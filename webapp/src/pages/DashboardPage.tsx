import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  ArrowRight,
  Trash2,
  Activity,
  FolderOpen,
  ClipboardCheck,
  Scale,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { useBhoomi } from '../context/BhoomiContext';
import {
  farmerRuleActionTitle,
  translateDimension,
  translateStatus,
} from '../i18n/strings';

const DIMENSION_ROUTE: Record<string, string> = {
  'Document Completeness': '/documents',
  'Ownership Consistency': '/title-report',
  'Mutation Consistency': '/ownership',
  'Extent Consistency': '/title-report',
  'Boundary Evidence': '/gis',
  'Valuation Evidence': '/valuation',
};

interface ReviewerQueuePayload {
  pending_discrepancies: Array<{
    case_id: string;
    case_name: string;
    survey_number: string;
    discrepancy_id: string;
    rule_id: string;
    rule_name: string;
    severity: string;
    explanation: string;
    suggested_next_step: string;
    evidence_count: number;
  }>;
  low_confidence_fields: Array<{
    case_id: string;
    case_name: string;
    document_id: string;
    document_name: string;
    field_name: string;
    label: string;
    original_text: string;
    normalized_value: any;
    confidence: number;
    page: number;
  }>;
  uncertain_persons: Array<{
    case_id: string;
    case_name: string;
    person_id: string;
    canonical_name: string;
    aliases: string[];
    similarity_score: number;
  }>;
  reupload_documents: Array<{
    case_id: string;
    case_name: string;
    document_id: string;
    filename: string;
    quality_warning: string;
  }>;
  summary: {
    total_pending_items: number;
    pending_discrepancies_count: number;
    low_confidence_fields_count: number;
    uncertain_persons_count: number;
    reupload_documents_count: number;
    cases_requiring_attention: number;
  };
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeCase,
    casesList,
    loading,
    role,
    lang,
    t,
    selectCase,
    deleteCase,
    resetDemoCases,
    rerunPipeline,
    reviewDiscrepancy,
    openEvidence,
    apiFetch,
  } = useBhoomi();

  const [expandedDim, setExpandedDim] = useState<string | null>('Ownership Consistency');
  const [queueData, setQueueData] = useState<ReviewerQueuePayload | null>(null);
  const [queueTab, setQueueTab] = useState<'discs' | 'fields' | 'entities'>('discs');

  const fetchReviewerQueue = useCallback(async () => {
    try {
      const res = await apiFetch('/reviewer/queue');
      if (res.ok) {
        setQueueData(await res.json());
      }
    } catch {
      // handled gracefully
    }
  }, [apiFetch]);

  useEffect(() => {
    if (role === 'reviewer') {
      fetchReviewerQueue();
    }
  }, [role, activeCase?.case_id, activeCase?.discrepancies.length, activeCase?.review_decisions.length, fetchReviewerQueue]);

  if (loading && !activeCase) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Loading BhoomiAI Case Data...
      </div>
    );
  }

  if (!activeCase) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center text-sm text-rose-700">
        Backend API unreachable on port 8000. Ensure uvicorn is running.
      </div>
    );
  }

  const totalFields = activeCase.documents.reduce(
    (sum, d) => sum + d.extracted_fields.length,
    0
  );
  const totalDiscs = activeCase.discrepancies.length;
  const reviewedDiscs = activeCase.discrepancies.filter(
    (d) => d.review_status !== 'pending'
  ).length;
  const lowConfFields = activeCase.documents.reduce(
    (sum, d) =>
      sum +
      d.extracted_fields.filter(
        (f) => f.confidence < 0.85 && f.verification_status !== 'corrected'
      ).length,
    0
  );
  const traceSteps = activeCase.latest_workflow_run?.trace || [];
  const completedOrSkipped = traceSteps.filter((s) => s.status !== 'error').length;

  const statusBadge = (status: string) => {
    if (status === 'Pass') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (status === 'Requires Professional Review') return 'bg-rose-50 text-rose-800 border-rose-200';
    if (status === 'Attention Required') return 'bg-amber-50 text-amber-800 border-amber-200';
    if (status === 'Baseline Computed') return 'bg-sky-50 text-sky-800 border-sky-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const handleQueueDecision = async (discId: string, decision: 'approved' | 'escalated') => {
    const ok = await reviewDiscrepancy(
      discId,
      decision,
      `Triaged via Cross-Case Reviewer Queue (${decision})`
    );
    if (ok) {
      await fetchReviewerQueue();
    }
  };

  const handleResetDemo = async () => {
    await resetDemoCases();
    if (role === 'reviewer') await fetchReviewerQueue();
  };

  const handleRerunPipeline = async () => {
    await rerunPipeline();
    if (role === 'reviewer') await fetchReviewerQueue();
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 lg:px-6 space-y-5">
      {/* Top Case Header + Balanced 4-Column KPI Strip */}
      <section className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#123D32] px-2.5 py-0.5 font-mono text-[11px] font-bold text-white">
                {activeCase.case_id}
              </span>
              <span className="rounded-full bg-[#F7F5EB] border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-[#164E49]">
                Survey No. {activeCase.survey_number || 'Unspecified'}
              </span>
              {activeCase.synthetic && (
                <span className="rounded-full bg-[#D6A84B]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#7c5308]">
                  {t('synthetic_badge')}
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                {role === 'reviewer' ? t('perspective_reviewer') : t('perspective_farmer')}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#123D32]">
              {activeCase.case_name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {[activeCase.village, activeCase.hobli, activeCase.taluk, activeCase.district]
                .filter(Boolean)
                .join(' • ') || 'Location metadata from uploaded records'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/documents')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F7F5EB] px-3 py-2 text-xs font-semibold text-[#123D32] hover:bg-[#ece8d5] cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>{t('upload_inspect_docs')}</span>
            </button>
            <button
              onClick={handleRerunPipeline}
              className="flex items-center gap-1.5 rounded-xl border border-[#164E49]/25 bg-white px-3 py-2 text-xs font-semibold text-[#164E49] hover:bg-emerald-50 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 text-[#239B65]" />
              <span>{t('rerun_pipeline')}</span>
            </button>
            <button
              onClick={handleResetDemo}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('reset_demo')}</span>
            </button>
          </div>
        </div>

        {/* Balanced 4-Column KPI Grid */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            onClick={() => navigate('/documents')}
            className="rounded-xl border border-slate-200/80 bg-[#fcfbf7] p-4 text-left transition hover:border-[#239B65]/50 hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">{t('kpi_docs')}</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[#164E49]">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-[#123D32]">
              {activeCase.documents.length}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {totalFields} {t('kpi_docs_sub')}
            </p>
          </button>

          <button
            onClick={() => navigate('/title-report')}
            className="rounded-xl border border-slate-200/80 bg-[#fcfbf7] p-4 text-left transition hover:border-[#239B65]/50 hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">
                {t('kpi_discrepancies')}
              </span>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  totalDiscs > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-[#123D32]">{totalDiscs}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {totalDiscs === 0
                ? t('kpi_discrepancies_sub_clean')
                : t('kpi_discrepancies_sub_flagged')}
            </p>
          </button>

          <button
            onClick={() => navigate('/title-report')}
            className="rounded-xl border border-slate-200/80 bg-[#fcfbf7] p-4 text-left transition hover:border-[#239B65]/50 hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">{t('kpi_reviews')}</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-[#123D32]">
              {reviewedDiscs} / {totalDiscs}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t('kpi_reviews_sub')} • {lowConfFields} {t('kpi_low_conf')}
            </p>
          </button>

          <button
            onClick={handleRerunPipeline}
            className="rounded-xl border border-slate-200/80 bg-[#fcfbf7] p-4 text-left transition hover:border-[#239B65]/50 hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">{t('kpi_pipeline')}</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[#164E49]">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-[#123D32]">
              {completedOrSkipped} / {traceSteps.length}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#164E49] capitalize">
              {translateStatus(activeCase.status, lang)}
            </p>
          </button>
        </div>
      </section>

      {/* DUAL-PERSONA SPOTLIGHT: FARMER ACTION GUIDE vs CROSS-CASE REVIEWER TRIAGE QUEUE */}
      {role === 'farmer' ? (
        <section
          aria-label="Farmer Next Steps"
          className="rounded-2xl border border-[#239B65]/30 bg-white p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#123D32] flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-[#239B65]" />
                <span>{t('farmer_checklist_title')}</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">{t('farmer_checklist_sub')}</p>
            </div>
            <button
              onClick={() => navigate('/title-report')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#164E49]/25 bg-[#F7F5EB] px-3 py-1.5 text-xs font-bold text-[#123D32] hover:bg-[#ece7d4] cursor-pointer"
            >
              <Scale className="h-3.5 w-3.5 text-[#239B65]" />
              <span>{t('farmer_legal_help')}</span>
            </button>
          </div>

          {activeCase.discrepancies.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#239B65] mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#123D32]">{t('farmer_all_clear_title')}</p>
                <p className="text-xs text-slate-600 mt-1">{t('farmer_all_clear_desc')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCase.discrepancies.map((disc, idx) => {
                const firstEv = disc.evidence_refs[0];
                return (
                  <div
                    key={disc.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-[#fdfcf8] p-4"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-[260px]">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#123D32] text-xs font-extrabold text-[#D6A84B]">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-[#123D32]">
                          {farmerRuleActionTitle(disc.rule_id, lang, disc.rule_name)}
                        </p>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {disc.suggested_next_step}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {disc.explanation}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {firstEv && (
                        <button
                          onClick={() =>
                            openEvidence({
                              documentId: firstEv.document_id,
                              documentName: firstEv.document_name,
                              page: firstEv.page,
                              highlightBBox: firstEv.bounding_box,
                              highlightText: firstEv.original_text,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#239B65] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1b8153] cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>{t('farmer_view_proof')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section
          aria-label="Reviewer Cross-Case Queue"
          className="rounded-2xl border border-[#D6A84B]/50 bg-white p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#123D32] flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#D6A84B]" />
                <span>{t('reviewer_queue_title')}</span>
                {queueData && (
                  <span className="rounded-full bg-[#D6A84B]/25 px-2.5 py-0.5 text-xs font-extrabold text-[#7c5308]">
                    {queueData.summary.total_pending_items}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('reviewer_queue_sub')}</p>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
              <button
                onClick={() => setQueueTab('discs')}
                className={`rounded-full px-3 py-1 cursor-pointer ${
                  queueTab === 'discs'
                    ? 'bg-[#123D32] text-white'
                    : 'bg-[#F7F5EB] text-slate-700 hover:bg-[#ece8d5]'
                }`}
              >
                {t('reviewer_pending_discs')} ({queueData?.summary.pending_discrepancies_count ?? 0})
              </button>
              <button
                onClick={() => setQueueTab('fields')}
                className={`rounded-full px-3 py-1 cursor-pointer ${
                  queueTab === 'fields'
                    ? 'bg-[#123D32] text-white'
                    : 'bg-[#F7F5EB] text-slate-700 hover:bg-[#ece8d5]'
                }`}
              >
                {t('reviewer_low_conf')} ({queueData?.summary.low_confidence_fields_count ?? 0})
              </button>
              <button
                onClick={() => setQueueTab('entities')}
                className={`rounded-full px-3 py-1 cursor-pointer ${
                  queueTab === 'entities'
                    ? 'bg-[#123D32] text-white'
                    : 'bg-[#F7F5EB] text-slate-700 hover:bg-[#ece8d5]'
                }`}
              >
                {t('reviewer_uncertain_persons')} ({(queueData?.summary.uncertain_persons_count ?? 0) + (queueData?.summary.reupload_documents_count ?? 0)})
              </button>
            </div>
          </div>

          {queueTab === 'discs' && (
            <div className="space-y-2.5">
              {(queueData?.pending_discrepancies || []).map((item) => (
                <div
                  key={item.discrepancy_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#fdfcf8] p-3.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#123D32] px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                        {item.case_id}
                      </span>
                      <span className="font-bold text-[#123D32]">
                        {item.rule_id}: {item.rule_name}
                      </span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                        {translateStatus(item.severity, lang)}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600 line-clamp-2">{item.explanation}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={async () => {
                        await selectCase(item.case_id);
                        navigate('/title-report');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>{t('reviewer_open_case')}</span>
                    </button>
                    <button
                      onClick={() => handleQueueDecision(item.discrepancy_id, 'approved')}
                      className="rounded-lg bg-[#239B65] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#1b8153] cursor-pointer"
                    >
                      {t('reviewer_approve')}
                    </button>
                    <button
                      onClick={() => handleQueueDecision(item.discrepancy_id, 'escalated')}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-800 hover:bg-rose-100 cursor-pointer"
                    >
                      {t('reviewer_escalate')}
                    </button>
                  </div>
                </div>
              ))}
              {(!queueData || queueData.pending_discrepancies.length === 0) && (
                <p className="rounded-xl bg-emerald-50/70 p-4 text-center text-xs font-semibold text-emerald-800 border border-emerald-200">
                  {t('reviewer_queue_clear')}
                </p>
              )}
            </div>
          )}

          {queueTab === 'fields' && (
            <div className="space-y-2 text-xs">
              {(queueData?.low_confidence_fields || []).map((f, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#fdfcf8] p-3"
                >
                  <div>
                    <span className="font-mono text-[10px] font-bold text-[#123D32] mr-2">
                      {f.case_id}
                    </span>
                    <strong className="text-slate-900">{f.label}</strong> ({f.document_name} p.{f.page}) —{' '}
                    <span className="text-amber-700 font-bold">{Math.round(f.confidence * 100)}%</span>
                  </div>
                  <button
                    onClick={async () => {
                      await selectCase(f.case_id);
                      navigate('/documents');
                    }}
                    className="rounded-lg bg-[#123D32] px-3 py-1 text-[11px] font-bold text-white cursor-pointer"
                  >
                    Review in Documents
                  </button>
                </div>
              ))}
              {(!queueData || queueData.low_confidence_fields.length === 0) && (
                <p className="text-center py-4 text-xs text-slate-500">
                  All extracted fields across accessible cases meet high confidence (&ge; 85%).
                </p>
              )}
            </div>
          )}

          {queueTab === 'entities' && (
            <div className="space-y-2 text-xs">
              {(queueData?.uncertain_persons || []).map((p) => (
                <div key={p.person_id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#fdfcf8] p-3">
                  <span>
                    <strong className="font-mono mr-2">{p.case_id}</strong>
                    {p.canonical_name} (sim {Math.round(p.similarity_score * 100)}%)
                  </span>
                  <button
                    onClick={async () => {
                      await selectCase(p.case_id);
                      navigate('/ownership');
                    }}
                    className="rounded-lg bg-[#123D32] px-3 py-1 text-[11px] font-bold text-white cursor-pointer"
                  >
                    Resolve Entity
                  </button>
                </div>
              ))}
              {(queueData?.reupload_documents || []).map((d) => (
                <div key={d.document_id} className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                  <span>
                    <strong className="font-mono mr-2">{d.case_id}</strong>
                    {d.filename}: {d.quality_warning}
                  </span>
                  <button
                    onClick={async () => {
                      await selectCase(d.case_id);
                      navigate('/documents');
                    }}
                    className="rounded-lg bg-rose-700 px-3 py-1 text-[11px] font-bold text-white cursor-pointer"
                  >
                    Re-upload
                  </button>
                </div>
              ))}
              {(!queueData || (queueData.uncertain_persons.length === 0 && queueData.reupload_documents.length === 0)) && (
                <p className="text-center py-4 text-xs text-slate-500">
                  No uncertain person entities or scan re-upload requests pending.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* 6 Readiness Dimensions (SPEC Section 9 — strictly no single averaged score) */}
      <section className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-extrabold text-[#123D32]">{t('readiness_title')}</h2>
            <p className="text-xs text-slate-500">{t('readiness_sub')}</p>
          </div>
          <span className="rounded-full bg-[#F7F5EB] border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600">
            SPEC §9 Compliant
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {activeCase.readiness_dimensions.map((dim) => {
            const isExpanded = expandedDim === dim.dimension_name;
            const targetRoute = DIMENSION_ROUTE[dim.dimension_name] || '/title-report';
            return (
              <div
                key={dim.dimension_name}
                className="rounded-xl border border-slate-200 bg-[#fdfcf8] p-4 transition hover:border-[#239B65]/40"
              >
                <div
                  onClick={() => setExpandedDim(isExpanded ? null : dim.dimension_name)}
                  className="flex items-start justify-between gap-2 cursor-pointer"
                >
                  <div>
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadge(
                        dim.status
                      )}`}
                    >
                      {translateStatus(dim.status, lang)}
                    </span>
                    <h3 className="mt-2 text-sm font-bold text-[#123D32]">
                      {translateDimension(dim.dimension_name, lang)}
                    </h3>
                  </div>
                  <button
                    aria-label={`Toggle ${dim.dimension_name}`}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                <p className="mt-2 text-xs text-slate-600 leading-relaxed">{dim.summary}</p>

                <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-2.5 text-[11px] text-slate-500">
                  <span>
                    {t('checks_label')}: <strong className="text-slate-800">{dim.checks_run}</strong> •{' '}
                    {t('issues_label')}: <strong className="text-slate-800">{dim.issues_found}</strong>
                  </span>
                  <span className="font-semibold text-[#164E49]">
                    {translateStatus(dim.review_status, lang)}
                  </span>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3 text-[11px]">
                    <p className="text-slate-600">
                      <strong>{t('evidence_cited_label')}:</strong> {dim.evidence_count}
                    </p>
                    {dim.missing_items.length > 0 && (
                      <div className="rounded-lg bg-amber-50/80 p-2 text-amber-900 border border-amber-200/70">
                        <p className="font-bold">{t('missing_items_label')}:</p>
                        <ul className="list-disc list-inside mt-0.5">
                          {dim.missing_items.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => navigate(targetRoute)}
                      className="inline-flex items-center gap-1 font-bold text-[#239B65] hover:underline cursor-pointer"
                    >
                      <span>{t('open_detailed_view')}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Grid: Cases Table + Pipeline Trace + Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-5 rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-[#123D32]">
              {t('cases_panel_title')} ({casesList.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('cases_panel_sub')}</p>

            <div className="mt-4 space-y-2.5">
              {casesList.map((c) => {
                const isSelected = c.case_id === activeCase.case_id;
                return (
                  <div
                    key={c.case_id}
                    onClick={() => selectCase(c.case_id)}
                    className={`flex items-center justify-between rounded-xl border p-3 transition cursor-pointer ${
                      isSelected
                        ? 'border-[#239B65] bg-[#239B65]/5 ring-1 ring-[#239B65]/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#123D32]">
                          {c.case_id}
                        </span>
                        {c.synthetic && (
                          <span className="rounded bg-[#D6A84B]/20 px-1.5 py-0.2 text-[9px] font-bold text-[#7c5308]">
                            Demo
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs font-semibold text-slate-800 mt-0.5">
                        {c.case_name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Sy {c.survey_number || 'N/A'} • {c.documents_count} docs •{' '}
                        <span
                          className={`font-bold ${
                            c.discrepancies_count > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {c.discrepancies_count} discrepancies
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!['BHOOMI-DEMO-001', 'BHOOMI-CLEAN-002'].includes(c.case_id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCase(c.case_id);
                          }}
                          className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                          title="Delete custom case"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-[#239B65]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{role === 'reviewer' ? t('perspective_reviewer') : t('perspective_farmer')}</span>
            <button
              onClick={() => navigate('/title-report')}
              className="font-bold text-[#239B65] hover:underline cursor-pointer"
            >
              {t('nav_report')} →
            </button>
          </div>
        </section>

        <section className="lg:col-span-4 rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-extrabold text-[#123D32]">{t('pipeline_trace_title')}</h2>
              <p className="text-[11px] text-slate-500">
                Run: {activeCase.latest_workflow_run?.id || 'N/A'}
              </p>
            </div>
            <button
              onClick={handleRerunPipeline}
              className="rounded-lg bg-[#F7F5EB] border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-[#123D32] hover:bg-[#eae5d2] cursor-pointer"
            >
              Re-run
            </button>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {traceSteps.map((step) => (
              <div
                key={step.node}
                className="rounded-lg border border-slate-200/80 bg-[#fdfcf8] p-2.5 text-[11px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-[#123D32]">{step.node}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">{step.duration_ms}ms</span>
                    <span
                      className={`rounded-full px-2 py-0.2 text-[9px] font-bold uppercase ${
                        step.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : step.status === 'escalated'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-slate-600 leading-snug">{step.summary}</p>
                {step.conditional_branch && (
                  <p className="mt-1 font-mono text-[9px] text-[#164E49]">
                    branch: {step.conditional_branch}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-3 rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-extrabold text-[#123D32] mb-3">{t('audit_log_title')}</h2>
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {activeCase.audit_logs.map((log) => (
              <div key={log.id} className="border-l-2 border-[#239B65] pl-2.5 py-0.5 text-[11px]">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-bold text-[#164E49]">{log.action}</span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {log.created_at.split(' ')[1] || log.created_at}
                  </span>
                </div>
                <p className="text-slate-700 mt-0.5 leading-snug">{log.details}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {log.actor_name} ({log.actor_role})
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
