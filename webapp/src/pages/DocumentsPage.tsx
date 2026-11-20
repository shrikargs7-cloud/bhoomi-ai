import React, { useRef, useState } from 'react';
import {
  Upload,
  FileText,
  CheckSquare,
  BarChart3,
  Eye,
  Trash2,
  Search,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Edit3,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useBhoomi } from '../context/BhoomiContext';
import { DocumentItem, ExtractedField } from '../types/bhoomi';

type SubView = 'upload' | 'library' | 'review_queue' | 'evaluation';

const DOC_TYPES = [
  'ALL',
  'RTC',
  'DEATH_CERTIFICATE',
  'PARTITION_DEED',
  'SALE_DEED',
  'MUTATION_EXTRACT',
  'SURVEY_SKETCH',
];

export const DocumentsPage: React.FC = () => {
  const {
    activeCase,
    role,
    t,
    uploadDocument,
    deleteDocument,
    correctField,
    openEvidence,
    resetDemoCases,
    apiFetch,
  } = useBhoomi();

  const [activeView, setActiveView] = useState<SubView>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Library filters
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');

  // Review queue filters
  const [fieldFilter, setFieldFilter] = useState<'all' | 'low_conf' | 'unverified' | 'corrected'>('all');
  const [inlineEditKey, setInlineEditKey] = useState<string | null>(null);
  const [inlineEditVal, setInlineEditVal] = useState('');
  const [inlineEditNotes, setInlineEditNotes] = useState('');

  // Evaluation runner state
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalData, setEvalData] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const docs = activeCase?.documents || [];

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    for (let i = 0; i < fileList.length; i++) {
      await uploadDocument(fileList[i]);
    }
    setUploading(false);
  };

  const filteredDocs = docs.filter((d) => {
    const matchesType = docTypeFilter === 'ALL' || d.doc_type === docTypeFilter;
    const matchesSearch =
      !searchQuery ||
      d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.doc_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const allFieldsWithDoc: Array<{ doc: DocumentItem; field: ExtractedField }> = [];
  for (const d of docs) {
    for (const f of d.extracted_fields) {
      allFieldsWithDoc.push({ doc: d, field: f });
    }
  }

  const filteredFields = allFieldsWithDoc.filter(({ field }) => {
    if (fieldFilter === 'low_conf') return field.confidence < 0.90;
    if (fieldFilter === 'unverified') return field.verification_status === 'unverified';
    if (fieldFilter === 'corrected') return field.verification_status === 'corrected';
    return true;
  });

  const runLiveEvaluation = async () => {
    setEvalLoading(true);
    try {
      const res = await apiFetch('/evaluation/run');
      if (res.ok) {
        setEvalData(await res.json());
      }
    } finally {
      setEvalLoading(false);
    }
  };

  const sidebarTabs: Array<{ id: SubView; label: string; badge?: number; icon: any }> = [
    { id: 'upload', label: 'Upload & Intake', icon: Upload },
    { id: 'library', label: 'Document Library', badge: docs.length, icon: FileText },
    { id: 'review_queue', label: 'Field Review Queue', badge: allFieldsWithDoc.length, icon: CheckSquare },
    { id: 'evaluation', label: 'Evaluation Benchmarks', icon: BarChart3 },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#123D32]">{t('documents_title')}</h1>
          <p className="text-xs text-slate-500">
            Case: <span className="font-bold text-[#164E49]">{activeCase?.case_id}</span> •
            Survey No. {activeCase?.survey_number || 'N/A'} • Extraction via PyMuPDF Digital Layout &amp; OCR Fallback Ladder
          </p>
        </div>

        <button
          onClick={resetDemoCases}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t('reset_demo')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Working Left Sidebar */}
        <aside className="lg:col-span-3 space-y-3">
          <div className="rounded-2xl border border-[#164E49]/15 bg-white p-3 shadow-xs space-y-1">
            <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Document Workspace
            </p>
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveView(tab.id);
                    if (tab.id === 'evaluation' && !evalData) runLiveEvaluation();
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-[#123D32] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-[#F7F5EB]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-[#D6A84B]' : 'text-[#164E49]'}`} />
                    <span>{tab.label}</span>
                  </span>
                  {tab.badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Extraction Ladder Summary Card */}
          <div className="rounded-2xl border border-[#164E49]/15 bg-white p-4 shadow-xs text-[11px] space-y-2">
            <p className="font-bold text-[#123D32] uppercase tracking-wider text-[10px]">
              OCR &amp; Extraction Ladder (SPEC §4)
            </p>
            <ol className="space-y-1.5 text-slate-600 list-decimal list-inside">
              <li className={consentChecked ? 'font-semibold text-[#164E49]' : 'text-slate-400'}>
                Vision-LLM (requires DPDP consent)
              </li>
              <li className="font-semibold text-[#239B65]">
                PyMuPDF Digital Layout + Kannada Regex (Active)
              </li>
              <li className="text-slate-500">Tesseract Kannada + English OCR</li>
              <li className="text-slate-600">Pre-filled Manual Review Form (Fallback)</li>
            </ol>
          </div>
        </aside>

        {/* Right Main View Area */}
        <section className="lg:col-span-9 space-y-5">
          {/* VIEW 1: UPLOAD & INTAKE */}
          {activeView === 'upload' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#164E49]/15 bg-white p-6 shadow-xs">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                  }}
                  className={`flex min-h-[210px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition cursor-pointer ${
                    isDragging
                      ? 'border-[#239B65] bg-[#239B65]/10'
                      : 'border-[#164E49]/30 bg-[#F7F5EB]/70 hover:border-[#239B65] hover:bg-[#F7F5EB]'
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#123D32] text-white shadow-md">
                    <Upload className="h-5 w-5 text-[#D6A84B]" />
                  </div>
                  <h2 className="mt-3 text-base font-bold text-[#123D32]">
                    {uploading ? 'Extracting Fields & Running Rules...' : 'Drop Land Documents Here to Upload'}
                  </h2>
                  <p className="mt-1 max-w-lg text-xs text-slate-600">
                    Uploads are validated for MIME/magic-bytes, SHA-256 hashed for duplicate checks,
                    extracted with page &amp; bounding-box citations, and screened for prompt injection.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {['PDF (Digital)', 'PNG', 'JPG', 'WEBP'].map((fmt) => (
                      <span
                        key={fmt}
                        className="rounded-full bg-[#164E49] px-2.5 py-0.5 text-[10px] font-semibold text-white"
                      >
                        {fmt}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Consent checkbox (CLAUDE.md Rule 10) */}
                <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-[#fdfcf8] p-3 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 accent-[#239B65]"
                  />
                  <span>
                    <strong>DPDP Act 2023 Consent:</strong> Allow sending redacted document snippets to an external Vision-LLM if local PyMuPDF/OCR fails (currently unchecked = 100% local extraction).
                  </span>
                </label>
              </div>

              {/* Quick Uploaded Inventory */}
              <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#123D32]">
                    Uploaded Case Documents ({docs.length})
                  </h3>
                  <button
                    onClick={() => setActiveView('library')}
                    className="text-xs font-semibold text-[#239B65] hover:underline cursor-pointer"
                  >
                    Filter &amp; Manage Library →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() =>
                        openEvidence({
                          documentId: doc.id,
                          documentName: doc.filename,
                          page: 1,
                          highlightField: doc.extracted_fields[0] || null,
                        })
                      }
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#fdfcf8] p-3.5 transition hover:border-[#239B65] cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#123D32] text-[10px] font-extrabold text-[#D6A84B]">
                          {doc.doc_type.slice(0, 4)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-xs font-bold text-[#123D32]">
                              {doc.filename}
                            </p>
                            {doc.status === 'needs_reupload' && (
                              <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                <AlertTriangle className="h-3 w-3" /> Needs Re-upload
                              </span>
                            )}
                            {doc.injection_warning && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                <ShieldAlert className="h-3 w-3" /> Injection Quarantined
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {doc.doc_type} • {doc.pages_count} pg • {doc.file_size_kb} KB •{' '}
                            {doc.language} •{' '}
                            <span className="font-semibold text-[#239B65]">
                              Conf: {Math.round(doc.ocr_quality_score * 100)}%
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          {doc.extracted_fields.length} Fields
                        </span>
                        <button className="flex items-center gap-1 rounded-lg bg-[#239B65] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1b8153] cursor-pointer">
                          <Eye className="h-3.5 w-3.5" />
                          <span>Inspect PDF</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {docs.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400">
                      No documents uploaded to this case yet. Drop a PDF or PNG above to begin.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: DOCUMENT LIBRARY */}
          {activeView === 'library' && (
            <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[#F7F5EB] px-3 py-1.5 w-full sm:w-72">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter documents by name or type..."
                    className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {DOC_TYPES.map((dt) => (
                    <button
                      key={dt}
                      onClick={() => setDocTypeFilter(dt)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                        docTypeFilter === dt
                          ? 'bg-[#123D32] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F5EB] text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Document</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Extraction Method</th>
                      <th className="py-2.5 px-3">Quality</th>
                      <th className="py-2.5 px-3">Fields</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocs.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-bold text-[#123D32]">
                          {d.filename}
                          <p className="font-mono text-[10px] font-normal text-slate-400">
                            sha256: {d.file_hash.slice(0, 14)}…
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#164E49]">
                            {d.doc_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{d.extraction_method}</td>
                        <td className="py-3 px-3 font-semibold">
                          {Math.round(d.ocr_quality_score * 100)}%
                        </td>
                        <td className="py-3 px-3">{d.extracted_fields.length}</td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() =>
                              openEvidence({
                                documentId: d.id,
                                documentName: d.filename,
                                page: 1,
                                highlightField: d.extracted_fields[0] || null,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded bg-[#239B65] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#1b8153] cursor-pointer"
                          >
                            <Eye className="h-3 w-3" /> Inspect
                          </button>
                          {role === 'reviewer' && (
                            <button
                              onClick={() => deleteDocument(d.id)}
                              className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                              title="Delete document"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredDocs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          No documents match current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: FIELD REVIEW QUEUE */}
          {activeView === 'review_queue' && (
            <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#123D32]">
                    Extracted Field Provenance &amp; Correction Queue
                  </h2>
                  <p className="text-xs text-slate-500">
                    Rule 6: Original extracted text and normalized values are permanently preserved alongside any reviewer correction.
                  </p>
                </div>

                <div className="flex gap-1.5">
                  {[
                    { id: 'all', label: `All (${allFieldsWithDoc.length})` },
                    { id: 'low_conf', label: 'Low Conf (<90%)' },
                    { id: 'unverified', label: 'Unverified' },
                    { id: 'corrected', label: 'Corrected' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFieldFilter(f.id as any)}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold cursor-pointer ${
                        fieldFilter === f.id
                          ? 'bg-[#123D32] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F5EB] text-[10px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Document &amp; Field</th>
                      <th className="py-2.5 px-3">Original Text</th>
                      <th className="py-2.5 px-3">Normalized / Reviewer Value</th>
                      <th className="py-2.5 px-3">Conf</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFields.map(({ doc, field }) => {
                      const key = `${doc.id}:${field.field_name}`;
                      const isEditing = inlineEditKey === key;
                      return (
                        <tr key={key} className="hover:bg-slate-50 align-top">
                          <td className="py-3 px-3">
                            <p className="font-bold text-[#123D32]">{field.label}</p>
                            <p className="text-[10px] text-slate-400">
                              {doc.filename} (p.{field.page})
                            </p>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-700 max-w-[240px]">
                            {field.original_text}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-[#164E49]">
                              {typeof field.normalized_value === 'object'
                                ? JSON.stringify(field.normalized_value)
                                : String(field.normalized_value)}
                            </p>
                            {field.reviewer_value !== null && field.reviewer_value !== undefined && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" />
                                Reviewer: {String(field.reviewer_value)}
                              </span>
                            )}
                            {isEditing && (
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  const ok = await correctField(doc.id, field.field_name, inlineEditVal, inlineEditNotes);
                                  if (ok) setInlineEditKey(null);
                                }}
                                className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-[#F7F5EB] p-2"
                              >
                                <input
                                  value={inlineEditVal}
                                  onChange={(e) => setInlineEditVal(e.target.value)}
                                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                                  required
                                />
                                <input
                                  value={inlineEditNotes}
                                  onChange={(e) => setInlineEditNotes(e.target.value)}
                                  placeholder="Correction note"
                                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                                />
                                <div className="flex justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setInlineEditKey(null)}
                                    className="px-2 py-0.5 text-[11px] text-slate-600 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    className="rounded bg-[#239B65] px-2.5 py-0.5 text-[11px] font-bold text-white cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </div>
                              </form>
                            )}
                          </td>
                          <td className="py-3 px-3 font-bold">
                            {Math.round(field.confidence * 100)}%
                          </td>
                          <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() =>
                                openEvidence({
                                  documentId: doc.id,
                                  documentName: doc.filename,
                                  page: field.page,
                                  highlightField: field,
                                })
                              }
                              className="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-[#164E49] hover:bg-emerald-50 cursor-pointer"
                            >
                              PDF Source
                            </button>
                            {role === 'reviewer' && (
                              <button
                                onClick={() => {
                                  setInlineEditKey(key);
                                  setInlineEditVal(
                                    typeof field.normalized_value === 'object'
                                      ? JSON.stringify(field.normalized_value)
                                      : String(field.reviewer_value ?? field.normalized_value)
                                  );
                                  setInlineEditNotes(field.notes || '');
                                }}
                                className="rounded bg-[#123D32] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#164E49] cursor-pointer"
                              >
                                <Edit3 className="h-3 w-3 inline mr-1" />
                                Correct
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 4: EVALUATION BENCHMARKS */}
          {activeView === 'evaluation' && (
            <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#123D32]">
                    Measured Golden &amp; 20-Case Evaluation Benchmarks
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live output from <code>evaluate_extraction.py</code> and <code>evaluate_discrepancies.py</code> (never hardcoded).
                  </p>
                </div>
                <button
                  onClick={runLiveEvaluation}
                  disabled={evalLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-[#239B65] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1b8153] cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>{evalLoading ? 'Running Benchmark...' : 'Re-run Evaluation Scripts'}</span>
                </button>
              </div>

              {evalData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-[#F7F5EB] p-3 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Golden Field Prec / Rec</p>
                      <p className="text-lg font-extrabold text-[#123D32] mt-1">
                        {evalData.extraction.overall_precision_pct}% / {evalData.extraction.overall_recall_pct}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#F7F5EB] p-3 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase text-slate-500">20-Case Discrepancy Prec / Rec</p>
                      <p className="text-lg font-extrabold text-[#123D32] mt-1">
                        {evalData.discrepancies.benchmark_20_cases.precision_pct}% /{' '}
                        {evalData.discrepancies.benchmark_20_cases.recall_pct}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#F7F5EB] p-3 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase text-slate-500">False Positive Rate</p>
                      <p className="text-lg font-extrabold text-[#239B65] mt-1">
                        {evalData.discrepancies.benchmark_20_cases.false_positive_rate_pct}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#F7F5EB] p-3 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Unsupported Claim Rate</p>
                      <p className="text-lg font-extrabold text-[#239B65] mt-1">
                        {evalData.discrepancies.benchmark_20_cases.unsupported_claim_rate_pct}%
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#123D32] text-white text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-3">Golden Document</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Language</th>
                          <th className="py-2 px-3">Matched</th>
                          <th className="py-2 px-3">Precision</th>
                          <th className="py-2 px-3">Recall</th>
                          <th className="py-2 px-3">BBox Coverage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {evalData.extraction.by_document.map((r: any) => (
                          <tr key={r.filename}>
                            <td className="py-2 px-3 font-semibold text-slate-800">{r.filename}</td>
                            <td className="py-2 px-3">{r.doc_type}</td>
                            <td className="py-2 px-3">{r.language}</td>
                            <td className="py-2 px-3">
                              {r.matched_fields}/{r.expected_fields}
                            </td>
                            <td className="py-2 px-3 font-bold text-emerald-700">{r.precision_pct}%</td>
                            <td className="py-2 px-3 font-bold text-emerald-700">{r.recall_pct}%</td>
                            <td className="py-2 px-3 font-bold">{r.has_bbox_rate_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
