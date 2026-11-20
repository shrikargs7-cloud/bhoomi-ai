"""Phase 3 Verification Tests:
- OpenCV deskew/denoise + Tesseract OCR ladder on rotated scan images & image-only PDFs
- Blank PDF re-upload flagging
- Kannada-first classification, normalization, extraction & discrepancy rules
- Compiled LangGraph StateGraph routing, node retries & error recovery
- Deterministic Unsupported-Claim Verifier gate (V1-V4) & Legal RAG verification
"""

import os
import tempfile
from typing import Any, Dict

import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.discrepancy.engine import run_discrepancy_engine
from app.document_processing.ocr import preprocess_scan_image
from app.document_processing.parser import parse_and_extract_document
from app.models.schemas import (
    DiscrepancyFinding,
    DocumentItem,
    EvidenceRef,
    LegalQueryResponse,
    OwnershipEvent,
)
from app.services.legal_rag import CURATED_STATUTORY_CORPUS
from app.workflows.pipeline import execute_case_pipeline, get_compiled_workflow_graph
from app.workflows.verifier import verify_case_claims, verify_legal_response


def _load_ocr_test_font(size: int = 24):
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


def _render_rotated_rtc_png(path: str, angle_deg: float = -2.2) -> None:
    """Renders a realistic 1200x900 synthetic RTC scan PNG with slight skew & light sensor noise."""
    w, h = 1200, 900
    img = Image.new("RGB", (w, h), color=(250, 249, 244))
    draw = ImageDraw.Draw(img)
    font = _load_ocr_test_font(24)

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

    rotated = img.rotate(angle_deg, resample=Image.BICUBIC, fillcolor=(250, 249, 244))
    arr = np.array(rotated, dtype=np.int16)
    rng = np.random.default_rng(42)
    noise = rng.normal(0, 4.0, size=arr.shape).astype(np.int16)
    noisy = np.clip(arr + noise, 0, 255).astype(np.uint8)
    Image.fromarray(noisy).save(path, format="PNG")


def _write_kannada_pdf(path: str, lines: list[str]) -> None:
    kn_font_path = "/System/Library/Fonts/Supplemental/Kannada Sangam MN.ttc"
    assert os.path.exists(kn_font_path), "Kannada Sangam MN.ttc required for digital Kannada test PDF"
    if "KannadaTestFont" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("KannadaTestFont", kn_font_path, subfontIndex=0))

    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
    style = ParagraphStyle("KnBody", fontName="KannadaTestFont", fontSize=11, leading=16)
    story = []
    for ln in lines:
        story.append(Paragraph(ln, style))
        story.append(Spacer(1, 6))
    doc.build(story)


def test_opencv_preprocess_and_tesseract_ocr_on_rotated_scan_image():
    with tempfile.TemporaryDirectory() as tmpdir:
        png_path = os.path.join(tmpdir, "scanned_rtc_tilted.png")
        _render_rotated_rtc_png(png_path, angle_deg=-2.2)

        with Image.open(png_path) as raw_img:
            processed_img, metrics = preprocess_scan_image(raw_img)
            assert processed_img.size[0] >= 1200
            assert not metrics["is_blank"]
            assert abs(metrics["deskew_angle_deg"]) >= 0.5

        doc = parse_and_extract_document(png_path, "scanned_rtc_tilted.png", "image/png")
        assert doc.status == "extracted"
        assert "OpenCV + Tesseract OCR" in doc.extraction_method
        assert doc.doc_type == "RTC"

        fields = {f.field_name: f for f in doc.extracted_fields}
        assert "survey_number" in fields
        assert fields["survey_number"].normalized_value == "84/1"
        assert "total_extent" in fields
        assert abs(float(fields["total_extent"].normalized_value) - 1.875) <= 0.01

        bbox = fields["survey_number"].bounding_box
        assert bbox is not None
        assert 0.0 <= bbox["x"] <= 100.0
        assert 0.0 <= bbox["y"] <= 100.0
        assert bbox["width"] > 0.0 and bbox["height"] > 0.0


