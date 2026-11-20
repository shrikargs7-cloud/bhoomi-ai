"""BhoomiAI Comparable-Based Valuation Baseline (SPEC Section 10)
Strictly abstains unless >= 3 verified comparable transactions exist.
Never presents synthetic numbers as market valuation or registered valuer reports.
"""

import statistics
from typing import List, Optional
from app.models.schemas import ComparableItem, ValuationResponse, DocumentItem
from app.core.normalization import parse_extent_to_acres

ABSTENTION_EXACT_MSG = "Insufficient verified comparable evidence to produce a reliable valuation."
MIN_VERIFIED_COMPARABLES = 3


def _subject_extent_from_docs(documents: List[DocumentItem]) -> tuple[Optional[float], Optional[str]]:
    # Prefer RTC extent, fallback to deed/sketch
    for doc_type in ("RTC", "SURVEY_SKETCH", "PARTITION_DEED", "SALE_DEED"):
        for d in documents:
            if d.doc_type == doc_type and d.status == "extracted":
                for f in d.extracted_fields:
                    if f.field_name in ("total_extent", "stated_extent", "extent_allotted"):
                        val = f.reviewer_value if (f.reviewer_value is not None and f.verification_status == "corrected") else f.normalized_value
                        if isinstance(val, (int, float)) and val > 0:
                            return float(val), f"{d.filename} ({f.original_text})"
                        if isinstance(val, str):
                            parsed = parse_extent_to_acres(val)
                            if parsed > 0:
                                return parsed, f"{d.filename} ({f.original_text})"
    return None, None


def compute_valuation_baseline(
    case_id: str,
    documents: List[DocumentItem],
    comparables: List[ComparableItem],
) -> ValuationResponse:
    subject_extent, extent_source = _subject_extent_from_docs(documents)
    verified = [c for c in comparables if c.verified and c.extent_acres > 0 and c.sale_price_inr > 0]

    limitations = (
        "Comparable-based arithmetic baseline only. NOT a registered valuer report, bank appraisal, "
        "or official Sub-Registrar guidance valuation."
    )

    if len(verified) < MIN_VERIFIED_COMPARABLES:
        return ValuationResponse(
            case_id=case_id,
            abstained=True,
            message=ABSTENTION_EXACT_MSG,
            verified_count=len(verified),
            total_count=len(comparables),
            subject_extent_acres=subject_extent,
            subject_extent_source=extent_source,
            method="Comparable-based arithmetic range (Abstained: < 3 verified comparables)",
            limitations=limitations,
            comparables=comparables,
        )

    rates = sorted([c.price_per_acre_inr for c in verified])
    min_rate = round(rates[0], 2)
    median_rate = round(statistics.median(rates), 2)
    max_rate = round(rates[-1], 2)

    est_range = None
    if subject_extent and subject_extent > 0:
        est_range = [round(min_rate * subject_extent, 0), round(max_rate * subject_extent, 0)]

    has_synthetic = any(c.synthetic for c in verified)
    msg = (
        f"Computed from {len(verified)} verified comparable(s)"
        + (" [Includes Synthetic Demo Comparables — NOT Real Market Values]." if has_synthetic else ".")
    )

    return ValuationResponse(
        case_id=case_id,
        abstained=False,
        message=msg,
        verified_count=len(verified),
        total_count=len(comparables),
        subject_extent_acres=subject_extent,
        subject_extent_source=extent_source,
        min_price_per_acre_inr=min_rate,
        median_price_per_acre_inr=median_rate,
        max_price_per_acre_inr=max_rate,
        estimated_range_inr=est_range,
        method="Min / Median / Max ₹ per acre across user-verified comparables",
        limitations=limitations,
        comparables=comparables,
    )
