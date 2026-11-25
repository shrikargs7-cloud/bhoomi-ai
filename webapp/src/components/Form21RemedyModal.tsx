import React from 'react';
import { X, FileText, Download, CheckCircle, ShieldCheck, MapPin, Printer } from 'lucide-react';
import { useBhoomi } from '../context/BhoomiContext';

interface Form21RemedyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Form21RemedyModal: React.FC<Form21RemedyModalProps> = ({ isOpen, onClose }) => {
  const { activeCase, lang } = useBhoomi();

  if (!isOpen || !activeCase) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Top Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#164E49] border border-emerald-200">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#123D32]">
                {lang === 'kn' ? 'ಫಾರ್ಮ್ ೨೧ ಖಾತೆ ಬದಲಾವಣೆ ಅರ್ಜಿ (Form 21)' : 'Form 21 Mutation Petition Draft'}
              </h2>
              <p className="text-xs text-slate-500">
                Karnataka Land Revenue Act, 1964 — Section 128 (Inheritance &amp; Pauti Khata)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Petition Preview Body */}
        <div className="p-6 space-y-6 text-sm text-slate-800">
          {/* Plain Language Status Card */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-[#123D32]">
                {lang === 'kn' ? 'ರೈತರಿಗೆ ನೇರ ಪರಿಹಾರ ಕ್ರಮ' : 'Action Required for Bank Loan Approval'}
              </p>
              <p className="mt-1 leading-relaxed">
                {lang === 'kn'
                  ? 'ಪಹಣಿಯಲ್ಲಿ ಇನ್ನೂ ದಿವಂಗತ ರಾಮಚಂದ್ರಪ್ಪ ಅವರ ಹೆಸರು ದಾಖಲಾಗಿದೆ. ಈ ಕೆಳಗಿನ ಫಾರ್ಮ್ ೨೧ ಅರ್ಜಿಯನ್ನು ನಾಡಕಚೇರಿ ಅಥವಾ ಗ್ರಾಮ ಆಡಳಿತಾಧಿಕಾರಿಗಳಿಗೆ ಸಲ್ಲಿಸಿ ಖಾತೆ ಬದಲಾವಣೆ ಮಾಡಿಕೊಳ್ಳಿ.'
                  : 'The RTC still lists deceased owner Ramachandrappa. Submit this pre-filled Form 21 petition at your local Nadakacheri kiosk or Village Accountant office to complete the legal succession.'}
              </p>
            </div>
          </div>

          {/* Legal Draft Container */}
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-[#fdfcf8] p-5 font-mono text-xs space-y-4">
            <div className="text-center border-b border-slate-200 pb-3">
              <p className="font-bold text-sm text-slate-900 uppercase">
                FORM NO. 21 / ನಮೂನೆ ೨೧
              </p>
              <p className="text-[11px] text-slate-500">
                [See Rule 64 of Karnataka Land Revenue Rules, 1966]
              </p>
              <p className="text-[11px] font-bold text-[#164E49] mt-1">
                Notice of Acquisition of Rights by Inheritance / ಉತ್ತರಾಧಿಕಾರದ ಮೂಲಕ ಹಕ್ಕು ವರ್ಗಾವಣೆ ಸೂಚನೆ
              </p>
            </div>

            <div className="space-y-1 text-slate-700">
              <p><strong>To:</strong> The Tahasildar / Revenue Inspector, {activeCase.taluk || 'Ramanagara'} Taluk</p>
              <p><strong>District:</strong> {activeCase.district || 'Ramanagara'}</p>
            </div>

            <div className="rounded-lg bg-white p-3 border border-slate-200 space-y-1.5">
              <p><strong>1. Parcel Details:</strong> Survey No. {activeCase.survey_number || '84/1'}, Village: {activeCase.village || 'Ramanagara Rural'}, Hobli: {activeCase.hobli || 'Bidadi'}</p>
              <p><strong>2. Recorded Extent:</strong> 1 Acre 35 Guntas (1.875 acres)</p>
              <p><strong>3. Name of Deceased Khatedar:</strong> Ramachandrappa (Demised: 14/03/2016)</p>
              <p><strong>4. Applicant &amp; Legal Heir:</strong> Sri Venkatesh R (Son / Coparcener)</p>
              <p><strong>5. Mode of Acquisition:</strong> Succession / Inheritance u/s 128 KLR Act</p>
            </div>

            <div>
              <p className="font-bold text-slate-900 mb-1.5">MANDATORY ATTACHMENTS CHECKLIST / ಲಗತ್ತಿಸಬೇಕಾದ ದಾಖಲೆಗಳು:</p>
              <div className="space-y-1 text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Original Death Certificate of Khatedar (Certified copy)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Surviving Family Tree Extract (Vamsha Vruksha from Nadakacheri)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Latest Certified RTC / Pahani Extract (Form 16)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span>No-Objection Affidavit from surviving co-heirs (₹20 e-stamp)</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-end border-t border-slate-200 text-[11px]">
              <div>
                <p>Date: 25/11/2026</p>
                <p>Place: {activeCase.taluk || 'Ramanagara'}</p>
              </div>
              <div className="text-right">
                <p className="border-b border-slate-400 w-36 mb-1"></p>
                <p className="font-bold">Signature of Applicant</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <MapPin className="h-4 w-4 text-[#239B65]" />
            <span>Filing location: Taluk Office or Nadakacheri Center</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-[#239B65] px-4 py-2 text-xs font-bold text-white hover:bg-[#1b8153] cursor-pointer shadow-xs"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Download Petition</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
