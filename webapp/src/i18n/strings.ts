export type Lang = 'en' | 'kn';

export const UI_STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    brand: 'BhoomiAI',
    tagline: 'Evidence-First Land Intelligence',
    nav_dashboard: 'Readiness',
    nav_documents: 'Documents',
    nav_report: 'Title Audit',
    nav_ownership: 'Ownership',
    nav_gis: 'Survey & GIS',
    nav_valuation: 'Valuation',
    synthetic_banner: 'SYNTHETIC DEMO DATA — DECISION SUPPORT ONLY. NOT A LEGAL TITLE CERTIFICATE.',
    real_banner: 'DECISION SUPPORT ONLY — NOT A LEGAL CERTIFICATION OF TITLE OR BOUNDARIES.',
    role_farmer: 'Farmer',
    role_reviewer: 'Reviewer',
    export_pdf: 'Export PDF',
    new_case: 'New Case',
    new_case_full: 'New Land Case',
    reset_demo: 'Reset Demo',
    rerun_pipeline: 'Re-run Pipeline',
    upload_inspect_docs: 'Upload / Inspect Docs',
    search_cases: 'Search cases by ID, village, or survey...',
    switch_case: 'Switch Active Case',
    sign_in: 'Sign In',
    sign_out: 'Sign Out',
    readiness_title: 'Land Readiness Dimensions (No Single Averaged Score)',
    readiness_sub: 'Each dimension reports checks run, documentary evidence, missing items, and review status independently.',
    documents_title: 'Document Intake, Extraction & Field Verification',
    report_title: 'Detailed Title Audit & Discrepancy Register',
    ownership_title: 'Ownership Lineage & Event Reconstruction',
    gis_title: 'Survey Sketch Evidence & Supplied GeoJSON QA',
    valuation_title: 'Comparable Valuation Baseline & Extent Unit Tools',

    // 4-Column KPIs
    kpi_docs: 'Submitted Documents',
    kpi_docs_sub: 'records verified',
    kpi_discrepancies: 'Issues to Resolve',
    kpi_discrepancies_sub_clean: 'All documents match cleanly',
    kpi_discrepancies_sub_flagged: 'Require your attention',
    kpi_reviews: 'Verification Progress',
    kpi_reviews_sub: 'checks confirmed',
    kpi_low_conf: 'unclear fields',
    kpi_pipeline: 'Verification Status',
    kpi_pipeline_nodes: 'checks completed',

    // Dual Persona: Farmer
    farmer_checklist_title: 'Simple Next Steps for You (Plain-Language Guide)',
    farmer_checklist_sub: 'Clear, step-by-step actions derived directly from your records to get this parcel ready to sell, inherit, or borrow against.',
    farmer_all_clear_title: 'All Submitted Records Match Cleanly',
    farmer_all_clear_desc: 'Zero discrepancies detected across your RTC, deed, and mutation records. Your parcel is ready for bank loan or sale proceedings.',
    farmer_view_proof: 'View Document Proof',
    farmer_legal_help: 'Download Form 21 Remedy',
    farmer_form21_btn: 'Generate Form 21 Mutation Petition',

    // Dual Persona: Reviewer
    reviewer_queue_title: 'Field Officer Triage Queue',
    reviewer_queue_sub: 'Pending discrepancies, low-confidence OCR fields, and unmutated name matches for case approval.',
    reviewer_pending_discs: 'Pending Issues',
    reviewer_low_conf: 'Low-Confidence Fields',
    reviewer_uncertain_persons: 'Name Mismatches',
    reviewer_reuploads: 'Re-upload Requests',
    reviewer_open_case: 'Open Case',
    reviewer_approve: 'Approve',
    reviewer_escalate: 'Escalate',
    reviewer_queue_clear: 'All case checks are clear.',

    // Workspace panels
    cases_panel_title: 'Land Cases',
    cases_panel_sub: 'Switch between the Ramanagara case (requires update) and Mandya case (clean record).',
    pipeline_trace_title: 'Verification Step-by-Step Trace',
    audit_log_title: 'Activity History',
    checks_label: 'Checks Run',
    issues_label: 'Issues Found',
    evidence_cited_label: 'Evidence Items Cited',
    missing_items_label: 'Missing / Pending Items',
    open_detailed_view: 'Open detailed view',
    synthetic_badge: 'Synthetic Demo Data',
    perspective_farmer: 'Farmer / Landowner',
    perspective_reviewer: 'Reviewer Queue',
  },
  kn: {
    brand: 'ಭೂಮಿAI',
    tagline: 'ಸಾಕ್ಷ್ಯ-ಆಧಾರಿತ ಭೂ ದಾಖಲೆ',
    nav_dashboard: 'ಸಿದ್ಧತೆ',
    nav_documents: 'ದಾಖಲೆಗಳು',
    nav_report: 'ಹಕ್ಕು ವರದಿ',
    nav_ownership: 'ಮಾಲೀಕತ್ವ',
    nav_gis: 'ಸರ್ವೇ GIS',
    nav_valuation: 'ಮೌಲ್ಯಮಾಪನ',
    synthetic_banner: 'ಪ್ರಾಯೋಗಿಕ ಮಾದರಿ ದತ್ತಾಂಶ — ನಿರ್ಧಾರ ಸಹಾಯಕ್ಕಾಗಿ ಮಾತ್ರ. ಇದು ಕಾನೂನುಬದ್ಧ ಹಕ್ಕು ಪ್ರಮಾಣಪತ್ರವಲ್ಲ.',
    real_banner: 'ನಿರ್ಧಾರ ಸಹಾಯಕ್ಕಾಗಿ ಮಾತ್ರ — ಕಾನೂನುಬದ್ಧ ಹಕ್ಕು ಅಥವಾ ಗಡಿ ಪ್ರಮಾಣೀಕರಣವಲ್ಲ.',
    role_farmer: 'ರೈತರು',
    role_reviewer: 'ಪರಿಶೀಲಕ',
    export_pdf: 'PDF ರಫ್ತು',
    new_case: 'ಹೊಸ ಪ್ರಕರಣ',
    new_case_full: 'ಹೊಸ ಭೂ ಪ್ರಕರಣ',
    reset_demo: 'ಡೆಮೋ ಮರುಹೊಂದಿಸಿ',
    rerun_pipeline: 'ಪೈಪ್‌ಲೈನ್ ಮರುಚಾಲನೆ',
    upload_inspect_docs: 'ದಾಖಲೆ ಅಪ್‌ಲೋಡ್ / ಪರಿಶೀಲಿಸಿ',
    search_cases: 'ಪ್ರಕರಣ ಸಂಖ್ಯೆ, ಗ್ರಾಮ ಅಥವಾ ಸರ್ವೇ ಹುಡುಕಿ...',
    switch_case: 'ಪ್ರಕರಣ ಬದಲಾಯಿಸಿ',
    sign_in: 'ಲಾಗಿನ್',
    sign_out: 'ಲಾಗ್‌ಔಟ್',
    readiness_title: 'ಭೂ ಸಿದ್ಧತಾ ಆಯಾಮಗಳು (ಸರಾಸರಿ ಅಂಕವಿಲ್ಲ)',
    readiness_sub: 'ಪ್ರತಿ ಆಯಾಮವು ನಡೆಸಿದ ಪರಿಶೀಲನೆಗಳು, ದಾಖಲೆ ಸಾಕ್ಷ್ಯ ಮತ್ತು ಬಾಕಿ ಅಂಶಗಳನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ ತೋರಿಸುತ್ತದೆ.',
    documents_title: 'ದಾಖಲೆ ಅಪ್‌ಲೋಡ್ ಮತ್ತು ಕ್ಷೇತ್ರ ಪರಿಶೀಲನೆ',
    report_title: 'ವಿವರವಾದ ಹಕ್ಕು ವರದಿ ಮತ್ತು ವ್ಯತ್ಯಾಸಗಳ ಪಟ್ಟಿ',
    ownership_title: 'ಮಾಲೀಕತ್ವದ ವಂಶಾವಳಿ ಮತ್ತು ಘಟನೆಗಳ ಕಾಲಾನುಕ್ರಮ',
    gis_title: 'ಸರ್ವೇ ಸ್ಕೆಚ್ ಮತ್ತು GeoJSON ಗುಣಮಟ್ಟ ಪರೀಕ್ಷೆ',
    valuation_title: 'ತುಲನಾತ್ಮಕ ಮೌಲ್ಯಮಾಪನ ಮತ್ತು ವಿಸ್ತೀರ್ಣ ಪರಿವರ್ತಕ',

    // 4-Column KPIs
    kpi_docs: 'ಸಲ್ಲಿಸಿದ ದಾಖಲೆಗಳು',
    kpi_docs_sub: 'ದಾಖಲೆಗಳು ಪರಿಶೀಲಿಸಲಾಗಿದೆ',
    kpi_discrepancies: 'ಪರಿಹರಿಸಬೇಕಾದ ಅಂಶಗಳು',
    kpi_discrepancies_sub_clean: 'ಎಲ್ಲಾ ದಾಖಲೆಗಳು ಸರಿಯಾಗಿವೆ',
    kpi_discrepancies_sub_flagged: 'ನಿಮ್ಮ ಗಮನ ಅಗತ್ಯವಿದೆ',
    kpi_reviews: 'ಪರಿಶೀಲನಾ ಪ್ರಗತಿ',
    kpi_reviews_sub: 'ಪರಿಶೀಲಿಸಿದ ಹಂತಗಳು',
    kpi_low_conf: 'ಅಸ್ಪಷ್ಟ ಕ್ಷೇತ್ರಗಳು',
    kpi_pipeline: 'ಪರಿಶೀಲನೆ ಸ್ಥಿತಿ',
    kpi_pipeline_nodes: 'ಹಂತಗಳು ಪೂರ್ಣ',

    // Dual Persona: Farmer
    farmer_checklist_title: 'ಮುಂದೆ ನೀವು ಮಾಡಬೇಕಾದ ಕ್ರಮಗಳು (ಸರಳ ಮಾರ್ಗದರ್ಶಿ)',
    farmer_checklist_sub: 'ನಿಮ್ಮ ಜಮೀನನ್ನು ಮಾರಾಟ, ಪಿತ್ರಾರ್ಜಿತ ಖಾತೆ ಬದಲಾವಣೆ ಅಥವಾ ಬ್ಯಾಂಕ್ ಸಾಲಕ್ಕೆ ಸಿದ್ಧಪಡಿಸಲು ಸ್ಪಷ್ಟ ಹಂತಗಳು.',
    farmer_all_clear_title: 'ಎಲ್ಲಾ ದಾಖಲೆಗಳು ಪರಸ್ಪರ ಹೊಂದಿಕೆಯಾಗುತ್ತಿವೆ',
    farmer_all_clear_desc: 'ಪಹಣಿ, ಕ್ರಯಪತ್ರ ಮತ್ತು ಮ್ಯುಟೇಷನ್ ದಾಖಲೆಗಳಲ್ಲಿ ಯಾವುದೇ ವ್ಯತ್ಯಾಸವಿಲ್ಲ. ನಿಮ್ಮ ಜಮೀನು ಸಾಲ ಅಥವಾ ಮಾರಾಟಕ್ಕೆ ಸಿದ್ಧವಾಗಿದೆ.',
    farmer_view_proof: 'ದಾಖಲೆ ಸಾಕ್ಷ್ಯ ನೋಡಿ',
    farmer_legal_help: 'ಫಾರ್ಮ್ ೨೧ ಅರ್ಜಿ ಪಡೆಯಿರಿ',
    farmer_form21_btn: 'ಫಾರ್ಮ್ ೨೧ ಖಾತೆ ಬದಲಾವಣೆ ಅರ್ಜಿ ಡೌನ್‌ಲೋಡ್',

    // Dual Persona: Reviewer
    reviewer_queue_title: 'ಕ್ಷೇತ್ರ ಅಧಿಕಾರಿಗಳ ಪರಿಶೀಲನಾ ಸರದಿ',
    reviewer_queue_sub: 'ಬಾಕಿ ಇರುವ ವ್ಯತ್ಯಾಸಗಳು ಮತ್ತು ಅಸ್ಪಷ್ಟ ಹೆಸರುಗಳ ಪರಿಶೀಲನಾ ಪಟ್ಟಿ.',
    reviewer_pending_discs: 'ಬಾಕಿ ಸಮಸ್ಯೆಗಳು',
    reviewer_low_conf: 'ಕಡಿಮೆ ವಿಶ್ವಾಸ ಕ್ಷೇತ್ರಗಳು',
    reviewer_uncertain_persons: 'ಹೆಸರು ಹೊಂದಾಣಿಕೆಗಳು',
    reviewer_reuploads: 'ಮರು-ಅಪ್‌ಲೋಡ್ ವಿನಂತಿಗಳು',
    reviewer_open_case: 'ಪ್ರಕರಣ ತೆರೆಯಿರಿ',
    reviewer_approve: 'ಅನುಮೋದಿಸಿ',
    reviewer_escalate: 'ಉನ್ನತ ಪರಿಶೀಲನೆ',
    reviewer_queue_clear: 'ಯಾವುದೇ ಬಾಕಿ ಪರಿಶೀಲನಾ ಅಂಶಗಳು ಉಳಿದಿಲ್ಲ.',

    // Workspace panels
    cases_panel_title: 'ಕಾರ್ಯಕ್ಷೇತ್ರದಲ್ಲಿರುವ ಭೂ ಪ್ರಕರಣಗಳು',
    cases_panel_sub: 'ರಾಮನಗರ ಮಾದರಿ ಪ್ರಕರಣ (4 ವ್ಯತ್ಯಾಸಗಳು) ಮತ್ತು ಮಂಡ್ಯ ಶುದ್ಧ ಪ್ರಕರಣ (0 ವ್ಯತ್ಯಾಸಗಳು) ನಡುವೆ ಬದಲಿಸಿ.',
    pipeline_trace_title: 'ಪೈಪ್‌ಲೈನ್ ಕಾರ್ಯನಿರ್ವಹಣಾ ಪಥ',
    audit_log_title: 'ಪ್ರಕರಣದ ಆಡಿಟ್ ದಾಖಲೆ',
    checks_label: 'ಪರೀಕ್ಷೆಗಳು',
    issues_label: 'ಸಮಸ್ಯೆಗಳು',
    evidence_cited_label: 'ಉಲ್ಲೇಖಿತ ಸಾಕ್ಷ್ಯಗಳು',
    missing_items_label: 'ಬಾಕಿ / ಕೊರತೆ ದಾಖಲೆಗಳು',
    open_detailed_view: 'ವಿವರವಾದ ವೀಕ್ಷಣೆ ತೆರೆಯಿರಿ',
    synthetic_badge: 'ಪ್ರಾಯೋಗಿಕ ಮಾದರಿ ದತ್ತಾಂಶ',
    perspective_farmer: 'ರೈತ / ಭೂ ಮಾಲೀಕರು',
    perspective_reviewer: 'ಪರಿಶೀಲನಾಧಿಕಾರಿ ಸರದಿ',
  },
};

