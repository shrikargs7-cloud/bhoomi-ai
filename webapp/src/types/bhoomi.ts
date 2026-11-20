export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvidenceRef {
  document_id: string;
  document_name: string;
  page: number;
  original_text: string;
  bounding_box?: BoundingBox | null;
}

export interface ExtractedField {
  id?: string;
  field_name: string;
  label: string;
  original_text: string;
  normalized_value: any;
  confidence: number;
  method: string;
  page: number;
  bounding_box?: BoundingBox | null;
  reviewer_value?: any;
  verification_status: string;
  notes?: string | null;
}

export interface DocumentItem {
  id: string;
  filename: string;
  doc_type: string;
  mime_type: string;
  pages_count: number;
  file_size_kb: number;
  upload_timestamp: string;
  file_hash: string;
  language: string;
  extraction_method: string;
  extracted_fields: ExtractedField[];
  ocr_quality_score: number;
  status: string;
  quality_warning?: string | null;
  injection_warning?: string | null;
}

export interface PersonEntity {
  id: string;
  canonical_name: string;
  normalized_name: string;
  aliases: string[];
  is_deceased: boolean;
  date_of_death?: string | null;
  resolution_status: string;
  similarity_score: number;
}

export interface OwnershipEvent {
  id: string;
  date?: string | null;
  event_type: string;
  description: string;
  parties_involved: string[];
  extent_affected?: string | null;
  status: string;
  evidence: EvidenceRef;
}

export interface DiscrepancyFinding {
  id: string;
  rule_id: string;
  rule_name: string;
  severity: string;
  severity_rationale: string;
  explanation: string;
  suggested_next_step: string;
  fields_compared: Record<string, any>;
  evidence_refs: EvidenceRef[];
  review_status: string;
  reviewer_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export interface ReadinessDimension {
  dimension_name: string;
  status: string;
  checks_run: number;
  issues_found: number;
  evidence_count: number;
  missing_items: string[];
  review_status: string;
  summary: string;
}

export interface WorkflowStepTrace {
  node: string;
  status: string;
  duration_ms: number;
  summary: string;
  conditional_branch?: string | null;
}

export interface WorkflowRunSummary {
  id: string;
  status: string;
  started_at: string;
  completed_at: string;
  trace: WorkflowStepTrace[];
}

export interface ReviewDecisionEntry {
  id: string;
  target_type: string;
  target_id: string;
  decision: string;
  previous_value?: string | null;
  new_value?: string | null;
  notes?: string | null;
  actor_name: string;
  actor_role: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  details: string;
  created_at: string;
}

export interface LandCase {
  case_id: string;
  case_name: string;
  village: string;
  hobli: string;
  taluk: string;
  district: string;
  survey_number: string;
  created_at: string;
  synthetic: boolean;
  is_public_demo: boolean;
  external_llm_consent: boolean;
  disclaimer: string;
  documents: DocumentItem[];
  persons: PersonEntity[];
  ownership_events: OwnershipEvent[];
  discrepancies: DiscrepancyFinding[];
  readiness_dimensions: ReadinessDimension[];
  latest_workflow_run?: WorkflowRunSummary | null;
  review_decisions: ReviewDecisionEntry[];
  audit_logs: AuditLogEntry[];
  status: string;
}

export interface CaseSummaryItem {
  case_id: string;
  case_name: string;
  village: string;
  district: string;
  survey_number: string;
  documents_count: number;
  discrepancies_count: number;
  synthetic: boolean;
  status: string;
  created_at: string;
}

export interface OwnershipGraphResponse {
  case_id: string;
  nodes: Array<{ id: string; node_type: string; label: string; meta: Record<string, any> }>;
  edges: Array<{ source: string; target: string; relation: string }>;
}

export interface ComparableItem {
  id: string;
  label: string;
  location: string;
  sale_date: string;
  extent_str: string;
  extent_acres: number;
  sale_price_inr: number;
  price_per_acre_inr: number;
  source_ref: string;
  verified: boolean;
  synthetic: boolean;
}

export interface ValuationResponse {
  case_id: string;
  abstained: boolean;
  message: string;
  verified_count: number;
  total_count: number;
  subject_extent_acres?: number | null;
  subject_extent_source?: string | null;
  min_price_per_acre_inr?: number | null;
  median_price_per_acre_inr?: number | null;
  max_price_per_acre_inr?: number | null;
  estimated_range_inr?: number[] | null;
  method: string;
  limitations: string;
  comparables: ComparableItem[];
}

export interface GeoJsonQaCheck {
  check_id: string;
  name: string;
  passed: boolean;
  severity: string;
  detail: string;
}

export interface GeoJsonResponse {
  case_id: string;
  has_geometry: boolean;
  source_description?: string | null;
  synthetic: boolean;
  message: string;
  geojson?: any;
  computed_area_acres?: number | null;
  rtc_extent_acres?: number | null;
  area_variance_acres?: number | null;
  qa_checks: GeoJsonQaCheck[];
}

export interface LegalSourceItem {
  id: string;
  title: string;
  jurisdiction: string;
  section: string;
  retrieval_date: string;
  summary: string;
}

export interface LegalQueryResponse {
  abstained: boolean;
  explanation: string;
  jurisdiction: string;
  source?: string | null;
  section_or_page?: string | null;
  retrieval_date?: string | null;
  limitations: string;
  referral: string;
  matched_sources: LegalSourceItem[];
}
