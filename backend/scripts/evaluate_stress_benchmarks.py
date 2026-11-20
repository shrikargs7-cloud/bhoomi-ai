"""BhoomiAI Phase 4 Stress-Test Benchmark Suite
Measures real system performance (zero fabricated metrics) across:
1. Degraded-scan OpenCV + Tesseract OCR robustness (skew, noise, low contrast, blur, image-only PDF, low-res/blank rejection)
2. Karnataka English + Kannada name-variant resolution & false-merge avoidance
3. Adversarial prompt injection, Unsupported-Claim Verifier gate & Legal RAG abstention
"""

import os
import tempfile
import time
from typing import Any, Dict, List

import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from app.core.normalization import match_names
from app.document_processing.parser import parse_and_extract_document
from app.models.schemas import (
    DiscrepancyFinding,
    DocumentItem,
    EvidenceRef,
    ExtractedField,
    OwnershipEvent,
)
from app.ownership.resolver import resolve_person_entities
from app.services.legal_rag import query_legal_reference
from app.workflows.verifier import verify_case_claims

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EVAL_DIR = os.path.join(BASE_DIR, "data", "eval_suite")


def _load_font(size: int = 24):
    for candidate in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if os.path.exists(candidate):
            try:
                return ImageFont.truetype(candidate, size=size)
            except Exception:
                pass
    return ImageFont.load_default(size=size)


def _render_synthetic_rtc_image(
    angle_deg: float = 0.0,
    noise_std: float = 0.0,
    contrast_factor: float = 1.0,
    blur_radius: float = 0.0,
) -> Image.Image:
    w, h = 1200, 900
    bg_val = 250 if contrast_factor == 1.0 else 215
    img = Image.new("RGB", (w, h), color=(bg_val, bg_val, bg_val))
    draw = ImageDraw.Draw(img)
    font = _load_font(24)

    lines = [
        "FORM NO. 16 - RECORD OF RIGHTS (RTC / PAHANI)",
        "Village: Ramanagara Rural   Taluk: Ramanagara   District: Ramanagara",
        "Survey No: 84/1   Hissa / Sub-Div: 1A   Khata No: 342",
        "Record Date: 12/04/2023",
        "Dry (Kushki) 1-35 (1 Acre 35 Guntas)",
        "COLUMN 9: OWNERS & EXTENTS   Mutation / Acq. Ref",
        "1 Sri Ramachandrappa S/o Kempanna 1-35 MR/2010-11/04",
        "COLUMN 11: LIABILITIES & ENCUMBRANCES",
        "Canara Bank Bidadi Branch Mortgage Charge Rs. 1,50,000",
    ]
    y = 70
    for ln in lines:
        draw.text((70, y), ln, fill=(18, 18, 18), font=font)
        y += 68

    if contrast_factor != 1.0:
        arr_c = np.array(img, dtype=np.float32)
        arr_c = bg_val - (bg_val - arr_c) * contrast_factor
        img = Image.fromarray(np.clip(arr_c, 0, 255).astype(np.uint8))

    if angle_deg != 0.0:
        img = img.rotate(angle_deg, resample=Image.BICUBIC, fillcolor=(bg_val, bg_val, bg_val))

    if blur_radius > 0.0:
        img = img.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    if noise_std > 0.0:
        arr = np.array(img, dtype=np.int16)
        rng = np.random.default_rng(108)
        noise = rng.normal(0.0, noise_std, size=arr.shape).astype(np.int16)
        img = Image.fromarray(np.clip(arr + noise, 0, 255).astype(np.uint8))

    return img


