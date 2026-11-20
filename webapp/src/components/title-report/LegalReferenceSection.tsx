import React from 'react';
import { BookOpen, Scale, Search } from 'lucide-react';
import { LegalQueryResponse, LegalSourceItem } from '../../types/bhoomi';

interface LegalReferenceSectionProps {
  legalQuery: string;
  legalResult: LegalQueryResponse | null;
  legalLoading: boolean;
  legalSources: LegalSourceItem[];
  onChangeQuery: (value: string) => void;
  onRunSearch: (preset?: string) => void;
}

const PRESET_QUERIES = [
  'Deceased owner Pauti Khata mutation',
  'Extent mismatch 11E Phodi survey',
  'Unregistered partition deed Section 17',
  'Mortgage charge discharge NOC',
  'Test abstention: Space mining law',
];

/** Section 07: Grounded Karnataka statutory legal reference Q&A with abstention guardrails. */
export const LegalReferenceSection: React.FC<LegalReferenceSectionProps> = ({
  legalQuery,
  legalResult,
  legalLoading,
  legalSources,
  onChangeQuery,
  onRunSearch,
}) => {
  return (
    <div className="mt-4 space-y-4 text-xs">
      <div className="rounded-xl bg-[#F7F5EB] p-4 border border-slate-200 space-y-3">
        <div className="flex items-center gap-2 font-bold text-[#123D32]">
          <Scale className="h-4 w-4 text-[#239B65]" />
          <span>Query Curated Karnataka Land Law Corpus (SPEC §12)</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={legalQuery}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder="Ask about KLRA 1964, Pauti Khata, 11E Phodi, Mortgage NOC, Registration Act..."
            className="flex-1 min-w-[240px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-[#239B65] focus:outline-none"
          />
          <button
            onClick={() => onRunSearch()}
            disabled={legalLoading}
            className="flex items-center gap-1.5 rounded-lg bg-[#123D32] px-4 py-2 font-bold text-white hover:bg-[#164E49] cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{legalLoading ? 'Searching...' : 'Query Citations'}</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESET_QUERIES.map((preset) => (
            <button
              key={preset}
              onClick={() => onRunSearch(preset)}
              className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-[#164E49] hover:border-[#239B65] cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {legalResult && (
        <div
          className={`rounded-xl border p-4 space-y-2 ${
            legalResult.abstained
              ? 'border-amber-300 bg-amber-50'
              : 'border-emerald-200 bg-emerald-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#123D32]">
              {legalResult.abstained
                ? 'Abstention — Procedure Cannot Be Established From Curated Sources'
                : legalResult.source}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {legalResult.jurisdiction}
            </span>
          </div>
          <p className="text-slate-700 leading-relaxed">{legalResult.explanation}</p>
          {!legalResult.abstained && (
            <p className="text-[11px] text-[#164E49] font-semibold">
              Section/Page: {legalResult.section_or_page} • Retrieved: {legalResult.retrieval_date}
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            <strong>Limitations:</strong> {legalResult.limitations}
          </p>
          <p className="text-[11px] text-slate-600">
            <strong>Professional Referral:</strong> {legalResult.referral}
          </p>
        </div>
      )}

      <div>
        <h4 className="font-bold text-[#123D32] mb-2 flex items-center gap-1.5">
          <BookOpen className="h-4 w-4" />
          Curated Statutory Reference Corpus ({legalSources.length} Sources)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {legalSources.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-[#fdfcf8] p-3">
              <p className="font-bold text-[#123D32]">{s.title}</p>
              <p className="text-[10px] text-[#239B65] font-semibold">{s.section}</p>
              <p className="mt-1 text-[11px] text-slate-600">{s.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
