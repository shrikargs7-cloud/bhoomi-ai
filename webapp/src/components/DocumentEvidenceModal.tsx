import React, { useEffect, useState } from 'react';
import {
  X,
  FileCheck,
  Edit3,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { useBhoomi } from '../context/BhoomiContext';
import { ExtractedField, BoundingBox } from '../types/bhoomi';

export const DocumentEvidenceModal: React.FC = () => {
  const {
    activeCase,
    role,
    evidenceTarget,
    closeEvidence,
    correctField,
    apiFetch,
  } = useBhoomi();

  const [page, setPage] = useState<number>(1);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState<boolean>(false);
  const [selectedField, setSelectedField] = useState<ExtractedField | null>(null);
  const [editingField, setEditingField] = useState<ExtractedField | null>(null);
  const [correctedInput, setCorrectedInput] = useState<string>('');
  const [reviewerNotes, setReviewerNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const doc = activeCase?.documents.find(
    (d) =>
      d.id === evidenceTarget?.documentId ||
      (evidenceTarget?.documentName && d.filename === evidenceTarget.documentName)
  );

  useEffect(() => {
    if (!evidenceTarget) return;
    setPage(evidenceTarget.page || 1);
    setSelectedField(evidenceTarget.highlightField || doc?.extracted_fields[0] || null);
    setEditingField(null);
  }, [evidenceTarget, doc?.id]);

  useEffect(() => {
    if (!evidenceTarget || !doc) return;
    let revoked = false;
    let objectUrl: string | null = null;
    setImgLoading(true);

    apiFetch(`/documents/${encodeURIComponent(doc.id)}/page/${page}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load page preview');
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setImgUrl(objectUrl);
      })
      .catch(() => {
        if (!revoked) setImgUrl(null);
      })
      .finally(() => {
        if (!revoked) setImgLoading(false);
      });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidenceTarget, doc?.id, page, apiFetch]);

  if (!evidenceTarget || !doc) return null;

  const activeBBox: BoundingBox | null | undefined =
    selectedField?.bounding_box || evidenceTarget.highlightBBox;
  const activePageMatch = (selectedField?.page || evidenceTarget.page || 1) === page;

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField) return;
    setSaving(true);
    const ok = await correctField(doc.id, editingField.field_name, correctedInput, reviewerNotes);
    setSaving(false);
    if (ok) {
      setEditingField(null);
      setReviewerNotes('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Evidence Viewer — ${doc.filename}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={closeEvidence}
    >
      <div
        className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#164E49]/20 bg-[#F7F5EB] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#123D32] px-5 py-3 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <FileCheck className="h-5 w-5 shrink-0 text-[#D6A84B]" />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold">
                Evidence Viewer — {doc.filename}
              </h3>
              <p className="text-[11px] text-emerald-100/80">
                Type: <span className="font-semibold text-white">{doc.doc_type}</span> •
                Method: {doc.extraction_method} • Language: {doc.language} • Avg Conf:{' '}
                <span className="font-bold text-[#D6A84B]">
                  {Math.round(doc.ocr_quality_score * 100)}%
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={closeEvidence}
            aria-label="Close evidence viewer"
            className="rounded-lg p-1.5 text-emerald-100 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Banners */}
        {(doc.quality_warning || doc.injection_warning) && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-900 flex flex-wrap items-center gap-3">
            {doc.quality_warning && (
              <span className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {doc.quality_warning}
              </span>
            )}
            {doc.injection_warning && (
              <span className="flex items-center gap-1.5 font-semibold text-rose-800">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                {doc.injection_warning}
              </span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
          {/* Left: Real Rendered PDF Page Image + Bounding Box */}
          <div className="flex min-h-[280px] h-[46%] md:h-auto md:flex-1 flex-col items-center overflow-auto bg-[#eae6d7] p-4 lg:p-6">
            <div className="mb-3 flex w-full max-w-[540px] shrink-0 items-center justify-between rounded-lg bg-white px-3 py-1.5 text-xs shadow-2xs border border-slate-200">
              <span className="font-semibold text-[#123D32]">
                Page {page} of {doc.pages_count}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded p-1 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={page >= doc.pages_count}
                  onClick={() => setPage((p) => Math.min(doc.pages_count, p + 1))}
                  className="rounded p-1 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative w-full max-w-[540px] shrink-0 rounded-xl bg-white shadow-lg ring-1 ring-slate-300 overflow-hidden">
              {imgLoading && (
                <div className="flex h-[420px] items-center justify-center text-xs text-slate-500">
                  Rendering PDF page {page}...
                </div>
              )}
              {!imgLoading && imgUrl && (
                <div className="relative w-full">
                  <img
                    src={imgUrl}
                    alt={`${doc.filename} page ${page}`}
                    className="block w-full h-auto select-none"
                  />
                  {activeBBox && activePageMatch && (
                    <div
                      data-testid="evidence-bbox"
                      className="pointer-events-none absolute rounded border-2 border-[#D6A84B] bg-[#D6A84B]/20 ring-2 ring-[#123D32]/50 transition-all duration-200"
                      style={{
                        left: `${activeBBox.x}%`,
                        top: `${activeBBox.y}%`,
                        width: `${activeBBox.width}%`,
                        height: `${activeBBox.height}%`,
                      }}
                    >
                      <span className="absolute -top-5 left-0 rounded bg-[#123D32] px-1.5 py-0.5 text-[9px] font-bold text-[#F7F5EB] shadow-xs whitespace-nowrap">
                        {selectedField?.label || 'Evidence Citation'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {!imgLoading && !imgUrl && (
                <div className="p-6 text-xs text-slate-600">
                  <p className="font-bold text-slate-800">Source Excerpt</p>
                  <p className="mt-2 rounded bg-slate-50 p-3 font-mono border border-slate-200">
                    {evidenceTarget.highlightText || selectedField?.original_text || 'Preview unavailable'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Extracted Fields & Reviewer Correction */}
          <div className="flex flex-1 min-h-0 md:flex-none md:w-[370px] lg:w-[440px] shrink-0 flex-col border-t md:border-t-0 md:border-l border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#164E49]">
                Extracted Fields ({doc.extracted_fields.length})
              </span>
              <span className="text-[10px] font-medium text-slate-400">
                Rule 6: Originals Preserved
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {doc.extracted_fields.map((f) => {
                const isSelected = selectedField?.field_name === f.field_name;
                const isEditing = editingField?.field_name === f.field_name;
                return (
                  <div
                    key={f.field_name}
                    onClick={() => {
                      setSelectedField(f);
                      setPage(f.page || 1);
                    }}
                    className={`rounded-xl border p-3 text-xs transition cursor-pointer ${
                      isSelected
                        ? 'border-[#239B65] bg-[#239B65]/5 ring-1 ring-[#239B65]/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900">{f.label}</p>
                        <p className="text-[10px] text-slate-400">
                          Page {f.page} • {f.method}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            f.confidence >= 0.9
                              ? 'bg-emerald-50 text-emerald-700'
                              : f.confidence >= 0.7
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {Math.round(f.confidence * 100)}%
                        </span>
                        {role === 'reviewer' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingField(f);
                              setCorrectedInput(
                                typeof f.normalized_value === 'object'
                                  ? JSON.stringify(f.normalized_value)
                                  : String(f.reviewer_value ?? f.normalized_value)
                              );
                              setReviewerNotes(f.notes || '');
                            }}
                            className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-[#123D32] cursor-pointer"
                            title="Correct normalized value"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 space-y-1 text-[11px]">
                      <p className="text-slate-600">
                        <span className="font-medium text-slate-400">Original Text:</span>{' '}
                        <span className="font-mono text-slate-800">{f.original_text}</span>
                      </p>
                      <p className="text-slate-600">
                        <span className="font-medium text-slate-400">Normalized:</span>{' '}
                        <span className="font-semibold text-[#164E49]">
                          {typeof f.normalized_value === 'object'
                            ? JSON.stringify(f.normalized_value)
                            : String(f.normalized_value)}
                        </span>
                      </p>
                      {f.reviewer_value !== null && f.reviewer_value !== undefined && (
                        <div className="mt-1 flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span>
                            Reviewer Value: {String(f.reviewer_value)}
                            {f.notes ? ` (${f.notes})` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {isEditing && (
                      <form
                        onSubmit={handleSaveCorrection}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-[#F7F5EB] p-2.5"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#123D32]">
                          Reviewer Correction (Original kept intact)
                        </p>
                        <input
                          type="text"
                          value={correctedInput}
                          onChange={(e) => setCorrectedInput(e.target.value)}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-[#239B65] focus:outline-none"
                          required
                        />
                        <input
                          type="text"
                          value={reviewerNotes}
                          onChange={(e) => setReviewerNotes(e.target.value)}
                          placeholder="Reason / source note (e.g. Verified from Akarband)"
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-[#239B65] focus:outline-none"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingField(null)}
                            className="rounded px-2.5 py-1 text-[11px] text-slate-600 hover:bg-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={saving}
                            className="rounded bg-[#239B65] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#1b8153] cursor-pointer"
                          >
                            {saving ? 'Saving...' : 'Save & Re-check'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between text-[11px] text-slate-500">
              <span>SHA-256: {doc.file_hash.slice(0, 14)}…</span>
              <button
                onClick={closeEvidence}
                className="rounded-lg bg-[#123D32] px-4 py-1.5 font-semibold text-white hover:bg-[#164E49] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