def test_scanned_image_only_pdf_uses_ocr_fallback():
    with tempfile.TemporaryDirectory() as tmpdir:
        png_path = os.path.join(tmpdir, "page1.png")
        pdf_path = os.path.join(tmpdir, "image_only_rtc.pdf")
        _render_rotated_rtc_png(png_path, angle_deg=-1.8)

        pdf = pymupdf.open()
        page = pdf.new_page(width=842, height=632)
        page.insert_image(page.rect, filename=png_path)
        pdf.save(pdf_path)
        pdf.close()

        doc = parse_and_extract_document(pdf_path, "image_only_rtc.pdf", "application/pdf")
        assert doc.status == "extracted"
        assert "OpenCV + Tesseract OCR" in doc.extraction_method
        assert doc.doc_type == "RTC"

        fields = {f.field_name: f for f in doc.extracted_fields}
        assert fields["survey_number"].normalized_value == "84/1"
        assert abs(float(fields["total_extent"].normalized_value) - 1.875) <= 0.01


def test_blank_pdf_flags_needs_reupload():
    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path = os.path.join(tmpdir, "blank_scan.pdf")
        pdf = pymupdf.open()
        pdf.new_page(width=595, height=842)
        pdf.save(pdf_path)
        pdf.close()

        doc = parse_and_extract_document(pdf_path, "blank_scan.pdf", "application/pdf")
        assert doc.status == "needs_reupload"
        assert doc.quality_warning is not None


def test_kannada_first_extractors_and_discrepancies():
    with tempfile.TemporaryDirectory() as tmpdir:
        rtc_path = os.path.join(tmpdir, "doc_a.pdf")
        death_path = os.path.join(tmpdir, "doc_b.pdf")

        _write_kannada_pdf(
            rtc_path,
            [
                "ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಪಹಣಿ / ಹಕ್ಕು ಮತ್ತು ಬೆಳೆ ದಾಖಲೆ (ನಮೂನೆ ೧೬)",
                "ಜಿಲ್ಲೆ: ರಾಮನಗರ ತಾಲೂಕು: ರಾಮನಗರ ಗ್ರಾಮ: ಬನ್ನಿಕುಪ್ಪೆ",
                "ಸರ್ವೆ ನಂ: ೮೪/೧ ಹಿಸ್ಸಾ: ೧ಎ ಖಾತಾ ನಂ: ೩೪೨ ದಾಖಲೆ ದಿನಾಂಕ: ೧೨/೦೪/೨೦೨೩",
                "ಒಟ್ಟು ವಿಸ್ತೀರ್ಣ: ೧-೩೫ (೧ ಎಕರೆ ೩೫ ಗುಂಟೆ)",
                "ಕಾಲಂ ೯ - ಖಾತೆದಾರರ ಹೆಸರು: ೧ ಶ್ರೀ ರಾಮಚಂದ್ರಪ್ಪ ಬಿನ್ ಕೆಂಪಣ್ಣ",
                "ಕಾಲಂ ೧೧ - ಬಾಧ್ಯತೆಗಳು: ಕೆನರಾ ಬ್ಯಾಂಕ್ ಸಾಲ ರೂ ೧,೫೦,೦೦೦ ಅಡಮಾನ",
            ],
        )
        _write_kannada_pdf(
            death_path,
            [
                "ಮರಣ ಪ್ರಮಾಣ ಪತ್ರ",
                "ನೋಂದಣಿ ಸಂಖ್ಯೆ: DTH-೨೦೧೬-೪೪೧",
                "ಮೃತರ ಹೆಸರು: ಶ್ರೀ ರಾಮಚಂದ್ರಪ್ಪ",
                "ಮರಣ ದಿನಾಂಕ: ೧೪/೦೩/೨೦೧೬",
                "ಮರಣ ಸ್ಥಳ: ರಾಮನಗರ",
            ],
        )

        # Intentionally pass neutral filenames so classification relies solely on Kannada text
        rtc_doc = parse_and_extract_document(rtc_path, "upload_01.pdf", "application/pdf")
        death_doc = parse_and_extract_document(death_path, "upload_02.pdf", "application/pdf")

        assert rtc_doc.doc_type == "RTC"
        assert rtc_doc.language == "Kannada"
        rtc_fields = {f.field_name: f for f in rtc_doc.extracted_fields}
        assert rtc_fields["survey_number"].normalized_value == "84/1"
        assert "೮೪/೧" in rtc_fields["survey_number"].original_text
        assert abs(float(rtc_fields["total_extent"].normalized_value) - 1.875) <= 0.01
        assert rtc_fields["record_date"].normalized_value == "12/04/2023"
        assert "ರಾಮಚಂದ್ರಪ್ಪ" in rtc_fields["recorded_owners"].original_text

        assert death_doc.doc_type == "DEATH_CERTIFICATE"
        death_fields = {f.field_name: f for f in death_doc.extracted_fields}
        assert death_fields["date_of_death"].normalized_value == "14/03/2016"
        assert "ರಾಮಚಂದ್ರಪ್ಪ" in death_fields["deceased_name"].original_text

        findings = run_discrepancy_engine([rtc_doc, death_doc])
        rule_ids = {f.rule_id for f in findings}
        assert "R1" in rule_ids
        assert "R5" in rule_ids