const DIMENSION_KN: Record<string, string> = {
  'Document Completeness': 'ದಾಖಲೆ ಪೂರ್ಣತೆ',
  'Ownership Consistency': 'ಮಾಲೀಕತ್ವ ಸ್ಥಿರತೆ',
  'Mutation Consistency': 'ಖಾತೆ / ಮ್ಯುಟೇಷನ್ ಸ್ಥಿರತೆ',
  'Extent Consistency': 'ವಿಸ್ತೀರ್ಣ ಹೊಂದಾಣಿಕೆ',
  'Boundary Evidence': 'ಗಡಿ ಮತ್ತು ಸರ್ವೇ ಸಾಕ್ಷ್ಯ',
  'Valuation Evidence': 'ಮೌಲ್ಯಮಾಪನ ಸಾಕ್ಷ್ಯ',
};

const STATUS_KN: Record<string, string> = {
  Pass: 'ಸಮರ್ಪಕ',
  'Requires Professional Review': 'ತಜ್ಞರ ಪರಿಶೀಲನೆ ಅಗತ್ಯ',
  'Requires professional review': 'ತಜ್ಞರ ಪರಿಶೀಲನೆ ಅಗತ್ಯ',
  'Attention Required': 'ಗಮನ ಅಗತ್ಯ',
  'Insufficient Evidence': 'ಸಾಕಷ್ಟು ಸಾಕ್ಷ್ಯವಿಲ್ಲ',
  'Baseline Computed': 'ಆಧಾರ ಲೆಕ್ಕಾಚಾರ ಪೂರ್ಣ',
  'Pending Review': 'ಪರಿಶೀಲನೆ ಬಾಕಿ',
  Pending: 'ಪರಿಶೀಲನೆ ಬಾಕಿ',
  pending: 'ಪರಿಶೀಲನೆ ಬಾಕಿ',
  Approved: 'ಅನುಮೋದಿತ',
  approved: 'ಅನುಮೋದಿತ',
  Escalated: 'ಉನ್ನತ ಪರಿಶೀಲನೆ',
  escalated: 'ಉನ್ನತ ಪರಿಶೀಲನೆ',
  Rejected: 'ತಿರಸ್ಕೃತ',
  High: 'ಹೆಚ್ಚು',
  Medium: 'ಮಧ್ಯಮ',
  Low: 'ಕಡಿಮೆ',
  Verified: 'ದೃಢೀಕೃತ',
  Documented: 'ದಾಖಲಿತ',
  Abstained: 'ತಡೆಹಿಡಿಯಲಾಗಿದೆ',
  Missing: 'ಲಭ್ಯವಿಲ್ಲ',
  ready_for_review: 'ಪರಿಶೀಲನೆಗೆ ಸಿದ್ಧ',
  reviewed_clean: 'ಶುದ್ಧ — ಸಮಸ್ಯೆಗಳಿಲ್ಲ',
  reviewed_complete: 'ಪರಿಶೀಲನೆ ಪೂರ್ಣ',
  awaiting_documents: 'ದಾಖಲೆಗಳು ಬಾಕಿ',
};

