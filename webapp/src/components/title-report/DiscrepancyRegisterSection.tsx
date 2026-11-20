import React from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import { EvidenceModalTarget } from '../../context/BhoomiContext';
import { DiscrepancyFinding } from '../../types/bhoomi';

interface DiscrepancyRegisterSectionProps {
  totalDiscrepanciesCount: number;
  filteredDiscrepancies: DiscrepancyFinding[];
  filterMode: string;
  role: 'farmer' | 'reviewer';
  reviewNotesMap: Record<string, string>;
  onChangeReviewNote: (discId: string, value: string) => void;
  onOpenEvidence: (target: EvidenceModalTarget) => void;
  onReviewDiscrepancy: (discId: string, decision: string, notes: string) => Promise<boolean>;
}

/** Section 02: Evidence-linked discrepancy register with reviewer triage bar. */
export const DiscrepancyRegisterSection: React.FC<DiscrepancyRegisterSectionProps> = ({
  totalDiscrepanciesCount,
  filteredDiscrepancies,
  filterMode,
  role,
  reviewNotesMap,
  onChangeReviewNote,
  onOpenEvidence,
  onReviewDiscrepancy,
}) => {
  if (filteredDiscrepancies.length === 0) {
    return (
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-[#239B65]" />
          <p className="mt-2 text-sm font-bold text-[#123D32]">
            {totalDiscrepanciesCount === 0
              ? 'Zero Cross-Document Discrepancies Detected'
              : `No discrepancies match filter "${filterMode}"`}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {totalDiscrepanciesCount === 0
              ? 'Deterministic rules R1–R5 verified all uploaded documents with zero false positives.'
              : 'Switch filter back to "All" to view all detected findings.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {filteredDiscrepancies.map((disc) => (
        <div
          key={disc.id}
          className="rounded-xl border border-slate-200 bg-[#fdfcf8] p-4 space-y-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="font-mono text-[11px] font-bold text-[#164E49]">
                Rule {disc.rule_id} • {disc.id}
              </span>
              <h3 className="text-sm font-extrabold text-[#123D32]">{disc.rule_name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  disc.severity.toLowerCase().includes('review') || disc.severity === 'High'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {disc.severity}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                  disc.review_status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : disc.review_status === 'rejected'
                    ? 'bg-slate-200 text-slate-700'
                    : disc.review_status === 'escalated'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-[#D6A84B]/25 text-[#7c5308]'
                }`}
              >
                {disc.review_status}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">{disc.explanation}</p>

          <p className="text-[11px] text-slate-500 italic">
            Severity Rule: {disc.severity_rationale}
          </p>

          {/* Clickable Evidence Citation Pills */}
          <div className="rounded-lg bg-white p-3 border border-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Evidence Citations (Click to inspect PDF source &amp; bounding box)
            </p>
            <div className="flex flex-wrap gap-2">
              {disc.evidence_refs.map((ev, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    onOpenEvidence({
                      documentId: ev.document_id,
                      documentName: ev.document_name,
                      page: ev.page,
                      highlightBBox: ev.bounding_box,
                      highlightText: ev.original_text,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#164E49]/25 bg-[#F7F5EB] px-2.5 py-1.5 text-[11px] font-semibold text-[#123D32] hover:bg-[#239B65] hover:text-white transition cursor-pointer text-left"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {ev.document_name} (p.{ev.page}): &ldquo;{ev.original_text.slice(0, 52)}
                    {ev.original_text.length > 52 ? '…' : ''}&rdquo;
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-emerald-50/70 p-2.5 text-xs text-[#123D32] border border-emerald-200/70">
            <strong>Recommended Next Step:</strong> {disc.suggested_next_step}
          </div>

          {/* Reviewer Decision Bar */}
          {role === 'reviewer' && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
              <input
                type="text"
                value={reviewNotesMap[disc.id] ?? (disc.reviewer_notes || '')}
                onChange={(e) => onChangeReviewNote(disc.id, e.target.value)}
                placeholder="Reviewer notes / verification memo..."
                className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-[#239B65] focus:outline-none"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    onReviewDiscrepancy(
                      disc.id,
                      'approved',
                      reviewNotesMap[disc.id] || 'Verified against record evidence'
                    )
                  }
                  className="rounded-lg bg-[#239B65] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1b8153] cursor-pointer"
                >
                  Approve Finding
                </button>
                <button
                  onClick={() =>
                    onReviewDiscrepancy(
                      disc.id,
                      'escalated',
                      reviewNotesMap[disc.id] || 'Escalated for licensed advocate/surveyor verification'
                    )
                  }
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 cursor-pointer"
                >
                  Escalate
                </button>
                <button
                  onClick={() =>
                    onReviewDiscrepancy(
                      disc.id,
                      'rejected',
                      reviewNotesMap[disc.id] || 'Dismissed after reviewer verification'
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
