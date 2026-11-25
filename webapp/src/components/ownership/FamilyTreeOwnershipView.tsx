import React, { useState } from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldAlert,
  ArrowRight,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useBhoomi } from '../../context/BhoomiContext';

interface FamilyNode {
  id: string;
  name: string;
  knName: string;
  gender: 'M' | 'F';
  generation: 1 | 2 | 3;
  relationship: string;
  status: 'deceased' | 'applicant' | 'coparcener' | 'co_sharer';
  dod?: string;
  surveyAllocated?: string;
  extent?: string;
  sharePct: string;
  isBlocking: boolean;
  legalBasis: string;
  description: string;
  evidenceDoc?: {
    id: string;
    name: string;
    page: number;
  };
}

export const FamilyTreeOwnershipView: React.FC = () => {
  const { lang, openEvidence } = useBhoomi();
  const [selectedNodeId, setSelectedNodeId] = useState<string>('ramachandrappa');

  const nodes: Record<string, FamilyNode> = {
    muniyappa: {
      id: 'muniyappa',
      name: 'Muniyappa (Late)',
      knName: 'ದಿವಂಗತ ಮುನಿಯಪ್ಪ',
      gender: 'M',
      generation: 1,
      relationship: 'Propositus / Grandfather (Original Khatedar)',
      status: 'deceased',
      dod: '1998',
      extent: 'Original Ancestral Holding: 5 Acres 20 Guntas',
      sharePct: '100% (Original Ancestral Title)',
      isBlocking: false,
      legalBasis: 'Ancestral Inam / Occupancy Rights (Pre-1985)',
      description:
        'Original family head. Holding was legally partitioned among his 2 sons in 2011 via Registered Partition Deed (Book-I, Doc #2011/44).',
      evidenceDoc: {
        id: 'doc-a20f41ac',
        name: 'Partition_Deed_2011_Registered.pdf',
        page: 1,
      },
    },
    ramachandrappa: {
      id: 'ramachandrappa',
      name: 'Ramachandrappa (Late)',
      knName: 'ದಿವಂಗತ ರಾಮಚಂದ್ರಪ್ಪ',
      gender: 'M',
      generation: 2,
      relationship: 'Elder Son of Muniyappa (Father of Applicant)',
      status: 'deceased',
      dod: '14/03/2016',
      surveyAllocated: 'Survey No. 84/1',
      extent: '1 Acre 35 Guntas (1.875 Acres)',
      sharePct: '50% of Ancestral Holding',
      isBlocking: true,
      legalBasis: 'Allocated in 2011 Registered Partition Deed',
      description:
        'CRITICAL ISSUE: Deceased on 14/03/2016. Name is STILL recorded as active owner in Column 9 of 2023 RTC Form 16. Section 128 of KLR Act requires immediate Pauti Khata mutation.',
      evidenceDoc: {
        id: 'doc-30f4f927',
        name: 'Death_Certificate_Ramachandrappa.pdf',
        page: 1,
      },
    },
    govindappa: {
      id: 'govindappa',
      name: 'Govindappa',
      knName: 'ಗೋವಿಂದಪ್ಪ',
      gender: 'M',
      generation: 2,
      relationship: 'Younger Son of Muniyappa (Uncle)',
      status: 'co_sharer',
      surveyAllocated: 'Survey No. 84/2',
      extent: '2 Acres 15 Guntas',
      sharePct: '50% of Ancestral Holding',
      isBlocking: false,
      legalBasis: 'Allocated in 2011 Registered Partition Deed',
      description:
        'Younger brother of Ramachandrappa. Received separate Survey 84/2 under 2011 partition. Independent Khata already mutated cleanly in Bhoomi portal with no boundary clash.',
      evidenceDoc: {
        id: 'doc-a20f41ac',
        name: 'Partition_Deed_2011_Registered.pdf',
        page: 1,
      },
    },
    venkatesh: {
      id: 'venkatesh',
      name: 'Venkatesh R',
      knName: 'ವೆಂಕಟೇಶ್ ಆರ್',
      gender: 'M',
      generation: 3,
      relationship: 'Son of Ramachandrappa (Present Applicant)',
      status: 'applicant',
      surveyAllocated: 'Survey No. 84/1',
      extent: '1 Acre 35 Guntas',
      sharePct: '1/3rd Coparcenary Share (Possession of 100%)',
      isBlocking: true,
      legalBasis: 'Hindu Succession Act Section 6 + KLR Act Section 128',
      description:
        'In beneficial possession of Survey 84/1 and applying for Kisan Credit Card loan. Cannot create mortgage charge until Form 21 mutation is completed.',
      evidenceDoc: {
        id: 'doc-ccf7a89a',
        name: 'RTC_Form16_2023.pdf',
        page: 1,
      },
    },
    radhamma: {
      id: 'radhamma',
      name: 'Radhamma',
      knName: 'ರಾಧಮ್ಮ',
      gender: 'F',
      generation: 3,
      relationship: 'Elder Daughter of Ramachandrappa',
      status: 'coparcener',
      sharePct: '1/3rd Equal Coparcenary Right',
      isBlocking: false,
      legalBasis: 'Hindu Succession (Amendment) Act, 2005 (Section 6)',
      description:
        'Coparcener by birth with equal succession rights as a son under 2005 HSA amendment (Vineeta Sharma v. Rakesh Sharma). Must execute No-Objection Affidavit to prevent future title litigation.',
      evidenceDoc: {
        id: 'doc-30f4f927',
        name: 'Death_Certificate_Ramachandrappa.pdf',
        page: 1,
      },
    },
    manjula: {
      id: 'manjula',
      name: 'Manjula',
      knName: 'ಮಂಜುಳಾ',
      gender: 'F',
      generation: 3,
      relationship: 'Younger Daughter of Ramachandrappa',
      status: 'coparcener',
      sharePct: '1/3rd Equal Coparcenary Right',
      isBlocking: false,
      legalBasis: 'Hindu Succession (Amendment) Act, 2005 (Section 6)',
      description:
        'Coparcener by birth. Consent required for single-name Khata mutation in favour of Venkatesh R or joint Khata entry.',
      evidenceDoc: {
        id: 'doc-30f4f927',
        name: 'Death_Certificate_Ramachandrappa.pdf',
        page: 1,
      },
    },
  };

  const selected = nodes[selectedNodeId] || nodes.ramachandrappa;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6 space-y-6">
      {/* Top Banner with Pedigree Legend */}
      <div className="rounded-2xl border border-[#239B65]/30 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#123D32] px-2.5 py-0.5 font-mono text-[11px] font-bold text-white">
                GENEALOGICAL PEDIGREE ANALYSIS
              </span>
              <span className="rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span>1 Fatal Succession Gap: Unmutated Inheritance</span>
              </span>
            </div>
            <h2 className="mt-2 text-lg font-extrabold text-[#123D32]">
              {lang === 'kn'
                ? 'ವಂಶಾವಳಿ ವೃಕ್ಷ ಮತ್ತು ಪೀಳಿಗೆಯ ಹಕ್ಕುಗಳ ವಿಶ್ಲೇಷಣೆ'
                : 'Vamsha Vruksha: Complete 3-Generation Family Pedigree Flowchart'}
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-4xl">
              Standard genealogical pedigree structure tracing ancestral propositus, 2011 branch partition, and individual child coparcenary entitlements under Section 6 of the Hindu Succession Act (2005). Click any node to inspect legal rights and citations.
            </p>
          </div>

          {/* Standard Pedigree Legend */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#F7F5EB] border border-slate-200 p-2.5 text-[11px] font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-700 bg-white text-[9px] font-bold">
                □
              </span>
              <span>Male (ಪುರುಷ)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-700 bg-white text-[9px] font-bold">
                ○
              </span>
              <span>Female (ಮಹಿಳೆ)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-600"></span>
              <span className="text-rose-700 font-bold">Deceased / Blocked</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#239B65]"></span>
              <span className="text-[#164E49] font-bold">Active Coparcener</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: The Pure Pedigree Flowchart */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs overflow-x-auto">
            {/* GENERATION 1: PROPOSITUS */}
            <div className="text-center">
              <div className="inline-block rounded-full bg-slate-100 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Generation I • Original Propositus (ಪೂರ್ವಜರು)
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setSelectedNodeId('muniyappa')}
                  className={`w-72 rounded-xl p-3 border text-left transition cursor-pointer relative shadow-xs ${
                    selectedNodeId === 'muniyappa'
                      ? 'border-[#239B65] bg-[#239B65]/10 ring-2 ring-[#239B65]/40'
                      : 'border-slate-300 bg-slate-50/70 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-slate-700 bg-white font-mono text-xs font-bold text-slate-800">
                      □
                    </span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[9px] font-bold text-slate-700">
                      Late (Demised 1998)
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-extrabold text-[#123D32]">Muniyappa (ಮುನಿಯಪ್ಪ)</p>
                  <p className="text-[11px] text-slate-500">Ancestral Khatedar • 5A 20G</p>
                </button>
              </div>

              {/* Connecting Tree Stem */}
              <div className="flex flex-col items-center">
                <div className="h-6 w-0.5 bg-slate-400"></div>
                {/* Horizontal branch line for Generation 2 */}
                <div className="h-0.5 w-[56%] bg-slate-400 relative">
                  <div className="absolute left-0 top-0 h-4 w-0.5 bg-slate-400"></div>
                  <div className="absolute right-0 top-0 h-4 w-0.5 bg-slate-400"></div>
                </div>
              </div>
            </div>

            {/* GENERATION 2: SIBLING BRANCHES (PARTITION 2011) */}
            <div className="mt-4">
              <div className="text-center mb-2">
                <span className="inline-block rounded-full bg-slate-100 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Generation II • 2011 Partition Sibling Branches (ಮಕ್ಕಳು)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-2">
                {/* Branch A: Ramachandrappa (Focal branch with defect) */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setSelectedNodeId('ramachandrappa')}
                    className={`w-full max-w-[270px] rounded-xl p-3.5 border text-left transition cursor-pointer relative shadow-xs ${
                      selectedNodeId === 'ramachandrappa'
                        ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/40'
                        : 'border-rose-300 bg-rose-50/50 hover:bg-rose-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-5 w-5 items-center justify-center rounded border border-rose-800 bg-white font-mono text-xs font-bold text-rose-800">
                        □
                      </span>
                      <span className="rounded bg-rose-600 px-2 py-0.2 text-[9px] font-bold text-white">
                        Demised 14/03/2016
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-extrabold text-rose-950">
                      Ramachandrappa (ರಾಮಚಂದ್ರಪ್ಪ)
                    </p>
                    <p className="text-[11px] font-semibold text-rose-800">
                      Allocated Survey 84/1 (1A 35G)
                    </p>
                    <div className="mt-2 flex items-center gap-1 rounded bg-rose-200/70 px-2 py-0.5 text-[10px] font-extrabold text-rose-900">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>Unmutated Khatedar in RTC</span>
                    </div>
                  </button>

                  {/* Stem connecting Ramachandrappa to his children */}
                  <div className="h-7 w-0.5 bg-rose-400"></div>
                  {/* Horizontal line for 3 children */}
                  <div className="h-0.5 w-[92%] bg-rose-400 relative">
                    <div className="absolute left-0 top-0 h-4 w-0.5 bg-rose-400"></div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 h-4 w-0.5 bg-rose-400"></div>
                    <div className="absolute right-0 top-0 h-4 w-0.5 bg-rose-400"></div>
                  </div>
                </div>

                {/* Branch B: Govindappa (Clean branch) */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setSelectedNodeId('govindappa')}
                    className={`w-full max-w-[270px] rounded-xl p-3.5 border text-left transition cursor-pointer relative shadow-xs ${
                      selectedNodeId === 'govindappa'
                        ? 'border-[#239B65] bg-[#239B65]/10 ring-2 ring-[#239B65]/40'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-5 w-5 items-center justify-center rounded border border-slate-700 bg-white font-mono text-xs font-bold text-slate-800">
                        □
                      </span>
                      <span className="rounded bg-emerald-100 px-2 py-0.2 text-[9px] font-bold text-emerald-800">
                        Khata Cleared
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-extrabold text-[#123D32]">
                      Govindappa (ಗೋವಿಂದಪ್ಪ)
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Allocated Survey 84/2 (2A 15G)
                    </p>
                    <div className="mt-2 text-[10px] font-medium text-slate-500">
                      Clean mutation • Adjoining North border
                    </div>
                  </button>
                  <div className="mt-4 p-3 rounded-xl border border-dashed border-slate-200 text-center text-[10px] text-slate-400 max-w-[240px]">
                    Separate branch settled under MR #12/2012 (No pending dispute with Sy 84/1)
                  </div>
                </div>
              </div>
            </div>

            {/* GENERATION 3: INDIVIDUAL CHILDREN & COPARCENERS */}
            <div className="mt-6 border-t border-slate-100 pt-3">
              <div className="text-center mb-3">
                <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#164E49]">
                  Generation III • All Children of Ramachandrappa (Coparceners under Hindu Succession Act)
                </span>
              </div>

              {/* 3 Children Cards Side by Side */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Child 1: Venkatesh R (Son / Applicant) */}
                <button
                  onClick={() => setSelectedNodeId('venkatesh')}
                  className={`rounded-xl p-3 border text-left transition cursor-pointer relative shadow-xs ${
                    selectedNodeId === 'venkatesh'
                      ? 'border-[#239B65] bg-[#239B65]/15 ring-2 ring-[#239B65]/40'
                      : 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-[#164E49] bg-white font-mono text-xs font-bold text-[#164E49]">
                      □
                    </span>
                    <span className="rounded bg-[#123D32] px-1.5 py-0.2 text-[9px] font-bold text-[#D6A84B]">
                      Applicant (Son)
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-extrabold text-[#123D32]">
                    1. Venkatesh R (ವೆಂಕಟೇಶ್)
                  </p>
                  <p className="text-[10.5px] text-slate-600 mt-0.5">Son • In possession of 1A 35G</p>
                  <div className="mt-2 text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                    Applying for KCC Bank Loan
                  </div>
                </button>

                {/* Child 2: Radhamma (Daughter / Coparcener) */}
                <button
                  onClick={() => setSelectedNodeId('radhamma')}
                  className={`rounded-xl p-3 border text-left transition cursor-pointer relative shadow-xs ${
                    selectedNodeId === 'radhamma'
                      ? 'border-[#239B65] bg-[#239B65]/15 ring-2 ring-[#239B65]/40'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-purple-700 bg-white font-mono text-xs font-bold text-purple-800">
                      ○
                    </span>
                    <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.2 text-[9px] font-bold text-purple-800">
                      Daughter (ಮಗಳು)
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-extrabold text-slate-900">
                    2. Radhamma (ರಾಧಮ್ಮ)
                  </p>
                  <p className="text-[10.5px] text-slate-600 mt-0.5">Daughter • HSA 2005 S.6</p>
                  <div className="mt-2 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Consent Affidavit Required
                  </div>
                </button>

                {/* Child 3: Manjula (Daughter / Coparcener) */}
                <button
                  onClick={() => setSelectedNodeId('manjula')}
                  className={`rounded-xl p-3 border text-left transition cursor-pointer relative shadow-xs ${
                    selectedNodeId === 'manjula'
                      ? 'border-[#239B65] bg-[#239B65]/15 ring-2 ring-[#239B65]/40'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-purple-700 bg-white font-mono text-xs font-bold text-purple-800">
                      ○
                    </span>
                    <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.2 text-[9px] font-bold text-purple-800">
                      Daughter (ಮಗಳು)
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-extrabold text-slate-900">
                    3. Manjula (ಮಂಜುಳಾ)
                  </p>
                  <p className="text-[10.5px] text-slate-600 mt-0.5">Daughter • HSA 2005 S.6</p>
                  <div className="mt-2 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Consent Affidavit Required
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Deep Legal Rights & Evidence Inspector */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-[#164E49]/20 bg-white p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Pedigree Node Inspector
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    selected.status === 'deceased'
                      ? 'bg-rose-100 text-rose-800'
                      : selected.status === 'applicant'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {selected.status.toUpperCase()}
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#123D32] mt-1">
                {selected.name}
              </h3>
              <p className="text-xs text-slate-500 font-sans">{selected.knName}</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold text-[11px]">Kinship &amp; Position:</span>
                <p className="font-bold text-slate-800 mt-0.5">{selected.relationship}</p>
              </div>

              <div>
                <span className="text-slate-400 font-semibold text-[11px]">Statutory Share Entitlement:</span>
                <p className="font-bold text-[#164E49] mt-0.5">{selected.sharePct}</p>
              </div>

              {selected.surveyAllocated && (
                <div>
                  <span className="text-slate-400 font-semibold text-[11px]">Survey Extent:</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {selected.surveyAllocated} • {selected.extent}
                  </p>
                </div>
              )}

              <div>
                <span className="text-slate-400 font-semibold text-[11px]">Statutory Legal Grounding:</span>
                <p className="font-semibold text-slate-700 mt-0.5 bg-[#F7F5EB] p-2 rounded-lg border border-slate-200">
                  {selected.legalBasis}
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-semibold text-[11px]">Analysis &amp; Bank Diligence:</span>
                <p className="text-slate-600 mt-0.5 leading-relaxed">
                  {selected.description}
                </p>
              </div>
            </div>

            {selected.isBlocking && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 space-y-1">
                <p className="font-extrabold flex items-center gap-1.5 text-rose-800">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Loan Underwriting Warning</span>
                </p>
                <p className="text-[11px] leading-snug">
                  Bank cannot issue KCC sanction while title sits in a deceased person's name. A Form 21 inheritance petition supported by surviving coparcener affidavits must be submitted to Taluk office.
                </p>
              </div>
            )}

            {selected.evidenceDoc && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[11px] font-bold text-slate-500 mb-2">Source Document Citation:</p>
                <button
                  onClick={() =>
                    openEvidence({
                      documentId: selected.evidenceDoc!.id,
                      documentName: selected.evidenceDoc!.name,
                      page: selected.evidenceDoc!.page,
                    })
                  }
                  className="w-full flex items-center justify-between rounded-lg bg-[#F7F5EB] border border-slate-200 p-2.5 text-xs font-bold text-[#123D32] hover:bg-[#239B65] hover:text-white transition cursor-pointer"
                >
                  <span className="truncate">{selected.evidenceDoc.name}</span>
                  <FileText className="h-4 w-4 shrink-0 ml-1.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
