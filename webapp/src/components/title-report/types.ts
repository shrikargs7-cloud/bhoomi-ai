import { DocumentItem, ExtractedField, LandCase } from '../../types/bhoomi';

export interface ReportSectionDef {
  id: string;
  num: string;
  title: string;
  badgeType: 'risk' | 'watch' | 'clean';
}

export interface ExtentReconciliationRow {
  filename: string;
  docType: string;
  originalText: string;
  acres: number;
  docId: string;
  page: number;
}

export interface EncumbranceEntry {
  doc: DocumentItem;
  field: ExtractedField;
}

export function buildReportSections(
  activeCase: LandCase,
  highOrReviewCount: number,
  medCount: number
): ReportSectionDef[] {
  const discs = activeCase.discrepancies;
  return [
    {
      id: '01',
      num: '01',
      title: 'Case & Parcel Overview',
      badgeType: activeCase.documents.length > 0 ? 'clean' : 'watch',
    },
    {
      id: '02',
      num: '02',
      title: `Discrepancy Register (${discs.length})`,
      badgeType: highOrReviewCount > 0 ? 'risk' : medCount > 0 ? 'watch' : 'clean',
    },
    {
      id: '03',
      num: '03',
      title: 'Ownership & Title Hierarchy',
      badgeType: discs.some((d) => d.rule_id === 'R1' || d.rule_id === 'R3') ? 'risk' : 'clean',
    },
    {
      id: '04',
      num: '04',
      title: 'Extent & Unit Reconciliation',
      badgeType: discs.some((d) => d.rule_id === 'R2' || d.rule_id === 'R4') ? 'risk' : 'clean',
    },
    {
      id: '05',
      num: '05',
      title: 'Encumbrances & Missing Docs',
      badgeType: discs.some((d) => d.rule_id === 'R5') ? 'watch' : 'clean',
    },
    {
      id: '06',
      num: '06',
      title: 'Readiness Dimensions (6)',
      badgeType: highOrReviewCount > 0 ? 'watch' : 'clean',
    },
    {
      id: '07',
      num: '07',
      title: 'Statutory Legal Reference',
      badgeType: 'clean',
    },
    {
      id: '08',
      num: '08',
      title: 'Review Decisions & Audit Log',
      badgeType: 'clean',
    },
  ];
}

export function deriveExtentRows(activeCase: LandCase): ExtentReconciliationRow[] {
  const rows: ExtentReconciliationRow[] = [];
  for (const doc of activeCase.documents) {
    for (const f of doc.extracted_fields) {
      if (
        ['total_extent', 'extent_allotted', 'stated_extent', 'transferred_extent'].includes(
          f.field_name
        )
      ) {
        const eff =
          f.reviewer_value !== null && f.reviewer_value !== undefined
            ? f.reviewer_value
            : f.normalized_value;
        const ac = typeof eff === 'number' ? eff : parseFloat(String(eff)) || 0;
        if (ac > 0) {
          rows.push({
            filename: doc.filename,
            docType: doc.doc_type,
            originalText: f.original_text,
            acres: ac,
            docId: doc.id,
            page: f.page,
          });
        }
      }
    }
  }
  return rows;
}
