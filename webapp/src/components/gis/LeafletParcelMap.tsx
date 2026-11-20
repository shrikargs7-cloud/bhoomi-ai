import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

export type BasemapKey = 'osm' | 'satellite' | 'carto';

const BASEMAPS: Record<BasemapKey, { label: string; url: string; attribution: string }> = {
  osm: {
    label: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri World Imagery',
  },
  carto: {
    label: 'Carto',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &amp; OpenStreetMap',
  },
};

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractOuterRings(feature: any): [number, number][][] {
  const geom = feature?.geometry;
  if (!geom || !geom.coordinates) return [];
  if (geom.type === 'Polygon') {
    const outer = geom.coordinates[0] || [];
    return [outer.map(([lon, lat]: [number, number]) => [lat, lon])];
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.map((poly: any) =>
      (poly?.[0] || []).map(([lon, lat]: [number, number]) => [lat, lon])
    );
  }
  return [];
}

interface LeafletParcelMapProps {
  geojson: any;
  synthetic: boolean;
  selectedSurvey: string | null;
  onSelectSurvey: (survey: string) => void;
  showPolygons: boolean;
  showVertices: boolean;
  showLabels: boolean;
  basemap: BasemapKey;
  onChangeBasemap: (basemap: BasemapKey) => void;
  onCursorMove?: (coords: { lat: number; lon: number }) => void;
}

/** Interactive Leaflet WGS84 map rendering ONLY supplied GeoJSON parcel features (SPEC §11). */
export const LeafletParcelMap: React.FC<LeafletParcelMapProps> = ({
  geojson,
  synthetic,
  selectedSurvey,
  onSelectSurvey,
  showPolygons,
  showVertices,
  showLabels,
  basemap,
  onChangeBasemap,
  onCursorMove,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const fittedKeyRef = useRef<string>('');
  const latestBoundsRef = useRef<L.LatLngBounds | null>(null);

  const onSelectRef = useRef(onSelectSurvey);
  onSelectRef.current = onSelectSurvey;
  const onCursorRef = useRef(onCursorMove);
  onCursorRef.current = onCursorMove;

  // Initialize Leaflet map instance with clean StrictMode teardown
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      center: [12.7193, 77.2818],
      zoom: 17,
    });
    const overlayGroup = L.layerGroup().addTo(map);

    map.on('mousemove', (ev: L.LeafletMouseEvent) => {
      onCursorRef.current?.({
        lat: +ev.latlng.lat.toFixed(6),
        lon: +ev.latlng.lng.toFixed(6),
      });
    });

    mapRef.current = map;
    overlayGroupRef.current = overlayGroup;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 60);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      overlayGroupRef.current = null;
    };
  }, []);

  // Switch tile basemap cleanly without recreating map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const cfg = BASEMAPS[basemap] || BASEMAPS.osm;
    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 20,
    }).addTo(map);
    tileLayerRef.current = layer;
  }, [basemap]);

  // Render supplied GeoJSON polygons, boundary vertices, and survey labels
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const features = geojson?.features || [];
    if (!features.length) {
      latestBoundsRef.current = null;
      return;
    }

    const bounds = L.latLngBounds([]);

    features.forEach((ft: any, idx: number) => {
      const rings = extractOuterRings(ft);
      if (!rings.length || !rings[0].length) return;

      const props = ft.properties || {};
      const sy = String(props.survey_number || `P-${idx + 1}`);
      const isSubj = Boolean(props.is_subject);
      const isSel = selectedSurvey === sy;

      rings.forEach((ringLatLngs) => {
        ringLatLngs.forEach((pt) => bounds.extend(pt));
      });

      if (showPolygons) {
        const poly = L.polygon(rings.length === 1 ? rings[0] : (rings as any), {
          color: isSel ? '#FACC15' : isSubj ? '#D6A84B' : '#34d399',
          weight: isSel ? 3 : 2,
          fillColor: isSubj ? '#D6A84B' : '#239B65',
          fillOpacity: isSel ? 0.4 : isSubj ? 0.24 : 0.16,
        });

        const popupHtml = `
          <div style="font-size:11px;line-height:1.45;min-width:170px">
            <div style="font-weight:700;color:#123D32;margin-bottom:3px">${escapeHtml(
              props.label || `Sy ${sy}`
            )}</div>
            <div><strong>Owner:</strong> ${escapeHtml(props.owner || 'N/A')}</div>
            <div><strong>Extent:</strong> ${escapeHtml(props.recorded_extent || 'N/A')}</div>
            ${
              synthetic
                ? '<div style="margin-top:4px;color:#92400e;font-weight:600">Synthetic Demo Geometry</div>'
                : ''
            }
          </div>
        `;
        poly.bindPopup(popupHtml);
        poly.on('click', () => onSelectRef.current(sy));
        poly.addTo(group);
      }

      if (showVertices) {
        const firstRing = rings[0];
        firstRing.forEach(([lat, lon]) => {
          L.circleMarker([lat, lon], {
            radius: 4,
            color: '#123D32',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 1.5,
          }).addTo(group);
        });
      }

      if (showLabels) {
        const firstRing = rings[0];
        const len = Math.max(1, firstRing.length);
        const cLat = firstRing.reduce((s, p) => s + p[0], 0) / len;
        const cLon = firstRing.reduce((s, p) => s + p[1], 0) / len;

        const labelMarker = L.marker([cLat, cLon], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:rgba(18,61,50,0.9);color:#ffffff;padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:700;border:1px solid rgba(255,255,255,0.35);white-space:nowrap;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.3)">Sy ${escapeHtml(
              sy
            )}</div>`,
            iconSize: [74, 22],
            iconAnchor: [37, 11],
          }),
        });
        labelMarker.on('click', () => onSelectRef.current(sy));
        labelMarker.addTo(group);
      }
    });

    if (bounds.isValid()) {
      latestBoundsRef.current = bounds;
      const geoKey = `${features.length}:${bounds.toBBoxString()}`;
      if (fittedKeyRef.current !== geoKey) {
        fittedKeyRef.current = geoKey;
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 18 });
      }
    }
  }, [geojson, synthetic, selectedSurvey, showPolygons, showVertices, showLabels]);

  const handleFitBounds = () => {
    if (mapRef.current && latestBoundsRef.current?.isValid()) {
      mapRef.current.fitBounds(latestBoundsRef.current, { padding: [36, 36], maxZoom: 18 });
    }
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Leaflet Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#123D32] px-3.5 py-2 text-xs text-white">
        <span className="font-semibold">
          Leaflet WGS84 Basemap {synthetic ? '(Synthetic Demo)' : '(User GeoJSON)'}
        </span>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-[#0f241e]/80 p-0.5 border border-white/15">
            {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onChangeBasemap(key)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                  basemap === key
                    ? 'bg-[#239B65] text-white'
                    : 'text-emerald-100/80 hover:text-white'
                }`}
              >
                {BASEMAPS[key].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 border-l border-white/15 pl-2">
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              className="p-1 hover:bg-white/10 rounded cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              className="p-1 hover:bg-white/10 rounded cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFitBounds}
              className="p-1 hover:bg-white/10 rounded cursor-pointer"
              title="Fit parcel bounds"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Explicit-Height Leaflet Viewport */}
      <div ref={containerRef} className="h-[460px] w-full bg-[#0f241e]" />
    </div>
  );
};
