"""BhoomiAI Dynamic Ownership Event Resolver, Entity Resolution & Lineage Graph.
Reconstructs chronological ownership events strictly from parsed document fields,
resolves person entities with Jaro-Winkler similarity (never auto-merging uncertain
candidates below 0.88), and builds a NetworkX lineage graph.
"""

import re
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import networkx as nx

from app.models.schemas import (
    DocumentItem,
    ExtractedField,
    OwnershipEvent,
    EvidenceRef,
    PersonEntity,
    GraphNode,
    GraphEdge,
)
from app.core.normalization import normalize_name, match_names, format_extent


def _effective_field(doc: DocumentItem, field_name: str) -> Optional[ExtractedField]:
    return next((f for f in doc.extracted_fields if f.field_name == field_name), None)


def _effective_val(field: Optional[ExtractedField]) -> Any:
    if field is None:
        return None
    if field.reviewer_value is not None and field.verification_status == "corrected":
        return field.reviewer_value
    return field.normalized_value


def _parse_date_sortable(date_str: Optional[str]) -> datetime:
    if not date_str:
        return datetime.max
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(date_str).strip(), fmt)
        except Exception:
            pass
    return datetime.max


def resolve_person_entities(documents: List[DocumentItem]) -> List[PersonEntity]:
    """Extracts all person mentions across documents and clusters via Jaro-Winkler similarity."""
    mentions: List[Dict[str, Any]] = []
    deceased_names: Dict[str, str] = {}

    for doc in documents:
        if doc.status != "extracted":
            continue
        if doc.doc_type == "DEATH_CERTIFICATE":
            f_name = _effective_field(doc, "deceased_name")
            f_dod = _effective_field(doc, "date_of_death")
            name_val = _effective_val(f_name)
            if name_val:
                norm = normalize_name(str(name_val))
                deceased_names[norm] = str(_effective_val(f_dod) or "")
                mentions.append({"raw": str(name_val), "source": doc.filename, "deceased": True, "dod": deceased_names[norm]})

        elif doc.doc_type == "RTC":
            f_owners = _effective_field(doc, "recorded_owners")
            owners_val = _effective_val(f_owners)
            if isinstance(owners_val, str):
                owners_val = [x.strip() for x in owners_val.split(",") if x.strip()]
            if isinstance(owners_val, list):
                for o in owners_val:
                    mentions.append({"raw": str(o), "source": doc.filename, "deceased": False, "dod": None})

        elif doc.doc_type in ("PARTITION_DEED", "SALE_DEED"):
            f_allot = _effective_field(doc, "allottee")
            val = _effective_val(f_allot)
            if val:
                mentions.append({"raw": str(val), "source": doc.filename, "deceased": False, "dod": None})

    clusters: List[PersonEntity] = []
    for m in mentions:
        raw = m["raw"].strip()
        if not raw:
            continue
        norm = normalize_name(raw)
        if not norm:
            continue

        matched_cluster: Optional[PersonEntity] = None
        best_score = 0.0
        for cl in clusters:
            is_match, score, _ = match_names(raw, cl.canonical_name)
            if is_match and score > best_score:
                matched_cluster = cl
                best_score = score
            elif 0.68 <= score < 0.88 and score > best_score:
                # Uncertain candidate — record as distinct uncertain entity needing reviewer confirmation
                best_score = score

        if matched_cluster:
            if raw not in matched_cluster.aliases:
                matched_cluster.aliases.append(raw)
            if m["deceased"]:
                matched_cluster.is_deceased = True
                matched_cluster.date_of_death = m["dod"]
            matched_cluster.similarity_score = min(matched_cluster.similarity_score, best_score)
        else:
            is_dec = m["deceased"] or (norm in deceased_names)
            dod = m["dod"] or deceased_names.get(norm)
            status = "confirmed" if best_score == 0.0 or best_score >= 0.88 else "uncertain"
            clusters.append(
                PersonEntity(
                    id=f"PER-{len(clusters)+1:02d}",
                    canonical_name=raw,
                    normalized_name=norm,
                    aliases=[raw],
                    is_deceased=is_dec,
                    date_of_death=dod,
                    resolution_status=status,
                    similarity_score=round(best_score if best_score > 0 else 1.0, 3),
                )
            )

    return clusters