def run_degraded_scan_benchmark() -> Dict[str, Any]:
    """Benchmarks OpenCV preprocessing + Tesseract OCR across clean, skewed, noisy, faded, blurred & invalid inputs."""
    scenarios: List[Dict[str, Any]] = []

    with tempfile.TemporaryDirectory() as tmpdir:
        raster_specs = [
            {
                "id": "clean_scan_0deg",
                "desc": "Clean raster RTC PNG (0 deg skew, 0 noise)",
                "angle": 0.0,
                "noise": 0.0,
                "contrast": 1.0,
                "blur": 0.0,
                "core_ocr": True,
            },
            {
                "id": "mild_skew_grain",
                "desc": "Rotated -2.5 deg with light sensor noise (std=5)",
                "angle": -2.5,
                "noise": 5.0,
                "contrast": 1.0,
                "blur": 0.0,
                "core_ocr": True,
            },
            {
                "id": "moderate_skew_noise",
                "desc": "Rotated +4.5 deg with heavier grain (std=10)",
                "angle": 4.5,
                "noise": 10.0,
                "contrast": 1.0,
                "blur": 0.0,
                "core_ocr": True,
            },
            {
                "id": "low_contrast_faded",
                "desc": "Faded photocopy contrast (factor 0.45 around light gray 215)",
                "angle": 0.0,
                "noise": 2.0,
                "contrast": 0.45,
                "blur": 0.0,
                "core_ocr": True,
            },
            {
                "id": "blurred_camera_scan",
                "desc": "Gaussian defocus blur (radius 1.5)",
                "angle": -1.0,
                "noise": 0.0,
                "contrast": 1.0,
                "blur": 1.5,
                "core_ocr": False,
            },
        ]

        for spec in raster_specs:
            path = os.path.join(tmpdir, f"{spec['id']}.png")
            _render_synthetic_rtc_image(
                angle_deg=spec["angle"],
                noise_std=spec["noise"],
                contrast_factor=spec["contrast"],
                blur_radius=spec["blur"],
            ).save(path, format="PNG")

            t0 = time.perf_counter()
            doc = parse_and_extract_document(path, f"{spec['id']}.png", "image/png")
            ms = round((time.perf_counter() - t0) * 1000.0, 2)

            fmap = {f.field_name: f for f in doc.extracted_fields}
            sy_ok = fmap.get("survey_number") is not None and fmap["survey_number"].normalized_value == "84/1"
            ext_f = fmap.get("total_extent")
            ext_ok = ext_f is not None and abs(float(ext_f.normalized_value) - 1.875) <= 0.01
            bbox_ok = any(f.bounding_box is not None for f in doc.extracted_fields)

            passed = (
                doc.status == "extracted"
                and doc.doc_type == "RTC"
                and sy_ok
                and ext_ok
                if spec["core_ocr"]
                else doc.status in {"extracted", "needs_reupload"}
            )
            scenarios.append(
                {
                    "scenario": spec["id"],
                    "description": spec["desc"],
                    "status": doc.status,
                    "extraction_method": doc.extraction_method,
                    "doc_type": doc.doc_type,
                    "survey_matched": sy_ok,
                    "extent_matched": ext_ok,
                    "bbox_present": bbox_ok,
                    "ocr_quality_score": doc.ocr_quality_score,
                    "latency_ms": ms,
                    "passed": passed,
                }
            )

        # 6. Image-only scanned PDF (zero text layer)
        pdf_img_path = os.path.join(tmpdir, "scanned_pdf_src.png")
        pdf_path = os.path.join(tmpdir, "image_only_scanned.pdf")
        _render_synthetic_rtc_image(angle_deg=-2.0, noise_std=3.0).save(pdf_img_path, format="PNG")
        pdf = pymupdf.open()
        pg = pdf.new_page(width=842, height=632)
        pg.insert_image(pg.rect, filename=pdf_img_path)
        pdf.save(pdf_path)
        pdf.close()

        t0 = time.perf_counter()
        doc_pdf = parse_and_extract_document(pdf_path, "image_only_scanned.pdf", "application/pdf")
        ms = round((time.perf_counter() - t0) * 1000.0, 2)
        fmap_pdf = {f.field_name: f for f in doc_pdf.extracted_fields}
        sy_pdf_ok = fmap_pdf.get("survey_number") is not None and fmap_pdf["survey_number"].normalized_value == "84/1"
        ext_pdf_ok = (
            fmap_pdf.get("total_extent") is not None
            and abs(float(fmap_pdf["total_extent"].normalized_value) - 1.875) <= 0.01
        )
        scenarios.append(
            {
                "scenario": "image_only_scanned_pdf",
                "description": "Raster RTC rotated -2.0 deg embedded in PDF with zero vector text",
                "status": doc_pdf.status,
                "extraction_method": doc_pdf.extraction_method,
                "doc_type": doc_pdf.doc_type,
                "survey_matched": sy_pdf_ok,
                "extent_matched": ext_pdf_ok,
                "bbox_present": any(f.bounding_box is not None for f in doc_pdf.extracted_fields),
                "ocr_quality_score": doc_pdf.ocr_quality_score,
                "latency_ms": ms,
                "passed": doc_pdf.status == "extracted" and doc_pdf.doc_type == "RTC" and sy_pdf_ok and ext_pdf_ok,
            }
        )

        # 7. Ultra low-resolution image rejection (< 200x200)
        lowres_path = os.path.join(tmpdir, "ultra_low_res.png")
        Image.new("RGB", (120, 90), color=(210, 210, 210)).save(lowres_path, format="PNG")
        t0 = time.perf_counter()
        doc_low = parse_and_extract_document(lowres_path, "ultra_low_res.png", "image/png")
        ms = round((time.perf_counter() - t0) * 1000.0, 2)
        scenarios.append(
            {
                "scenario": "ultra_low_res_120x90",
                "description": "120x90px image rejected for re-upload",
                "status": doc_low.status,
                "extraction_method": doc_low.extraction_method,
                "doc_type": doc_low.doc_type,
                "survey_matched": False,
                "extent_matched": False,
                "bbox_present": False,
                "ocr_quality_score": doc_low.ocr_quality_score,
                "latency_ms": ms,
                "passed": doc_low.status == "needs_reupload",
            }
        )

        # 8. Blank white PDF rejection
        blank_path = os.path.join(tmpdir, "blank_white.pdf")
        bpdf = pymupdf.open()
        bpdf.new_page(width=595, height=842)
        bpdf.save(blank_path)
        bpdf.close()
        t0 = time.perf_counter()
        doc_blank = parse_and_extract_document(blank_path, "blank_white.pdf", "application/pdf")
        ms = round((time.perf_counter() - t0) * 1000.0, 2)
        scenarios.append(
            {
                "scenario": "blank_white_pdf",
                "description": "Empty white PDF flagged needs_reupload",
                "status": doc_blank.status,
                "extraction_method": doc_blank.extraction_method,
                "doc_type": doc_blank.doc_type,
                "survey_matched": False,
                "extent_matched": False,
                "bbox_present": False,
                "ocr_quality_score": doc_blank.ocr_quality_score,
                "latency_ms": ms,
                "passed": doc_blank.status == "needs_reupload",
            }
        )

    passed_count = sum(1 for s in scenarios if s["passed"])
    core_scenarios = [
        s
        for s in scenarios
        if s["scenario"]
        in {
            "clean_scan_0deg",
            "mild_skew_grain",
            "moderate_skew_noise",
            "low_contrast_faded",
            "image_only_scanned_pdf",
            "ultra_low_res_120x90",
            "blank_white_pdf",
        }
    ]
    return {
        "total_scenarios": len(scenarios),
        "passed_count": passed_count,
        "core_passed": f"{sum(1 for s in core_scenarios if s['passed'])}/{len(core_scenarios)}",
        "scenarios": scenarios,
    }


