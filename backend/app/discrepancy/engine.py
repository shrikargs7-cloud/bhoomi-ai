"""BhoomiAI Deterministic Discrepancy Engine (Rules R1–R5)
Rules decide deterministically from extracted/reviewer-verified fields.
Every finding strictly links to concrete document/page/original_text evidence.
Per CLAUDE.md Rule 7: Discrepancies state 'requires verification', never fraud accusations.
"""

import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from app.models.schemas import DiscrepancyFinding, DocumentItem, ExtractedField, EvidenceRef
from app.core.normalization import (
    extents_match,
    format_extent,
    match_names,
    parse_extent_to_acres,
    normalize_numerals,
    DEFAULT_EXTENT_TOLERANCE_ACRES,
)


def _get_field(doc: DocumentItem, field_name: str) -> Optional[ExtractedField]:
    return next((f for f in doc.extracted_fields if f.field_name == field_name), None)


def _effective_val(field: Optional[ExtractedField]) -> Any:
    if field is None:
        return None
    if field.reviewer_value is not None and field.verification_status == "corrected":
        return field.reviewer_value
    return field.normalized_value


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(date_str).strip(), fmt)
        except Exception:
            pass
    return None


def _make_ev(doc: DocumentItem, field: Optional[ExtractedField], fallback_text: str) -> EvidenceRef:
    return EvidenceRef(
        document_id=doc.id,
        document_name=doc.filename,
        page=field.page if field else 1,
        original_text=field.original_text if field else fallback_text,
        bounding_box=field.bounding_box if field else None,
    )


