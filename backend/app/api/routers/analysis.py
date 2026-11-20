"""Ownership Graph, Person Resolution, Discrepancy Review, Legal RAG & Evaluation Router."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_authorized_case, get_optional_user, new_uuid
from app.db.database import get_db
from app.db.models import DiscrepancyORM, PersonORM, ReviewDecisionORM
from app.db.repository import add_audit_log, build_land_case_response, rerun_and_persist_pipeline
from app.models.schemas import (
    DiscrepancyReviewRequest,
    LegalQueryRequest,
    LegalQueryResponse,
    OwnershipGraphResponse,
    PersonResolutionRequest,
)
from app.ownership.resolver import build_lineage_graph
from app.services.legal_rag import list_curated_sources, query_legal_reference

router = APIRouter()


@router.get("/cases/{case_id}/ownership/graph", response_model=OwnershipGraphResponse)
def get_ownership_graph(
    case_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor)
    case = build_land_case_response(db, c_orm)
    _, nodes, edges = build_lineage_graph(case.survey_number, case.persons, case.ownership_events, case.documents)
    return OwnershipGraphResponse(case_id=case.case_id, nodes=nodes, edges=edges)


@router.post("/cases/{case_id}/persons/{person_id}/resolve")
def resolve_person_entity(
    case_id: str,
    person_id: str,
    payload: PersonResolutionRequest,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor, require_write=True)
    p_orm = db.query(PersonORM).filter(PersonORM.id == person_id, PersonORM.case_id == c_orm.id).first()
    if not p_orm:
        raise HTTPException(status_code=404, detail="Person entity not found")

    prev = p_orm.resolution_status
    p_orm.resolution_status = payload.resolution_status
    if payload.merged_into_name:
        aliases = json.loads(p_orm.aliases_json)
        if payload.merged_into_name not in aliases:
            aliases.append(payload.merged_into_name)
        p_orm.aliases_json = json.dumps(aliases)

    db.add(
        ReviewDecisionORM(
            id=new_uuid("rev"),
            case_id=c_orm.id,
            target_type="person",
            target_id=p_orm.canonical_name,
            decision=payload.resolution_status,
            previous_value=prev,
            new_value=payload.merged_into_name or payload.resolution_status,
            notes=payload.notes,
            actor_name=actor["name"],
            actor_role=actor["role"],
        )
    )
    add_audit_log(
        db,
        c_orm.id,
        actor["name"],
        actor["role"],
        "PERSON_RESOLVED",
        f"Entity '{p_orm.canonical_name}' marked {payload.resolution_status}.",
    )
    db.commit()
    return {"status": "success", "case": build_land_case_response(db, c_orm)}


@router.post("/discrepancies/{disc_id}/review")
def review_discrepancy(
    disc_id: str,
    payload: DiscrepancyReviewRequest,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    d_orm = db.query(DiscrepancyORM).filter(DiscrepancyORM.id == disc_id).first()
    if not d_orm:
        raise HTTPException(status_code=404, detail="Discrepancy finding not found")
    c_orm = get_authorized_case(d_orm.land_case.case_code, db, actor, require_write=True)

    prev = d_orm.review_status
    d_orm.review_status = payload.decision
    d_orm.reviewer_notes = payload.reviewer_notes or f"Decision: {payload.decision}"
    d_orm.reviewed_by = actor["name"]
    d_orm.reviewed_at = datetime.now(timezone.utc)

    db.add(
        ReviewDecisionORM(
            id=new_uuid("rev"),
            case_id=c_orm.id,
            target_type="discrepancy",
            target_id=f"{d_orm.rule_id}: {d_orm.rule_name}",
            decision=payload.decision,
            previous_value=prev,
            new_value=payload.decision,
            notes=d_orm.reviewer_notes,
            actor_name=actor["name"],
            actor_role=actor["role"],
        )
    )
    add_audit_log(
        db,
        c_orm.id,
        actor["name"],
        actor["role"],
        "DISCREPANCY_REVIEWED",
        f"Finding {d_orm.rule_id} ({d_orm.rule_name}) marked '{payload.decision}'. Notes: {d_orm.reviewer_notes}",
    )
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return {"status": "success", "case": build_land_case_response(db, c_orm)}


@router.get("/legal/sources")
def legal_sources():
    return list_curated_sources()


@router.post("/legal/query", response_model=LegalQueryResponse)
def legal_query(payload: LegalQueryRequest):
    return query_legal_reference(payload.query)


@router.get("/evaluation/run")
def run_evaluation_suite():
    from scripts.evaluate_extraction import run_extraction_evaluation
    from scripts.evaluate_discrepancies import run_discrepancy_evaluation
    return {
        "extraction": run_extraction_evaluation(),
        "discrepancies": run_discrepancy_evaluation(),
    }


@router.get("/evaluation/stress")
def run_stress_evaluation_suite():
    from scripts.evaluate_stress_benchmarks import run_all_stress_benchmarks
    return run_all_stress_benchmarks()