export function translateDimension(name: string, lang: Lang): string {
  if (lang === 'en') return name;
  return DIMENSION_KN[name] || name;
}

export function translateStatus(status: string, lang: Lang): string {
  if (lang === 'en') return status.replace(/_/g, ' ');
  return STATUS_KN[status] || status.replace(/_/g, ' ');
}

export function farmerRuleActionTitle(ruleId: string, lang: Lang, fallback: string): string {
  if (lang === 'kn') {
    const map: Record<string, string> = {
      R1: 'ಮೃತ ಮಾಲೀಕರ ಹೆಸರು ಪಹಣಿಯಲ್ಲಿ ಇನ್ನೂ ಇದೆ — ಪೌತಿ ಖಾತೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ',
      R2: 'ಪತ್ರ ಮತ್ತು ಪಹಣಿ ನಡುವೆ ಭೂ ವಿಸ್ತೀರ್ಣ ವ್ಯತ್ಯಾಸ — 11E / ತತ್ಕಾಲ್ ಪೋಡಿ ಸರ್ವೇ ಮಾಡಿಸಿ',
      R3: 'ಉತ್ತರಾಧಿಕಾರ ಮ್ಯುಟೇಷನ್ (ಪೌತಿ ಖಾತೆ) ದಾಖಲಾಗಿಲ್ಲ — ನಾಡಕಚೇರಿಗೆ ಅರ್ಜಿ ನೀಡಿ',
      R4: 'ದಾಖಲೆಗಳಲ್ಲಿ ಬೇರೆ ಬೇರೆ ಸರ್ವೇ ನಂಬರ್‌ಗಳಿವೆ — ಆಕಾರ್‌ಬಂದ್ ಪರಿಶೀಲಿಸಿ',
      R5: 'ಬ್ಯಾಂಕ್ ಸಾಲ / ಅಡಮಾನ ದಾಖಲೆ ಬಾಕಿ — ಇಸಿ (Form 15/16) ಮತ್ತು NOC ಪಡೆದುಕೊಳ್ಳಿ',
    };
    return map[ruleId] || fallback;
  }
  const mapEn: Record<string, string> = {
    R1: 'Update deceased owner name in RTC (Apply for Pauti Khata)',
    R2: 'Reconcile land extent mismatch (Request 11E / Tatkal Phodi survey)',
    R3: 'Record missing inheritance mutation at Nadakacheri',
    R4: 'Confirm survey number renumbering with village Akarband',
    R5: 'Collect Bank NOC / Encumbrance Certificate for Column 11 loan',
  };
  return mapEn[ruleId] || fallback;
}