def _load_golden_docs():
    docs_dir = "backend/data/documents"
    return [
        parse_and_extract_document(os.path.join(docs_dir, fn), fn)
        for fn in (
            "RTC_Form16_2023.pdf",
            "Death_Certificate_Ramachandrappa.pdf",
            "Partition_Deed_2011_Registered.pdf",
            "Mutation_Extract_MR_2018_09.pdf",
            "Survey_Sketch_Tippani_84_1.pdf",
        )
    ]


def test_compiled_langgraph_stategraph_and_conditional_branches():
    compiled = get_compiled_workflow_graph()
    assert hasattr(compiled, "invoke")

    golden_docs = _load_golden_docs()
    state, readiness, summary = execute_case_pipeline(
        "LANGGRAPH-GOLDEN",
        golden_docs,
        has_geojson=False,
        verified_comparables_count=0,
    )
    assert len(state.trace) == 9
    nodes = [t.node for t in state.trace]
    assert "UNSUPPORTED_CLAIM_VERIFIER" in nodes
    assert state.rejected_claims == []
    assert len(readiness) == 6

    gis_step = next(t for t in state.trace if t.node == "GIS_MODULE")
    val_step = next(t for t in state.trace if t.node == "VALUATION_MODULE")
    assert gis_step.status == "skipped"
    assert gis_step.conditional_branch == "skip_gis_no_geometry"
    assert val_step.status == "skipped"
    assert val_step.conditional_branch == "abstain_insufficient_comparables"

    # When GeoJSON & >=3 comparables are supplied, conditional edges run both modules
    state2, _, _ = execute_case_pipeline(
        "LANGGRAPH-FULL",
        golden_docs,
        has_geojson=True,
        verified_comparables_count=3,
    )
    gis_step2 = next(t for t in state2.trace if t.node == "GIS_MODULE")
    val_step2 = next(t for t in state2.trace if t.node == "VALUATION_MODULE")
    assert gis_step2.status == "completed"
    assert gis_step2.conditional_branch == "run_gis_qa"
    assert val_step2.status == "completed"
    assert val_step2.conditional_branch == "compute_baseline"

    # Zero valid docs takes the conditional no_valid_docs branch
    bad_doc = DocumentItem(
        id="doc-bad",
        filename="bad.png",
        doc_type="OTHER",
        pages_count=1,
        file_size_kb=2,
        upload_timestamp="2026-11-19",
        file_hash="abc",
        status="needs_reupload",
    )
    state_empty, _, _ = execute_case_pipeline("LANGGRAPH-EMPTY", [bad_doc])
    empty_nodes = [t.node for t in state_empty.trace]
    assert empty_nodes == [
        "LOAD_CASE",
        "VALIDATE_DOCS",
        "UNSUPPORTED_CLAIM_VERIFIER",
        "HUMAN_REVIEW_CHECKPOINT",
    ]


def test_langgraph_node_retry_and_error_recovery():
    golden_docs = _load_golden_docs()

    # Case A: Transient failure recovers cleanly on retry 1
    calls = {"count": 0}

    def flaky_discrepancy(s: Dict[str, Any]) -> Dict[str, Any]:
        calls["count"] += 1
        if calls["count"] == 1:
            raise RuntimeError("Transient discrepancy lock timeout")
        findings = run_discrepancy_engine(s.get("documents") or [])
        return {"discrepancies": findings}

    state_rec, _, summary_rec = execute_case_pipeline(
        "LANGGRAPH-RETRY",
        golden_docs,
        node_overrides={"DISCREPANCY_ENGINE": flaky_discrepancy},
    )
    assert calls["count"] == 2
    assert state_rec.errors == []
    assert state_rec.retry_counts.get("DISCREPANCY_ENGINE") == 1
    disc_step = next(t for t in state_rec.trace if t.node == "DISCREPANCY_ENGINE")
    assert "recovered after 1 retry" in disc_step.summary
    assert summary_rec.status == "awaiting_human_review"

    # Case B: Exhausted retries record structured error without crashing workflow
    def always_fails(_s: Dict[str, Any]) -> Dict[str, Any]:
        raise RuntimeError("Persistent lineage backend failure")

    state_err, _, summary_err = execute_case_pipeline(
        "LANGGRAPH-ERR",
        golden_docs,
        node_overrides={"OWNERSHIP_LINEAGE": always_fails},
    )
    assert len(state_err.errors) == 1
    assert state_err.errors[0]["node"] == "OWNERSHIP_LINEAGE"
    assert state_err.errors[0]["attempts"] == 3
    err_step = next(t for t in state_err.trace if t.node == "OWNERSHIP_LINEAGE")
    assert err_step.status == "error"
    assert err_step.conditional_branch == "node_error_fallback"
    assert summary_err.status == "completed_with_errors"


