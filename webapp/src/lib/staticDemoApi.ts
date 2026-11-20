import type {
  CaseSummaryItem,
  ComparableItem,
  GeoJsonResponse,
  LandCase,
  LegalQueryResponse,
  LegalSourceItem,
  OwnershipGraphResponse,
  ValuationResponse,
} from '../types/bhoomi';

const BASE = import.meta.env.BASE_URL || '/';

const KANNADA_DIGITS: Record<string, string> = {
  '೦': '0',
  '೧': '1',
  '೨': '2',
  '೩': '3',
  '೪': '4',
  '೫': '5',
  '೬': '6',
  '೭': '7',
  '೮': '8',
  '೯': '9',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeKannadaNumerals(raw: string): string {
  return raw.replace(/[೦-೯]/g, (ch) => KANNADA_DIGITS[ch] ?? ch);
}

function parseExtentToAcres(raw: string): number {
  const s = normalizeKannadaNumerals(raw).trim().toLowerCase();
  if (!s) return 0;
  // Format like "2-14" or "2-14-0" (Acres-Guntas[-Annas])
  const dashMatch = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/);
  if (dashMatch) {
    const ac = parseFloat(dashMatch[1]);
    const gt = parseFloat(dashMatch[2]);
    const an = dashMatch[3] ? parseFloat(dashMatch[3]) : 0;
    return ac + gt / 40 + an / 640;
  }
  const acGt = s.match(/(\d+(?:\.\d+)?)\s*(?:ac|acre|acres)\D+(\d+(?:\.\d+)?)\s*(?:gt|gunta|guntas)/);
  if (acGt) return parseFloat(acGt[1]) + parseFloat(acGt[2]) / 40;
  const ha = s.match(/(\d+(?:\.\d+)?)\s*(?:ha|hectare|hectares)/);
  if (ha) return parseFloat(ha[1]) * 2.47105;
  const gtOnly = s.match(/(\d+(?:\.\d+)?)\s*(?:gt|gunta|guntas)/);
  if (gtOnly) return parseFloat(gtOnly[1]) / 40;
  const cents = s.match(/(\d+(?:\.\d+)?)\s*(?:cent|cents)/);
  if (cents) return parseFloat(cents[1]) / 100;
  const num = s.match(/(\d+(?:\.\d+)?)/);
  return num ? parseFloat(num[1]) : 0;
}

function formatExtent(acres: number): string {
  const totalGuntas = Math.round(acres * 40 * 100) / 100;
  const ac = Math.floor(totalGuntas / 40);
  const gt = Math.round((totalGuntas - ac * 40) * 100) / 100;
  const gtStr = Number.isInteger(gt) ? String(gt) : gt.toFixed(1);
  return `${ac}-${gtStr} (${ac} acres ${gtStr} guntas)`;
}

function recomputeValuation(base: ValuationResponse): ValuationResponse {
  const comps = base.comparables || [];
  const verified = comps.filter((c) => c.verified);
  const subjectAcres = base.subject_extent_acres || 0;
  if (verified.length < 3 || subjectAcres <= 0) {
    return {
      ...base,
      abstained: true,
      verified_count: verified.length,
      total_count: comps.length,
      min_price_per_acre_inr: null,
      median_price_per_acre_inr: null,
      max_price_per_acre_inr: null,
      estimated_range_inr: null,
      message: `Abstaining: Only ${verified.length} verified comparable sale(s) supplied. Minimum 3 verified comparable transactions required to prevent speculative valuation.`,
    };
  }
  const rates = verified.map((c) => c.price_per_acre_inr).sort((a, b) => a - b);
  const minR = rates[0];
  const maxR = rates[rates.length - 1];
  const mid = Math.floor(rates.length / 2);
  const medR = rates.length % 2 === 1 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;
  return {
    ...base,
    abstained: false,
    verified_count: verified.length,
    total_count: comps.length,
    min_price_per_acre_inr: Math.round(minR),
    median_price_per_acre_inr: Math.round(medR),
    max_price_per_acre_inr: Math.round(maxR),
    estimated_range_inr: [Math.round(minR * subjectAcres), Math.round(maxR * subjectAcres)],
    message: `Comparable baseline computed from ${verified.length} verified transactions across ${subjectAcres.toFixed(2)} acres.`,
  };
}