def reconstruct_ownership_events(documents: List[DocumentItem]) -> List[OwnershipEvent]:
    """Dynamically reconstructs chronological ownership events solely from parsed documents."""
    events: List[OwnershipEvent] = []

    for doc in documents:
        if doc.status != "extracted":
            continue

        if doc.doc_type in ("PARTITION_DEED", "SALE_DEED"):
            f_date = _effective_field(doc, "execution_date")
            f_reg = _effective_field(doc, "registration_number")
            f_allot = _effective_field(doc, "allottee")
            f_survey = _effective_field(doc, "survey_number")
            f_ext = _effective_field(doc, "extent_allotted")

            exec_date = str(_effective_val(f_date)) if f_date else None
            reg_no = str(_effective_val(f_reg)) if f_reg else "Unregistered"
            allottee = str(_effective_val(f_allot)) if f_allot else "Unknown Party"
            survey_no = str(_effective_val(f_survey)) if f_survey else "N/A"
            ext_val = _effective_val(f_ext)
            ext_str = format_extent(float(ext_val)) if isinstance(ext_val, (int, float)) else (f_ext.original_text if f_ext else None)

            ev_type = "partition" if doc.doc_type == "PARTITION_DEED" else "sale"
            desc = (
                f"Registered {'Partition' if ev_type == 'partition' else 'Sale'} Deed ({reg_no}) "
                f"for Survey No. {survey_no}: Schedule A allotted/conveyed to {allottee}"
                + (f" ({ext_str})." if ext_str else ".")
            )
            anchor = f_ext or f_allot or f_reg or doc.extracted_fields[0] if doc.extracted_fields else None
            events.append(
                OwnershipEvent(
                    id=f"EVT-{len(events)+1:02d}",
                    date=exec_date,
                    event_type=ev_type,
                    description=desc,
                    parties_involved=[allottee],
                    extent_affected=ext_str,
                    status="documented" if exec_date else "unresolved",
                    evidence=EvidenceRef(
                        document_id=doc.id,
                        document_name=doc.filename,
                        page=anchor.page if anchor else 1,
                        original_text=anchor.original_text if anchor else doc.filename,
                        bounding_box=anchor.bounding_box if anchor else None,
                    ),
                )
            )

        elif doc.doc_type == "DEATH_CERTIFICATE":
            f_name = _effective_field(doc, "deceased_name")
            f_dod = _effective_field(doc, "date_of_death")
            f_reg = _effective_field(doc, "registration_number")
            f_place = _effective_field(doc, "place_of_death")
            if f_name:
                name_val = str(_effective_val(f_name))
                dod_val = str(_effective_val(f_dod)) if f_dod else None
                reg_val = str(_effective_val(f_reg)) if f_reg else "N/A"
                place_val = str(_effective_val(f_place)) if f_place else "Registrar Office"
                events.append(
                    OwnershipEvent(
                        id=f"EVT-{len(events)+1:02d}",
                        date=dod_val,
                        event_type="death",
                        description=f"Demise of {name_val} at {place_val}. Official Death Certificate Reg No: {reg_val}.",
                        parties_involved=[name_val],
                        extent_affected=None,
                        status="documented" if dod_val else "unresolved",
                        evidence=EvidenceRef(
                            document_id=doc.id,
                            document_name=doc.filename,
                            page=f_name.page,
                            original_text=f"{f_name.original_text} | Date of Death: {dod_val or 'Missing'} | Reg: {reg_val}",
                            bounding_box=f_dod.bounding_box if f_dod else f_name.bounding_box,
                        ),
                    )
                )

        elif doc.doc_type == "MUTATION_EXTRACT":
            f_mr = _effective_field(doc, "mutation_number")
            f_date = _effective_field(doc, "mutation_date")
            f_type = _effective_field(doc, "mutation_type")
            f_ext = _effective_field(doc, "transferred_extent")
            f_inh = _effective_field(doc, "is_inheritance_mutation")

            mr_no = str(_effective_val(f_mr)) if f_mr else "Unknown MR"
            mr_date = str(_effective_val(f_date)) if f_date else None
            m_type = str(_effective_val(f_type)) if f_type else "Revenue Mutation"
            ext_val = _effective_val(f_ext)
            ext_str = format_extent(float(ext_val)) if isinstance(ext_val, (int, float)) else None
            anchor = f_type or f_mr or (doc.extracted_fields[0] if doc.extracted_fields else None)

            events.append(
                OwnershipEvent(
                    id=f"EVT-{len(events)+1:02d}",
                    date=mr_date,
                    event_type="mutation",
                    description=f"Mutation Extract {mr_no} ({m_type}) certified." + (f" Transferred extent: {ext_str}." if ext_str else ""),
                    parties_involved=[],
                    extent_affected=ext_str,
                    status="documented" if mr_date else "unresolved",
                    evidence=EvidenceRef(
                        document_id=doc.id,
                        document_name=doc.filename,
                        page=anchor.page if anchor else 1,
                        original_text=anchor.original_text if anchor else mr_no,
                        bounding_box=anchor.bounding_box if anchor else None,
                    ),
                )
            )

        elif doc.doc_type == "RTC":
            f_date = _effective_field(doc, "record_date")
            f_survey = _effective_field(doc, "survey_number")
            f_owners = _effective_field(doc, "recorded_owners")
            f_ext = _effective_field(doc, "total_extent")
            f_enc = _effective_field(doc, "column_11_encumbrance")

            rec_date = str(_effective_val(f_date)) if f_date else None
            survey_no = str(_effective_val(f_survey)) if f_survey else "N/A"
            owners_raw = _effective_val(f_owners)
            if isinstance(owners_raw, str):
                owners = [x.strip() for x in owners_raw.split(",") if x.strip()]
            elif isinstance(owners_raw, list):
                owners = [str(x) for x in owners_raw]
            else:
                owners = []
            ext_val = _effective_val(f_ext)
            ext_str = format_extent(float(ext_val)) if isinstance(ext_val, (int, float)) else None

            if f_enc:
                enc_text = str(_effective_val(f_enc) or "")
                if any(k in enc_text.lower() for k in ("mortgage", "loan", "charge", "lien")):
                    dm = re.search(r"([0-9]{2}/[0-9]{2}/[0-9]{4})", enc_text)
                    enc_date = dm.group(1) if dm else None
                    events.append(
                        OwnershipEvent(
                            id=f"EVT-{len(events)+1:02d}",
                            date=enc_date,
                            event_type="mortgage",
                            description=f"Encumbrance noted in RTC Column 11 for Survey No. {survey_no}: {enc_text} (Supporting deed requires verification).",
                            parties_involved=owners,
                            extent_affected=f"Survey No. {survey_no}",
                            status="unresolved",
                            evidence=EvidenceRef(
                                document_id=doc.id,
                                document_name=doc.filename,
                                page=f_enc.page,
                                original_text=f_enc.original_text,
                                bounding_box=f_enc.bounding_box,
                            ),
                        )
                    )

            anchor = f_owners or f_ext or (doc.extracted_fields[0] if doc.extracted_fields else None)
            events.append(
                OwnershipEvent(
                    id=f"EVT-{len(events)+1:02d}",
                    date=rec_date,
                    event_type="rtc_record",
                    description=(
                        f"RTC Form 16 for Survey No. {survey_no} lists recorded owner(s): "
                        f"{', '.join(owners) if owners else 'Unspecified'}."
                        + (f" Recorded extent: {ext_str}." if ext_str else "")
                    ),
                    parties_involved=owners,
                    extent_affected=ext_str,
                    status="documented" if rec_date else "unresolved",
                    evidence=EvidenceRef(
                        document_id=doc.id,
                        document_name=doc.filename,
                        page=anchor.page if anchor else 1,
                        original_text=anchor.original_text if anchor else doc.filename,
                        bounding_box=anchor.bounding_box if anchor else None,
                    ),
                )
            )

    events.sort(key=lambda e: _parse_date_sortable(e.date))
    for i, ev in enumerate(events, start=1):
        ev.id = f"EVT-{i:02d}"
    return events


