import React, { useEffect, useState } from 'react';
import { useBhoomi } from '../context/BhoomiContext';
import { LegalQueryResponse, LegalSourceItem } from '../types/bhoomi';
import { ReportHeaderBar } from '../components/title-report/ReportHeaderBar';
import { ReportSidebarNav } from '../components/title-report/ReportSidebarNav';
import { DiscrepancyRegisterSection } from '../components/title-report/DiscrepancyRegisterSection';
import { LegalReferenceSection } from '../components/title-report/LegalReferenceSection';
import {
  CaseOverviewSection,
  EncumbrancesSection,
  ExtentReconciliationSection,
  OwnershipHierarchySection,
  ReadinessDimensionsSection,
  ReviewAuditLogSection,
} from '../components/title-report/AuditDataSections';
import { buildReportSections, deriveExtentRows } from '../components/title-report/types';

const FILTER_CHIPS = [
  'All',
  'Requires professional review',
  'High',
  'Medium',
  'Pending',
  'Approved',
];

export const TitleReportPage: React.FC = () => {
  const {
    activeCase,
    role,
    t,
    openEvidence,
    reviewDiscrepancy,
    downloadReadinessPdf,
    apiFetch,
  } = useBhoomi();

  const [activeSection, setActiveSection] = useState<string>('02');
  const [filterMode, setFilterMode] = useState<string>('All');
  const [reviewNotesMap, setReviewNotesMap] = useState<Record<string, string>>({});
  const [legalQuery, setLegalQuery] = useState(
    'How to handle deceased owner Pauti Khata mutation in RTC?'
  );
  const [legalResult, setLegalResult] = useState<LegalQueryResponse | null>(null);
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalSources, setLegalSources] = useState<LegalSourceItem[]>([]);

  useEffect(() => {
    apiFetch('/legal/sources')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLegalSources(d))
      .catch(() => {});
  }, [apiFetch]);

  if (!activeCase) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Loading Title Audit Report...
      </div>
    );
  }

  const discs = activeCase.discrepancies;
  const highOrReviewCount = discs.filter(
    (d) => d.severity.toLowerCase().includes('review') || d.severity === 'High'
  ).length;
  const medCount = discs.filter((d) => d.severity === 'Medium').length;
  const cleanDims = activeCase.readiness_dimensions.filter((d) => d.status === 'Pass').length;
  const sections = buildReportSections(activeCase, highOrReviewCount, medCount);

  const filteredDiscrepancies = discs.filter((d) => {
    if (filterMode === 'All') return true;
    if (filterMode === 'Pending') return d.review_status === 'pending';
    if (filterMode === 'Approved') return d.review_status === 'approved';
    return d.severity.toLowerCase() === filterMode.toLowerCase();
  });

  const extentRows = deriveExtentRows(activeCase);
  const encumbranceFields = activeCase.documents.flatMap((d) =>
    d.extracted_fields
      .filter((f) => f.field_name === 'column_11_encumbrance')
      .map((f) => ({ doc: d, field: f }))
  );
  const allMissingItems = Array.from(
    new Set(activeCase.readiness_dimensions.flatMap((dim) => dim.missing_items))
  );

  const handleLegalSearch = async (qText?: string) => {
    const queryToRun = qText ?? legalQuery;
    if (qText) setLegalQuery(qText);
    setLegalLoading(true);
    try {
      const res = await apiFetch('/legal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToRun, case_id: activeCase.case_id }),
      });
      if (res.ok) setLegalResult(await res.json());
    } finally {
      setLegalLoading(false);
    }
  };

  const activeSectionMeta = sections.find((s) => s.id === activeSection) || sections[1];

  return (
    <div className="min-h-screen bg-[#F7F5EB] pb-12">
      <ReportHeaderBar
        activeCase={activeCase}
        reportTitle={t('report_title')}
        exportPdfLabel={t('export_pdf')}
        filterChips={FILTER_CHIPS}
        filterMode={filterMode}
        activeSection={activeSection}
        sections={sections}
        onDownloadPdf={downloadReadinessPdf}
        onSelectFilter={(chip) => {
          setFilterMode(chip);
          setActiveSection('02');
        }}
        onSelectSection={setActiveSection}
      />

      <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <ReportSidebarNav
            totalDiscrepancies={discs.length}
            highOrReviewCount={highOrReviewCount}
            medCount={medCount}
            cleanDims={cleanDims}
            sections={sections}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />

          <section className="lg:col-span-9 space-y-4">
            <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#239B65]">
                    Section {activeSectionMeta.num}
                  </span>
                  <h2 className="text-lg font-extrabold text-[#123D32]">
                    {activeSectionMeta.title}
                  </h2>
                </div>
                <span className="text-[11px] text-slate-500">
                  All claims strictly linked to documentary evidence (CLAUDE.md Rule 1)
                </span>
              </div>

              {activeSection === '01' && (
                <CaseOverviewSection activeCase={activeCase} onOpenEvidence={openEvidence} />
              )}
              {activeSection === '02' && (
                <DiscrepancyRegisterSection
                  totalDiscrepanciesCount={discs.length}
                  filteredDiscrepancies={filteredDiscrepancies}
                  filterMode={filterMode}
                  role={role}
                  reviewNotesMap={reviewNotesMap}
                  onChangeReviewNote={(discId, value) =>
                    setReviewNotesMap((m) => ({ ...m, [discId]: value }))
                  }
                  onOpenEvidence={openEvidence}
                  onReviewDiscrepancy={reviewDiscrepancy}
                />
              )}
              {activeSection === '03' && (
                <OwnershipHierarchySection activeCase={activeCase} onOpenEvidence={openEvidence} />
              )}
              {activeSection === '04' && (
                <ExtentReconciliationSection
                  extentRows={extentRows}
                  onOpenEvidence={openEvidence}
                />
              )}
              {activeSection === '05' && (
                <EncumbrancesSection
                  encumbranceFields={encumbranceFields}
                  allMissingItems={allMissingItems}
                  onOpenEvidence={openEvidence}
                />
              )}
              {activeSection === '06' && <ReadinessDimensionsSection activeCase={activeCase} />}
              {activeSection === '07' && (
                <LegalReferenceSection
                  legalQuery={legalQuery}
                  legalResult={legalResult}
                  legalLoading={legalLoading}
                  legalSources={legalSources}
                  onChangeQuery={setLegalQuery}
                  onRunSearch={handleLegalSearch}
                />
              )}
              {activeSection === '08' && (
                <ReviewAuditLogSection
                  activeCase={activeCase}
                  onDownloadPdf={downloadReadinessPdf}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
