"""Valuation Baseline, Comparables CRUD, GeoJSON QA & Extent Unit Converter Router."""

import json
import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.auth import get_authorized_case, get_optional_user, new_uuid
from app.core.normalization import (
    CENTS_TO_ACRES,
    HECTARES_TO_ACRES,
    SQFT_TO_ACRES,
    acres_to_karnataka_units,
    format_extent,
    normalize_numerals,
    parse_extent_to_acres,
)
from app.db.database import get_db
from app.db.models import ComparableORM, GeoJsonLayerORM
from app.db.repository import (
    add_audit_log,
    orm_to_comparables,
    orm_to_documents,
    rerun_and_persist_pipeline,
)
from app.models.schemas import (
    ComparableCreateRequest,
    ExtentConvertRequest,
    ExtentConvertResponse,
    GeoJsonResponse,
    ValuationResponse,
)
from app.services.gis_qa import get_synthetic_demo_geojson, validate_and_run_gis_qa
from app.services.valuation import compute_valuation_baseline

router = APIRouter()


@router.get("/cases/{case_id}/valuation", response_model=ValuationResponse)
def get_valuation(
    case_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor)
    docs = orm_to_documents(c_orm)
    comps = orm_to_comparables(c_orm)
    return compute_valuation_baseline(c_orm.case_code, docs, comps)


@router.post("/cases/{case_id}/comparables", response_model=ValuationResponse)
def add_comparable(
    case_id: str,
    payload: ComparableCreateRequest,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor, require_write=True)
    extent_acres = parse_extent_to_acres(payload.extent_str)
    if extent_acres <= 0 or payload.sale_price_inr <= 0:
        raise HTTPException(status_code=400, detail="Valid extent and positive sale price are required.")

    db.add(
        ComparableORM(
            id=new_uuid("cmp"),
            case_id=c_orm.id,
            label=payload.label.strip(),
            location=payload.location.strip(),
            sale_date=payload.sale_date.strip(),
            extent_str=payload.extent_str.strip(),
            extent_acres=extent_acres,
            sale_price_inr=payload.sale_price_inr,
            source_ref=payload.source_ref.strip(),
            verified=payload.verified,
            synthetic=False,
        )
    )
    add_audit_log(db, c_orm.id, actor["name"], actor["role"], "COMPARABLE_ADDED", f"Added comparable '{payload.label}' ({payload.extent_str}).")
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return compute_valuation_baseline(c_orm.case_code, orm_to_documents(c_orm), orm_to_comparables(c_orm))