def build_lineage_graph(
    survey_number: str,
    persons: List[PersonEntity],
    events: List[OwnershipEvent],
    documents: List[DocumentItem],
) -> Tuple[nx.DiGraph, List[GraphNode], List[GraphEdge]]:
    """Builds NetworkX graph and returns both DiGraph and serialized nodes/edges."""
    G = nx.DiGraph()
    nodes: List[GraphNode] = []
    edges: List[GraphEdge] = []
    seen_nodes = set()

    def add_node(nid: str, ntype: str, label: str, meta: Dict[str, Any]):
        if nid not in seen_nodes:
            seen_nodes.add(nid)
            G.add_node(nid, node_type=ntype, label=label, **meta)
            nodes.append(GraphNode(id=nid, node_type=ntype, label=label, meta=meta))

    def add_edge(src: str, dst: str, rel: str):
        if not G.has_edge(src, dst):
            G.add_edge(src, dst, relation=rel)
            edges.append(GraphEdge(source=src, target=dst, relation=rel))

    parcel_id = f"Parcel:{survey_number or 'Unknown'}"
    add_node(parcel_id, "Parcel", f"Survey No. {survey_number or 'Unknown'}", {"survey_number": survey_number})

    for p in persons:
        pid = f"Person:{p.canonical_name}"
        add_node(
            pid,
            "Person",
            p.canonical_name,
            {
                "is_deceased": p.is_deceased,
                "date_of_death": p.date_of_death,
                "resolution_status": p.resolution_status,
                "similarity_score": p.similarity_score,
            },
        )

    for doc in documents:
        did = f"Doc:{doc.filename}"
        add_node(did, "Document", doc.filename, {"doc_type": doc.doc_type, "doc_id": doc.id})

    for ev in events:
        eid = f"Event:{ev.id}"
        add_node(
            eid,
            "Event",
            f"{ev.event_type.upper()} ({ev.date or 'Undated'})",
            {"date": ev.date, "event_type": ev.event_type, "status": ev.status, "description": ev.description},
        )
        add_edge(eid, parcel_id, "AFFECTS")
        doc_nid = f"Doc:{ev.evidence.document_name}"
        add_node(doc_nid, "Document", ev.evidence.document_name, {"doc_id": ev.evidence.document_id})
        add_edge(doc_nid, eid, "SUPPORTS")

        for party in ev.parties_involved:
            pid = f"Person:{party}"
            add_node(pid, "Person", party, {})
            rel = "OWNS" if ev.event_type == "rtc_record" else "PARTICIPATES_IN"
            add_edge(pid, eid, rel)
            if ev.event_type == "rtc_record":
                add_edge(pid, parcel_id, "OWNS")

    return G, nodes, edges
