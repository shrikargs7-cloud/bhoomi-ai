"""Signed PDF Land Readiness Report Generation & Download Router."""

import os

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.auth import (
    create_download_token,
    get_authorized_case,
    get_optional_user,
    verify_download_token,
)
from app.db.database import get_db
from app.db.models import LandCaseORM
from app.db.repository import (
    REPORTS_DIR,
    add_audit_log,
    build_land_case_response,
    orm_to_comparables,
)
from app.reporting.pdf_generator import generate_land_readiness_pdf
from app.services.valuation import compute_valuation_baseline
from app.workflows.verifier import verify_case_claims

router = APIRouter()


def _stream_case_pdf(c_orm: LandCaseORM, actor_name: str, actor_role: str, db: Session) -> FileResponse:
    case = build_land_case_response(db, c_orm)
    verification = verify_case_claims(case.documents, case.discrepancies, case.ownership_events)
    case.discrepancies = verification.verified_discrepancies
    case.ownership_events = verification.verified_events
    val = compute_valuation_baseline(case.case_id, case.documents, orm_to_comparables(c_orm))

    pdf_path = os.path.join(REPORTS_DIR, f"{case.case_id}_Land_Readiness_Report.pdf")
    generate_land_readiness_pdf(case, pdf_path, valuation=val)

    add_audit_log(db, c_orm.id, actor_name, actor_role, "REPORT_GENERATED", f"Downloaded Land Readiness PDF for {case.case_id}.")
    db.commit()

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{case.case_id}_Land_Readiness_Report.pdf",
    )


@router.post("/cases/{case_id}/reports/sign")
def sign_readiness_pdf_url(
    case_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor)
    ttl = 300
    token = create_download_token(
        case_id=c_orm.case_code,
        actor_id=actor["id"],
        actor_name=actor["name"],
        actor_role=actor["role"],
        ttl_seconds=ttl,
    )
    return {
        "case_id": c_orm.case_code,
        "token": token,
        "download_url": f"/api/reports/download?token={token}",
        "expires_in_seconds": ttl,
    }


@router.get("/reports/download")
def download_signed_readiness_pdf(
    token: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
):
    payload = verify_download_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired signed report download token",
        )
    case_id = payload["case_id"]
    c_orm = (
        db.query(LandCaseORM)
        .filter((LandCaseORM.case_code == case_id) | (LandCaseORM.id == case_id))
        .first()
    )
    if not c_orm:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    if not c_orm.is_public_demo and c_orm.owner_user_id and c_orm.owner_user_id != payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Signed token subject does not own case")

    return _stream_case_pdf(
        c_orm,
        actor_name=payload.get("actor_name", "Authorized User"),
        actor_role=payload.get("actor_role", "farmer"),
        db=db,
    )


@router.get("/cases/{case_id}/reports/readiness-pdf")
def download_readiness_pdf(
    case_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor)
    return _stream_case_pdf(c_orm, actor["name"], actor["role"], db)
