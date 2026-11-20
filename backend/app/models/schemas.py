"""BhoomiAI Pydantic Schemas
Typed contracts for Auth, Cases, Documents, Extracted Fields, Ownership Graph,
Discrepancies, Workflow Trace, Comparables/Valuation, GIS QA, and Legal Reference.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# --- Auth Schemas ---
class UserRegisterRequest(BaseModel):
    email: str
    name: str
    password: str = Field(min_length=6)
    role: str = "farmer"  # farmer | reviewer


class UserLoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


# --- Evidence & Extraction Schemas ---
class EvidenceRef(BaseModel):
    document_id: str
    document_name: str
    page: int
    original_text: str
    bounding_box: Optional[Dict[str, float]] = None


class ExtractedField(BaseModel):
    id: Optional[str] = None
    field_name: str
    label: str
    original_text: str
    normalized_value: Any
    confidence: float
    method: str
    page: int
    bounding_box: Optional[Dict[str, float]] = None
    reviewer_value: Optional[Any] = None
    verification_status: str = "unverified"
    notes: Optional[str] = None


class DocumentItem(BaseModel):
    id: str
    filename: str
    doc_type: str
    mime_type: str = "application/pdf"
    pages_count: int
    file_size_kb: int
    upload_timestamp: str
    file_hash: str
    language: str = "English"
    extraction_method: str = "PyMuPDF Digital Layout"
    extracted_fields: List[ExtractedField] = []
    ocr_quality_score: float = 0.95
    status: str = "extracted"
    quality_warning: Optional[str] = None
    injection_warning: Optional[str] = None


# --- Ownership & Entities ---
class PersonEntity(BaseModel):
    id: str
    canonical_name: str
    normalized_name: str
    aliases: List[str] = []
    is_deceased: bool = False
    date_of_death: Optional[str] = None
    resolution_status: str = "confirmed"
    similarity_score: float = 1.0


class OwnershipEvent(BaseModel):
    id: str
    date: Optional[str] = None
    event_type: str
    description: str
    parties_involved: List[str]
    extent_affected: Optional[str] = None
    status: str = "documented"
    evidence: EvidenceRef


class GraphNode(BaseModel):
    id: str
    node_type: str  # Person | Parcel | Event | Document
    label: str
    meta: Dict[str, Any] = {}


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str


class OwnershipGraphResponse(BaseModel):
    case_id: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# --- Discrepancies & Readiness ---
class DiscrepancyFinding(BaseModel):
    id: str
    rule_id: str
    rule_name: str
    severity: str
    severity_rationale: str = ""
    explanation: str
    suggested_next_step: str
    fields_compared: Dict[str, Any]
    evidence_refs: List[EvidenceRef]
    review_status: str = "pending"
    reviewer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None


class ReadinessDimension(BaseModel):
    dimension_name: str
    status: str
    checks_run: int
    issues_found: int
    evidence_count: int = 0
    missing_items: List[str] = []
    review_status: str = "Pending Review"
    summary: str


class WorkflowStepTrace(BaseModel):
    node: str
    status: str  # completed | skipped | escalated
    duration_ms: float
    summary: str
    conditional_branch: Optional[str] = None


class WorkflowRunSummary(BaseModel):
    id: str
    status: str
    started_at: str
    completed_at: str
    trace: List[WorkflowStepTrace]


class ReviewDecisionEntry(BaseModel):
    id: str
    target_type: str
    target_id: str
    decision: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None
    actor_name: str
    actor_role: str
    created_at: str


class AuditLogEntry(BaseModel):
    id: str
    actor_name: str
    actor_role: str
    action: str
    details: str
    created_at: str


# --- Case Schemas ---
class CaseCreateRequest(BaseModel):
    case_name: str
    village: str = ""
    hobli: str = ""
    taluk: str = ""
    district: str = ""
    survey_number: str = ""
    external_llm_consent: bool = False


class CaseSummaryItem(BaseModel):
    case_id: str
    case_name: str
    village: str
    district: str
    survey_number: str
    documents_count: int
    discrepancies_count: int
    synthetic: bool
    status: str
    created_at: str


class LandCase(BaseModel):
    case_id: str
    case_name: str
    village: str
    hobli: str
    taluk: str
    district: str
    survey_number: str
    created_at: str
    synthetic: bool = True
    is_public_demo: bool = True
    external_llm_consent: bool = False
    disclaimer: str = (
        "Synthetic demo data — decision support only. "
        "NOT legal certification of title, boundaries, mutations, valuation, or loan eligibility."
    )
    documents: List[DocumentItem] = []
    persons: List[PersonEntity] = []
    ownership_events: List[OwnershipEvent] = []
    discrepancies: List[DiscrepancyFinding] = []
    readiness_dimensions: List[ReadinessDimension] = []
    latest_workflow_run: Optional[WorkflowRunSummary] = None
    review_decisions: List[ReviewDecisionEntry] = []
    audit_logs: List[AuditLogEntry] = []
    status: str = "ready_for_review"


# --- Correction & Review Requests ---
class FieldCorrectionRequest(BaseModel):
    document_id: str
    field_name: str
    corrected_value: Any
    reviewer_notes: Optional[str] = None


class DiscrepancyReviewRequest(BaseModel):
    discrepancy_id: str
    decision: str  # approved | rejected | escalated | pending
    reviewer_notes: Optional[str] = None


class PersonResolutionRequest(BaseModel):
    resolution_status: str  # confirmed | reviewer_confirmed | distinct
    merged_into_name: Optional[str] = None
    notes: Optional[str] = None


# --- Valuation / Comparables ---
class ComparableCreateRequest(BaseModel):
    label: str
    location: str
    sale_date: str
    extent_str: str
    sale_price_inr: float
    source_ref: str
    verified: bool = False


class ComparableItem(BaseModel):
    id: str
    label: str
    location: str
    sale_date: str
    extent_str: str
    extent_acres: float
    sale_price_inr: float
    price_per_acre_inr: float
    source_ref: str
    verified: bool
    synthetic: bool


class ValuationResponse(BaseModel):
    case_id: str
    abstained: bool
    message: str
    verified_count: int
    total_count: int
    subject_extent_acres: Optional[float] = None
    subject_extent_source: Optional[str] = None
    min_price_per_acre_inr: Optional[float] = None
    median_price_per_acre_inr: Optional[float] = None
    max_price_per_acre_inr: Optional[float] = None
    estimated_range_inr: Optional[List[float]] = None
    method: str
    limitations: str
    comparables: List[ComparableItem] = []


# --- GIS QA ---
class GeoJsonQaCheck(BaseModel):
    check_id: str
    name: str
    passed: bool
    severity: str
    detail: str


class GeoJsonResponse(BaseModel):
    case_id: str
    has_geometry: bool
    source_description: Optional[str] = None
    synthetic: bool = False
    message: str
    geojson: Optional[Dict[str, Any]] = None
    computed_area_acres: Optional[float] = None
    rtc_extent_acres: Optional[float] = None
    area_variance_acres: Optional[float] = None
    qa_checks: List[GeoJsonQaCheck] = []


# --- Legal RAG ---
class LegalQueryRequest(BaseModel):
    query: str
    case_id: Optional[str] = None


class LegalSourceItem(BaseModel):
    id: str
    title: str
    jurisdiction: str
    section: str
    retrieval_date: str
    summary: str


class LegalQueryResponse(BaseModel):
    abstained: bool
    explanation: str
    jurisdiction: str
    source: Optional[str] = None
    section_or_page: Optional[str] = None
    retrieval_date: Optional[str] = None
    limitations: str
    referral: str
    matched_sources: List[LegalSourceItem] = []


# --- Unit Conversion Tool ---
class ExtentConvertRequest(BaseModel):
    extent_str: str


class ExtentConvertResponse(BaseModel):
    input: str
    normalized_numerals: str
    acres: float
    guntas: float
    annas: float
    hectares: float
    cents: float
    sqft: float
    canonical_karnataka: str