def run_discrepancy_engine(documents: List[DocumentItem]) -> List[DiscrepancyFinding]:
    """Evaluates rules R1–R5 across extracted case documents."""
    active_docs = [d for d in documents if d.status == "extracted"]
    findings: List[DiscrepancyFinding] = []

    rtcs = [d for d in active_docs if d.doc_type == "RTC"]
    death_certs = [d for d in active_docs if d.doc_type == "DEATH_CERTIFICATE"]
    deeds = [d for d in active_docs if d.doc_type in ("PARTITION_DEED", "SALE_DEED")]
    mutations = [d for d in active_docs if d.doc_type == "MUTATION_EXTRACT"]
    sketches = [d for d in active_docs if d.doc_type == "SURVEY_SKETCH"]
    mortgages = [d for d in active_docs if d.doc_type == "MORTGAGE_DEED"]

    # ==========================================================
    # RULE R1: Deceased Owner Appearing in Subsequent Record
    # ==========================================================
    for dc in death_certs:
        f_dec = _get_field(dc, "deceased_name")
        f_dod = _get_field(dc, "date_of_death")
        dec_name = str(_effective_val(f_dec) or "").strip()
        dod_str = str(_effective_val(f_dod) or "").strip()
        dod_dt = _parse_date(dod_str)
        if not dec_name:
            continue

        for rtc in rtcs:
            f_owners = _get_field(rtc, "recorded_owners")
            f_rdate = _get_field(rtc, "record_date")
            owners_raw = _effective_val(f_owners)
            if isinstance(owners_raw, str):
                owners = [x.strip() for x in owners_raw.split(",") if x.strip()]
            elif isinstance(owners_raw, list):
                owners = [str(x) for x in owners_raw]
            else:
                owners = []

            rdate_str = str(_effective_val(f_rdate) or "").strip()
            rdate_dt = _parse_date(rdate_str)

            # Fire only if record date is after date of death (or if record date missing, still flag if DOD exists)
            is_after_death = True
            if dod_dt and rdate_dt:
                is_after_death = rdate_dt > dod_dt

            if not is_after_death:
                continue

            for owner in owners:
                is_match, score, _ = match_names(dec_name, owner)
                if is_match or score >= 0.80:
                    findings.append(
                        DiscrepancyFinding(
                            id=f"DISC-R1-{len(findings)+1:02d}",
                            rule_id="R1",
                            rule_name="Deceased Owner in Current Record",
                            severity="Requires professional review",
                            severity_rationale=(
                                "Rule R1 triggers 'Requires professional review' whenever a death certificate "
                                "pre-dates an active RTC listing the deceased person as current holder."
                            ),
                            explanation=(
                                f"'{dec_name}' (date of death {dod_str or 'documented'}) still appears as a recorded owner "
                                f"('{owner}') in {rtc.filename} dated {rdate_str or 'subsequent year'} "
                                f"(name similarity {round(score * 100)}%). This may indicate pending succession mutation "
                                "or an unupdated revenue khata and requires verification."
                            ),
                            suggested_next_step=(
                                "Verify legal heirship tree (Vamsha Vruksha) and submit Death Certificate at Nadakacheri / "
                                "Bhoomi portal for Pauti Khata (inheritance mutation) verification."
                            ),
                            fields_compared={
                                "deceased_name": dec_name,
                                "date_of_death": dod_str,
                                "rtc_recorded_owner": owner,
                                "rtc_record_date": rdate_str,
                                "name_similarity": score,
                            },
                            evidence_refs=[
                                _make_ev(dc, f_dec, f"Deceased: {dec_name} ({dod_str})"),
                                _make_ev(rtc, f_owners, f"Recorded owner: {owner} ({rdate_str})"),
                            ],
                            review_status="pending",
                        )
                    )
                    break

    # ==========================================================
    # RULE R2: Extent Mismatch Across Same Survey Number
    # ==========================================================
    extent_records: List[Tuple[DocumentItem, ExtractedField, str, float]] = []
    for rtc in rtcs:
        f_ext = _get_field(rtc, "total_extent")
        f_sy = _get_field(rtc, "survey_number")
        val = _effective_val(f_ext)
        if val is not None:
            acres = float(val) if isinstance(val, (int, float)) else parse_extent_to_acres(str(val))
            sy = normalize_numerals(str(_effective_val(f_sy) or "")).strip()
            extent_records.append((rtc, f_ext, sy, acres))

    for deed in deeds:
        f_ext = _get_field(deed, "extent_allotted")
        f_sy = _get_field(deed, "survey_number")
        val = _effective_val(f_ext)
        if val is not None:
            acres = float(val) if isinstance(val, (int, float)) else parse_extent_to_acres(str(val))
            sy = normalize_numerals(str(_effective_val(f_sy) or "")).strip()
            extent_records.append((deed, f_ext, sy, acres))

    for sk in sketches:
        f_ext = _get_field(sk, "stated_extent")
        f_sy = _get_field(sk, "survey_number")
        val = _effective_val(f_ext)
        if val is not None:
            acres = float(val) if isinstance(val, (int, float)) else parse_extent_to_acres(str(val))
            sy = normalize_numerals(str(_effective_val(f_sy) or "")).strip()
            extent_records.append((sk, f_ext, sy, acres))

    # Group extent records by normalized survey number and check variance across documents
    by_survey: Dict[str, List[Tuple[DocumentItem, ExtractedField, float]]] = {}
    for doc_item, fld, sy, ac in extent_records:
        key = sy or "SUBJECT_PARCEL"
        by_survey.setdefault(key, []).append((doc_item, fld, ac))

    for sy, entries in by_survey.items():
        if len(entries) < 2:
            continue
        extents_vals = [ac for _, _, ac in entries]
        min_ac, max_ac = min(extents_vals), max(extents_vals)
        if not extents_match(min_ac, max_ac, tolerance=DEFAULT_EXTENT_TOLERANCE_ACRES):
            diff = round(max_ac - min_ac, 4)
            severity = "High" if diff >= 0.25 else "Medium"
            summary_parts = [f"{d.filename}: {format_extent(ac)} ({ac} ac)" for d, _, ac in entries]
            findings.append(
                DiscrepancyFinding(
                    id=f"DISC-R2-{len(findings)+1:02d}",
                    rule_id="R2",
                    rule_name="Extent Mismatch Between Documents",
                    severity=severity,
                    severity_rationale=(
                        f"Rule R2 assigns 'High' when extent variance >= 0.25 ac (observed {diff} ac > "
                        f"{DEFAULT_EXTENT_TOLERANCE_ACRES} ac tolerance) and 'Medium' for smaller variances."
                    ),
                    explanation=(
                        f"For Survey No. {sy}, stated extents differ across documents ({'; '.join(summary_parts)}), "
                        f"a variance of {diff} acres. Legitimate causes such as pot kharab deduction, phodi subdivision, "
                        "or resurvey correction may account for part of this variance; this requires verification."
                    ),
                    suggested_next_step=(
                        "Reconcile deed schedules against Akarband / Hissa Tippani and request an 11E / Tatkal Phodi "
                        "measurement through a licensed surveyor."
                    ),
                    fields_compared={
                        "survey_number": sy,
                        "document_extents": {d.filename: ac for d, _, ac in entries},
                        "min_extent_acres": min_ac,
                        "max_extent_acres": max_ac,
                        "variance_acres": diff,
                        "tolerance_acres": DEFAULT_EXTENT_TOLERANCE_ACRES,
                    },
                    evidence_refs=[
                        _make_ev(d, f, f"{d.filename}: {ac} acres") for d, f, ac in entries
                    ],
                    review_status="pending",
                )
            )

    # ==========================================================
    # RULE R3: Missing Inheritance / Partition Mutation
    # ==========================================================
    has_certified_inheritance_mutation = any(
        bool(_effective_val(_get_field(m, "is_inheritance_mutation"))) is True
        for m in mutations
    )
    if death_certs and rtcs and not has_certified_inheritance_mutation:
        dc = death_certs[0]
        rtc = rtcs[0]
        f_dec = _get_field(dc, "deceased_name")
        f_dod = _get_field(dc, "date_of_death")
        f_owners = _get_field(rtc, "recorded_owners")
        mut_note_field = _get_field(mutations[0], "is_inheritance_mutation") if mutations else None

        ev_list = [
            _make_ev(dc, f_dec, f"Death Certificate: {_effective_val(f_dec) or 'Deceased'}"),
            _make_ev(rtc, f_owners, "RTC Column 9 lacks post-death inheritance mutation"),
        ]
        if mutations and mut_note_field:
            ev_list.append(_make_ev(mutations[0], mut_note_field, mut_note_field.original_text))

        findings.append(
            DiscrepancyFinding(
                id=f"DISC-R3-{len(findings)+1:02d}",
                rule_id="R3",
                rule_name="Missing Inheritance Mutation (Pauti Khata)",
                severity="Medium",
                severity_rationale=(
                    "Rule R3 assigns 'Medium' when death certificate evidence exists without a certified "
                    "subsequent inheritance mutation extract."
                ),
                explanation=(
                    f"Death Certificate {dc.filename} establishes demise on {_effective_val(f_dod) or 'record'}, "
                    "and no certified inheritance mutation (Pauti Khata) appears in the uploaded mutation extracts "
                    "to reflect succession in revenue records. This requires verification before title transfer."
                ),
                suggested_next_step=(
                    "Apply for Pauti Khata mutation at Nadakacheri / Taluk office with death certificate, "
                    "family genealogy certificate, and survivor consent."
                ),
                fields_compared={
                    "deceased_person": str(_effective_val(f_dec) or "Unknown"),
                    "date_of_death": str(_effective_val(f_dod) or "Unknown"),
                    "certified_pauti_mutation_present": has_certified_inheritance_mutation,
                },
                evidence_refs=ev_list,
                review_status="pending",
            )
        )

    # Also check partition/sale deed without any mutation extract
    if deeds and not mutations:
        deed = deeds[0]
        f_reg = _get_field(deed, "registration_number")
        findings.append(
            DiscrepancyFinding(
                id=f"DISC-R3-{len(findings)+1:02d}",
                rule_id="R3",
                rule_name="Missing Mutation Extract for Registered Deed",
                severity="Medium",
                severity_rationale="Rule R3 assigns 'Medium' when a transfer/partition deed has no matching mutation record.",
                explanation=(
                    f"{deed.filename} records a registered transfer/partition, but no corresponding "
                    "Mutation Register (MR) extract was found in the case documents; requires verification."
                ),
                suggested_next_step="Obtain certified MR extract from Bhoomi kiosk corresponding to the deed.",
                fields_compared={"deed": deed.filename, "mutation_extracts_count": 0},
                evidence_refs=[_make_ev(deed, f_reg, deed.filename)],
                review_status="pending",
            )
        )

    # ==========================================================
    # RULE R4: Survey-Number Mismatch Across Documents
    # ==========================================================
    survey_mentions: List[Tuple[DocumentItem, ExtractedField, str]] = []
    for doc in active_docs:
        f_sy = _get_field(doc, "survey_number")
        val = _effective_val(f_sy)
        if val:
            sy_norm = normalize_numerals(str(val)).strip().upper()
            if sy_norm:
                survey_mentions.append((doc, f_sy, sy_norm))

    unique_surveys = sorted({sy for _, _, sy in survey_mentions})
    if len(unique_surveys) > 1:
        ev_refs = [_make_ev(d, f, f"Survey No: {sy}") for d, f, sy in survey_mentions]
        findings.append(
            DiscrepancyFinding(
                id=f"DISC-R4-{len(findings)+1:02d}",
                rule_id="R4",
                rule_name="Survey Number Mismatch Across Documents",
                severity="Medium",
                severity_rationale=(
                    "Rule R4 assigns 'Medium' when primary documents in the same case cite differing survey/hissa numbers."
                ),
                explanation=(
                    f"Documents in this case cite differing primary survey numbers ({', '.join(unique_surveys)}). "
                    "Unless explained by renumbering or hissa phodi, this discrepancy requires verification."
                ),
                suggested_next_step="Cross-check village Akarband and phodi orders to confirm whether survey numbers were renumbered.",
                fields_compared={"survey_numbers_observed": unique_surveys},
                evidence_refs=ev_refs,
                review_status="pending",
            )
        )

    # ==========================================================
    # RULE R5: Missing Expected Supporting Document
    # ==========================================================
    for rtc in rtcs:
        f_enc = _get_field(rtc, "column_11_encumbrance")
        enc_val = str(_effective_val(f_enc) or "").strip()
        enc_low = enc_val.lower()
        is_nil_enc = (
            "nil" in enc_low
            or "ಇಲ್ಲ" in enc_val
            or "ಶೂನ್ಯ" in enc_val
            or bool(re.search(r"\bnone\b", enc_low))
        )
        has_enc_term = any(
            kw in enc_low or kw in enc_val
            for kw in (
                "mortgage",
                "charge",
                "loan",
                "lien",
                "hypothecation",
                "ಸಾಲ",
                "ಅಡಮಾನ",
                "ಬಾಧ್ಯತೆ",
                "ಬ್ಯಾಂಕ್",
            )
        )
        if enc_val and not is_nil_enc and has_enc_term:
            if not mortgages:
                findings.append(
                    DiscrepancyFinding(
                        id=f"DISC-R5-{len(findings)+1:02d}",
                        rule_id="R5",
                        rule_name="Missing Expected Supporting Document",
                        severity="Medium",
                        severity_rationale=(
                            "Rule R5 assigns 'Medium' when an active encumbrance or charge is cited in Column 11 "
                            "without supporting mortgage deed or bank discharge/NOC documentation."
                        ),
                        explanation=(
                            f"RTC Column 11 in {rtc.filename} states: '{enc_val}', "
                            "but no registered mortgage deed, loan closure letter, or bank NOC has been provided; "
                            "encumbrance status requires verification."
                        ),
                        suggested_next_step=(
                            "Obtain Form 15/16 Encumbrance Certificate (EC) from Kaveri Online and request a Bank NOC / "
                            "Discharge Deed if the loan has been repaid."
                        ),
                        fields_compared={
                            "encumbrance_reference": enc_val,
                            "supporting_mortgage_docs_uploaded": 0,
                        },
                        evidence_refs=[_make_ev(rtc, f_enc, enc_val)],
                        review_status="pending",
                    )
                )

    for deed in deeds:
        f_reg = _get_field(deed, "registration_number")
        if not f_reg or not str(_effective_val(f_reg) or "").strip():
            f_any = deed.extracted_fields[0] if deed.extracted_fields else None
            findings.append(
                DiscrepancyFinding(
                    id=f"DISC-R5-{len(findings)+1:02d}",
                    rule_id="R5",
                    rule_name="Missing Registration Details on Deed",
                    severity="Medium",
                    severity_rationale="Rule R5 assigns 'Medium' when a partition/sale deed lacks registration reference.",
                    explanation=f"{deed.filename} appears to lack an extracted Sub-Registrar registration number; requires verification.",
                    suggested_next_step="Upload the registered index/endorsement page showing Sub-Registrar registration number.",
                    fields_compared={"deed": deed.filename, "registration_number": None},
                    evidence_refs=[_make_ev(deed, f_any, deed.filename)],
                    review_status="pending",
                )
            )

    # ==========================================================
    # EVIDENCE CHECK GATE (CLAUDE.md Rule 1: No evidence = no finding)
    # ==========================================================
    verified_findings = [
        f
        for f in findings
        if f.evidence_refs
        and all(ev.document_id and ev.document_name and ev.page >= 1 and ev.original_text for ev in f.evidence_refs)
    ]
    return verified_findings
