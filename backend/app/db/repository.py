"""SQLite Repository & Pipeline Orchestrator Persistence for BhoomiAI."""

import json
import os
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy.orm import Session

from app.db.models import (
    LandCaseORM,
    DocumentORM,
    ExtractedFieldORM,
    PersonORM,
    OwnershipEventORM,
    DiscrepancyORM,
    ReviewDecisionORM,
    ComparableORM,
    GeoJsonLayerORM,
    WorkflowRunORM,
    AuditLogORM,
)
from app.core.auth import new_uuid, seed_default_user
from app.core.normalization import parse_extent_to_acres
from app.document_processing.parser import parse_and_extract_document
from app.models.schemas import (
    LandCase,
    DocumentItem,
    ExtractedField,
    PersonEntity,
    OwnershipEvent,
    EvidenceRef,
    DiscrepancyFinding,
    ReadinessDimension,
    WorkflowRunSummary,
    WorkflowStepTrace,
    ReviewDecisionEntry,
    AuditLogEntry,
    ComparableItem,
)
from app.workflows.pipeline import execute_case_pipeline, compute_readiness_dimensions

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
DOCS_DIR = os.path.join(BASE_DIR, "data", "documents")
CLEAN_DIR = os.path.join(DOCS_DIR, "clean_case")
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")
REPORTS_DIR = os.path.join(BASE_DIR, "data", "reports")
os.makedirs(DOCS_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)


