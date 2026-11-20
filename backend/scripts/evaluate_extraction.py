"""BhoomiAI Extraction Evaluation Script
Measures real field-level Precision & Recall against ground_truth.json
and across all 20 synthetic cases in benchmark_20_cases.json.
Per CLAUDE.md: Never report a number you did not measure.
"""

import os
import json
from typing import Dict, Any
from app.document_processing.parser import parse_and_extract_document
from app.core.normalization import match_names

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOCS_DIR = os.path.join(BASE_DIR, "data", "documents")
EVAL_DIR = os.path.join(BASE_DIR, "data", "eval_suite")


def _values_match(expected: Any, actual: Any) -> bool:
    if actual is None:
        return False
    if isinstance(expected, float):
        return isinstance(actual, (int, float)) and abs(float(expected) - float(actual)) <= 0.01
    if isinstance(expected, list):
        act_list = actual if isinstance(actual, list) else [str(actual)]
        for exp_item in expected:
            if not any(match_names(str(exp_item), str(a))[0] or str(exp_item).lower() in str(a).lower() for a in act_list):
                return False
        return True
    exp_s = str(expected).strip().lower()
    act_s = str(actual).strip().lower()
    return exp_s == act_s or exp_s in act_s or match_names(exp_s, act_s)[0]


def run_extraction_evaluation() -> Dict[str, Any]:
    gt_path = os.path.join(DOCS_DIR, "ground_truth.json")
    with open(gt_path, "r") as f:
        gt = json.load(f)

    by_doc = []
    by_type: Dict[str, Dict[str, int]] = {}
    by_lang: Dict[str, Dict[str, int]] = {}

    total_expected = 0
    total_extracted = 0
    total_tp = 0

    for doc_meta in gt["documents"]:
        fn = doc_meta["filename"]
        dtype = doc_meta["type"]
        lang = doc_meta.get("language", "English")
        fp = os.path.join(DOCS_DIR, fn)
        parsed = parse_and_extract_document(fp, fn)

        expected_map = doc_meta.get("expected_fields", {})
        extracted_map = {f.field_name: f.normalized_value for f in parsed.extracted_fields}

        tp = 0
        for k, exp_v in expected_map.items():
            if k in extracted_map and _values_match(exp_v, extracted_map[k]):
                tp += 1

        exp_cnt = len(expected_map)
        ext_cnt = sum(1 for k in extracted_map if k in expected_map)
        total_expected += exp_cnt
        total_extracted += ext_cnt
        total_tp += tp

        by_type.setdefault(dtype, {"tp": 0, "expected": 0, "extracted": 0})
        by_type[dtype]["tp"] += tp
        by_type[dtype]["expected"] += exp_cnt
        by_type[dtype]["extracted"] += ext_cnt

        lang_key = "Kannada / Bilingual" if "Kannada" in lang else "English"
        by_lang.setdefault(lang_key, {"tp": 0, "expected": 0, "extracted": 0})
        by_lang[lang_key]["tp"] += tp
        by_lang[lang_key]["expected"] += exp_cnt
        by_lang[lang_key]["extracted"] += ext_cnt

        prec = round((tp / ext_cnt) * 100, 1) if ext_cnt else 0.0
        rec = round((tp / exp_cnt) * 100, 1) if exp_cnt else 0.0
        by_doc.append({
            "filename": fn,
            "doc_type": dtype,
            "language": lang,
            "expected_fields": exp_cnt,
            "matched_fields": tp,
            "precision_pct": prec,
            "recall_pct": rec,
            "has_bbox_rate_pct": round(
                (sum(1 for f in parsed.extracted_fields if f.bounding_box) / max(1, len(parsed.extracted_fields))) * 100, 1
            ),
        })

    # Also evaluate extraction across all 20 benchmark cases
    bench_path = os.path.join(EVAL_DIR, "benchmark_20_cases.json")
    bench_docs_total = 0
    bench_docs_classified_ok = 0
    if os.path.exists(bench_path):
        with open(bench_path, "r") as f:
            bench = json.load(f)
        for case in bench:
            for item in case["files"]:
                bench_docs_total += 1
                p = parse_and_extract_document(item["path"], item["filename"])
                if p.doc_type == item["type"] and len(p.extracted_fields) > 0:
                    bench_docs_classified_ok += 1

    overall_prec = round((total_tp / total_extracted) * 100, 1) if total_extracted else 0.0
    overall_rec = round((total_tp / total_expected) * 100, 1) if total_expected else 0.0

    return {
        "golden_case_id": gt["case_id"],
        "overall_precision_pct": overall_prec,
        "overall_recall_pct": overall_rec,
        "total_expected_fields": total_expected,
        "total_matched_fields": total_tp,
        "by_document": by_doc,
        "by_doc_type": {
            k: {
                "precision_pct": round((v["tp"] / max(1, v["extracted"])) * 100, 1),
                "recall_pct": round((v["tp"] / max(1, v["expected"])) * 100, 1),
            }
            for k, v in by_type.items()
        },
        "by_language": {
            k: {
                "precision_pct": round((v["tp"] / max(1, v["extracted"])) * 100, 1),
                "recall_pct": round((v["tp"] / max(1, v["expected"])) * 100, 1),
            }
            for k, v in by_lang.items()
        },
        "benchmark_20_cases_docs_evaluated": bench_docs_total,
        "benchmark_20_cases_classification_accuracy_pct": round(
            (bench_docs_classified_ok / max(1, bench_docs_total)) * 100, 1
        ),
    }


if __name__ == "__main__":
    res = run_extraction_evaluation()
    print("=" * 84)
    print(f"BhoomiAI Extraction Evaluation ({res['golden_case_id']})")
    print("=" * 84)
    for row in res["by_document"]:
        print(
            f"{row['filename']:<38} | {row['doc_type']:<18} | {row['matched_fields']}/{row['expected_fields']} | "
            f"Prec: {row['precision_pct']}% | Rec: {row['recall_pct']}% | BBox: {row['has_bbox_rate_pct']}%"
        )
    print("-" * 84)
    print(f"Golden Field Precision: {res['overall_precision_pct']}% | Recall: {res['overall_recall_pct']}%")
    print(f"20-Case Benchmark Docs Classified & Extracted: {res['benchmark_20_cases_docs_evaluated']} ({res['benchmark_20_cases_classification_accuracy_pct']}%)")