def test_unsupported_claim_verifier_blocks_ungrounded_and_accusatory_claims():
    golden_docs = _load_golden_docs()
    state, _, _ = execute_case_pipeline("VERIFY-GOLDEN", golden_docs)
    baseline_report = verify_case_claims(golden_docs, state.discrepancies, state.ownership_events)
    assert baseline_report.passed is True
    assert baseline_report.total_blocked == 0
    assert baseline_report.unsupported_claim_rate_pct == 0.0

    rtc = golden_docs[0]
    ev_valid = EvidenceRef(
        document_id=rtc.id,
        document_name=rtc.filename,
        page=1,
        original_text=rtc.extracted_fields[0].original_text,
    )

    f_no_refs = DiscrepancyFinding(
        id="BAD-1",
        rule_id="R1",
        rule_name="Missing citations",
        severity="Medium",
        explanation="Requires verification.",
        suggested_next_step="Check docs.",
        fields_compared={},
        evidence_refs=[],
    )
    f_fake_doc = DiscrepancyFinding(
        id="BAD-2",
        rule_id="R2",
        rule_name="Fake doc",
        severity="Medium",
        explanation="Requires verification.",
        suggested_next_step="Check docs.",
        fields_compared={},
        evidence_refs=[EvidenceRef(document_id="doc-does-not-exist", document_name="x.pdf", page=1, original_text="x")],
    )
    f_bad_page = DiscrepancyFinding(
        id="BAD-3",
        rule_id="R2",
        rule_name="Bad page",
        severity="Medium",
        explanation="Requires verification.",
        suggested_next_step="Check docs.",
        fields_compared={},
        evidence_refs=[EvidenceRef(document_id=rtc.id, document_name=rtc.filename, page=99, original_text=ev_valid.original_text)],
    )
    f_ungrounded = DiscrepancyFinding(
        id="BAD-4",
        rule_id="R5",
        rule_name="Ungrounded quote",
        severity="Medium",
        explanation="Requires verification.",
        suggested_next_step="Check docs.",
        fields_compared={},
        evidence_refs=[EvidenceRef(document_id=rtc.id, document_name=rtc.filename, page=1, original_text="Fake ungrounded statement XYZ 999")],
    )
    f_accusation = DiscrepancyFinding(
        id="BAD-5",
        rule_id="R1",
        rule_name="Prohibited accusation",
        severity="High",
        explanation="This deed is fraudulent and forged by the seller.",
        suggested_next_step="Report.",
        fields_compared={},
        evidence_refs=[ev_valid],
    )
    ev_bad_page = OwnershipEvent(
        id="EVT-BAD",
        event_type="sale",
        description="Out-of-bounds citation event.",
        parties_involved=["Someone"],
        evidence=EvidenceRef(document_id=rtc.id, document_name=rtc.filename, page=99, original_text=ev_valid.original_text),
    )

    block_report = verify_case_claims(
        golden_docs,
        [state.discrepancies[0], f_no_refs, f_fake_doc, f_bad_page, f_ungrounded, f_accusation],
        [state.ownership_events[0], ev_bad_page],
    )
    assert block_report.passed is False
    assert [d.id for d in block_report.verified_discrepancies] == [state.discrepancies[0].id]
    assert {b["id"] for b in block_report.blocked_discrepancies} == {"BAD-1", "BAD-2", "BAD-3", "BAD-4", "BAD-5"}
    assert [e["id"] for e in block_report.blocked_events] == ["EVT-BAD"]
    assert block_report.total_blocked == 6

    fabricated_legal = LegalQueryResponse(
        abstained=False,
        explanation="Section 999 allows instant transfer.",
        jurisdiction="Karnataka",
        source="Fabricated Land Act 2099",
        section_or_page="Section 999",
        retrieval_date="2026-11-19",
        limitations="None",
        referral="None",
        matched_sources=[],
    )
    verified_legal = verify_legal_response(fabricated_legal, CURATED_STATUTORY_CORPUS)
    assert verified_legal.abstained is True
    assert verified_legal.source is None
