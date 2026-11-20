import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  CaseSummaryItem,
  DocumentItem,
  ExtractedField,
  LandCase,
  BoundingBox,
} from '../types/bhoomi';
import { Lang, UI_STRINGS } from '../i18n/strings';
import { staticDemoFetch } from '../lib/staticDemoApi';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api';
const FORCE_STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true';

export interface EvidenceModalTarget {
  documentId: string;
  documentName?: string;
  page: number;
  highlightField?: ExtractedField | null;
  highlightBBox?: BoundingBox | null;
  highlightText?: string | null;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface BhoomiContextValue {
  activeCaseId: string;
  activeCase: LandCase | null;
  casesList: CaseSummaryItem[];
  loading: boolean;
  role: 'farmer' | 'reviewer';
  setRole: (r: 'farmer' | 'reviewer') => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  user: AuthUser | null;
  token: string | null;
  toast: { msg: string; type: 'ok' | 'err' | 'warn' } | null;
  showToast: (msg: string, type?: 'ok' | 'err' | 'warn') => void;
  selectCase: (caseId: string) => Promise<void>;
  refreshCase: () => Promise<void>;
  refreshCasesList: () => Promise<void>;
  createCase: (payload: {
    case_name: string;
    village: string;
    hobli: string;
    taluk: string;
    district: string;
    survey_number: string;
    external_llm_consent: boolean;
  }) => Promise<LandCase | null>;
  deleteCase: (caseId: string) => Promise<void>;
  resetDemoCases: () => Promise<void>;
  rerunPipeline: () => Promise<void>;
  uploadDocument: (file: File) => Promise<boolean>;
  deleteDocument: (docId: string) => Promise<void>;
  correctField: (docId: string, fieldName: string, correctedValue: any, notes: string) => Promise<boolean>;
  reviewDiscrepancy: (discId: string, decision: string, notes: string) => Promise<boolean>;
  downloadReadinessPdf: () => Promise<void>;
  loginUser: (email: string, password: string) => Promise<boolean>;
  registerUser: (name: string, email: string, password: string, role: string) => Promise<boolean>;
  logoutUser: () => void;
  evidenceTarget: EvidenceModalTarget | null;
  openEvidence: (target: EvidenceModalTarget) => void;
  closeEvidence: () => void;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const BhoomiContext = createContext<BhoomiContextValue | undefined>(undefined);

export const BhoomiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCaseId, setActiveCaseId] = useState<string>(
    () => localStorage.getItem('bhoomi_case_id') || 'BHOOMI-DEMO-001'
  );
  const [activeCase, setActiveCase] = useState<LandCase | null>(null);
  const [casesList, setCasesList] = useState<CaseSummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [role, setRole] = useState<'farmer' | 'reviewer'>('reviewer');
  const [lang, setLang] = useState<Lang>('en');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('bhoomi_token'));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('bhoomi_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | 'warn' } | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<EvidenceModalTarget | null>(null);

  const showToast = useCallback((msg: string, type: 'ok' | 'err' | 'warn' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev));
    }, 3600);
  }, []);

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      if (FORCE_STATIC_DEMO) {
        return staticDemoFetch(path, init);
      }
      const headers = new Headers(init.headers || {});
      headers.set('X-Demo-Role', role);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      try {
        return await fetch(`${API_BASE}${path}`, { ...init, headers });
      } catch {
        return staticDemoFetch(path, init);
      }
    },
    [role, token]
  );

  const refreshCasesList = useCallback(async () => {
    try {
      const res = await apiFetch('/cases');
      if (res.ok) {
        const list: CaseSummaryItem[] = await res.json();
        setCasesList(list);
      }
    } catch (e) {
      console.error('Failed to fetch cases list', e);
    }
  }, [apiFetch]);

  const loadCase = useCallback(
    async (cid: string) => {
      setLoading(true);
      try {
        const res = await apiFetch(`/cases/${encodeURIComponent(cid)}`);
        if (res.ok) {
          const data: LandCase = await res.json();
          setActiveCase(data);
          setActiveCaseId(data.case_id);
          localStorage.setItem('bhoomi_case_id', data.case_id);
        } else if (cid !== 'BHOOMI-DEMO-001') {
          const fallback = await apiFetch('/cases/BHOOMI-DEMO-001');
          if (fallback.ok) {
            const data: LandCase = await fallback.json();
            setActiveCase(data);
            setActiveCaseId(data.case_id);
            localStorage.setItem('bhoomi_case_id', data.case_id);
          }
        }
      } catch (e) {
        console.error('Error loading case', e);
      } finally {
        setLoading(false);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    refreshCasesList();
    loadCase(activeCaseId);
  }, [activeCaseId, loadCase, refreshCasesList]);

  const selectCase = async (cid: string) => {
    await loadCase(cid);
    await refreshCasesList();
  };

  const refreshCase = async () => {
    await loadCase(activeCaseId);
    await refreshCasesList();
  };

  const createCase = async (payload: {
    case_name: string;
    village: string;
    hobli: string;
    taluk: string;
    district: string;
    survey_number: string;
    external_llm_consent: boolean;
  }) => {
    try {
      const res = await apiFetch('/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.detail || 'Failed to create case', 'err');
        return null;
      }
      const created: LandCase = await res.json();
      setActiveCase(created);
      setActiveCaseId(created.case_id);
      localStorage.setItem('bhoomi_case_id', created.case_id);
      await refreshCasesList();
      showToast(`Created case ${created.case_id}`, 'ok');
      return created;
    } catch {
      showToast('Backend unavailable', 'err');
      return null;
    }
  };

  const deleteCase = async (cid: string) => {
    const res = await apiFetch(`/cases/${encodeURIComponent(cid)}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || 'Cannot delete case', 'err');
      return;
    }
    showToast(`Deleted case ${cid}`, 'ok');
    await selectCase('BHOOMI-DEMO-001');
  };

  const resetDemoCases = async () => {
    const res = await apiFetch('/cases/reset-demo', { method: 'POST' });
    if (res.ok) {
      await refreshCasesList();
      await loadCase('BHOOMI-DEMO-001');
      showToast('Synthetic demo cases reset cleanly.', 'ok');
    } else {
      showToast('Failed to reset demo cases', 'err');
    }
  };

  const rerunPipeline = async () => {
    const res = await apiFetch(`/cases/${encodeURIComponent(activeCaseId)}/pipeline/run`, {
      method: 'POST',
    });
    if (res.ok) {
      const updated: LandCase = await res.json();
      setActiveCase(updated);
      await refreshCasesList();
      showToast(`Pipeline completed (${updated.discrepancies.length} findings).`, 'ok');
    }
  };

  const uploadDocument = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiFetch(`/cases/${encodeURIComponent(activeCaseId)}/documents/upload`, {
      method: 'POST',
      body: fd,
    });
    const body = await res.json();
    if (!res.ok) {
      showToast(body.detail || `Failed to upload ${file.name}`, 'err');
      return false;
    }
    if (body.case) setActiveCase(body.case);
    await refreshCasesList();
    if (body.document?.status === 'needs_reupload') {
      showToast(body.document.quality_warning || 'Scan quality insufficient — please re-upload.', 'warn');
    } else if (body.document?.injection_warning) {
      showToast(`${file.name} extracted — prompt injection text quarantined safely.`, 'warn');
    } else {
      showToast(body.duplicate_notice ? `${body.message}. ${body.duplicate_notice}` : body.message, 'ok');
    }
    return true;
  };

  const deleteDocument = async (docId: string) => {
    const res = await apiFetch(`/documents/${encodeURIComponent(docId)}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      if (data.case) setActiveCase(data.case);
      await refreshCasesList();
      showToast('Document removed and pipeline re-evaluated.', 'ok');
    }
  };

  const correctField = async (docId: string, fieldName: string, correctedValue: any, notes: string) => {
    const res = await apiFetch(`/documents/${encodeURIComponent(docId)}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: docId,
        field_name: fieldName,
        corrected_value: correctedValue,
        reviewer_notes: notes,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || 'Correction failed', 'err');
      return false;
    }
    const data = await res.json();
    if (data.case) {
      setActiveCase(data.case);
      // Also update evidenceTarget highlightField if modal is open
      setEvidenceTarget((prev) => {
        if (!prev) return null;
        const updatedDoc = (data.case as LandCase).documents.find((d) => d.id === prev.documentId);
        const updatedFld = updatedDoc?.extracted_fields.find((f) => f.field_name === fieldName) || prev.highlightField;
        return { ...prev, highlightField: updatedFld };
      });
    }
    await refreshCasesList();
    showToast(`Saved reviewer value for '${fieldName}' (original preserved).`, 'ok');
    return true;
  };

  const reviewDiscrepancy = async (discId: string, decision: string, notes: string) => {
    const res = await apiFetch(`/discrepancies/${encodeURIComponent(discId)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discrepancy_id: discId,
        decision,
        reviewer_notes: notes,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || 'Review update failed', 'err');
      return false;
    }
    const data = await res.json();
    if (data.case) setActiveCase(data.case);
    await refreshCasesList();
    showToast(`Finding marked as ${decision.toUpperCase()}.`, 'ok');
    return true;
  };

  const downloadReadinessPdf = async () => {
    try {
      const res = await apiFetch(`/cases/${encodeURIComponent(activeCaseId)}/reports/sign`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Not authorized to download report PDF', 'err');
        return;
      }
      const data = await res.json();
      const baseHost = API_BASE.replace(/\/api\/?$/, '');
      const signedUrl =
        data.download_url.startsWith('http') || data.download_url.includes('/demo-snapshot/')
          ? data.download_url
          : `${baseHost}${data.download_url}`;
      const a = document.createElement('a');
      a.href = signedUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = `${activeCaseId}_Land_Readiness_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`Generating signed Land Readiness PDF for ${activeCaseId}...`, 'ok');
    } catch {
      showToast('Failed to generate signed download link', 'err');
    }
  };

  const loginUser = async (email: string, password: string) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || 'Login failed', 'err');
      return false;
    }
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('bhoomi_token', data.access_token);
    localStorage.setItem('bhoomi_user', JSON.stringify(data.user));
    showToast(`Signed in as ${data.user.name}`, 'ok');
    await refreshCasesList();
    return true;
  };

  const registerUser = async (name: string, email: string, password: string, userRole: string) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role: userRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || 'Registration failed', 'err');
      return false;
    }
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('bhoomi_token', data.access_token);
    localStorage.setItem('bhoomi_user', JSON.stringify(data.user));
    showToast(`Registered & signed in as ${data.user.name}`, 'ok');
    await refreshCasesList();
    return true;
  };

  const logoutUser = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('bhoomi_token');
    localStorage.removeItem('bhoomi_user');
    showToast('Signed out (switched to Demo Session)', 'ok');
    selectCase('BHOOMI-DEMO-001');
  };

  const t = useCallback((key: string) => UI_STRINGS[lang][key] || UI_STRINGS.en[key] || key, [lang]);

  return (
    <BhoomiContext.Provider
      value={{
        activeCaseId,
        activeCase,
        casesList,
        loading,
        role,
        setRole,
        lang,
        setLang,
        t,
        user,
        token,
        toast,
        showToast,
        selectCase,
        refreshCase,
        refreshCasesList,
        createCase,
        deleteCase,
        resetDemoCases,
        rerunPipeline,
        uploadDocument,
        deleteDocument,
        correctField,
        reviewDiscrepancy,
        downloadReadinessPdf,
        loginUser,
        registerUser,
        logoutUser,
        evidenceTarget,
        openEvidence: (tgt) => setEvidenceTarget(tgt),
        closeEvidence: () => setEvidenceTarget(null),
        apiFetch,
      }}
    >
      {children}
    </BhoomiContext.Provider>
  );
};

export const useBhoomi = (): BhoomiContextValue => {
  const ctx = useContext(BhoomiContext);
  if (!ctx) throw new Error('useBhoomi must be used inside BhoomiProvider');
  return ctx;
};
