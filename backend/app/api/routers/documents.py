"""Documents Upload (with Magic-Byte Validation), PDF Page Preview, and Field Correction Router."""

import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth import get_authorized_case, get_optional_user, new_uuid
from app.core.normalization import parse_extent_to_acres
from app.core.security import validate_magic_bytes
from app.db.database import get_db
from app.db.models import DocumentORM, ExtractedFieldORM, ReviewDecisionORM
from app.db.repository import (
    UPLOAD_DIR,
    add_audit_log,
    build_land_case_response,
    persist_document,
    rerun_and_persist_pipeline,
)
from app.document_processing.parser import (
    ALLOWED_EXTENSIONS,
    MAX_UPLOAD_BYTES,
    parse_and_extract_document,
    render_pdf_page_png,
)
from app.models.schemas import FieldCorrectionRequest

router = APIRouter()


@router.post("/cases/{case_id}/documents/upload")
async def upload_document(
    case_id: str,
    file: UploadFile = File(...),
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor, require_write=True)
    filename = os.path.basename(file.filename or "upload.pdf")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    raw_bytes = await file.read()
    if len(raw_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds 15 MB upload limit.")

    canonical_mime = validate_magic_bytes(raw_bytes, ext)

    case_upload_dir = os.path.join(UPLOAD_DIR, c_orm.case_code)
    os.makedirs(case_upload_dir, exist_ok=True)
    stored_path = os.path.join(case_upload_dir, filename)
    with open(stored_path, "wb") as f:
        f.write(raw_bytes)

    doc_item = parse_and_extract_document(
        stored_path,
        filename,
        mime_type=canonical_mime,
    )

    dup = (
        db.query(DocumentORM)
        .filter(
            DocumentORM.case_id == c_orm.id,
            DocumentORM.file_hash == doc_item.file_hash,
            DocumentORM.filename != filename,
        )
        .first()
    )
    duplicate_notice = f"Note: Identical file hash already uploaded as '{dup.filename}'." if dup else None

    persist_document(db, c_orm, doc_item, stored_path, len(raw_bytes))
    add_audit_log(
        db,
        c_orm.id,
        actor["name"],
        actor["role"],
        "DOCUMENT_UPLOADED",
        f"Uploaded {filename} ({doc_item.doc_type}, status={doc_item.status}, fields={len(doc_item.extracted_fields)}).",
    )
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])

    updated_case = build_land_case_response(db, c_orm)
    return {
        "message": doc_item.quality_warning or f"Parsed and extracted {filename}",
        "duplicate_notice": duplicate_notice,
        "document": doc_item,
        "case": updated_case,
    }


@router.get("/documents/{doc_id}/page/{page_num}")
def get_document_page_image(
    doc_id: str,
    page_num: int = 1,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    d_orm = db.query(DocumentORM).filter(DocumentORM.id == doc_id).first()
    if not d_orm:
        raise HTTPException(status_code=404, detail="Document not found")
    get_authorized_case(d_orm.land_case.case_code, db, actor)

    if not os.path.exists(d_orm.stored_path):
        raise HTTPException(status_code=404, detail="Stored document file missing on disk")
    try:
        png_bytes = render_pdf_page_png(d_orm.stored_path, page_num=page_num, dpi=150)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot render page preview: {exc}")

    return Response(content=png_bytes, media_type="image/png")


@router.post("/documents/{doc_id}/correct")
def correct_field(
    doc_id: str,
    payload: FieldCorrectionRequest,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    d_orm = db.query(DocumentORM).filter(DocumentORM.id == doc_id).first()
    if not d_orm:
        raise HTTPException(status_code=404, detail="Document not found")
    c_orm = get_authorized_case(d_orm.land_case.case_code, db, actor, require_write=True)

    f_orm = (
        db.query(ExtractedFieldORM)
        .filter(ExtractedFieldORM.document_id == doc_id, ExtractedFieldORM.field_name == payload.field_name)
        .first()
    )
    if not f_orm:
        raise HTTPException(status_code=404, detail=f"Field '{payload.field_name}' not found in document")

    # Rule 6: Never overwrite original_text or normalized_value_json
    prev_val = f_orm.reviewer_value_json or f_orm.normalized_value_json
    val_to_store = payload.corrected_value
    if f_orm.field_name in ("total_extent", "extent_allotted", "stated_extent", "transferred_extent") and isinstance(val_to_store, str):
        parsed_ac = parse_extent_to_acres(val_to_store)
        if parsed_ac > 0:
            val_to_store = parsed_ac

    f_orm.reviewer_value_json = json.dumps(val_to_store)
    f_orm.verification_status = "corrected"
    f_orm.reviewer_notes = payload.reviewer_notes or "Corrected by reviewer"
    f_orm.updated_at = datetime.now(timezone.utc)

    db.add(
        ReviewDecisionORM(
            id=new_uuid("rev"),
            case_id=c_orm.id,
            target_type="field",
            target_id=f"{d_orm.filename}:{f_orm.field_name}",
            decision="corrected",
            previous_value=str(prev_val),
            new_value=json.dumps(val_to_store),
            notes=f_orm.reviewer_notes,
            actor_name=actor["name"],
            actor_role=actor["role"],
        )
    )
    add_audit_log(
        db,
        c_orm.id,
        actor["name"],
        actor["role"],
        "FIELD_CORRECTED",
        f"Corrected {d_orm.filename} -> {f_orm.label} to {val_to_store} (original preserved: '{f_orm.original_text}').",
    )
    db.commit()

    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return {
        "status": "success",
        "case": build_land_case_response(db, c_orm),
    }


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    d_orm = db.query(DocumentORM).filter(DocumentORM.id == doc_id).first()
    if not d_orm:
        raise HTTPException(status_code=404, detail="Document not found")
    c_orm = get_authorized_case(d_orm.land_case.case_code, db, actor, require_write=True)
    fn = d_orm.filename
    db.delete(d_orm)
    add_audit_log(db, c_orm.id, actor["name"], actor["role"], "DOCUMENT_DELETED", f"Removed document {fn}.")
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return {"status": "deleted", "case": build_land_case_response(db, c_orm)}