interface SnapshotStore {
  casesList: CaseSummaryItem[];
  casesById: Record<string, LandCase>;
  valuationById: Record<string, ValuationResponse>;
  valuationDemoById: Record<string, ValuationResponse>;
  ownershipById: Record<string, OwnershipGraphResponse>;
  gisById: Record<string, GeoJsonResponse>;
  gisDemoById: Record<string, GeoJsonResponse>;
  evaluation: unknown;
  reviewerQueue: unknown;
  legalSources: LegalSourceItem[];
}

let storePromise: Promise<SnapshotStore> | null = null;
let storeInstance: SnapshotStore | null = null;

async function fetchSnap<T>(relPath: string): Promise<T> {
  const res = await fetch(`${BASE}demo-snapshot/${relPath}`);
  if (!res.ok) throw new Error(`Missing demo snapshot asset: ${relPath}`);
  return res.json() as Promise<T>;
}

async function initStore(forceReload = false): Promise<SnapshotStore> {
  if (storeInstance && !forceReload) return storeInstance;
  if (!storePromise || forceReload) {
    storePromise = (async () => {
      const [casesList, evaluation, reviewerQueue, legalSources] = await Promise.all([
        fetchSnap<CaseSummaryItem[]>('cases.json'),
        fetchSnap<unknown>('evaluation.json'),
        fetchSnap<unknown>('reviewer_queue.json'),
        fetchSnap<LegalSourceItem[]>('legal_sources.json'),
      ]);

      const casesById: Record<string, LandCase> = {};
      const valuationById: Record<string, ValuationResponse> = {};
      const valuationDemoById: Record<string, ValuationResponse> = {};
      const ownershipById: Record<string, OwnershipGraphResponse> = {};
      const gisById: Record<string, GeoJsonResponse> = {};
      const gisDemoById: Record<string, GeoJsonResponse> = {};

      await Promise.all(
        casesList.map(async (c) => {
          const cid = c.case_id;
          const [cData, val, valDemo, own, gis, gisDemo] = await Promise.all([
            fetchSnap<LandCase>(`case_${cid}.json`),
            fetchSnap<ValuationResponse>(`valuation_${cid}.json`),
            fetchSnap<ValuationResponse>(`valuation_demo_${cid}.json`),
            fetchSnap<OwnershipGraphResponse>(`ownership_${cid}.json`),
            fetchSnap<GeoJsonResponse>(`gis_${cid}.json`),
            fetchSnap<GeoJsonResponse>(`gis_demo_${cid}.json`),
          ]);
          casesById[cid] = cData;
          valuationById[cid] = val;
          valuationDemoById[cid] = valDemo;
          ownershipById[cid] = own;
          gisById[cid] = gis;
          gisDemoById[cid] = gisDemo;
        })
      );

      storeInstance = {
        casesList,
        casesById,
        valuationById,
        valuationDemoById,
        ownershipById,
        gisById,
        gisDemoById,
        evaluation,
        reviewerQueue,
        legalSources,
      };
      return storeInstance;
    })();
  }
  return storePromise;
}

