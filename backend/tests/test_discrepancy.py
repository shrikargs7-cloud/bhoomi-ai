import os
import glob
from app.document_processing.parser import parse_and_extract_document
from app.discrepancy.engine import run_discrepancy_engine

DOCS_DIR = "backend/data/documents"
CLEAN_DIR = "backend/data/documents/clean_case"
EVAL_DIR = "backend/data/eval_suite"


def test_golden_case_discrepancies():
    docs = [
        parse_and_extract_document(os.path.join(DOCS_DIR, fn), fn)
        for fn in (
            "RTC_Form16_2023.pdf",
            "Death_Certificate_Ramachandrappa.pdf",
            "Partition_Deed_2011_Registered.pdf",
            "Mutation_Extract_MR_2018_09.pdf",
            "Survey_Sketch_Tippani_84_1.pdf",
        )
    ]
    findings = run_discrepancy_engine(docs)
    rule_ids = {f.rule_id for f in findings}
    assert rule_ids == {"R1", "R2", "R3", "R5"}

    # Every finding must cite real documentary evidence
    for f in findings:
        assert len(f.evidence_refs) > 0
        for ev in f.evidence_refs:
            assert ev.document_id
            assert ev.document_name
            assert ev.page >= 1
            assert len(ev.original_text) > 0
        assert "requires verification" in f.explanation.lower() or "verification" in f.explanation.lower()


def test_clean_case_produces_no_false_positives():
    docs = [
        parse_and_extract_document(p, os.path.basename(p))
        for p in sorted(glob.glob(os.path.join(CLEAN_DIR, "*.pdf")))
    ]
    assert len(docs) == 3
    findings = run_discrepancy_engine(docs)
    assert len(findings) == 0


def test_r4_survey_mismatch_case():
    c13_dir = os.path.join(EVAL_DIR, "SYNTH-13-SURVEY")
    docs = [
        parse_and_extract_document(os.path.join(c13_dir, fn), fn)
        for fn in ("RTC.pdf", "Deed.pdf", "Mutation.pdf")
    ]
    findings = run_discrepancy_engine(docs)
    assert any(f.rule_id == "R4" for f in findings)