def run_name_variant_benchmark() -> Dict[str, Any]:
    """Benchmarks English + Kannada name transliteration, uncertain candidate flagging & false-merge rate."""
    test_pairs = [
        ("Sri Ramachandrappa", "Late Ramachandrappa", "match"),
        ("ರಾಮಚಂದ್ರಪ್ಪ", "Ramachandrappa", "match"),
        ("ಶ್ರೀ ರಾಮಚಂದ್ರಪ್ಪ", "Sri Ramachandrappa", "match"),
        ("ರಾಮಯ್ಯ", "Ramaiah", "match"),
        ("ಶ್ರೀಮತಿ ಸಾವಿತ್ರಮ್ಮ", "Smt. Savithramma", "match"),
        ("ವೆಂಕಟೇಶ್", "Venkatesh", "match"),
        ("ಮಂಜುನಾಥ್", "Manjunath", "match"),
        ("Ramayya", "Ramaiah", "uncertain"),
        ("Ramayya", "ರಾಮಯ್ಯ", "uncertain"),
        ("Kempaiah", "Kemparaju", "uncertain"),
        ("Subbaiah", "Subbanna", "uncertain"),
        ("Ramachandrappa", "Suresh Kumar", "distinct"),
        ("Ramaiah", "Muniyappa", "distinct"),
        ("Savithramma", "Lakshmi", "distinct"),
    ]

    results: List[Dict[str, Any]] = []
    false_merges = 0
    for a, b, expected_bucket in test_pairs:
        is_match, score, msg = match_names(a, b)
        if is_match:
            actual_bucket = "match"
        elif score >= 0.68:
            actual_bucket = "uncertain"
        else:
            actual_bucket = "distinct"

        if actual_bucket == "match" and expected_bucket != "match":
            false_merges += 1

        results.append(
            {
                "name_a": a,
                "name_b": b,
                "expected_bucket": expected_bucket,
                "actual_bucket": actual_bucket,
                "similarity_score": score,
                "status_message": msg,
                "passed": actual_bucket == expected_bucket,
            }
        )

    # End-to-end resolver cluster test: Ramaiah + ರಾಮಯ್ಯ merge; Ramayya uncertain; Suresh Kumar distinct
    synth_docs = [
        DocumentItem(
            id="doc-nv-1",
            filename="nv_rtc.pdf",
            doc_type="RTC",
            pages_count=1,
            file_size_kb=2,
            upload_timestamp="2026-11-19",
            file_hash="h1",
            status="extracted",
            extracted_fields=[
                ExtractedField(
                    field_name="recorded_owners",
                    label="Owners",
                    original_text="Ramaiah, ರಾಮಯ್ಯ, Ramayya, Suresh Kumar",
                    normalized_value=["Ramaiah", "ರಾಮಯ್ಯ", "Ramayya", "Suresh Kumar"],
                    confidence=0.95,
                    method="Test",
                    page=1,
                )
            ],
        )
    ]
    entities = resolve_person_entities(synth_docs)
    entity_summary = [
        {
            "canonical_name": e.canonical_name,
            "aliases": e.aliases,
            "resolution_status": e.resolution_status,
            "similarity_score": e.similarity_score,
        }
        for e in entities
    ]

    ramayya_ent = next((e for e in entities if e.canonical_name == "Ramayya"), None)
    ramaiah_ent = next((e for e in entities if e.canonical_name == "Ramaiah"), None)
    suresh_ent = next((e for e in entities if e.canonical_name == "Suresh Kumar"), None)
    cluster_passed = (
        len(entities) == 3
        and ramaiah_ent is not None
        and "ರಾಮಯ್ಯ" in ramaiah_ent.aliases
        and ramaiah_ent.resolution_status == "confirmed"
        and ramayya_ent is not None
        and ramayya_ent.resolution_status == "uncertain"
        and suresh_ent is not None
    )

    correct = sum(1 for r in results if r["passed"])
    return {
        "total_pairs": len(results),
        "pairs_passed": correct,
        "bucket_accuracy_pct": round((correct / len(results)) * 100.0, 1),
        "false_merges": false_merges,
        "false_merge_rate_pct": round((false_merges / len(results)) * 100.0, 1),
        "pairs": results,
        "entity_cluster_check_passed": cluster_passed,
        "resolved_entities": entity_summary,
    }