function queryLegalStatic(sources: LegalSourceItem[], query: string): LegalQueryResponse {
  const q = query.trim().toLowerCase();
  const stop = new Set(['what', 'when', 'does', 'the', 'for', 'and', 'with', 'how', 'under', 'karnataka', 'land']);
  const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !stop.has(t));
  const scored = sources
    .map((s) => {
      const hay = `${s.title} ${s.section} ${s.summary}`.toLowerCase();
      const score = tokens.reduce((acc, tok) => acc + (hay.includes(tok) ? 1 : 0), 0);
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      abstained: true,
      explanation:
        'Abstaining from legal interpretation: no curated statutory source in the local repository matched your specific query with high confidence.',
      jurisdiction: 'Karnataka (India)',
      source: null,
      section_or_page: null,
      retrieval_date: '2026-11-19',
      limitations: 'Curated statutory reference lookup only — not legal advice.',
      referral: 'Consult a licensed Karnataka land title advocate before property transfer or loan execution.',
      matched_sources: [],
    };
  }
  const top = scored.slice(0, 3).map((x) => x.s);
  return {
    abstained: false,
    explanation: top.map((item) => `[${item.title} — ${item.section}] ${item.summary}`).join(' '),
    jurisdiction: top[0].jurisdiction,
    source: top[0].title,
    section_or_page: top[0].section,
    retrieval_date: top[0].retrieval_date,
    limitations: 'Static curated statutory reference summary — does not replace advocates or revenue officials.',
    referral: 'Verify original Karnataka Gazette / Tahasildar orders with panel counsel.',
    matched_sources: top,
  };
}

