import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  FileSearch,
  GitBranch,
  MapPin,
  Calculator,
  ChevronDown,
  Plus,
  Download,
  UserCheck,
  User,
  Globe,
  LogIn,
  LogOut,
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Sprout,
  Search,
  Check,
} from 'lucide-react';
import { useBhoomi } from '../context/BhoomiContext';
import { DocumentEvidenceModal } from './DocumentEvidenceModal';

export const BhoomiShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activeCaseId,
    activeCase,
    casesList,
    selectCase,
    createCase,
    role,
    setRole,
    lang,
    setLang,
    t,
    user,
    loginUser,
    registerUser,
    logoutUser,
    downloadReadinessPdf,
    toast,
  } = useBhoomi();

  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const caseMenuRef = useRef<HTMLDivElement>(null);

  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // New case form state
  const [ncName, setNcName] = useState('');
  const [ncSurvey, setNcSurvey] = useState('');
  const [ncVillage, setNcVillage] = useState('');
  const [ncHobli, setNcHobli] = useState('');
  const [ncTaluk, setNcTaluk] = useState('');
  const [ncDistrict, setNcDistrict] = useState('');
  const [ncConsent, setNcConsent] = useState(false);

  // Auth form state
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authRole, setAuthRole] = useState<'farmer' | 'reviewer'>('farmer');

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (caseMenuRef.current && !caseMenuRef.current.contains(e.target as Node)) {
        setCaseMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCaseMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const navItems = [
    { to: '/', label: t('nav_dashboard'), icon: LayoutDashboard, end: true },
    { to: '/documents', label: t('nav_documents'), icon: FileText },
    { to: '/title-report', label: t('nav_report'), icon: FileSearch },
    { to: '/ownership', label: t('nav_ownership'), icon: GitBranch },
    { to: '/gis', label: t('nav_gis'), icon: MapPin },
    { to: '/valuation', label: t('nav_valuation'), icon: Calculator },
  ];

  const handleCreateCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await createCase({
      case_name: ncName,
      survey_number: ncSurvey,
      village: ncVillage,
      hobli: ncHobli,
      taluk: ncTaluk,
      district: ncDistrict,
      external_llm_consent: ncConsent,
    });
    if (created) {
      setShowNewCaseModal(false);
      setNcName('');
      setNcSurvey('');
      setNcVillage('');
      setNcHobli('');
      setNcTaluk('');
      setNcDistrict('');
      setNcConsent(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let ok = false;
    if (authMode === 'login') {
      ok = await loginUser(authEmail, authPass);
    } else {
      ok = await registerUser(authName, authEmail, authPass, authRole);
    }
    if (ok) {
      setShowAuthModal(false);
      setAuthPass('');
    }
  };

  const pendingDiscs =
    activeCase?.discrepancies.filter((d) => d.review_status === 'pending').length || 0;

  const filteredCases = casesList.filter((c) => {
    const q = caseSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.case_id.toLowerCase().includes(q) ||
      c.case_name.toLowerCase().includes(q) ||
      c.village.toLowerCase().includes(q) ||
      c.survey_number.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5EB] text-[#132520]">
      {/* Persistent Statutory & Synthetic Data Notice */}
      <div className="bg-[#D6A84B]/20 border-b border-[#D6A84B]/40 px-4 py-1 text-center text-[11px] font-semibold text-[#123D32] flex items-center justify-center gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[#9a6b13]" />
        <span className="truncate">
          {activeCase?.synthetic !== false ? t('synthetic_banner') : t('real_banner')}
        </span>
      </div>

      {/* Crisp 56px Single-Row Header */}
      <header className="sticky top-0 z-40 border-b border-[#164E49] bg-[#123D32] text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-2 px-3 sm:px-4">
          {/* Left: Brand + Custom Searchable Case Switcher Popover */}
          <div className="flex items-center gap-2 shrink-0">
            <NavLink to="/" className="flex items-center gap-2 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#239B65] text-white shadow-xs ring-1 ring-white/20">
                <Sprout className="h-4 w-4" />
              </div>
              <div className="hidden sm:block leading-none">
                <span className="text-sm font-extrabold tracking-tight text-white">
                  {t('brand')}
                </span>
                <p className="hidden 2xl:block text-[9px] font-medium text-emerald-200/80 mt-0.5">
                  {t('tagline')}
                </p>
              </div>
            </NavLink>

            {/* Custom Searchable Case Switcher (zero native select double-caret) */}
            <div ref={caseMenuRef} className="relative">
              <button
                type="button"
                aria-label="Switch Active Land Case"
                aria-expanded={caseMenuOpen}
                onClick={() => setCaseMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-lg bg-[#164E49] px-2 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 hover:bg-[#1c615b] transition cursor-pointer"
              >
                <span className="max-w-[130px] truncate font-mono text-[11px]">
                  {activeCaseId}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    pendingDiscs > 0
                      ? 'bg-[#D6A84B] text-[#123D32]'
                      : 'bg-emerald-500/25 text-emerald-200'
                  }`}
                >
                  {pendingDiscs}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-emerald-200 transition-transform ${
                    caseMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {caseMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl ring-1 ring-black/5 overflow-hidden z-50">
                  <div className="border-b border-slate-100 p-2.5 bg-[#F7F5EB]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#164E49] mb-1.5">
                      {t('switch_case')} ({casesList.length})
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                      <Search className="h-3.5 w-3.5 text-slate-400" />
                      <input
                        autoFocus
                        value={caseSearch}
                        onChange={(e) => setCaseSearch(e.target.value)}
                        placeholder={t('search_cases')}
                        className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {filteredCases.map((c) => {
                      const isSel = c.case_id === activeCaseId;
                      return (
                        <button
                          key={c.case_id}
                          type="button"
                          onClick={() => {
                            selectCase(c.case_id);
                            setCaseMenuOpen(false);
                            setCaseSearch('');
                          }}
                          className={`flex w-full items-start justify-between gap-2 p-2.5 text-left transition cursor-pointer ${
                            isSel ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-[#123D32]">
                                {c.case_id}
                              </span>
                              {c.synthetic && (
                                <span className="rounded bg-[#D6A84B]/20 px-1 py-0.2 text-[9px] font-bold text-[#7c5308]">
                                  Demo
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs font-semibold text-slate-800 mt-0.5">
                              {c.case_name}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {c.village || c.district || 'Karnataka'} • Sy {c.survey_number || 'N/A'} •{' '}
                              {c.documents_count} docs
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                c.discrepancies_count > 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {c.discrepancies_count} issues
                            </span>
                            {isSel && <Check className="h-3.5 w-3.5 text-[#239B65]" />}
                          </div>
                        </button>
                      );
                    })}
                    {filteredCases.length === 0 && (
                      <p className="p-4 text-center text-xs text-slate-400">
                        No matching cases found.
                      </p>
                    )}
                  </div>

                  <div className="border-t border-slate-100 bg-slate-50 p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCaseMenuOpen(false);
                        setShowNewCaseModal(true);
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#123D32] py-1.5 text-xs font-bold text-white hover:bg-[#164E49] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-[#D6A84B]" />
                      <span>{t('new_case_full')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center: Single-Line Navigation Tabs on xl+ */}
          <nav className="hidden xl:flex items-center gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[11.5px] font-semibold transition ${
                      isActive
                        ? 'bg-[#239B65] text-white shadow-xs'
                        : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {item.to === '/title-report' && pendingDiscs > 0 && (
                    <span className="rounded-full bg-[#D6A84B] px-1.5 py-0.2 text-[10px] font-extrabold text-[#123D32]">
                      {pendingDiscs}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Right: Segmented Role Switcher, Language, Auth, Export PDF */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Compact Segmented Role Switcher */}
            <div
              role="group"
              aria-label="Perspective Role"
              className="flex items-center rounded-lg bg-[#0d2c24] p-0.5 ring-1 ring-white/15 text-[11px] font-bold"
            >
              <button
                type="button"
                onClick={() => setRole('farmer')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 transition cursor-pointer ${
                  role === 'farmer'
                    ? 'bg-[#239B65] text-white shadow-2xs'
                    : 'text-emerald-200/80 hover:text-white'
                }`}
                title="Farmer / Landowner guidance view"
              >
                <User className="h-3 w-3" />
                <span className="hidden sm:inline">{t('role_farmer')}</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('reviewer')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 transition cursor-pointer ${
                  role === 'reviewer'
                    ? 'bg-[#D6A84B] text-[#123D32] shadow-2xs'
                    : 'text-emerald-200/80 hover:text-white'
                }`}
                title="Reviewer Queue & correction view"
              >
                <UserCheck className="h-3 w-3" />
                <span className="hidden sm:inline">{t('role_reviewer')}</span>
              </button>
            </div>

            {/* EN / ಕನ್ನಡ Toggle */}
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'kn' : 'en')}
              className="flex items-center gap-1 rounded-lg bg-[#164E49] px-2 py-1.5 text-[11px] font-bold text-emerald-100 ring-1 ring-white/15 hover:bg-white/10 cursor-pointer"
              title="Toggle English / Kannada UI"
            >
              <Globe className="h-3.5 w-3.5 text-[#D6A84B]" />
              <span>{lang === 'en' ? 'ಕನ್ನಡ' : 'EN'}</span>
            </button>

            {/* Auth Button */}
            {user ? (
              <button
                type="button"
                onClick={logoutUser}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-white/20 cursor-pointer"
                title={`${user.email} (${t('sign_out')})`}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden md:inline max-w-[70px] truncate">
                  {user.name.split(' ')[0]}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20 cursor-pointer"
                title={t('sign_in')}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t('sign_in')}</span>
              </button>
            )}

            {/* Single Persistent Export PDF Primary CTA */}
            <button
              type="button"
              onClick={downloadReadinessPdf}
              className="flex items-center gap-1.5 rounded-lg bg-[#239B65] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-[#1d8556] transition cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('export_pdf')}</span>
            </button>
          </div>
        </div>

        {/* Clean Responsive Secondary Nav Strip for < xl viewports */}
        <nav className="flex xl:hidden items-center gap-1 overflow-x-auto border-t border-white/10 bg-[#0f332a] px-3 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    isActive
                      ? 'bg-[#239B65] text-white'
                      : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{item.label}</span>
                {item.to === '/title-report' && pendingDiscs > 0 && (
                  <span className="rounded-full bg-[#D6A84B] px-1.5 text-[9px] font-extrabold text-[#123D32]">
                    {pendingDiscs}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </header>

      {/* Main Page Content */}
      <main className="flex-1">{children}</main>

      {/* Global Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[110] flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-2xl ring-1 ${
            toast.type === 'err'
              ? 'bg-rose-800 ring-rose-500'
              : toast.type === 'warn'
              ? 'bg-amber-800 ring-amber-400'
              : 'bg-[#123D32] ring-[#239B65]'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 text-[#239B65]" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-[#D6A84B]" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Global Document Evidence & Correction Modal */}
      <DocumentEvidenceModal />

      {/* Create New Case Modal */}
      {showNewCaseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          onClick={() => setShowNewCaseModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#123D32]">{t('new_case_full')}</h3>
              <button
                onClick={() => setShowNewCaseModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCaseSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Case Name *</label>
                <input
                  required
                  value={ncName}
                  onChange={(e) => setNcName(e.target.value)}
                  placeholder="e.g. Doddaballapur Survey 45/2 Purchase Check"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#239B65] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Survey Number *</label>
                  <input
                    required
                    value={ncSurvey}
                    onChange={(e) => setNcSurvey(e.target.value)}
                    placeholder="e.g. 45/2"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#239B65] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Village</label>
                  <input
                    value={ncVillage}
                    onChange={(e) => setNcVillage(e.target.value)}
                    placeholder="Village name"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#239B65] focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Hobli</label>
                  <input
                    value={ncHobli}
                    onChange={(e) => setNcHobli(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 focus:border-[#239B65] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Taluk</label>
                  <input
                    value={ncTaluk}
                    onChange={(e) => setNcTaluk(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 focus:border-[#239B65] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">District</label>
                  <input
                    value={ncDistrict}
                    onChange={(e) => setNcDistrict(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 focus:border-[#239B65] focus:outline-none"
                  />
                </div>
              </div>
              <label className="flex items-start gap-2 rounded-lg bg-[#F7F5EB] p-2.5 text-[11px] text-slate-700 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ncConsent}
                  onChange={(e) => setNcConsent(e.target.checked)}
                  className="mt-0.5 accent-[#239B65]"
                />
                <span>
                  I grant informed consent (DPDP Act 2023) if external Vision-LLM extraction is needed; otherwise keep all parsing 100% local.
                </span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#239B65] px-4 py-1.5 font-bold text-white hover:bg-[#1d8556] cursor-pointer"
                >
                  Create Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auth Login / Register Modal */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#123D32]">
                {authMode === 'login' ? 'Sign In to BhoomiAI' : 'Register Private Account'}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Demo officer login: <span className="font-mono">demo@bhoomiai.in</span> /{' '}
              <span className="font-mono">bhoomi123</span>. Or register a private account for isolated cases.
            </p>
            <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3 text-xs">
              {authMode === 'register' && (
                <div>
                  <label className="font-semibold text-slate-700">Full Name</label>
                  <input
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#239B65] focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="font-semibold text-slate-700">Email</label>
                <input
                  required
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#239B65] focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Password (min 6 chars)</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={authPass}
                  onChange={(e) => setAuthPass(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#239B65] focus:outline-none"
                />
              </div>
              {authMode === 'register' && (
                <div>
                  <label className="font-semibold text-slate-700">Role</label>
                  <select
                    value={authRole}
                    onChange={(e) => setAuthRole(e.target.value as 'farmer' | 'reviewer')}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                  >
                    <option value="farmer">Farmer / Landowner</option>
                    <option value="reviewer">Land Reviewer</option>
                  </select>
                </div>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-[#123D32] py-2 font-bold text-white hover:bg-[#164E49] cursor-pointer"
              >
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="w-full text-center text-[11px] font-semibold text-[#164E49] hover:underline cursor-pointer"
              >
                {authMode === 'login' ? 'Need an account? Register' : 'Already registered? Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