def run_adversarial_verifier_benchmark() -> Dict[str, Any]:
    """Benchmarks prompt-injection quarantine, unsupported-claim blocking & legal RAG abstention."""
    inj_path = os.path.join(EVAL_DIR, "Adversarial_Injection_RTC.pdf")
    inj_doc = parse_and_extract_document(inj_path, "Adversarial_Injection_RTC.pdf", "application/pdf")
    from app.discrepancy.engine import run_discrepancy_engine

    inj_findings = run_discrepancy_engine([inj_doc])
    injection_quarantined = inj_doc.injection_warning is not None and any(
        f.rule_id == "R5" for f in inj_findings
    )

    # Verifier block test: 5 invalid discrepancy findings + 1 out-of-bounds ownership event
    anchor_f = inj_doc.extracted_fields[0]
    ev_ok = EvidenceRef(
        document_id=inj_doc.id,
        document_name=inj_doc.filename,
        page=1,
        original_text=anchor_f.original_text,
    )
    bad_findings = [
        DiscrepancyFinding(
            id="ADV-NO-REF",
            rule_id="R1",
            rule_name="No refs",
            severity="Medium",
            explanation="Requires verification.",
            suggested_next_step="Check.",
            fields_compared={},
            evidence_refs=[],
        ),
        DiscrepancyFinding(
            id="ADV-FAKE-DOC",
            rule_id="R2",
            rule_name="Fake doc",
            severity="Medium",
            explanation="Requires verification.",
            suggested_next_step="Check.",
            fields_compared={},
            evidence_refs=[EvidenceRef(document_id="doc-missing", document_name="missing.pdf", page=1, original_text="x")],
        ),
        DiscrepancyFinding(
            id="ADV-BAD-PAGE",
            rule_id="R2",
            rule_name="Bad page",
            severity="Medium",
            explanation="Requires verification.",
            suggested_next_step="Check.",
            fields_compared={},
            evidence_refs=[EvidenceRef(document_id=inj_doc.id, document_name=inj_doc.filename, page=99, original_text=ev_ok.original_text)],
        ),
        DiscrepancyFinding(
            id="ADV-UNGROUNDED",
            rule_id="R5",
            rule_name="Ungrounded",
            severity="Medium",
            explanation="Requires verification.",
            suggested_next_step="Check.",
            fields_compared={},
            evidence_refs=[EvidenceRef(document_id=inj_doc.id, document_name=inj_doc.filename, page=1, original_text="Nonexistent synthetic bank charge XYZ")],
        ),
        DiscrepancyFinding(
            id="ADV-ACCUSATION",
            rule_id="R1",
            rule_name="Fraud phrase",
            severity="High",
            explanation="Record shows fraudulent criminal forgery.",
            suggested_next_step="Check.",
            fields_compared={},
            evidence_refs=[ev_ok],
        ),
    ]
    bad_event = OwnershipEvent(
        id="ADV-EVT-PAGE",
        event_type="sale",
        description="Invalid page citation.",
        parties_involved=["Test"],
        evidence=EvidenceRef(document_id=inj_doc.id, document_name=inj_doc.filename, page=88, original_text=ev_ok.original_text),
    )

    v_rep = verify_case_claims([inj_doc], bad_findings + inj_findings, [bad_event])
    claims_blocked_ok = (
        v_rep.total_blocked == 6
        and len(v_rep.verified_discrepancies) == len(inj_findings)
        and len(v_rep.verified_events) == 0
    )

    # Legal RAG: 3 curated queries + 3 out-of-corpus queries
    curated_qs = [
        "How to handle deceased owner Pauti Khata mutation in RTC?",
        "Extent mismatch 11E Phodi survey correction",
        "Mortgage charge discharge NOC in Column 11",
    ]
    abstention_qs = [
        "Space mining asteroid ownership law",
        "Maritime admiralty vessel salvage lien",
        "Cryptocurrency securities staking tax in Delaware",
    ]
    curated_ok = sum(1 for q in curated_qs if not query_legal_reference(q).abstained)
    abstained_ok = sum(1 for q in abstention_qs if query_legal_reference(q).abstained)

    return {
        "prompt_injection_quarantined": injection_quarantined,
        "injection_rule_r5_still_detected": any(f.rule_id == "R5" for f in inj_findings),
        "verifier_blocked_count": v_rep.total_blocked,
        "verifier_expected_blocked": 6,
        "verifier_block_rate_pct": 100.0 if claims_blocked_ok else round((v_rep.total_blocked / 6) * 100.0, 1),
        "legal_curated_cited": f"{curated_ok}/{len(curated_qs)}",
        "legal_out_of_corpus_abstained": f"{abstained_ok}/{len(abstention_qs)}",
        "all_passed": injection_quarantined and claims_blocked_ok and curated_ok == 3 and abstained_ok == 3,
    }