export async function staticDemoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cleanPath = path.split('?')[0];
  const method = (init.method || 'GET').toUpperCase();

  // Direct static PNG preview proxy
  const pageMatch = cleanPath.match(/^\/documents\/([^/]+)\/page\/(\d+)$/);
  if (pageMatch && method === 'GET') {
    const [, docId, page] = pageMatch;
    return fetch(`${BASE}demo-snapshot/pages/${encodeURIComponent(docId)}_p${page}.png`);
  }

  const store = await initStore();
  const bodyObj =
    typeof init.body === 'string'
      ? (() => {
          try {
            return JSON.parse(init.body);
          } catch {
            return {};
          }
        })()
      : {};

  if (cleanPath === '/cases' && method === 'GET') {
    return jsonResponse(store.casesList);
  }
  if (cleanPath === '/cases/reset-demo' && method === 'POST') {
    const fresh = await initStore(true);
    return jsonResponse({ status: 'reset', cases: fresh.casesList });
  }
  if (cleanPath === '/evaluation/run' && method === 'GET') {
    return jsonResponse(store.evaluation);
  }
  if (cleanPath === '/reviewer/queue' && method === 'GET') {
    return jsonResponse(store.reviewerQueue);
  }
  if (cleanPath === '/legal/sources' && method === 'GET') {
    return jsonResponse(store.legalSources);
  }
  if (cleanPath === '/legal/query' && method === 'POST') {
    return jsonResponse(queryLegalStatic(store.legalSources, bodyObj.query || ''));
  }
  if (cleanPath === '/tools/convert-extent' && method === 'POST') {
    const extentStr = String(bodyObj.extent_str || '');
    const normalized = normalizeKannadaNumerals(extentStr);
    const acres = parseExtentToAcres(extentStr);
    return jsonResponse({
      input: extentStr,
      normalized_numerals: normalized,
      acres: Number(acres.toFixed(4)),
      guntas: Number((acres * 40).toFixed(2)),
      annas: Number((acres * 640).toFixed(1)),
      hectares: Number((acres / 2.47105).toFixed(4)),
      cents: Number((acres * 100).toFixed(2)),
      sqft: Number((acres * 43560).toFixed(1)),
      canonical_karnataka: acres > 0 ? formatExtent(acres) : '0-0 (0 acres 0 guntas)',
    });
  }

  // Case detail & sub-routes
  const caseMatch = cleanPath.match(/^\/cases\/([^/]+)$/);
  if (caseMatch && method === 'GET') {
    const cid = decodeURIComponent(caseMatch[1]);
    const found = store.casesById[cid];
    return found ? jsonResponse(found) : jsonResponse({ detail: 'Case not found' }, 404);
  }

  const pipeMatch = cleanPath.match(/^\/cases\/([^/]+)\/pipeline\/run$/);
  if (pipeMatch && method === 'POST') {
    const cid = decodeURIComponent(pipeMatch[1]);
    const c = store.casesById[cid];
    if (c) {
      c.audit_logs = [
        {
          id: `aud-${Date.now()}`,
          actor_name: 'Demo Reviewer',
          actor_role: 'reviewer',
          action: 'PIPELINE_RERUN',
          details: 'Deterministic rules & ownership graph re-verified in interactive demo session.',
          created_at: new Date().toISOString(),
        },
        ...c.audit_logs,
      ];
      return jsonResponse(c);
    }
  }

  const signMatch = cleanPath.match(/^\/cases\/([^/]+)\/reports\/sign$/);
  if (signMatch && method === 'POST') {
    const cid = decodeURIComponent(signMatch[1]);
    return jsonResponse({
      case_id: cid,
      token: 'static-demo-token',
      download_url: `${BASE}demo-snapshot/reports/${encodeURIComponent(cid)}.pdf`,
      expires_in_seconds: 300,
    });
  }

  const valMatch = cleanPath.match(/^\/cases\/([^/]+)\/valuation$/);
  if (valMatch && method === 'GET') {
    const cid = decodeURIComponent(valMatch[1]);
    return jsonResponse(store.valuationById[cid] || { abstained: true, comparables: [] });
  }

  const valDemoMatch = cleanPath.match(/^\/cases\/([^/]+)\/comparables\/load-demo$/);
  if (valDemoMatch && method === 'POST') {
    const cid = decodeURIComponent(valDemoMatch[1]);
    const demoVal = JSON.parse(JSON.stringify(store.valuationDemoById[cid]));
    store.valuationById[cid] = demoVal;
    return jsonResponse(demoVal);
  }

  const valAddMatch = cleanPath.match(/^\/cases\/([^/]+)\/comparables$/);
  if (valAddMatch && method === 'POST') {
    const cid = decodeURIComponent(valAddMatch[1]);
    const current = store.valuationById[cid];
    if (!current) return jsonResponse({ detail: 'Case not found' }, 404);
    const acres = parseExtentToAcres(String(bodyObj.extent_str || '1'));
    const price = Number(bodyObj.sale_price_inr || 0);
    if (acres <= 0 || price <= 0) {
      return jsonResponse({ detail: 'Extent and sale price must be positive.' }, 400);
    }
    const item: ComparableItem = {
      id: `comp-${Date.now()}`,
      label: bodyObj.label || 'Custom Comparable',
      location: bodyObj.location || 'Local Village',
      sale_date: bodyObj.sale_date || '2026-01',
      extent_str: bodyObj.extent_str || '1-0',
      extent_acres: Number(acres.toFixed(3)),
      sale_price_inr: price,
      price_per_acre_inr: Math.round(price / acres),
      source_ref: bodyObj.source_ref || 'User-supplied SRO index',
      verified: Boolean(bodyObj.verified),
      synthetic: false,
    };
    current.comparables = [...current.comparables, item];
    store.valuationById[cid] = recomputeValuation(current);
    return jsonResponse(store.valuationById[cid]);
  }

  const compVerifyMatch = cleanPath.match(/^\/comparables\/([^/]+)\/verify$/);
  if (compVerifyMatch && (method === 'PATCH' || method === 'POST')) {
    const compId = decodeURIComponent(compVerifyMatch[1]);
    for (const cid of Object.keys(store.valuationById)) {
      const v = store.valuationById[cid];
      const idx = v.comparables.findIndex((c) => c.id === compId);
      if (idx >= 0) {
        v.comparables[idx].verified = !v.comparables[idx].verified;
        store.valuationById[cid] = recomputeValuation(v);
        return jsonResponse(store.valuationById[cid]);
      }
    }
  }

  const compDelMatch = cleanPath.match(/^\/comparables\/([^/]+)$/);
  if (compDelMatch && method === 'DELETE') {
    const compId = decodeURIComponent(compDelMatch[1]);
    for (const cid of Object.keys(store.valuationById)) {
      const v = store.valuationById[cid];
      if (v.comparables.some((c) => c.id === compId)) {
        v.comparables = v.comparables.filter((c) => c.id !== compId);
        store.valuationById[cid] = recomputeValuation(v);
        return jsonResponse(store.valuationById[cid]);
      }
    }
  }

  const ownMatch = cleanPath.match(/^\/cases\/([^/]+)\/ownership\/graph$/);
  if (ownMatch && method === 'GET') {
    const cid = decodeURIComponent(ownMatch[1]);
    return jsonResponse(store.ownershipById[cid] || { case_id: cid, nodes: [], edges: [] });
  }

  const resolveMatch = cleanPath.match(/^\/cases\/([^/]+)\/persons\/([^/]+)\/resolve$/);
  if (resolveMatch && method === 'POST') {
    const cid = decodeURIComponent(resolveMatch[1]);
    const pid = decodeURIComponent(resolveMatch[2]);
    const c = store.casesById[cid];
    if (c) {
      const p = c.persons.find((x) => x.id === pid);
      if (p) p.resolution_status = bodyObj.resolution_status || 'verified';
      return jsonResponse({ case: c });
    }
  }

  const gisMatch = cleanPath.match(/^\/cases\/([^/]+)\/gis$/);
  if (gisMatch && method === 'GET') {
    const cid = decodeURIComponent(gisMatch[1]);
    return jsonResponse(store.gisById[cid] || { has_geometry: false, qa_checks: [] });
  }
  if (gisMatch && method === 'DELETE') {
    const cid = decodeURIComponent(gisMatch[1]);
    store.gisById[cid] = await fetchSnap<GeoJsonResponse>(`gis_${cid}.json`);
    return jsonResponse(store.gisById[cid]);
  }
  const gisDemoMatch = cleanPath.match(/^\/cases\/([^/]+)\/gis\/load-demo$/);
  if (gisDemoMatch && method === 'POST') {
    const cid = decodeURIComponent(gisDemoMatch[1]);
    store.gisById[cid] = JSON.parse(JSON.stringify(store.gisDemoById[cid]));
    return jsonResponse(store.gisById[cid]);
  }

  const discReviewMatch = cleanPath.match(/^\/discrepancies\/([^/]+)\/review$/);
  if (discReviewMatch && method === 'POST') {
    const did = decodeURIComponent(discReviewMatch[1]);
    for (const c of Object.values(store.casesById)) {
      const d = c.discrepancies.find((x) => x.id === did);
      if (d) {
        d.review_status = bodyObj.decision || 'accepted';
        d.reviewer_notes = bodyObj.reviewer_notes || null;
        d.reviewed_by = 'Demo Reviewer';
        d.reviewed_at = new Date().toISOString();
        return jsonResponse({ case: c });
      }
    }
  }

  const docCorrectMatch = cleanPath.match(/^\/documents\/([^/]+)\/correct$/);
  if (docCorrectMatch && method === 'POST') {
    const docId = decodeURIComponent(docCorrectMatch[1]);
    for (const c of Object.values(store.casesById)) {
      const doc = c.documents.find((x) => x.id === docId);
      if (doc) {
        const fld = doc.extracted_fields.find((f) => f.field_name === bodyObj.field_name);
        if (fld) {
          fld.reviewer_value = bodyObj.corrected_value;
          fld.verification_status = 'verified';
          fld.notes = bodyObj.reviewer_notes || null;
        }
        return jsonResponse({ case: c });
      }
    }
  }

  if (cleanPath.endsWith('/documents/upload') && method === 'POST') {
    return jsonResponse(
      {
        detail:
          'Hosted GitHub Pages demo runs preloaded cases. Start local Docker Compose (`docker compose up`) to upload and OCR new PDF/image scans.',
      },
      400
    );
  }

  return jsonResponse({ detail: `Endpoint ${cleanPath} not available in static preview mode.` }, 404);
}
