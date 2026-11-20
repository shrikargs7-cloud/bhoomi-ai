import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  Layers,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  FileImage,
  Play,
  Sparkles,
} from 'lucide-react';
import { useBhoomi } from '../context/BhoomiContext';
import { GeoJsonResponse } from '../types/bhoomi';
import { BasemapKey, LeafletParcelMap } from '../components/gis/LeafletParcelMap';

type GisTab = 'sketch' | 'geojson';

export const GisPage: React.FC = () => {
  const { activeCase, t, apiFetch, showToast, refreshCase } = useBhoomi();

  const [activeTab, setActiveTab] = useState<GisTab>('sketch');
  const [gisData, setGisData] = useState<GeoJsonResponse | null>(null);
  const [sketchImgUrl, setSketchImgUrl] = useState<string | null>(null);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const [cursorLonLat, setCursorLonLat] = useState<{ lon: number; lat: number } | null>(null);
  const [basemap, setBasemap] = useState<BasemapKey>('osm');

  // Interactive layer toggles
  const [showPolygons, setShowPolygons] = useState(true);
  const [showVertices, setShowVertices] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const geoInputRef = useRef<HTMLInputElement>(null);

  const sketchDoc = activeCase?.documents.find((d) => d.doc_type === 'SURVEY_SKETCH');

  const fetchGis = async () => {
    if (!activeCase) return;
    const res = await apiFetch(`/cases/${encodeURIComponent(activeCase.case_id)}/gis`);
    if (res.ok) {
      const data: GeoJsonResponse = await res.json();
      setGisData(data);
      if (data.geojson?.features?.length) {
        const subj =
          data.geojson.features.find((ft: any) => ft.properties?.is_subject) ||
          data.geojson.features[0];
        setSelectedSurvey(subj?.properties?.survey_number || null);
      }
    }
  };

  useEffect(() => {
    fetchGis();
  }, [activeCase?.case_id, apiFetch]);

  // Fetch Tippani Survey Sketch PNG safely via apiFetch blob
  useEffect(() => {
    if (!sketchDoc) {
      setSketchImgUrl(null);
      return;
    }
    let revoked = false;
    let url: string | null = null;
    apiFetch(`/documents/${encodeURIComponent(sketchDoc.id)}/page/1`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!revoked && blob) {
          url = URL.createObjectURL(blob);
          setSketchImgUrl(url);
        }
      })
      .catch(() => {});
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sketchDoc?.id, apiFetch]);

  if (!activeCase) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Loading Survey &amp; GIS View...
      </div>
    );
  }

  const handleUploadGeoJson = async (file: File | null) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiFetch(`/cases/${encodeURIComponent(activeCase.case_id)}/gis/upload`, {
      method: 'POST',
      body: fd,
    });
    if (res.ok) {
      setGisData(await res.json());
      setActiveTab('geojson');
      await refreshCase();
      showToast(`Uploaded and validated GeoJSON: ${file.name}`, 'ok');
    } else {
      const err = await res.json();
      showToast(err.detail || 'Invalid GeoJSON upload', 'err');
    }
  };

  const handleLoadDemoGeoJson = async () => {
    const res = await apiFetch(`/cases/${encodeURIComponent(activeCase.case_id)}/gis/load-demo`, {
      method: 'POST',
    });
    if (res.ok) {
      const data: GeoJsonResponse = await res.json();
      setGisData(data);
      if (data.geojson?.features?.length) {
        const subj =
          data.geojson.features.find((ft: any) => ft.properties?.is_subject) ||
          data.geojson.features[0];
        setSelectedSurvey(subj?.properties?.survey_number || null);
      }
      setActiveTab('geojson');
      await refreshCase();
      showToast('Loaded synthetic demo GeoJSON boundary for inspection.', 'warn');
    }
  };

  const handleClearGeoJson = async () => {
    const res = await apiFetch(`/cases/${encodeURIComponent(activeCase.case_id)}/gis`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setGisData(await res.json());
      setSelectedSurvey(null);
      await refreshCase();
      showToast('Cleared supplied GeoJSON geometry.', 'ok');
    }
  };

  const features = gisData?.geojson?.features || [];
  const selectedFeature =
    features.find((ft: any) => ft.properties?.survey_number === selectedSurvey) || features[0];
  const boundaryField = sketchDoc?.extracted_fields.find((f) => f.field_name === 'boundaries');

  return (
    <div className="min-h-screen bg-[#F7F5EB] pb-12">
      {/* Header + Tabs */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-2xs">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-extrabold text-[#123D32] flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#239B65]" />
              {t('gis_title')}
            </h1>
            <p className="text-xs text-slate-500">
              SPEC §11: Never fabricates polygons from survey numbers. Shows uploaded Tippani sketch or supplied valid GeoJSON only.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-[#F7F5EB] p-1 border border-slate-200">
              <button
                onClick={() => setActiveTab('sketch')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  activeTab === 'sketch'
                    ? 'bg-[#123D32] text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <FileImage className="h-3.5 w-3.5" />
                <span>Survey Sketch Evidence</span>
              </button>
              <button
                onClick={() => setActiveTab('geojson')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  activeTab === 'geojson'
                    ? 'bg-[#123D32] text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Supplied GeoJSON Inspector</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: SURVEY SKETCH EVIDENCE */}
      {activeTab === 'sketch' && (
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
          {!sketchDoc ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
              <FileImage className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="text-base font-bold text-[#123D32]">
                No Tippani Survey Sketch Uploaded in {activeCase.case_id}
              </h2>
              <p className="mx-auto max-w-lg text-xs text-slate-500">
                Per SPEC Section 11, BhoomiAI never invents parcel geometry when no sketch or GeoJSON is provided. Upload a Tippani PDF or switch to Supplied GeoJSON Inspector to upload coordinates.
              </p>
              <button
                onClick={() => setActiveTab('geojson')}
                className="rounded-lg bg-[#123D32] px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Open GeoJSON Inspector
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 rounded-2xl border border-[#164E49]/15 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#123D32]">
                      Uploaded Evidence Document: {sketchDoc.filename}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Rendered directly from verified PDF upload (Page 1)
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    Evidence Image
                  </span>
                </div>

                {sketchImgUrl ? (
                  <img
                    src={sketchImgUrl}
                    alt={sketchDoc.filename}
                    className="mx-auto w-full max-w-[560px] rounded-xl border border-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Rendering Tippani preview...
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs space-y-3 text-xs">
                  <h3 className="text-sm font-bold text-[#123D32]">
                    Extracted Field &amp; Adjoining Boundaries
                  </h3>
                  {sketchDoc.extracted_fields.map((f) => (
                    <div
                      key={f.field_name}
                      className="rounded-xl border border-slate-200 bg-[#fdfcf8] p-3"
                    >
                      <p className="text-[10px] font-bold uppercase text-slate-400">{f.label}</p>
                      <p className="font-semibold text-[#123D32] mt-1">
                        {typeof f.normalized_value === 'object'
                          ? Object.entries(f.normalized_value)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' • ')
                          : String(f.normalized_value)}
                      </p>
                    </div>
                  ))}
                  {boundaryField && typeof boundaryField.normalized_value === 'object' && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {Object.entries(boundaryField.normalized_value).map(([dir, val]) => (
                        <div key={dir} className="rounded-lg bg-[#F7F5EB] p-2.5 border border-slate-200">
                          <span className="text-[10px] font-bold uppercase text-[#164E49]">{dir}</span>
                          <p className="text-xs font-semibold text-slate-800 mt-0.5">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUPPLIED GEOJSON INSPECTOR & QA */}
      {activeTab === 'geojson' && (
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6 space-y-4">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#164E49]/15 bg-white p-4 shadow-xs text-xs">
            <input
              ref={geoInputRef}
              type="file"
              accept=".geojson,.json"
              className="hidden"
              onChange={(e) => handleUploadGeoJson(e.target.files?.[0] || null)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => geoInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg bg-[#123D32] px-3.5 py-2 font-bold text-white hover:bg-[#164E49] cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5 text-[#D6A84B]" />
                <span>Upload Valid .GeoJSON</span>
              </button>
              <button
                onClick={handleLoadDemoGeoJson}
                className="flex items-center gap-1.5 rounded-lg border border-[#D6A84B] bg-[#D6A84B]/15 px-3.5 py-2 font-bold text-[#7c5308] hover:bg-[#D6A84B]/25 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Load Synthetic Demo GeoJSON</span>
              </button>
              {gisData?.has_geometry && (
                <button
                  onClick={handleClearGeoJson}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Geometry</span>
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-500">
              {gisData?.has_geometry ? (
                <span className="font-semibold text-[#164E49]">{gisData.source_description}</span>
              ) : (
                <span>No GeoJSON geometry attached</span>
              )}
            </div>
          </div>

          {!gisData?.has_geometry ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
              <MapPin className="mx-auto h-10 w-10 text-[#164E49]" />
              <h2 className="text-base font-bold text-[#123D32]">No Supplied GeoJSON Geometry</h2>
              <p className="mx-auto max-w-xl text-xs text-slate-500 leading-relaxed">
                {gisData?.message ||
                  'Upload a real parcel .geojson file to inspect boundary topology, compute geodesic acres, and compare against RTC extent — or load the explicitly labelled synthetic demo GeoJSON.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Layer Tree & Basemap Selector (3 cols) */}
              <aside className="lg:col-span-3 rounded-2xl border border-[#164E49]/15 bg-white p-4 shadow-xs space-y-4 text-xs">
                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-2">
                    Basemap Tiles
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { id: 'osm', label: 'Street (OSM)' },
                      { id: 'satellite', label: 'Satellite (Esri)' },
                      { id: 'carto', label: 'Carto Voyager' },
                    ].map((bm) => (
                      <label
                        key={bm.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-100 bg-[#fdfcf8] px-3 py-1.5 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="basemap-select"
                          checked={basemap === bm.id}
                          onChange={() => setBasemap(bm.id as BasemapKey)}
                          className="accent-[#239B65]"
                        />
                        <span className="font-semibold text-slate-700">{bm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-2">
                    Drawing Order &amp; Layers
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: 'Parcel Polygons', checked: showPolygons, set: setShowPolygons },
                      { label: 'Boundary Vertices', checked: showVertices, set: setShowVertices },
                      { label: 'Survey No. Labels', checked: showLabels, set: setShowLabels },
                    ].map((lyr) => (
                      <label
                        key={lyr.label}
                        className="flex items-center gap-2 rounded-lg border border-slate-100 bg-[#fdfcf8] px-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={lyr.checked}
                          onChange={(e) => lyr.set(e.target.checked)}
                          className="accent-[#239B65]"
                        />
                        <span className="font-semibold text-slate-700">{lyr.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Parcel Attribute Pop-up Inspector */}
                {selectedFeature && (
                  <div className="rounded-xl border border-[#239B65]/40 bg-[#F7F5EB] p-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#164E49]">
                      Selected Feature Pop-up
                    </p>
                    <p className="font-bold text-sm text-[#123D32]">
                      {selectedFeature.properties?.label ||
                        `Survey ${selectedFeature.properties?.survey_number}`}
                    </p>
                    <p>
                      Owner: <strong>{selectedFeature.properties?.owner || 'N/A'}</strong>
                    </p>
                    <p>
                      Recorded Extent:{' '}
                      <strong>{selectedFeature.properties?.recorded_extent || 'N/A'}</strong>
                    </p>
                    {gisData.computed_area_acres && selectedFeature.properties?.is_subject && (
                      <p>
                        GeoJSON Area: <strong>{gisData.computed_area_acres} ac</strong>
                      </p>
                    )}
                  </div>
                )}
              </aside>

              {/* Center Interactive Leaflet Map Canvas (5 cols) */}
              <div className="lg:col-span-5 rounded-2xl border border-[#164E49]/15 bg-slate-900 overflow-hidden shadow-xs flex flex-col">
                <LeafletParcelMap
                  geojson={gisData.geojson}
                  synthetic={gisData.synthetic}
                  selectedSurvey={selectedSurvey}
                  onSelectSurvey={setSelectedSurvey}
                  showPolygons={showPolygons}
                  showVertices={showVertices}
                  showLabels={showLabels}
                  basemap={basemap}
                  onChangeBasemap={setBasemap}
                  onCursorMove={setCursorLonLat}
                />

                <div className="flex items-center justify-between bg-[#164E49] px-4 py-1.5 font-mono text-[10px] text-emerald-100">
                  <span>
                    {cursorLonLat
                      ? `${cursorLonLat.lat}°N, ${cursorLonLat.lon}°E`
                      : 'Hover parcel for coords'}
                  </span>
                  <span>Features: {features.length}</span>
                </div>
              </div>

              {/* Right Geometry QA Runner Panel (4 cols) */}
              <div className="lg:col-span-4 rounded-2xl border border-[#164E49]/15 bg-white p-4 shadow-xs flex flex-col justify-between space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                    <h3 className="text-sm font-bold text-[#123D32]">
                      Mathematical Geometry QA ({gisData.qa_checks.length})
                    </h3>
                    <button
                      onClick={fetchGis}
                      className="flex items-center gap-1 rounded-lg bg-[#239B65] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#1b8153] cursor-pointer"
                    >
                      <Play className="h-3 w-3" />
                      <span>Re-run QA</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {gisData.qa_checks.map((chk) => (
                      <div
                        key={chk.check_id}
                        className={`rounded-xl border p-2.5 ${
                          chk.passed
                            ? 'border-emerald-200 bg-emerald-50/40'
                            : 'border-amber-300 bg-amber-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#123D32]">
                            {chk.check_id}: {chk.name}
                          </span>
                          {chk.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-[#239B65]" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600">{chk.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-[#F7F5EB] p-3 border border-slate-200 text-[11px]">
                  <p>
                    <strong>GeoJSON Area:</strong> {gisData.computed_area_acres ?? 'N/A'} ac
                  </p>
                  <p>
                    <strong>RTC Stated Extent:</strong> {gisData.rtc_extent_acres ?? 'N/A'} ac
                  </p>
                  {gisData.area_variance_acres !== null &&
                    gisData.area_variance_acres !== undefined && (
                      <p>
                        <strong>Variance:</strong> {gisData.area_variance_acres} ac
                      </p>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
