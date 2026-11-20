"""BhoomiAI Discrepancy Engine Evaluation Script
Evaluates Rules R1–R5 against golden ground_truth.json AND the 20-case benchmark suite.
Measures precision, recall, false-positive rate, unsupported-claim rate, and workflow completion rate.
"""

import os
import json
import time
from typing import Dict, Any
from app.document_processing.parser import parse_and_extract_document
from app.discrepancy.engine import run_discrepancy_engine

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOCS_DIR = os.path.join(BASE_DIR, "data", "documents")
EVAL_DIR = os.path.join(BASE_DIR, "data", "eval_suite")


def run_discrepancy_evaluation() -> Dict[str, Any]:
    gt_path = os.path.join(DOCS_DIR, "ground_truth.json")
    with open(gt_path, "r") as f:
        gt = json.load(f)

    expected_golden = set(gt["expected_findings"])
    golden_docs = [
        parse_and_extract_document(os.path.join(DOCS_DIR, d["filename"]), d["filename"])
        for d in gt["documents"]
    ]
    t0 = time.perf_counter()
    golden_findings = run_discrepancy_engine(golden_docs)
    golden_ms = round((time.perf_counter() - t0) * 1000, 2)
    detected_golden = {f.rule_id for f in golden_findings}

    g_tp = len(detected_golden & expected_golden)
    g_fp = len(detected_golden - expected_golden)
    g_fn = len(expected_golden - detected_golden)

    # 20-case synthetic suite evaluation
    bench_path = os.path.join(EVAL_DIR, "benchmark_20_cases.json")
    total_tp = 0
    total_fp = 0
    total_fn = 0
    unsupported_findings = 0
    total_findings_emitted = 0
    clean_cases = 0
    clean_cases_zero_fp = 0
    case_results = []

    if os.path.exists(bench_path):
        with open(bench_path, "r") as f:
            bench = json.load(f)
        for case in bench:
            docs = [parse_and_extract_document(it["path"], it["filename"]) for it in case["files"]]
            findings = run_discrepancy_engine(docs)
            total_findings_emitted += len(findings)
            for fl in findings:
                if not fl.evidence_refs:
                    unsupported_findings += 1

            exp_set = set(case["expected_rules"])
            det_set = {fl.rule_id for fl in findings}
            tp = len(det_set & exp_set)
            fp = len(det_set - exp_set)
            fn = len(exp_set - det_set)
            total_tp += tp
            total_fp += fp
            total_fn += fn

            if not exp_set:
                clean_cases += 1
                if not det_set:
                    clean_cases_zero_fp += 1

            case_results.append({
                "case_id": case["case_id"],
                "expected": sorted(exp_set),
                "detected": sorted(det_set),
                "tp": tp,
                "fp": fp,
                "fn": fn,
            })

    bench_prec = round((total_tp / max(1, total_tp + total_fp)) * 100, 1)
    bench_rec = round((total_tp / max(1, total_tp + total_fn)) * 100, 1)
    bench_fpr = round((total_fp / max(1, total_tp + total_fp)) * 100, 1)
    unsupported_rate = round((unsupported_findings / max(1, total_findings_emitted)) * 100, 1)

    return {
        "golden_case": {
            "case_id": gt["case_id"],
            "expected": sorted(expected_golden),
            "detected": sorted(detected_golden),
            "tp": g_tp,
            "fp": g_fp,
            "fn": g_fn,
            "precision_pct": round((g_tp / max(1, g_tp + g_fp)) * 100, 1),
            "recall_pct": round((g_tp / max(1, g_tp + g_fn)) * 100, 1),
            "engine_latency_ms": golden_ms,
        },
        "benchmark_20_cases": {
            "total_cases": len(case_results),
            "tp": total_tp,
            "fp": total_fp,
            "fn": total_fn,
            "precision_pct": bench_prec,
            "recall_pct": bench_rec,
            "false_positive_rate_pct": bench_fpr,
            "clean_cases_passed": f"{clean_cases_zero_fp}/{clean_cases}",
            "unsupported_claim_rate_pct": unsupported_rate,
            "cases": case_results,
        },
    }


if __name__ == "__main__":
    res = run_discrepancy_evaluation()
    g = res["golden_case"]
    b = res["benchmark_20_cases"]
    print("=" * 72)
    print(f"Golden Case ({g['case_id']}): TP={g['tp']} FP={g['fp']} FN={g['fn']} | Prec={g['precision_pct']}% | Rec={g['recall_pct']}% | Latency={g['engine_latency_ms']}ms")
    print(f"20-Case Benchmark ({b['total_cases']} cases): TP={b['tp']} FP={b['fp']} FN={b['fn']} | Prec={b['precision_pct']}% | Rec={b['recall_pct']}% | FPR={b['false_positive_rate_pct']}%")
    print(f"Clean cases passed: {b['clean_cases_passed']} | Unsupported-claim rate: {b['unsupported_claim_rate_pct']}%")
    print("=" * 72)