def run_all_stress_benchmarks() -> Dict[str, Any]:
    return {
        "degraded_scans": run_degraded_scan_benchmark(),
        "name_variants": run_name_variant_benchmark(),
        "adversarial_verifier": run_adversarial_verifier_benchmark(),
    }


if __name__ == "__main__":
    out = run_all_stress_benchmarks()
    ds = out["degraded_scans"]
    nv = out["name_variants"]
    av = out["adversarial_verifier"]

    print("=" * 84)
    print(f"Suite A: Degraded-Scan OCR Benchmark ({ds['passed_count']}/{ds['total_scenarios']} passed; core {ds['core_passed']})")
    print("=" * 84)
    for row in ds["scenarios"]:
        print(
            f"{row['scenario']:<24} | status={row['status']:<14} | sy={row['survey_matched']} | "
            f"ext={row['extent_matched']} | conf={row['ocr_quality_score']} | {row['latency_ms']}ms | passed={row['passed']}"
        )

    print("\n" + "=" * 84)
    print(
        f"Suite B: Kannada & Cross-Lingual Name Variants ({nv['pairs_passed']}/{nv['total_pairs']} | "
        f"Accuracy={nv['bucket_accuracy_pct']}% | False Merges={nv['false_merges']} | Cluster={nv['entity_cluster_check_passed']})"
    )
    print("=" * 84)
    for p in nv["pairs"]:
        print(
            f"{p['name_a']} <-> {p['name_b']} | exp={p['expected_bucket']:<9} | "
            f"got={p['actual_bucket']:<9} ({p['similarity_score']}) | passed={p['passed']}"
        )

    print("\n" + "=" * 84)
    print(
        f"Suite C: Adversarial & Verifier Gate | injection_quarantined={av['prompt_injection_quarantined']} | "
        f"blocked={av['verifier_blocked_count']}/{av['verifier_expected_blocked']} ({av['verifier_block_rate_pct']}%) | "
        f"legal={av['legal_curated_cited']} cited, {av['legal_out_of_corpus_abstained']} abstained | "
        f"all_passed={av['all_passed']}"
    )
    print("=" * 84)
