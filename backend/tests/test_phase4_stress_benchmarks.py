"""Phase 4 Verification Tests:
- Degraded-scan OpenCV + Tesseract OCR stress benchmark
- Kannada & cross-lingual name-variant benchmark + Winkler calibration check
- Adversarial prompt-injection, Unsupported-Claim Verifier & Legal RAG abstention stress benchmark
- Live API endpoint GET /api/evaluation/stress
"""

from fastapi.testclient import TestClient

from app.main import app
from scripts.evaluate_stress_benchmarks import (
    run_adversarial_verifier_benchmark,
    run_degraded_scan_benchmark,
    run_name_variant_benchmark,
)

client = TestClient(app)


def test_degraded_scan_ocr_stress_benchmark():
    res = run_degraded_scan_benchmark()
    by_id = {row["scenario"]: row for row in res["scenarios"]}

    for required_ocr_id in (
        "clean_scan_0deg",
        "mild_skew_grain",
        "moderate_skew_noise",
        "low_contrast_faded",
        "image_only_scanned_pdf",
    ):
        row = by_id[required_ocr_id]
        assert row["status"] == "extracted", required_ocr_id
        assert row["doc_type"] == "RTC", required_ocr_id
        assert row["survey_matched"] is True, required_ocr_id
        assert row["extent_matched"] is True, required_ocr_id
        assert row["bbox_present"] is True, required_ocr_id

    assert by_id["ultra_low_res_120x90"]["status"] == "needs_reupload"
    assert by_id["blank_white_pdf"]["status"] == "needs_reupload"
    assert by_id["blurred_camera_scan"]["passed"] is True


def test_kannada_name_variant_stress_benchmark():
    res = run_name_variant_benchmark()
    assert res["false_merge_rate_pct"] == 0.0
    assert res["bucket_accuracy_pct"] == 100.0
    assert res["entity_cluster_check_passed"] is True


def test_adversarial_and_verifier_stress_benchmark():
    res = run_adversarial_verifier_benchmark()
    assert res["prompt_injection_quarantined"] is True
    assert res["injection_rule_r5_still_detected"] is True
    assert res["verifier_block_rate_pct"] == 100.0
    assert res["legal_curated_cited"] == "3/3"
    assert res["legal_out_of_corpus_abstained"] == "3/3"
    assert res["all_passed"] is True


def test_stress_evaluation_api_endpoint():
    r = client.get("/api/evaluation/stress")
    assert r.status_code == 200
    data = r.json()
    assert "degraded_scans" in data
    assert "name_variants" in data
    assert "adversarial_verifier" in data
    assert data["name_variants"]["bucket_accuracy_pct"] == 100.0
    assert data["adversarial_verifier"]["all_passed"] is True
