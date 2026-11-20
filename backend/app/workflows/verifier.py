"""BhoomiAI Deterministic Unsupported-Claim Verifier Gate (SPEC Section 15 / Phase 3)
Validates every discrepancy finding, ownership event, and legal RAG answer against
extracted document citations and non-accusatory phrasing rules before persistence or PDF export.
"""

import re
from typing import Any, Dict, List, Set

from pydantic import BaseModel

from app.models.schemas import (
    DiscrepancyFinding,
    DocumentItem,
    EvidenceRef,
    LegalQueryResponse,
    OwnershipEvent,
)

PROHIBITED_ACCUSATION_RE = re.compile(
    r"\b(?:fraud|fraudulent|forged|forgery|criminal|illegal\s+title|legally\s+valid\s+title|certified\s+clean\s+title)\b",
    re.IGNORECASE,
)


class VerificationReport(BaseModel):
    passed: bool
    verified_discrepancies: List[DiscrepancyFinding]
    blocked_discrepancies: List[Dict[str, Any]]
    verified_events: List[OwnershipEvent]
    blocked_events: List[Dict[str, Any]]
    total_checked: int
    total_blocked: int
    unsupported_claim_rate_pct: float


def _norm_ws(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip().lower()


def _meaningful_tokens(text: str) -> Set[str]:
    return {tok for tok in re.findall(r"[0-9a-zA-Z\u0C80-\u0CFF]+", _norm_ws(text)) if len(tok) >= 3}


def _collect_doc_corpus(doc: DocumentItem) -> List[str]:
    corpus: List[str] = [doc.filename]
    for f in doc.extracted_fields:
        if f.original_text:
            corpus.append(str(f.original_text))
        for val in (f.normalized_value, f.reviewer_value):
            if val is None:
                continue
            if isinstance(val, list):
                corpus.extend(str(item) for item in val if item is not None)
                corpus.append(" ".join(str(item) for item in val if item is not None))
            elif isinstance(val, dict):
                corpus.extend(f"{k} {v}" for k, v in val.items())
            else:
                corpus.append(str(val))
    return [c for c in corpus if str(c).strip()]


def _is_evidence_grounded_in_doc(ev: EvidenceRef, doc: DocumentItem) -> bool:
    ev_norm = _norm_ws(ev.original_text)
    if not ev_norm:
        return False

    corpus = _collect_doc_corpus(doc)
    for entry in corpus:
        c_norm = _norm_ws(entry)
        if not c_norm:
            continue
        if ev_norm in c_norm or (len(c_norm) >= 3 and c_norm in ev_norm):
            return True

    ev_tokens = _meaningful_tokens(ev_norm)
    if not ev_tokens:
        return False
    corpus_tokens: Set[str] = set()
    for entry in corpus:
        corpus_tokens |= _meaningful_tokens(entry)
    overlap_ratio = len(ev_tokens & corpus_tokens) / len(ev_tokens)
    return overlap_ratio >= 0.5


def verify_case_claims(
    documents: List[DocumentItem],
    discrepancies: List[DiscrepancyFinding],
    ownership_events: List[OwnershipEvent],
) -> VerificationReport:
    """Enforces V1-V4 deterministic grounding and phrasing checks across findings and events."""
    doc_by_id: Dict[str, DocumentItem] = {d.id: d for d in documents}

    verified_discs: List[DiscrepancyFinding] = []
    blocked_discs: List[Dict[str, Any]] = []

    for f in discrepancies:
        reasons: List[str] = []

        # V1: Evidence Completeness & Document/Page Bounds
        if not f.evidence_refs:
            reasons.append("V1: Finding lacks evidence citations.")
        else:
            for ev in f.evidence_refs:
                doc = doc_by_id.get(ev.document_id)
                if not doc:
                    reasons.append(f"V1: Unknown referenced document_id '{ev.document_id}'.")
                    continue
                if ev.document_name != doc.filename:
                    reasons.append(
                        f"V1: Document filename mismatch ('{ev.document_name}' != '{doc.filename}')."
                    )
                max_page = max(1, doc.pages_count)
                if ev.page < 1 or ev.page > max_page:
                    reasons.append(f"V1: Page {ev.page} out of range 1..{max_page} for '{doc.filename}'.")
                if not str(ev.original_text or "").strip():
                    reasons.append(f"V1: Empty citation original_text for '{doc.filename}'.")
                elif not _is_evidence_grounded_in_doc(ev, doc):
                    # V2: Field-Value Grounding Check
                    reasons.append(
                        f"V2: Citation text '{ev.original_text[:48]}' is not grounded in extracted fields of '{doc.filename}'."
                    )

        # V3: Non-Accusatory & Non-Certification Phrasing Guard (CLAUDE.md Rule 7)
        if PROHIBITED_ACCUSATION_RE.search(f.explanation or ""):
            reasons.append("V3: Explanation uses prohibited accusation or legal certification terminology.")

        if reasons:
            blocked_discs.append(
                {
                    "id": f.id,
                    "rule_id": f.rule_id,
                    "reasons": reasons,
                }
            )
        else:
            verified_discs.append(f)

    verified_events: List[OwnershipEvent] = []
    blocked_events: List[Dict[str, Any]] = []

    for ev_item in ownership_events:
        ev = ev_item.evidence
        doc = doc_by_id.get(ev.document_id) if ev else None
        ev_reasons: List[str] = []
        if not ev:
            ev_reasons.append("V4: Ownership event lacks evidence ref.")
        elif not doc:
            ev_reasons.append(f"V4: Unknown document_id '{ev.document_id}'.")
        else:
            max_page = max(1, doc.pages_count)
            if ev.page < 1 or ev.page > max_page:
                ev_reasons.append(f"V4: Page {ev.page} out of bounds 1..{max_page}.")
            if not str(ev.original_text or "").strip():
                ev_reasons.append("V4: Ownership event citation original_text is empty.")

        if ev_reasons:
            blocked_events.append({"id": ev_item.id, "reasons": ev_reasons})
        else:
            verified_events.append(ev_item)

    total_checked = len(discrepancies) + len(ownership_events)
    total_blocked = len(blocked_discs) + len(blocked_events)
    rate = round((total_blocked / total_checked) * 100.0, 2) if total_checked > 0 else 0.0

    return VerificationReport(
        passed=total_blocked == 0,
        verified_discrepancies=verified_discs,
        blocked_discrepancies=blocked_discs,
        verified_events=verified_events,
        blocked_events=blocked_events,
        total_checked=total_checked,
        total_blocked=total_blocked,
        unsupported_claim_rate_pct=rate,
    )


def verify_legal_response(resp: LegalQueryResponse, corpus: List[Dict[str, Any]]) -> LegalQueryResponse:
    """Ensures non-abstained legal RAG responses strictly match a curated statutory entry."""
    if resp.abstained:
        return resp

    by_title = {item["title"]: item for item in corpus}
    src = by_title.get(resp.source or "")
    section_ok = src is not None and (resp.section_or_page == src["section"])
    sources_ok = len(resp.matched_sources) >= 1 and all(ms.title in by_title for ms in resp.matched_sources)

    if src and section_ok and sources_ok:
        return resp

    return LegalQueryResponse(
        abstained=True,
        explanation=(
            "Legal citation verification blocked an unverified statutory claim. BhoomiAI abstains unless "
            "the cited statute and section match its curated Karnataka statutory corpus."
        ),
        jurisdiction="Karnataka / India",
        source=None,
        section_or_page=None,
        retrieval_date=None,
        limitations="Curated statutory verification failed — abstained per CLAUDE.md Rule 1.",
        referral="Refer this question to a qualified property advocate practicing before Karnataka Revenue Courts.",
        matched_sources=[],
    )
