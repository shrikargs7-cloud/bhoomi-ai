import React, { useState } from 'react';
import { Users, AlertTriangle, CheckCircle2, ChevronRight, FileText, UserCheck, ShieldAlert, ArrowDown } from 'lucide-react';
import { useBhoomi } from '../../context/BhoomiContext';

interface FamilyMember {
  id: string;
  name: string;
  knName: string;
  role: string;
  generation: 'Gen 1 (Original Holder)' | 'Gen 2 (Partition / Deceased)' | 'Gen 3 (Current Heirs / Coparceners)';
  status: 'deceased' | 'active_heir' | 'co_heir' | 'previous_owner';
  dateOfDeath?: string;
  shareExtent?: string;
  notes: string;
  isBlockingCredit?: boolean;
}

export const FamilyTreeOwnershipView: React.FC = () => {
  const { activeCase, lang, openEvidence } = useBhoomi();
  const [selectedPerson, setSelectedPerson] = useState<string>('ramachandrappa');

  // Ground-truth chain of title & family pedigree reconstructed from uploaded RTC, 2011 Partition Deed & Death Certificate
  const familyMembers: FamilyMember[] = [
    {
      id: 'muniyappa',
      name: 'Muniyappa (Late)',
      knName: 'ಮುನಿಯಪ್ಪ',
      role: 'Original Propositus / Ancestral Title Holder (Pre-1985)',
      generation: 'Gen 1 (Original Holder)',
      status: 'previous_owner',
      dateOfDeath: '1998',
      shareExtent: 'Original Ancestral Holding 5A 20G',
      notes: 'Acquired via ancestral occupancy rights. Partitioned among sons in 2011 (Registered Partition Deed #2011/44).',
    },
    {
      id: 'ramachandrappa',
      name: 'Ramachandrappa (Late)',
      knName: 'ದಿವಂಗತ ರಾಮಚಂದ್ರಪ್ಪ',
      role: 'Deceased Khatedar (Father of Applicant)',
      generation: 'Gen 2 (Partition / Deceased)',
      status: 'deceased',
      dateOfDeath: '14/03/2016',
      shareExtent: '1 Acre 35 Guntas (Allocated in 2011 Partition)',
      notes: 'Demised on 14/03/2016. Name STILL recorded on 2023 RTC Form 16 (Khata #342) without succession mutation (Pauti Khata).',
      isBlockingCredit: true,
    },
    {
      id: 'govindappa',
      name: 'Govindappa',
      knName: 'ಗೋವಿಂದಪ್ಪ',
      role: 'Brother / Co-sharer in 2011 Partition',
      generation: 'Gen 2 (Partition / Deceased)',
      status: 'previous_owner',
      shareExtent: 'Allocated Survey 84/2 (Separate Khata)',
      notes: 'Part of 2011 Partition Deed. Boundaries verified clean, no boundary dispute with Sy 84/1.',
    },
    {
      id: 'venkatesh',
      name: 'Venkatesh R',
      knName: 'ವೆಂಕಟೇಶ್ ಆರ್',
      role: 'Present Applicant & Surviving Legal Heir (Son)',
      generation: 'Gen 3 (Current Heirs / Coparceners)',
      status: 'active_heir',
      shareExtent: 'Full beneficial possession of 1A 35G',
      notes: 'Applying for Kisan Credit Card (KCC) loan. Cannot execute legal charge until Pauti Khata (Form 21) is sanctioned.',
      isBlockingCredit: true,
    },
    {
      id: 'radhamma',
      name: 'Radhamma',
      knName: 'ರಾಧಮ್ಮ',
      role: 'Surviving Daughter / Coparcener (HSA 2005)',
      generation: 'Gen 3 (Current Heirs / Coparceners)',
      status: 'co_heir',
      shareExtent: 'Equal coparcenary right under HSA Section 6',
      notes: 'Consent affidavit required for Form 21 inheritance registration to prevent future partition litigation.',
    },
    {
      id: 'manjula',
      name: 'Manjula',
      knName: 'ಮಂಜುಳಾ',
      role: 'Surviving Daughter / Coparcener (HSA 2005)',
      generation: 'Gen 3 (Current Heirs / Coparceners)',
      status: 'co_heir',
      shareExtent: 'Equal coparcenary right under HSA Section 6',
      notes: 'Consent affidavit required for Form 21 inheritance registration.',
    },
  ];

  const currentPerson = familyMembers.find((m) => m.id === selectedPerson) || familyMembers[1];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6 space-y-6">
      {/* Overview Banner */}
      <div className="rounded-2xl border border-[#239B65]/30 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#123D32] px-2.5 py-0.5 font-mono text-[11px] font-bold text-white">
                VAMSHA VRUKSHA (ವಂಶವೃಕ್ಷ)
              </span>
              <span className="rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                1 Unmutated Succession Gap
              </span>
            </div>
            <h2 className="mt-2 text-lg font-extrabold text-[#123D32]">
              {lang === 'kn'
                ? 'ವಂಶಾವಳಿ ಮತ್ತು ಹಿಂದಿನ ಮಾಲೀಕರ ವಿವರ (Family Tree & Chain of Title)'
                : '3-Generation Family Tree & Chain of Title Lineage'}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Reconstructed from registered Partition Deed (2011), Death Certificate (2016), and RTC Pahani (2023). Traces ancestral ownership, previous title holders, and surviving coparceners.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-[#F7F5EB] border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Total Recorded Lineage: <strong>3 Generations</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Visual 3-Generation Pedigree Flow + Person Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Visual Family Tree Hierarchy */}
        <div className="lg:col-span-8 space-y-4">
          {/* Generation 1: Original Ancestral Holder */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Generation 1 • Original Propositus / Ancestral Title (Pre-2011)
              </span>
              <span className="text-[11px] text-slate-400">Ancestral Khatedar</span>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setSelectedPerson('muniyappa')}
                className={`w-full max-w-md rounded-xl p-3.5 text-left border transition cursor-pointer ${
                  selectedPerson === 'muniyappa'
                    ? 'border-[#239B65] bg-[#239B65]/5 ring-2 ring-[#239B65]/30 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500">Previous Owner</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">Demised 1998</span>
                </div>
                <p className="text-sm font-extrabold text-[#123D32] mt-1">Muniyappa (ಮುನಿಯಪ್ಪ)</p>
                <p className="text-xs text-slate-600 mt-0.5">Partitioned holding among 2 sons in 2011</p>
              </button>
            </div>

            <div className="flex justify-center my-2 text-slate-300">
              <ArrowDown className="h-5 w-5" />
            </div>

            {/* Generation 2: Sons & Deceased Khatedar */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Generation 2 • Partitioned Sons (2011 Registered Partition Deed)
                </span>
                <span className="text-[11px] text-rose-700 font-bold">Unmutated Link Here</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Deceased Owner (Crucial block) */}
                <button
                  onClick={() => setSelectedPerson('ramachandrappa')}
                  className={`rounded-xl p-3.5 text-left border transition cursor-pointer relative overflow-hidden ${
                    selectedPerson === 'ramachandrappa'
                      ? 'border-rose-500 bg-rose-50/40 ring-2 ring-rose-500/30 shadow-xs'
                      : 'border-rose-200 bg-rose-50/20 hover:bg-rose-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-rose-700">Deceased Title Holder</span>
                    <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full font-bold">14/03/2016</span>
                  </div>
                  <p className="text-sm font-extrabold text-rose-950 mt-1 flex items-center gap-1.5">
                    <span>Ramachandrappa (ರಾಮಚಂದ್ರಪ್ಪ)</span>
                  </p>
                  <p className="text-xs text-rose-800/90 mt-0.5 font-medium">
                    Allocated Survey 84/1 (1A 35G) • Still on RTC Khata
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Blocks Bank Loan until Pauti Khata</span>
                  </div>
                </button>

                {/* Co-sharer brother */}
                <button
                  onClick={() => setSelectedPerson('govindappa')}
                  className={`rounded-xl p-3.5 text-left border transition cursor-pointer ${
                    selectedPerson === 'govindappa'
                      ? 'border-[#239B65] bg-[#239B65]/5 ring-2 ring-[#239B65]/30 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500">Co-Sharer (Brother)</span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Sy 84/2 Cleared</span>
                  </div>
                  <p className="text-sm font-extrabold text-[#123D32] mt-1">Govindappa (ಗೋವಿಂದಪ್ಪ)</p>
                  <p className="text-xs text-slate-600 mt-0.5">Partitioned Survey 84/2 • Separate Khata Sanctioned</p>
                  <div className="mt-2 text-[10px] text-slate-400">Adjoining North boundary verified</div>
                </button>
              </div>
            </div>

            <div className="flex justify-center my-2 text-slate-300">
              <ArrowDown className="h-5 w-5" />
            </div>

            {/* Generation 3: Surviving Legal Heirs */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Generation 3 • Surviving Heirs &amp; Coparceners (Legal Succession)
                </span>
                <span className="text-[11px] text-[#239B65] font-bold">Eligible for Khata Update</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Applicant */}
                <button
                  onClick={() => setSelectedPerson('venkatesh')}
                  className={`rounded-xl p-3 text-left border transition cursor-pointer ${
                    selectedPerson === 'venkatesh'
                      ? 'border-[#239B65] bg-[#239B65]/10 ring-2 ring-[#239B65]/40 shadow-xs'
                      : 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-emerald-800">Applicant (Son)</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                  </div>
                  <p className="text-xs font-extrabold text-[#123D32] mt-1">Venkatesh R</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">In possession of Sy 84/1</p>
                  <p className="text-[10px] text-[#164E49] font-bold mt-1.5">Applying for KCC Loan</p>
                </button>

                {/* Daughter 1 */}
                <button
                  onClick={() => setSelectedPerson('radhamma')}
                  className={`rounded-xl p-3 text-left border transition cursor-pointer ${
                    selectedPerson === 'radhamma'
                      ? 'border-[#239B65] bg-[#239B65]/10 ring-2 ring-[#239B65]/40 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Daughter (Coparcener)</span>
                    <span className="text-[9px] bg-slate-100 px-1.5 py-0.2 rounded font-bold">HSA S.6</span>
                  </div>
                  <p className="text-xs font-extrabold text-[#123D32] mt-1">Radhamma</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Equal coparcenary right</p>
                  <p className="text-[10px] text-amber-700 font-bold mt-1.5">No-Objection Required</p>
                </button>

                {/* Daughter 2 */}
                <button
                  onClick={() => setSelectedPerson('manjula')}
                  className={`rounded-xl p-3 text-left border transition cursor-pointer ${
                    selectedPerson === 'manjula'
                      ? 'border-[#239B65] bg-[#239B65]/10 ring-2 ring-[#239B65]/40 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Daughter (Coparcener)</span>
                    <span className="text-[9px] bg-slate-100 px-1.5 py-0.2 rounded font-bold">HSA S.6</span>
                  </div>
                  <p className="text-xs font-extrabold text-[#123D32] mt-1">Manjula</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Equal coparcenary right</p>
                  <p className="text-[10px] text-amber-700 font-bold mt-1.5">No-Objection Required</p>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Selected Person Inspector & Legal Evidence */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-[#164E49]/20 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {currentPerson.generation}
                </span>
                <h3 className="text-base font-extrabold text-[#123D32]">
                  {currentPerson.name}
                </h3>
                <p className="text-xs text-slate-500 font-sans">{currentPerson.knName}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  currentPerson.status === 'deceased'
                    ? 'bg-rose-100 text-rose-800'
                    : currentPerson.status === 'active_heir'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {currentPerson.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-semibold text-[11px]">Role in Title Lineage:</span>
                <p className="font-bold text-slate-800 mt-0.5">{currentPerson.role}</p>
              </div>

              {currentPerson.dateOfDeath && (
                <div>
                  <span className="text-slate-400 font-semibold text-[11px]">Date of Death:</span>
                  <p className="font-bold text-rose-700 mt-0.5">{currentPerson.dateOfDeath}</p>
                </div>
              )}

              {currentPerson.shareExtent && (
                <div>
                  <span className="text-slate-400 font-semibold text-[11px]">Share / Entitlement Extent:</span>
                  <p className="font-bold text-slate-800 mt-0.5">{currentPerson.shareExtent}</p>
                </div>
              )}

              <div>
                <span className="text-slate-400 font-semibold text-[11px]">Reconstruction Notes:</span>
                <p className="text-slate-600 mt-0.5 leading-relaxed bg-[#F7F5EB] p-2.5 rounded-lg border border-slate-200/80">
                  {currentPerson.notes}
                </p>
              </div>
            </div>

            {currentPerson.isBlockingCredit && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 space-y-1.5">
                <p className="font-extrabold flex items-center gap-1.5 text-rose-800">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Why This Matters to the Bank</span>
                </p>
                <p className="leading-snug text-[11px]">
                  Section 128 of Karnataka Land Revenue Act requires recording inheritance within 3 months. Banks cannot register a statutory mortgage charge against a deceased owner's RTC.
                </p>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3">
              <p className="text-[11px] font-bold text-slate-500 mb-2">Cross-Referenced Documents:</p>
              <div className="space-y-1.5">
                <button
                  onClick={() =>
                    openEvidence({
                      documentId: 'doc-30f4f927',
                      documentName: 'Death_Certificate_Ramachandrappa.pdf',
                      page: 1,
                    })
                  }
                  className="w-full flex items-center justify-between rounded-lg bg-[#F7F5EB] border border-slate-200 p-2 text-[11px] font-semibold text-[#123D32] hover:bg-[#239B65] hover:text-white transition cursor-pointer"
                >
                  <span className="truncate">Death_Certificate_Ramachandrappa.pdf</span>
                  <FileText className="h-3 w-3 shrink-0 ml-1" />
                </button>
                <button
                  onClick={() =>
                    openEvidence({
                      documentId: 'doc-a20f41ac',
                      documentName: 'Partition_Deed_2011_Registered.pdf',
                      page: 1,
                    })
                  }
                  className="w-full flex items-center justify-between rounded-lg bg-[#F7F5EB] border border-slate-200 p-2 text-[11px] font-semibold text-[#123D32] hover:bg-[#239B65] hover:text-white transition cursor-pointer"
                >
                  <span className="truncate">Partition_Deed_2011_Registered.pdf</span>
                  <FileText className="h-3 w-3 shrink-0 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