@router.patch("/comparables/{comp_id}/verify", response_model=ValuationResponse)
def toggle_verify_comparable(
    comp_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    comp = db.query(ComparableORM).filter(ComparableORM.id == comp_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Comparable not found")
    c_orm = get_authorized_case(comp.land_case.case_code, db, actor, require_write=True)
    comp.verified = not comp.verified
    add_audit_log(db, c_orm.id, actor["name"], actor["role"], "COMPARABLE_VERIFIED", f"Comparable '{comp.label}' verified={comp.verified}.")
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return compute_valuation_baseline(c_orm.case_code, orm_to_documents(c_orm), orm_to_comparables(c_orm))


@router.delete("/comparables/{comp_id}", response_model=ValuationResponse)
def delete_comparable(
    comp_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    comp = db.query(ComparableORM).filter(ComparableORM.id == comp_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Comparable not found")
    c_orm = get_authorized_case(comp.land_case.case_code, db, actor, require_write=True)
    db.delete(comp)
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return compute_valuation_baseline(c_orm.case_code, orm_to_documents(c_orm), orm_to_comparables(c_orm))


@router.post("/cases/{case_id}/comparables/load-demo", response_model=ValuationResponse)
def load_demo_comparables(
    case_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor, require_write=True)
    for c in list(c_orm.comparables):
        if c.synthetic:
            db.delete(c)
    db.flush()

    demo_items = [
        ("Sy 82/4 Sale (Synthetic Demo)", "Ramanagara Rural", "14/02/2024", "1-20", 1.50, 4800000.0, "Synthetic SRO Index Demo #101", True),
        ("Sy 86/1 Sale (Synthetic Demo)", "Bidadi Hobli", "09/05/2024", "2-00", 2.00, 6800000.0, "Synthetic SRO Index Demo #102", True),
        ("Sy 79/2 Sale (Synthetic Demo)", "Ramanagara Rural", "21/08/2024", "1-30", 1.75, 5775000.0, "Synthetic SRO Index Demo #103", True),
    ]
    for lbl, loc, dt, ext_s, ext_ac, price, ref, ver in demo_items:
        db.add(
            ComparableORM(
                id=new_uuid("cmp"),
                case_id=c_orm.id,
                label=lbl,
                location=loc,
                sale_date=dt,
                extent_str=ext_s,
                extent_acres=ext_ac,
                sale_price_inr=price,
                source_ref=ref,
                verified=ver,
                synthetic=True,
            )
        )
    add_audit_log(db, c_orm.id, actor["name"], actor["role"], "DEMO_COMPARABLES_LOADED", "Loaded 3 synthetic demo comparables.")
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return compute_valuation_baseline(c_orm.case_code, orm_to_documents(c_orm), orm_to_comparables(c_orm))


@router.get("/cases/{case_id}/gis", response_model=GeoJsonResponse)
def get_case_gis(
    case_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor)
    docs = orm_to_documents(c_orm)
    if not c_orm.geojson_layers:
        return validate_and_run_gis_qa(c_orm.case_code, None, None, False, docs)
    layer = sorted(c_orm.geojson_layers, key=lambda x: x.uploaded_at)[-1]
    return validate_and_run_gis_qa(c_orm.case_code, json.loads(layer.geojson_json), layer.source_description, layer.synthetic, docs)


@router.post("/cases/{case_id}/gis/upload", response_model=GeoJsonResponse)
async def upload_case_geojson(
    case_id: str,
    file: UploadFile = File(...),
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor, require_write=True)
    raw = await file.read()
    try:
        gj = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON / GeoJSON file.")

    for existing in list(c_orm.geojson_layers):
        db.delete(existing)
    db.flush()

    fn = os.path.basename(file.filename or "parcel.geojson")
    db.add(
        GeoJsonLayerORM(
            id=new_uuid("geo"),
            case_id=c_orm.id,
            filename=fn,
            source_description=f"User-supplied GeoJSON ({fn})",
            synthetic=False,
            geojson_json=json.dumps(gj),
        )
    )
    add_audit_log(db, c_orm.id, actor["name"], actor["role"], "GEOJSON_UPLOADED", f"Uploaded GeoJSON {fn}.")
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return validate_and_run_gis_qa(c_orm.case_code, gj, f"User-supplied GeoJSON ({fn})", False, orm_to_documents(c_orm))


@router.post("/cases/{case_id}/gis/load-demo", response_model=GeoJsonResponse)
def load_demo_geojson(
    case_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor, require_write=True)
    for existing in list(c_orm.geojson_layers):
        db.delete(existing)
    db.flush()

    gj = get_synthetic_demo_geojson(c_orm.survey_number or "84/1")
    desc = f"Synthetic Demo GeoJSON for Survey {c_orm.survey_number or '84/1'} (Demo Only — NOT Survey Record)"
    db.add(
        GeoJsonLayerORM(
            id=new_uuid("geo"),
            case_id=c_orm.id,
            filename=f"demo_{c_orm.survey_number.replace('/', '_')}.geojson",
            source_description=desc,
            synthetic=True,
            geojson_json=json.dumps(gj),
        )
    )
    add_audit_log(db, c_orm.id, actor["name"], actor["role"], "DEMO_GEOJSON_LOADED", desc)
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return validate_and_run_gis_qa(c_orm.case_code, gj, desc, True, orm_to_documents(c_orm))


@router.delete("/cases/{case_id}/gis", response_model=GeoJsonResponse)
def clear_case_geojson(
    case_id: str,
    actor: dict = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    c_orm = get_authorized_case(case_id, db, actor, require_write=True)
    for existing in list(c_orm.geojson_layers):
        db.delete(existing)
    db.commit()
    rerun_and_persist_pipeline(db, c_orm, actor["name"], actor["role"])
    return validate_and_run_gis_qa(c_orm.case_code, None, None, False, orm_to_documents(c_orm))


@router.post("/tools/convert-extent", response_model=ExtentConvertResponse)
def convert_extent_tool(payload: ExtentConvertRequest):
    norm_num = normalize_numerals(payload.extent_str)
    acres = parse_extent_to_acres(payload.extent_str)
    acres_to_karnataka_units(acres)
    return ExtentConvertResponse(
        input=payload.extent_str,
        normalized_numerals=norm_num,
        acres=round(acres, 4),
        guntas=round(acres * 40.0, 2),
        annas=round(acres * 640.0, 1),
        hectares=round(acres / HECTARES_TO_ACRES, 4),
        cents=round(acres / CENTS_TO_ACRES, 2),
        sqft=round(acres / SQFT_TO_ACRES, 1),
        canonical_karnataka=format_extent(acres) if acres > 0 else "0-0 (0 acres 0 guntas)",
    )
