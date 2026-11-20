import React, { useEffect, useState } from 'react';
import {
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Ruler,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { useBhoomi } from '../context/BhoomiContext';
import { ValuationResponse } from '../types/bhoomi';

export const ValuationPage: React.FC = () => {
  const { activeCase, t, apiFetch, showToast, refreshCase } = useBhoomi();

  const [valData, setValData] = useState<ValuationResponse | null>(null);

  // Add comparable form
  const [label, setLabel] = useState('');
  const [location, setLocation] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [extentStr, setExtentStr] = useState('1-20');
  const [salePrice, setSalePrice] = useState('4500000');
  const [sourceRef, setSourceRef] = useState('');
  const [verified, setVerified] = useState(true);

  // Extent converter state
  const [extInput, setExtInput] = useState('2-15');
  const [extResult, setExtResult] = useState<any>(null);

  const fetchValuation = async () => {
    if (!activeCase) return;
    const res = await apiFetch(`/cases/${encodeURIComponent(activeCase.case_id)}/valuation`);
    if (res.ok) {
      setValData(await res.json());
    }
  };

  const runUnitConvert = async (val: string) => {
    setExtInput(val);
    const res = await apiFetch('/tools/convert-extent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extent_str: val }),
    });
    if (res.ok) {
      setExtResult(await res.json());
    }
  };

  useEffect(() => {
    fetchValuation();
    runUnitConvert('2-15');
  }, [activeCase?.case_id, apiFetch]);

  if (!activeCase) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Loading Valuation &amp; Extent Tools...
      </div>
    );
  }

  const handleAddComparable = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch(`/cases/${encodeURIComponent(activeCase.case_id)}/comparables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label,
        location,
        sale_date: saleDate,
        extent_str: extentStr,
        sale_price_inr: parseFloat(salePrice) || 0,
        source_ref: sourceRef || 'User-supplied SRO index',
        verified,
      }),
    });
    if (res.ok) {
      setValData(await res.json());
      setLabel('');
      setLocation('');
      setSaleDate('');
      setSourceRef('');
      await refreshCase();
      showToast('Comparable transaction added.', 'ok');
    } else {
      const err = await res.json();
      showToast(err.detail || 'Invalid comparable data', 'err');
    }
  };

  const handleToggleVerify = async (compId: string) => {
    const res = await apiFetch(`/comparables/${encodeURIComponent(compId)}/verify`, {
      method: 'PATCH',
    });
    if (res.ok) {
      setValData(await res.json());
      await refreshCase();
    }
  };

  const handleDeleteComparable = async (compId: string) => {
    const res = await apiFetch(`/comparables/${encodeURIComponent(compId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setValData(await res.json());
      await refreshCase();
      showToast('Comparable removed.', 'ok');
    }
  };

  const handleLoadDemoComparables = async () => {
    const res = await apiFetch(`/cases/${encodeURIComponent(activeCase.case_id)}/comparables/load-demo`, {
      method: 'POST',
    });
    if (res.ok) {
      setValData(await res.json());
      await refreshCase();
      showToast('Loaded 3 synthetic demo comparables (not real market data).', 'warn');
    }
  };

  const verifiedComparables = (valData?.comparables || []).filter((c) => c.verified);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-[#123D32] flex items-center gap-2">
            <Calculator className="h-5 w-5 text-[#239B65]" />
            {t('valuation_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            SPEC §10: Comparable-based baseline only (min 3 verified comparables). Abstains rather than fabricating values.
          </p>
        </div>

        <button
          onClick={handleLoadDemoComparables}
          className="flex items-center gap-1.5 rounded-xl border border-[#D6A84B] bg-[#D6A84B]/15 px-3.5 py-2 text-xs font-bold text-[#7c5308] hover:bg-[#D6A84B]/25 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Load Synthetic Demo Comparables (3)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Valuation Baseline / Abstention + Chart + Comparables List (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Valuation Status Card */}
          <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
            {valData?.abstained !== false ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <span>Valuation Abstention (SPEC Section 10)</span>
                </div>
                <p className="text-sm font-bold text-[#123D32]">
                  {valData?.message || 'Insufficient verified comparable evidence to produce a reliable valuation.'}
                </p>
                <p className="text-xs text-amber-900/80">
                  Verified comparables: <strong>{valData?.verified_count || 0}</strong> / 3 required.
                  Add verified Sub-Registrar comparable transactions below or load synthetic demo comparables to inspect the arithmetic range computation.
                </p>
                {valData?.subject_extent_acres && (
                  <p className="text-xs text-slate-600 pt-1">
                    Subject parcel extent from documentary evidence: <strong>{valData.subject_extent_acres} acres</strong> ({valData.subject_extent_source})
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50/80 border border-amber-200 px-3.5 py-2 text-[11px] text-amber-900">
                  <span className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    {valData.message}
                  </span>
                  <span>{valData.limitations}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-[#F7F5EB] p-3 border border-slate-200">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Min ₹ / Acre</p>
                    <p className="text-lg font-extrabold text-[#123D32] mt-1">
                      ₹{Math.round(valData.min_price_per_acre_inr || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F7F5EB] p-3 border border-slate-200">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Median ₹ / Acre</p>
                    <p className="text-lg font-extrabold text-[#239B65] mt-1">
                      ₹{Math.round(valData.median_price_per_acre_inr || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F7F5EB] p-3 border border-slate-200">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Max ₹ / Acre</p>
                    <p className="text-lg font-extrabold text-[#123D32] mt-1">
                      ₹{Math.round(valData.max_price_per_acre_inr || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#123D32] p-3 text-white">
                    <p className="text-[10px] font-bold uppercase text-[#D6A84B]">
                      Baseline ({valData.subject_extent_acres || '?'} ac)
                    </p>
                    <p className="text-sm font-extrabold mt-1">
                      {valData.estimated_range_inr
                        ? `₹${(valData.estimated_range_inr[0] / 100000).toFixed(1)}L – ₹${(valData.estimated_range_inr[1] / 100000).toFixed(1)}L`
                        : 'Extent needed'}
                    </p>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="h-[220px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={verifiedComparables} margin={{ top: 10, right: 16, left: 12, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#475569' }}
                        tickFormatter={(v) => `₹${Math.round(v / 100000)}L`}
                      />
                      <Tooltip
                        formatter={(value: any) => [`₹${Number(value).toLocaleString()} / acre`, 'Rate']}
                      />
                      <Bar dataKey="price_per_acre_inr" radius={[6, 6, 0, 0]} barSize={44}>
                        {verifiedComparables.map((_, i) => (
                          <Cell key={i} fill={i % 2 === 0 ? '#164E49' : '#239B65'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Comparable Transactions Table */}
          <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#123D32]">
              Supplied Comparable Transactions ({valData?.comparables.length || 0})
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F5EB] text-[10px] font-bold uppercase text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Comparable</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Extent</th>
                    <th className="py-2.5 px-3">Price (₹)</th>
                    <th className="py-2.5 px-3">₹ / Acre</th>
                    <th className="py-2.5 px-3">Verified</th>
                    <th className="py-2.5 px-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(valData?.comparables || []).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-[#123D32]">
                        {c.label}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {c.location} • {c.source_ref}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{c.sale_date}</td>
                      <td className="py-2.5 px-3">{c.extent_acres} ac ({c.extent_str})</td>
                      <td className="py-2.5 px-3 font-semibold">₹{c.sale_price_inr.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-bold text-[#164E49]">
                        ₹{Math.round(c.price_per_acre_inr).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleToggleVerify(c.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                            c.verified
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {c.verified ? 'Verified' : 'Unverified'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteComparable(c.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!valData?.comparables || valData.comparables.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No comparable transactions added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Add Comparable Form + Karnataka Unit Converter (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Add Comparable Form */}
          <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#123D32] flex items-center gap-1.5 mb-3">
              <Plus className="h-4 w-4 text-[#239B65]" />
              Add Verified Comparable Sale
            </h3>
            <form onSubmit={handleAddComparable} className="space-y-2.5 text-xs">
              <input
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (e.g. Sy 81/2 Sale Deed)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#239B65] focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Village / Hobli"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 focus:border-[#239B65] focus:outline-none"
                />
                <input
                  required
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  placeholder="Date (DD/MM/YYYY)"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 focus:border-[#239B65] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  value={extentStr}
                  onChange={(e) => setExtentStr(e.target.value)}
                  placeholder="Extent (e.g. 1-20)"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 focus:border-[#239B65] focus:outline-none"
                />
                <input
                  required
                  type="number"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="Sale Price INR"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 focus:border-[#239B65] focus:outline-none"
                />
              </div>
              <input
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                placeholder="Source Ref (e.g. Kaveri Reg #442)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-[#239B65] focus:outline-none"
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                  className="accent-[#239B65]"
                />
                <span>Verified against SRO / Encumbrance record</span>
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-[#123D32] py-2 font-bold text-white hover:bg-[#164E49] cursor-pointer"
              >
                Add Comparable
              </button>
            </form>
          </div>

          {/* Live Karnataka Extent Unit Converter */}
          <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs space-y-3 text-xs">
            <h3 className="text-sm font-bold text-[#123D32] flex items-center gap-1.5">
              <Ruler className="h-4 w-4 text-[#239B65]" />
              Karnataka Extent Unit Normalizer
            </h3>
            <p className="text-[11px] text-slate-500">
              Try <code className="bg-slate-100 px-1 rounded">2-15</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">೧-೩೫</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">0-37.5</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">1.5 ha</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">43560 sqft</code>
            </p>
            <input
              value={extInput}
              onChange={(e) => runUnitConvert(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-[#F7F5EB] px-3 py-2 font-mono text-xs font-bold text-[#123D32] focus:border-[#239B65] focus:outline-none"
            />
            {extResult && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-lg bg-[#fdfcf8] border border-slate-200 p-2">
                  <span className="text-[10px] text-slate-400">Decimal Acres</span>
                  <p className="font-bold text-[#123D32]">{extResult.acres} ac</p>
                </div>
                <div className="rounded-lg bg-[#fdfcf8] border border-slate-200 p-2">
                  <span className="text-[10px] text-slate-400">Total Guntas</span>
                  <p className="font-bold text-[#123D32]">{extResult.guntas} gu</p>
                </div>
                <div className="rounded-lg bg-[#fdfcf8] border border-slate-200 p-2">
                  <span className="text-[10px] text-slate-400">Hectares</span>
                  <p className="font-bold text-[#123D32]">{extResult.hectares} ha</p>
                </div>
                <div className="rounded-lg bg-[#fdfcf8] border border-slate-200 p-2">
                  <span className="text-[10px] text-slate-400">Sq Ft</span>
                  <p className="font-bold text-[#123D32]">{Number(extResult.sqft).toLocaleString()}</p>
                </div>
                <div className="col-span-2 rounded-lg bg-[#123D32] px-3 py-2 text-white">
                  <span className="text-[10px] text-emerald-200">Canonical Ac-Gu-An:</span>
                  <p className="font-bold">{extResult.canonical_karnataka}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
