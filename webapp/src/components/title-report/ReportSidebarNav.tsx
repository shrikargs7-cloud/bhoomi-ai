import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ReportSectionDef } from './types';

interface ReportSidebarNavProps {
  totalDiscrepancies: number;
  highOrReviewCount: number;
  medCount: number;
  cleanDims: number;
  sections: ReportSectionDef[];
  activeSection: string;
  onSelectSection: (sectionId: string) => void;
}

/** Left navigation rail displaying case flag breakdown and the 8 report sections. */
export const ReportSidebarNav: React.FC<ReportSidebarNavProps> = ({
  totalDiscrepancies,
  highOrReviewCount,
  medCount,
  cleanDims,
  sections,
  activeSection,
  onSelectSection,
}) => {
  return (
    <aside className="lg:col-span-3 space-y-4">
      {/* Overall Case Audit Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#123D32] to-[#164E49] p-4 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
            CASE AUDIT SUMMARY
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-[#D6A84B]">
            {totalDiscrepancies === 0 ? 'CLEAN' : `${totalDiscrepancies} FLAGS`}
          </span>
        </div>
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="bg-rose-400"
            style={{ width: `${Math.min(100, highOrReviewCount * 25)}%` }}
          />
          <div
            className="bg-[#D6A84B]"
            style={{ width: `${Math.min(100, medCount * 20)}%` }}
          />
          <div
            className="bg-[#239B65]"
            style={{ width: `${Math.min(100, cleanDims * 16)}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-100">
          <span>● {highOrReviewCount} high/review</span>
          <span>● {medCount} medium</span>
          <span>● {cleanDims}/6 clean dims</span>
        </div>
      </div>

      {/* Interactive 8-Section Selector */}
      <div className="rounded-2xl border border-[#164E49]/15 bg-white p-3 shadow-xs">
        <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          REPORT SECTIONS ({sections.length})
        </div>
        <div className="space-y-1">
          {sections.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => onSelectSection(sec.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left text-xs transition cursor-pointer ${
                  isActive
                    ? 'bg-[#123D32] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-[#F7F5EB]'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                    isActive
                      ? 'bg-[#239B65] text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {sec.num}
                </span>
                <span className="flex-1 leading-snug">{sec.title}</span>
                <span>
                  {sec.badgeType === 'risk' && (
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  {sec.badgeType === 'watch' && (
                    <ShieldAlert className="h-3.5 w-3.5 text-[#D6A84B]" />
                  )}
                  {sec.badgeType === 'clean' && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#239B65]" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
