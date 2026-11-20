import React from 'react';
import { ClipboardList, Download, FileText, History, Ruler } from 'lucide-react';
import { EvidenceModalTarget } from '../../context/BhoomiContext';
import { LandCase } from '../../types/bhoomi';
import { EncumbranceEntry, ExtentReconciliationRow } from './types';

/** Section 01: Case summary metadata and extracted document inventory table. */
export const CaseOverviewSection: React.FC<{
  activeCase: LandCase;
  onOpenEvidence: (target: EvidenceModalTarget) => void;
}> = ({ activeCase, onOpenEvidence }) => (
  <div className="mt-4 space-y-4 text-xs">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl bg-[#F7F5EB] p-3">
        <p className="text-[10px] text-slate-500 uppercase font-bold">Case Code</p>
        <p className="font-bold text-[#123D32] mt-0.5">{activeCase.case_id}</p>
      </div>
      <div className="rounded-xl bg-[#F7F5EB] p-3">
        <p className="text-[10px] text-slate-500 uppercase font-bold">Survey Number</p>
        <p className="font-bold text-[#123D32] mt-0.5">{activeCase.survey_number || 'N/A'}</p>
      </div>
      <div className="rounded-xl bg-[#F7F5EB] p-3">
        <p className="text-[10px] text-slate-500 uppercase font-bold">Documents</p>
        <p className="font-bold text-[#123D32] mt-0.5">{activeCase.documents.length} verified files</p>
      </div>
      <div className="rounded-xl bg-[#F7F5EB] p-3">
        <p className="text-[10px] text-slate-500 uppercase font-bold">Case Status</p>
        <p className="font-bold text-[#164E49] mt-0.5">{activeCase.status.replace(/_/g, ' ')}</p>
      </div>
    </div>

    <p className="text-slate-600 leading-relaxed">{activeCase.disclaimer}</p>

    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left">
        <thead className="bg-[#F7F5EB] text-[10px] font-bold uppercase text-slate-600">
          <tr>
            <th className="py-2.5 px-3">Document</th>
            <th className="py-2.5 px-3">Classification</th>
            <th className="py-2.5 px-3">Method</th>
            <th className="py-2.5 px-3">Extracted Fields</th>
            <th className="py-2.5 px-3 text-right">Inspect</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {activeCase.documents.map((d) => (
            <tr key={d.id}>
              <td className="py-2.5 px-3 font-semibold text-[#123D32]">{d.filename}</td>
              <td className="py-2.5 px-3">{d.doc_type}</td>
              <td className="py-2.5 px-3 text-slate-500">{d.extraction_method}</td>
              <td className="py-2.5 px-3 font-bold">{d.extracted_fields.length}</td>
              <td className="py-2.5 px-3 text-right">
                <button
                  onClick={() => onOpenEvidence({ documentId: d.id, documentName: d.filename, page: 1 })}
                  className="rounded bg-[#239B65] px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                >
                  View PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/** Section 03: Deterministic ownership entity hierarchy and chronological events. */
export const OwnershipHierarchySection: React.FC<{
  activeCase: LandCase;
  onOpenEvidence: (target: EvidenceModalTarget) => void;
}> = ({ activeCase, onOpenEvidence }) => (
  <div className="mt-4 space-y-4 text-xs">
    <p className="text-slate-600">
      Entities resolved deterministically across RTC Column 9, Death Certificates, and Registered Deeds:
    </p>
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left">
        <thead className="bg-[#F7F5EB] text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
          <tr>
            <th className="py-2.5 px-4">Person / Entity</th>
            <th className="py-2.5 px-4">Vital Status</th>
            <th className="py-2.5 px-4">Resolution Status</th>
            <th className="py-2.5 px-4">Similarity</th>
            <th className="py-2.5 px-4">Supporting Chronological Events</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {activeCase.persons.map((p) => {
            const relEvents = activeCase.ownership_events.filter((ev) =>
              ev.parties_involved.some((party) =>
                party.toLowerCase().includes(p.normalized_name.split(' ')[0])
              )
            );
            return (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-bold text-[#123D32]">
                  {p.canonical_name}
                  <p className="text-[10px] font-normal text-slate-400">
                    Aliases: {p.aliases.join(', ')}
                  </p>
                </td>
                <td className="py-3 px-4">
                  {p.is_deceased ? (
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                      Deceased ({p.date_of_death})
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Active / Living Record
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 capitalize">{p.resolution_status}</td>
                <td className="py-3 px-4 font-mono">{Math.round(p.similarity_score * 100)}%</td>
                <td className="py-3 px-4 space-y-1">
                  {relEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() =>
                        onOpenEvidence({
                          documentId: ev.evidence.document_id,
                          documentName: ev.evidence.document_name,
                          page: ev.evidence.page,
                          highlightBBox: ev.evidence.bounding_box,
                        })
                      }
                      className="mr-1.5 inline-flex items-center gap-1 rounded bg-[#F7F5EB] px-2 py-0.5 text-[10px] font-semibold text-[#164E49] hover:bg-[#239B65] hover:text-white cursor-pointer"
                    >
                      <FileText className="h-3 w-3" />
                      {ev.event_type} ({ev.date || 'Undated'})
                    </button>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

/** Section 04: Cross-document Karnataka extent & unit reconciliation table. */
export const ExtentReconciliationSection: React.FC<{
  extentRows: ExtentReconciliationRow[];
  onOpenEvidence: (target: EvidenceModalTarget) => void;
}> = ({ extentRows, onOpenEvidence }) => (
  <div className="mt-4 space-y-4 text-xs">
    <div className="flex items-center gap-2 rounded-xl bg-[#F7F5EB] p-3 border border-slate-200">
      <Ruler className="h-4 w-4 text-[#164E49]" />
      <span>
        Standard Karnataka conversion:{' '}
        <strong>1 Acre = 40 Guntas = 640 Annas = 0.4047 Hectares = 43,560 Sq Ft</strong>. Tolerance
        threshold: ±0.01 Acre.
      </span>
    </div>

    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left">
        <thead className="bg-[#F7F5EB] text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
          <tr>
            <th className="py-2.5 px-3">Source Document</th>
            <th className="py-2.5 px-3">Original Text</th>
            <th className="py-2.5 px-3">Decimal Acres</th>
            <th className="py-2.5 px-3">Guntas</th>
            <th className="py-2.5 px-3">Hectares</th>
            <th className="py-2.5 px-3">Sq Ft</th>
            <th className="py-2.5 px-3 text-right">PDF</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {extentRows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="py-2.5 px-3 font-bold text-[#123D32]">
                {r.filename}
                <span className="block text-[10px] font-normal text-slate-400">{r.docType}</span>
              </td>
              <td className="py-2.5 px-3 font-mono">{r.originalText}</td>
              <td className="py-2.5 px-3 font-extrabold text-[#164E49]">{r.acres.toFixed(4)} ac</td>
              <td className="py-2.5 px-3">{(r.acres * 40).toFixed(2)} gu</td>
              <td className="py-2.5 px-3">{(r.acres / 2.47105).toFixed(4)} ha</td>
              <td className="py-2.5 px-3">{Math.round(r.acres * 43560).toLocaleString()}</td>
              <td className="py-2.5 px-3 text-right">
                <button
                  onClick={() =>
                    onOpenEvidence({ documentId: r.docId, documentName: r.filename, page: r.page })
                  }
                  className="rounded bg-[#123D32] px-2.5 py-1 text-[10px] font-bold text-white cursor-pointer"
                >
                  Cite
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/** Section 05: Column 11 encumbrances and missing supporting documents checklist. */
export const EncumbrancesSection: React.FC<{
  encumbranceFields: EncumbranceEntry[];
  allMissingItems: string[];
  onOpenEvidence: (target: EvidenceModalTarget) => void;
}> = ({ encumbranceFields, allMissingItems, onOpenEvidence }) => (
  <div className="mt-4 space-y-4 text-xs">
    <div>
      <h3 className="font-bold text-[#123D32] mb-2">Column 11 Encumbrances &amp; Liabilities</h3>
      {encumbranceFields.length === 0 ? (
        <p className="text-slate-500">No Column 11 encumbrance entries extracted.</p>
      ) : (
        <div className="space-y-2">
          {encumbranceFields.map(({ doc, field }, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3"
            >
              <div>
                <p className="font-bold text-slate-900">{doc.filename}</p>
                <p className="text-slate-700 mt-0.5">{field.original_text}</p>
              </div>
              <button
                onClick={() =>
                  onOpenEvidence({
                    documentId: doc.id,
                    documentName: doc.filename,
                    page: field.page,
                    highlightField: field,
                  })
                }
                className="rounded-lg bg-[#123D32] px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer"
              >
                View on RTC
              </button>
            </div>
          ))}
        </div>
      )}
    </div>

    <div>
      <h3 className="font-bold text-[#123D32] mb-2">Missing Supporting Documents Checklist</h3>
      {allMissingItems.length === 0 ? (
        <p className="text-emerald-700 font-semibold">All expected supporting documents present.</p>
      ) : (
        <ul className="space-y-1.5">
          {allMissingItems.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[#fdfcf8] px-3 py-2 text-slate-700"
            >
              <ClipboardList className="h-4 w-4 text-[#D6A84B]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

/** Section 06: Independent 6 Land Readiness Dimensions (no averaged score). */
export const ReadinessDimensionsSection: React.FC<{ activeCase: LandCase }> = ({ activeCase }) => (
  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
    {activeCase.readiness_dimensions.map((dim) => (
      <div key={dim.dimension_name} className="rounded-xl border border-slate-200 bg-[#fdfcf8] p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#123D32]">{dim.dimension_name}</h3>
          <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold">
            {dim.status}
          </span>
        </div>
        <p className="mt-2 text-slate-600">{dim.summary}</p>
        <p className="mt-2 text-[10px] text-slate-400">
          Checks: {dim.checks_run} • Issues: {dim.issues_found} • Review: {dim.review_status}
        </p>
      </div>
    ))}
  </div>
);

/** Section 08: PDF export callout and immutable reviewer decision log. */
export const ReviewAuditLogSection: React.FC<{
  activeCase: LandCase;
  onDownloadPdf: () => void;
}> = ({ activeCase, onDownloadPdf }) => (
  <div className="mt-4 space-y-4 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F5EB] p-4 border border-slate-200">
      <div>
        <p className="font-bold text-[#123D32]">Ready to Export Complete Report?</p>
        <p className="text-[11px] text-slate-600">
          Includes case summary, 6 readiness dimensions, document inventory, ownership timeline,
          discrepancies, and review sign-offs.
        </p>
      </div>
      <button
        onClick={onDownloadPdf}
        className="flex items-center gap-1.5 rounded-lg bg-[#239B65] px-4 py-2 font-bold text-white hover:bg-[#1b8153] cursor-pointer"
      >
        <Download className="h-4 w-4" />
        <span>Download PDF Report</span>
      </button>
    </div>

    <div>
      <h3 className="font-bold text-[#123D32] mb-2 flex items-center gap-1.5">
        <History className="h-4 w-4" />
        Recorded Reviewer Decisions ({activeCase.review_decisions.length})
      </h3>
      {activeCase.review_decisions.length === 0 ? (
        <p className="text-slate-500">
          No human review decisions recorded yet. Approve/Dismiss a discrepancy in Section 02 or
          correct a field to log a decision.
        </p>
      ) : (
        <div className="space-y-2">
          {activeCase.review_decisions.map((rv) => (
            <div key={rv.id} className="rounded-xl border border-slate-200 bg-[#fdfcf8] p-3">
              <div className="flex justify-between">
                <span className="font-bold text-[#123D32]">
                  [{rv.target_type.toUpperCase()}] {rv.target_id} → {rv.decision}
                </span>
                <span className="text-[10px] text-slate-400">{rv.created_at}</span>
              </div>
              <p className="mt-1 text-slate-600">
                Previous: <span className="font-mono">{rv.previous_value}</span> → New:{' '}
                <span className="font-mono font-bold text-[#164E49]">{rv.new_value}</span>
              </p>
              {rv.notes && <p className="mt-0.5 text-slate-500 italic">Notes: {rv.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);
