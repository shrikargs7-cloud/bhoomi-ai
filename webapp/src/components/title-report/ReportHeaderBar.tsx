import React from 'react';
import { Download } from 'lucide-react';
import { LandCase } from '../../types/bhoomi';
import { ReportSectionDef } from './types';

interface ReportHeaderBarProps {
  activeCase: LandCase;
  reportTitle: string;
  exportPdfLabel: string;
  filterChips: string[];
  filterMode: string;
  activeSection: string;
  sections: ReportSectionDef[];
  onDownloadPdf: () => void;
  onSelectFilter: (chip: string) => void;
  onSelectSection: (sectionId: string) => void;
}

/** Forest-green report sub-header with discrepancy filter chips and section jump selector. */
export const ReportHeaderBar: React.FC<ReportHeaderBarProps> = ({
  activeCase,
  reportTitle,
  exportPdfLabel,
  filterChips,
  filterMode,
  activeSection,
  sections,
  onDownloadPdf,
  onSelectFilter,
  onSelectSection,
}) => {
  return (
    <>
      {/* Sub-Header Forest Banner */}
      <div className="bg-gradient-to-r from-[#123D32] via-[#164E49] to-[#123D32] px-6 py-5 text-white shadow-sm">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#D6A84B]">
              {activeCase.case_id} • {reportTitle}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              {activeCase.case_name}
            </h1>
            <p className="mt-0.5 text-xs text-emerald-100/85">
              Survey No. {activeCase.survey_number || 'N/A'} •{' '}
              {[activeCase.village, activeCase.hobli, activeCase.taluk, activeCase.district]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>

          <button
            onClick={onDownloadPdf}
            className="flex items-center gap-2 rounded-xl bg-[#239B65] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#1b8153] cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>{exportPdfLabel}</span>
          </button>
        </div>
      </div>

      {/* Working Filter & Go-To-Section Bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-2.5">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Filter Discrepancies
            </span>
            {filterChips.map((chip) => (
              <button
                key={chip}
                onClick={() => onSelectFilter(chip)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  filterMode === chip
                    ? 'bg-[#123D32] text-white'
                    : 'bg-[#F7F5EB] text-slate-700 hover:bg-[#ece8d5]'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="go-to-section" className="text-[11px] font-semibold text-slate-500">
              Go to section:
            </label>
            <select
              id="go-to-section"
              value={activeSection}
              onChange={(e) => onSelectSection(e.target.value)}
              className="rounded-lg border border-slate-200 bg-[#fdfcf8] px-3 py-1 text-xs font-semibold text-[#123D32] focus:border-[#239B65] focus:outline-none cursor-pointer"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.num} — {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </>
  );
};