def _fmt_dt(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC")


def add_audit_log(db: Session, case_orm_id: str, actor_name: str, actor_role: str, action: str, details: str):
    db.add(
        AuditLogORM(
            id=new_uuid("aud"),
            case_id=case_orm_id,
            actor_name=actor_name,
            actor_role=actor_role,
            action=action,
            details=details,
        )
    )


def orm_to_documents(case_orm: LandCaseORM) -> List[DocumentItem]:
    docs: List[DocumentItem] = []
    for d in sorted(case_orm.documents, key=lambda x: x.uploaded_at):
        fields: List[ExtractedField] = []
        for f in d.extracted_fields:
            fields.append(
                ExtractedField(
                    id=f.id,
                    field_name=f.field_name,
                    label=f.label,
                    original_text=f.original_text,
                    normalized_value=json.loads(f.normalized_value_json),
                    confidence=f.confidence,
                    method=f.method,
                    page=f.page,
                    bounding_box=json.loads(f.bounding_box_json) if f.bounding_box_json else None,
                    reviewer_value=json.loads(f.reviewer_value_json) if f.reviewer_value_json is not None else None,
                    verification_status=f.verification_status,
                    notes=f.reviewer_notes,
                )
            )
        docs.append(
            DocumentItem(
                id=d.id,
                filename=d.filename,
                doc_type=d.doc_type,
                mime_type=d.mime_type,
                pages_count=d.pages_count,
                file_size_kb=max(1, d.file_size_bytes // 1024),
                upload_timestamp=_fmt_dt(d.uploaded_at),
                file_hash=d.file_hash,
                language=d.language,
                extraction_method=d.extraction_method,
                extracted_fields=fields,
                ocr_quality_score=d.ocr_quality_score,
                status=d.status,
                quality_warning=d.quality_warning,
                injection_warning=d.injection_warning,
            )
        )
    return docs


def orm_to_comparables(case_orm: LandCaseORM) -> List[ComparableItem]:
    out: List[ComparableItem] = []
    for c in sorted(case_orm.comparables, key=lambda x: x.created_at):
        rate = round(c.sale_price_inr / c.extent_acres, 2) if c.extent_acres > 0 else 0.0
        out.append(
            ComparableItem(
                id=c.id,
                label=c.label,
                location=c.location,
                sale_date=c.sale_date,
                extent_str=c.extent_str,
                extent_acres=c.extent_acres,
                sale_price_inr=c.sale_price_inr,
                price_per_acre_inr=rate,
                source_ref=c.source_ref,
                verified=c.verified,
                synthetic=c.synthetic,
            )
        )
    return out


def persist_document(db: Session, case_orm: LandCaseORM, doc_item: DocumentItem, stored_path: str, size_bytes: int, raw_text: str = "") -> DocumentORM:
    # Replace same-filename document inside case if re-uploaded
    existing = next((d for d in case_orm.documents if d.filename == doc_item.filename), None)
    if existing:
        db.delete(existing)
        db.flush()

    d_orm = DocumentORM(
        id=doc_item.id,
        case_id=case_orm.id,
        filename=doc_item.filename,
        stored_path=stored_path,
        doc_type=doc_item.doc_type,
        mime_type=doc_item.mime_type,
        pages_count=doc_item.pages_count,
        file_size_bytes=size_bytes,
        file_hash=doc_item.file_hash,
        language=doc_item.language,
        extraction_method=doc_item.extraction_method,
        ocr_quality_score=doc_item.ocr_quality_score,
        status=doc_item.status,
        quality_warning=doc_item.quality_warning,
        injection_warning=doc_item.injection_warning,
        raw_text=raw_text,
    )
    db.add(d_orm)
    db.flush()

    for f in doc_item.extracted_fields:
        db.add(
            ExtractedFieldORM(
                id=f.id or new_uuid("fld"),
                document_id=d_orm.id,
                field_name=f.field_name,
                label=f.label,
                original_text=f.original_text,
                normalized_value_json=json.dumps(f.normalized_value),
                confidence=f.confidence,
                method=f.method,
                page=f.page,
                bounding_box_json=json.dumps(f.bounding_box) if f.bounding_box else None,
                reviewer_value_json=json.dumps(f.reviewer_value) if f.reviewer_value is not None else None,
                verification_status=f.verification_status,
                reviewer_notes=f.notes,
            )
        )
    db.flush()
    return d_orm


def rerun_and_persist_pipeline(db: Session, case_orm: LandCaseORM, actor_name: str = "BhoomiAI Engine", actor_role: str = "system"):
    db.refresh(case_orm)
    docs = orm_to_documents(case_orm)
    has_geojson = len(case_orm.geojson_layers) > 0
    verified_comps = sum(1 for c in case_orm.comparables if c.verified)

    # Preserve existing discrepancy review states by rule_id / id
    prev_reviews: Dict[str, Dict[str, Any]] = {}
    for d in case_orm.discrepancies:
        prev_reviews[d.id] = {
            "review_status": d.review_status,
            "reviewer_notes": d.reviewer_notes,
            "reviewed_by": d.reviewed_by,
            "reviewed_at": _fmt_dt(d.reviewed_at) if d.reviewed_at else None,
        }
        prev_reviews[d.rule_id] = prev_reviews[d.id]

    state, readiness, run_summary = execute_case_pipeline(
        case_id=case_orm.case_code,
        documents=docs,
        has_geojson=has_geojson,
        verified_comparables_count=verified_comps,
        previous_discrepancy_reviews=prev_reviews,
    )

    # Preserve reviewer-confirmed person resolution statuses
    prev_persons = {p.normalized_name: p.resolution_status for p in case_orm.persons}

    # Clear derived tables and store fresh pipeline outputs
    for p in list(case_orm.persons):
        db.delete(p)
    for ev in list(case_orm.ownership_events):
        db.delete(ev)
    for disc in list(case_orm.discrepancies):
        db.delete(disc)
    db.flush()

    for p in state.persons:
        res_stat = prev_persons.get(p.normalized_name, p.resolution_status)
        if prev_persons.get(p.normalized_name) == "reviewer_confirmed":
            res_stat = "reviewer_confirmed"
        db.add(
            PersonORM(
                id=f"{case_orm.case_code}-{p.id}",
                case_id=case_orm.id,
                canonical_name=p.canonical_name,
                normalized_name=p.normalized_name,
                aliases_json=json.dumps(p.aliases),
                is_deceased=p.is_deceased,
                date_of_death=p.date_of_death,
                resolution_status=res_stat,
                similarity_score=p.similarity_score,
            )
        )

    for ev in state.ownership_events:
        db.add(
            OwnershipEventORM(
                id=f"{case_orm.case_code}-{ev.id}",
                case_id=case_orm.id,
                event_date=ev.date,
                event_type=ev.event_type,
                description=ev.description,
                parties_json=json.dumps(ev.parties_involved),
                extent_affected=ev.extent_affected,
                status=ev.status,
                evidence_doc_id=ev.evidence.document_id,
                evidence_doc_name=ev.evidence.document_name,
                evidence_page=ev.evidence.page,
                evidence_text=ev.evidence.original_text,
                evidence_bbox_json=json.dumps(ev.evidence.bounding_box) if ev.evidence.bounding_box else None,
            )
        )

    for disc in state.discrepancies:
        db.add(
            DiscrepancyORM(
                id=f"{case_orm.case_code}-{disc.id}",
                case_id=case_orm.id,
                rule_id=disc.rule_id,
                rule_name=disc.rule_name,
                severity=disc.severity,
                severity_rationale=disc.severity_rationale,
                explanation=disc.explanation,
                suggested_next_step=disc.suggested_next_step,
                fields_compared_json=json.dumps(disc.fields_compared),
                evidence_refs_json=json.dumps([e.model_dump() for e in disc.evidence_refs]),
                review_status=disc.review_status,
                reviewer_notes=disc.reviewer_notes,
                reviewed_by=disc.reviewed_by,
            )
        )

    db.add(
        WorkflowRunORM(
            id=run_summary.id,
            case_id=case_orm.id,
            status=run_summary.status,
            trace_json=json.dumps([t.model_dump() for t in run_summary.trace]),
        )
    )

    pending = [f for f in state.discrepancies if f.review_status == "pending"]
    if not docs:
        case_orm.status = "awaiting_documents"
    elif pending or state.low_confidence_fields_count > 0 or state.needs_reupload_count > 0:
        case_orm.status = "ready_for_review"
    else:
        case_orm.status = "reviewed_clean" if not state.discrepancies else "reviewed_complete"

    add_audit_log(
        db,
        case_orm.id,
        actor_name,
        actor_role,
        "PIPELINE_RUN",
        f"Run {run_summary.id}: {len(docs)} docs, {len(state.ownership_events)} events, {len(state.discrepancies)} discrepancies.",
    )
    db.commit()
    db.refresh(case_orm)


def build_land_case_response(db: Session, case_orm: LandCaseORM) -> LandCase:
    db.refresh(case_orm)
    docs = orm_to_documents(case_orm)

    persons = [
        PersonEntity(
            id=p.id,
            canonical_name=p.canonical_name,
            normalized_name=p.normalized_name,
            aliases=json.loads(p.aliases_json),
            is_deceased=p.is_deceased,
            date_of_death=p.date_of_death,
            resolution_status=p.resolution_status,
            similarity_score=p.similarity_score,
        )
        for p in case_orm.persons
    ]

    events = [
        OwnershipEvent(
            id=ev.id,
            date=ev.event_date,
            event_type=ev.event_type,
            description=ev.description,
            parties_involved=json.loads(ev.parties_json),
            extent_affected=ev.extent_affected,
            status=ev.status,
            evidence=EvidenceRef(
                document_id=ev.evidence_doc_id,
                document_name=ev.evidence_doc_name,
                page=ev.evidence_page,
                original_text=ev.evidence_text,
                bounding_box=json.loads(ev.evidence_bbox_json) if ev.evidence_bbox_json else None,
            ),
        )
        for ev in case_orm.ownership_events
    ]

    discrepancies = [
        DiscrepancyFinding(
            id=d.id,
            rule_id=d.rule_id,
            rule_name=d.rule_name,
            severity=d.severity,
            severity_rationale=d.severity_rationale,
            explanation=d.explanation,
            suggested_next_step=d.suggested_next_step,
            fields_compared=json.loads(d.fields_compared_json),
            evidence_refs=[EvidenceRef(**ev) for ev in json.loads(d.evidence_refs_json)],
            review_status=d.review_status,
            reviewer_notes=d.reviewer_notes,
            reviewed_by=d.reviewed_by,
            reviewed_at=_fmt_dt(d.reviewed_at) if d.reviewed_at else None,
        )
        for d in case_orm.discrepancies
    ]

    has_geojson = len(case_orm.geojson_layers) > 0
    verified_comps = sum(1 for c in case_orm.comparables if c.verified)
    readiness = compute_readiness_dimensions(docs, events, discrepancies, has_geojson, verified_comps)

    latest_run = None
    if case_orm.workflow_runs:
        r = sorted(case_orm.workflow_runs, key=lambda x: x.started_at)[-1]
        latest_run = WorkflowRunSummary(
            id=r.id,
            status=r.status,
            started_at=_fmt_dt(r.started_at),
            completed_at=_fmt_dt(r.completed_at),
            trace=[WorkflowStepTrace(**t) for t in json.loads(r.trace_json)],
        )

    decisions = [
        ReviewDecisionEntry(
            id=rv.id,
            target_type=rv.target_type,
            target_id=rv.target_id,
            decision=rv.decision,
            previous_value=rv.previous_value,
            new_value=rv.new_value,
            notes=rv.notes,
            actor_name=rv.actor_name,
            actor_role=rv.actor_role,
            created_at=_fmt_dt(rv.created_at),
        )
        for rv in sorted(case_orm.review_decisions, key=lambda x: x.created_at, reverse=True)
    ]

    audits = [
        AuditLogEntry(
            id=a.id,
            actor_name=a.actor_name,
            actor_role=a.actor_role,
            action=a.action,
            details=a.details,
            created_at=_fmt_dt(a.created_at),
        )
        for a in sorted(case_orm.audit_logs, key=lambda x: x.created_at, reverse=True)[:40]
    ]

    disclaimer = (
        "Synthetic demo data — decision support only. NOT legal certification of title, boundaries, mutations, valuation, or loan eligibility."
        if case_orm.synthetic
        else "Decision support only — NOT legal certification of title, boundaries, mutations, valuation, or loan eligibility."
    )

    return LandCase(
        case_id=case_orm.case_code,
        case_name=case_orm.case_name,
        village=case_orm.village,
        hobli=case_orm.hobli,
        taluk=case_orm.taluk,
        district=case_orm.district,
        survey_number=case_orm.survey_number,
        created_at=_fmt_dt(case_orm.created_at),
        synthetic=case_orm.synthetic,
        is_public_demo=case_orm.is_public_demo,
        external_llm_consent=case_orm.external_llm_consent,
        disclaimer=disclaimer,
        documents=docs,
        persons=persons,
        ownership_events=events,
        discrepancies=discrepancies,
        readiness_dimensions=readiness,
        latest_workflow_run=latest_run,
        review_decisions=decisions,
        audit_logs=audits,
        status=case_orm.status,
    )


def seed_demo_cases(db: Session, force_reset: bool = False):
    """Seeds BHOOMI-DEMO-001 (4 planted discrepancies) and BHOOMI-CLEAN-002 (0 discrepancies)."""
    demo_user = seed_default_user(db)

    if force_reset:
        for code in ("BHOOMI-DEMO-001", "BHOOMI-CLEAN-002"):
            existing = db.query(LandCaseORM).filter(LandCaseORM.case_code == code).first()
            if existing:
                db.delete(existing)
        db.commit()

    # 1. Golden Case BHOOMI-DEMO-001
    if not db.query(LandCaseORM).filter(LandCaseORM.case_code == "BHOOMI-DEMO-001").first():
        c1 = LandCaseORM(
            id=new_uuid("case"),
            owner_user_id=demo_user.id,
            case_code="BHOOMI-DEMO-001",
            case_name="Ramanagara Survey 84/1 Land Due Diligence",
            village="Ramanagara Rural",
            hobli="Bidadi",
            taluk="Ramanagara",
            district="Ramanagara",
            survey_number="84/1",
            synthetic=True,
            is_public_demo=True,
            external_llm_consent=False,
            status="ready_for_review",
        )
        db.add(c1)
        db.flush()

        golden_files = [
            "RTC_Form16_2023.pdf",
            "Death_Certificate_Ramachandrappa.pdf",
            "Partition_Deed_2011_Registered.pdf",
            "Mutation_Extract_MR_2018_09.pdf",
            "Survey_Sketch_Tippani_84_1.pdf",
        ]
        for fn in golden_files:
            fp = os.path.join(DOCS_DIR, fn)
            if os.path.exists(fp):
                doc_item = parse_and_extract_document(fp, fn, "application/pdf")
                persist_document(db, c1, doc_item, fp, os.path.getsize(fp))

        add_audit_log(db, c1.id, "BhoomiAI Seed", "system", "CASE_SEEDED", "Seeded synthetic golden case BHOOMI-DEMO-001 (5 PDFs).")
        db.commit()
        rerun_and_persist_pipeline(db, c1, "BhoomiAI Pipeline", "system")

    # 2. Clean Case BHOOMI-CLEAN-002
    if not db.query(LandCaseORM).filter(LandCaseORM.case_code == "BHOOMI-CLEAN-002").first():
        c2 = LandCaseORM(
            id=new_uuid("case"),
            owner_user_id=demo_user.id,
            case_code="BHOOMI-CLEAN-002",
            case_name="Mandya Survey 112/3 Clean Title Verification",
            village="Chikkarasinakere",
            hobli="Koppa",
            taluk="Maddur",
            district="Mandya",
            survey_number="112/3",
            synthetic=True,
            is_public_demo=True,
            external_llm_consent=False,
            status="reviewed_clean",
        )
        db.add(c2)
        db.flush()

        clean_files = [
            "RTC_Mandya_112_3_2024.pdf",
            "Sale_Deed_Mandya_2019.pdf",
            "Mutation_Mandya_MR_2020_14.pdf",
        ]
        for fn in clean_files:
            fp = os.path.join(CLEAN_DIR, fn)
            if os.path.exists(fp):
                doc_item = parse_and_extract_document(fp, fn, "application/pdf")
                persist_document(db, c2, doc_item, fp, os.path.getsize(fp))

        add_audit_log(db, c2.id, "BhoomiAI Seed", "system", "CASE_SEEDED", "Seeded synthetic clean case BHOOMI-CLEAN-002 (3 PDFs).")
        db.commit()
        rerun_and_persist_pipeline(db, c2, "BhoomiAI Pipeline", "system")
