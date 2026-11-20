"""Land Cases CRUD, Demo Seeding & Pipeline Execution Router."""

import json
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_authorized_case, get_optional_user, new_uuid
from app.db.database import get_db
from app.db.models import LandCaseORM
from app.db.repository import (
    add_audit_log,
    build_land_case_response,
    rerun_and_persist_pipeline,
    seed_demo_cases,
)
from app.models.schemas import CaseCreateRequest, CaseSummaryItem, LandCase

router = APIRouter()


@router.get("/cases", response_model=List[CaseSummaryItem])
def list_cases(actor: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    q = db.query(LandCaseORM).order_by(LandCaseORM.created_at.asc())
    items: List[CaseSummaryItem] = []
    for c in q.all():
        if not c.is_public_demo:
            if not actor["is_authenticated"] or c.owner_user_id != actor["id"]:
                continue
        items.append(
            CaseSummaryItem(
                case_id=c.case_code,
                case_name=c.case_name,
                village=c.village,
                district=c.district,
                survey_number=c.survey_number,
                documents_count=len(c.documents),
                discrepancies_count=len(c.discrepancies),
                synthetic=c.synthetic,
                status=c.status,
                created_at=c.created_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
            )
        )
    return items


@router.post("/cases", response_model=LandCase)
def create_case(
    payload: CaseCreateRequest,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    code = f"BHOOMI-CASE-{uuid.uuid4().hex[:5].upper()}"
    is_public = not actor["is_authenticated"]
    owner_id = actor["id"] if actor["is_authenticated"] else None

    c_orm = LandCaseORM(
        id=new_uuid("case"),
        owner_user_id=owner_id,
        case_code=code,
        case_name=payload.case_name.strip() or f"Survey {payload.survey_number} Review",
        village=payload.village.strip(),
        hobli=payload.hobli.strip(),
        taluk=payload.taluk.strip(),
        district=payload.district.strip(),
        survey_number=payload.survey_number.strip(),
        synthetic=False,
        is_public_demo=is_public,
        external_llm_consent=payload.external_llm_consent,
        status="awaiting_documents",
    )
    db.add(c_orm)
    db.flush()
    add_audit_log(db, c_orm.id, actor["name"], actor["role"], "CASE_CREATED", f"Created land case {code}.")
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return build_land_case_response(db, c_orm)


@router.get("/cases/{case_id}", response_model=LandCase)
def get_case(case_id: str, actor: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    c_orm = get_authorized_case(case_id, db, actor)
    return build_land_case_response(db, c_orm)


@router.delete("/cases/{case_id}")
def delete_case(case_id: str, actor: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    c_orm = get_authorized_case(case_id, db, actor, require_write=True)
    if c_orm.case_code in ("BHOOMI-DEMO-001", "BHOOMI-CLEAN-002"):
        raise HTTPException(status_code=400, detail="Built-in demo cases cannot be deleted; use Reset Demo instead.")
    db.delete(c_orm)
    db.commit()
    return {"status": "deleted", "case_id": case_id}


@router.post("/cases/reset-demo")
@router.post("/cases/reset-golden")
def reset_demo_cases(actor: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    seed_demo_cases(db, force_reset=True)
    c_orm = get_authorized_case("BHOOMI-DEMO-001", db, actor)
    return {"status": "reset", "case": build_land_case_response(db, c_orm)}


@router.post("/cases/{case_id}/pipeline/run", response_model=LandCase)
def run_pipeline_endpoint(
    case_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor, require_write=True)
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return build_land_case_response(db, c_orm)


@router.get("/reviewer/queue")
def get_reviewer_queue(
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Cross-case reviewer triage queue respecting strict case-level authorization."""
    cases = db.query(LandCaseORM).order_by(LandCaseORM.created_at.asc()).all()

    pending_discrepancies = []
    low_confidence_fields = []
    uncertain_persons = []
    reupload_documents = []
    cases_with_items = set()

    for c in cases:
        if not c.is_public_demo:
            if not actor["is_authenticated"] or c.owner_user_id != actor["id"]:
                continue

        for d in c.discrepancies:
            if d.review_status == "pending":
                cases_with_items.add(c.case_code)
                ev_refs = json.loads(d.evidence_refs_json or "[]")
                pending_discrepancies.append({
                    "case_id": c.case_code,
                    "case_name": c.case_name,
                    "survey_number": c.survey_number,
                    "discrepancy_id": d.id,
                    "rule_id": d.rule_id,
                    "rule_name": d.rule_name,
                    "severity": d.severity,
                    "explanation": d.explanation,
                    "suggested_next_step": d.suggested_next_step,
                    "evidence_count": len(ev_refs),
                })

        for doc in c.documents:
            if doc.status == "needs_reupload":
                cases_with_items.add(c.case_code)
                reupload_documents.append({
                    "case_id": c.case_code,
                    "case_name": c.case_name,
                    "document_id": doc.id,
                    "filename": doc.filename,
                    "quality_warning": doc.quality_warning or "Re-upload required",
                })
            for fld in doc.extracted_fields:
                if fld.confidence < 0.85 and fld.verification_status != "corrected":
                    cases_with_items.add(c.case_code)
                    low_confidence_fields.append({
                        "case_id": c.case_code,
                        "case_name": c.case_name,
                        "document_id": doc.id,
                        "document_name": doc.filename,
                        "field_name": fld.field_name,
                        "label": fld.label,
                        "original_text": fld.original_text,
                        "normalized_value": json.loads(fld.normalized_value_json),
                        "confidence": fld.confidence,
                        "page": fld.page,
                    })

        for p in c.persons:
            if p.resolution_status == "uncertain":
                cases_with_items.add(c.case_code)
                uncertain_persons.append({
                    "case_id": c.case_code,
                    "case_name": c.case_name,
                    "person_id": p.id,
                    "canonical_name": p.canonical_name,
                    "aliases": json.loads(p.aliases_json or "[]"),
                    "similarity_score": p.similarity_score,
                })

    total_items = (
        len(pending_discrepancies)
        + len(low_confidence_fields)
        + len(uncertain_persons)
        + len(reupload_documents)
    )
    return {
        "pending_discrepancies": pending_discrepancies,
        "low_confidence_fields": low_confidence_fields,
        "uncertain_persons": uncertain_persons,
        "reupload_documents": reupload_documents,
        "summary": {
            "total_pending_items": total_items,
            "pending_discrepancies_count": len(pending_discrepancies),
            "low_confidence_fields_count": len(low_confidence_fields),
            "uncertain_persons_count": len(uncertain_persons),
            "reupload_documents_count": len(reupload_documents),
            "cases_requiring_attention": len(cases_with_items),
        },
    }
