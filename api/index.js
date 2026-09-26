/**
 * THIRD EYE — Vercel Serverless API (api/index.js + vercel.json rewrite)
 * ============================================
 * Static hosting par live-data layers 404 de rahi thi (kyunki asli app ka
 * API proxy Vite dev-server ke andar tha). Ye ek single serverless function
 * un sab core proxies ko Vercel par wapas laata hai:
 *
 *   /api/opensky?lat=&lon=        → OpenSky states (adsb.lol fallback ke saath)
 *   /api/opensky-track?icao24=    → OpenSky flight track
 *   /api/celestrak/{group}        → CelesTrak TLE text (stations, starlink…)
 *   /api/adsblol/mil              → adsb.lol military aircraft
 *   /api/adsblol/trace?hex=       → adsb.lol aircraft trace
 *   /api/adsbdb/{callsign}        → aircraft type lookup
 *   /api/launches                 → Launch Library 2 (rolling 30d)
 *   /api/overpass                 → Overpass API (roads for traffic layer)
 *   /api/tomtom/status            → {hasKey, dailyCount, budget, date}
 *   /api/tomtom/flow/{z}/{x}/{y}.pbf → TomTom live flow tiles (TOMTOM_API_KEY)
 *
 * Env vars (Vercel dashboard → Settings → Environment Variables):
 *   TOMTOM_API_KEY  — optional; bina key flow tiles 503 denge aur status hasKey:false
 *   FIRMS_MAP_KEY   — optional free NASA FIRMS key; bina key fire layer 503 no_key
 */

import { parseFirmsCsv, filterTrailing24h } from '../src/data/firmsCsv.js';

/** Vercel function budget (FIRMS world pulls slow ho sakte hain cold start par). */
export const maxDuration = 60;

const MILITARY_INSTALLATION_ELEMENT_CAP = 700;
const FIRMS_TTL_MS = 300_000;
const FIRMS_SOURCES = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT'];

const KNOT_TO_MPS = 0.514444;
const FOOT_TO_M = 0.3048;
const FPM_TO_MPS = 0.00508;
const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = 'third-eye-vercel/1.0';

// Tiny warm-instance cache {key: {at, body, contentType, status}}
const cache = new Map();

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function emitterCategory(value) {
  const category = String(value || '').trim().toUpperCase();
  const categories = { A1: 2, A2: 3, A3: 4, A4: 5, A5: 6, A6: 7, A7: 8, B1: 9, B2: 10, B3: 11, B4: 12, B6: 14, B7: 15 };
  return categories[category] || 0;
}

/** adsb.lol v2 aircraft record → OpenSky state-vector shape (renderer-compatible). */
function normalizeAdsbLolAircraftState(aircraft, nowSeconds) {
  const hex = String(aircraft?.hex || '').trim().toLowerCase();
  const latitude = finiteNumber(aircraft?.lat);
  const longitude = finiteNumber(aircraft?.lon);
  if (!hex || latitude === null || longitude === null) return null;

  const seenPosition = Math.max(0, finiteNumber(aircraft?.seen_pos) ?? finiteNumber(aircraft?.seen) ?? 0);
  const seen = Math.max(0, finiteNumber(aircraft?.seen) ?? seenPosition);
  const onGround = aircraft?.alt_baro === 'ground';
  const barometricFeet = onGround ? null : finiteNumber(aircraft?.alt_baro);
  const geometricFeet = finiteNumber(aircraft?.alt_geom);
  const groundSpeedKnots = finiteNumber(aircraft?.gs);
  const verticalRateFpm = finiteNumber(aircraft?.baro_rate) ?? finiteNumber(aircraft?.geom_rate);
  const track = finiteNumber(aircraft?.track);

  return [
    hex,
    String(aircraft?.flight || aircraft?.r || '').trim() || null,
    null,
    Math.max(0, nowSeconds - seenPosition),
    Math.max(0, nowSeconds - seen),
    longitude,
    latitude,
    barometricFeet === null ? null : barometricFeet * FOOT_TO_M,
    onGround,
    groundSpeedKnots === null ? null : groundSpeedKnots * KNOT_TO_MPS,
    track,
    verticalRateFpm === null ? null : verticalRateFpm * FPM_TO_MPS,
    null,
    geometricFeet === null ? null : geometricFeet * FOOT_TO_M,
    aircraft?.squawk || null,
    aircraft?.spi === 1,
    0,
    emitterCategory(aircraft?.category),
  ];
}

function normalizeAdsbLolPoint(payload) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const aircraft = Array.isArray(payload?.ac) ? payload.ac : [];
  const states = [];
  for (const record of aircraft) {
    const state = normalizeAdsbLolAircraftState(record, nowSeconds);
    if (state) states.push(state);
  }
  return { time: nowSeconds, states };
}

async function fetchUpstream(url, { headers = {}, method, body, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      body,
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...headers },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function send(res, status, body, contentType = 'application/json') {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj));
}

// ————————————————————————— handlers —————————————————————————

function validBox(params) {
  const south = finiteNumber(params.get('south'));
  const west = finiteNumber(params.get('west'));
  const north = finiteNumber(params.get('north'));
  const east = finiteNumber(params.get('east'));
  if (south === null || west === null || north === null || east === null) return null;
  if (north <= south || east <= west) return null;
  if (north - south > 10 || east - west > 10) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  return { south, west, north, east };
}

async function handleMilitaryInstallations(req, res, urlObj) {
  const box = validBox(urlObj.searchParams);
  if (!box) return sendJson(res, 400, { error: 'A non-dateline bbox no larger than 10 degrees is required' });
  const exact = urlObj.searchParams.get('exact') === '1';
  const cacheKey = `milinst:${exact ? 'x' : 'q'}:${box.south.toFixed(2)},${box.west.toFixed(2)},${box.north.toFixed(2)},${box.east.toFixed(2)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < 300_000) {
    return sendJson(res, 200, { ...hit.payload, status: 'cached' });
  }
  const bbox = `${box.south.toFixed(5)},${box.west.toFixed(5)},${box.north.toFixed(5)},${box.east.toFixed(5)}`;
  const ql = `[out:json][timeout:20];(nwr["military"~"^(airfield|naval_base|range|barracks|base)$"](${bbox});nwr["landuse"="military"](${bbox}););out center tags geom ${MILITARY_INSTALLATION_ELEMENT_CAP};`;
  try {
    const response = await fetchUpstream('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(ql)}`,
      timeoutMs: 25000,
    });
    if (!response.ok) {
      return sendJson(res, 503, {
        error: 'Mapped installation context is temporarily unavailable',
        reason: response.status === 429 ? 'rate_limited' : response.status === 504 ? 'timeout' : 'unavailable',
      });
    }
    const parsed = await response.json();
    const elements = Array.isArray(parsed?.elements) ? parsed.elements.slice(0, MILITARY_INSTALLATION_ELEMENT_CAP) : [];
    const payload = {
      elements,
      saturated: elements.length >= MILITARY_INSTALLATION_ELEMENT_CAP,
      elementCap: MILITARY_INSTALLATION_ELEMENT_CAP,
      retrievedAt: new Date().toISOString(),
      status: 'ready',
    };
    cache.set(cacheKey, { at: Date.now(), payload });
    return sendJson(res, 200, payload);
  } catch {
    return sendJson(res, 503, { error: 'Mapped installation context is temporarily unavailable', reason: 'unavailable' });
  }
}

async function firmsFetchSource(key, source) {
  const response = await fetchUpstream(
    `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/world/2`,
    { timeoutMs: 55000 },
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const records = parseFirmsCsv(text);
  if (records === null) throw new Error('non-CSV upstream response');
  return records;
}

async function handleFirms(res, urlObj) {
  const key = process.env.FIRMS_MAP_KEY || '';
  const path = urlObj.pathname.replace(/\/+$/, '');

  if (path === '/api/firms/status') {
    if (!key) return sendJson(res, 200, { hasKey: false, lastFetch: null, count: null, stale: false, ttlMs: FIRMS_TTL_MS, transactions: null });
    const hit = cache.get('firms:payload');
    return sendJson(res, 200, {
      hasKey: true,
      lastFetch: hit ? hit.at : null,
      count: hit ? hit.payload.count : null,
      stale: hit ? Date.now() - hit.at >= FIRMS_TTL_MS : false,
      ttlMs: FIRMS_TTL_MS,
      transactions: null,
    });
  }

  if (!key) return sendJson(res, 503, { error: 'no_key' });

  const hit = cache.get('firms:payload');
  if (hit && Date.now() - hit.at < FIRMS_TTL_MS) return sendJson(res, 200, hit.payload);

  try {
    const now = Date.now();
    let fires = [];
    for (const source of FIRMS_SOURCES) {
      const records = filterTrailing24h(await firmsFetchSource(key, source), now);
      fires = fires.concat(records);
    }
    const payload = { fetchedAt: now, stale: false, ttlMs: FIRMS_TTL_MS, sources: FIRMS_SOURCES, count: fires.length, fires };
    cache.set('firms:payload', { at: now, payload });
    return sendJson(res, 200, payload);
  } catch {
    if (hit) return sendJson(res, 200, { ...hit.payload, stale: true });
    return sendJson(res, 503, { error: 'FIRMS upstream unavailable' });
  }
}


async function handleOpensky(req, res, url) {
  const lat = finiteNumber(url.searchParams.get('lat')) ?? 21.17;
  const lon = finiteNumber(url.searchParams.get('lon')) ?? 72.83;
  const cacheKey = `opensky:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < 15000) {
    res.setHeader('X-Flight-Source', hit.source);
    res.setHeader('X-Cache', 'HIT');
    return sendJson(res, 200, hit.body);
  }

  // 1) OpenSky anonymous — worldwide snapshot (bbox isHeavy; anon 400/day/IP)
  try {
    const response = await fetchUpstream('https://opensky-network.org/api/states/all', { timeoutMs: 8000 });
    if (response.ok) {
      const body = await response.json();
      if (body && Array.isArray(body.states)) {
        cache.set(cacheKey, { at: Date.now(), body, source: 'OpenSky' });
        res.setHeader('X-Flight-Source', 'OpenSky');
        return sendJson(res, 200, body);
      }
    }
  } catch { /* fall through to adsb.lol */ }

  // 2) adsb.lol regional fallback (250nm around viewer subpoint)
  try {
    const roundedLat = Math.round(lat * 4) / 4;
    const roundedLon = Math.round(lon * 4) / 4;
    const response = await fetchUpstream(
      `https://api.adsb.lol/v2/lat/${roundedLat}/lon/${roundedLon}/dist/250`,
      { timeoutMs: 8000 },
    );
    if (response.ok) {
      const payload = await response.json();
      const normalized = normalizeAdsbLolPoint(payload);
      cache.set(cacheKey, { at: Date.now(), body: normalized, source: 'adsb.lol' });
      res.setHeader('X-Flight-Source', 'adsb.lol');
      res.setHeader('X-Flight-Coverage', '250nm regional fallback');
      res.setHeader('X-Flight-Count', String(normalized.states.length));
      return sendJson(res, 200, normalized);
    }
    return sendJson(res, response.status, { error: `adsb.lol upstream ${response.status}` });
  } catch (error) {
    return sendJson(res, 502, { error: 'OpenSky + adsb.lol both unreachable' });
  }
}

async function handleOpenskyTrack(req, res, url) {
  const icao24 = String(url.searchParams.get('icao24') || '').trim();
  if (!/^[0-9a-f]{4,12}$/i.test(icao24)) return sendJson(res, 400, { error: 'bad icao24' });
  try {
    const response = await fetchUpstream(
      `https://opensky-network.org/api/tracks/all?icao24=${encodeURIComponent(icao24)}&time=0`,
    );
    const body = await response.text();
    send(res, response.status, body);
  } catch {
    sendJson(res, 502, { error: 'opensky track unreachable' });
  }
}

const CELESTRAK_ALLOWED = new Set([
  'stations', 'visual', 'active', 'starlink', 'oneweb', 'gnss', 'geo',
  'science', 'cosmos-2251-debris', 'iridium-33-debris', 'cosmos-1408-debris',
  'fengyun-1c-debris', 'weather', 'noaa', 'goes', 'education', 'resources',
  'sarsat', 'disaster', 'engineering', 'spire', 'last-30-days', 'analyst',
  'intelsat', 'ses', 'iridium-NEXT', 'oneweb-celestrak', 'orbcomm', 'globalstar',
  'swarm', 'kepler', 'spacex', 'gps-ops', 'glonass-status', 'galileo', 'beidou',
]);

async function handleCelestrak(res, group) {
  if (!CELESTRAK_ALLOWED.has(group)) return sendJson(res, 400, { error: 'invalid group' });
  const cacheKey = `celestrak:${group}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < 3600_000) {
    return send(res, 200, hit.body, 'text/plain; charset=utf-8');
  }
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchUpstream(
        `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`,
        { headers: { 'User-Agent': USER_AGENT }, timeoutMs: 10000 },
      );
      if (!response.ok) return sendJson(res, response.status, { error: `celestrak ${response.status}` });
      const body = await response.text();
      cache.set(cacheKey, { at: Date.now(), body });
      return send(res, 200, body, 'text/plain; charset=utf-8');
    } catch (error) {
      lastError = error;
    }
  }
  sendJson(res, 502, { error: 'celestrak unreachable', detail: String(lastError?.message || '').slice(0, 100) });
}

async function handleAdsbLol(res, sub, url) {
  try {
    if (sub === 'mil') {
      const response = await fetchUpstream('https://api.adsb.lol/v2/mil', { timeoutMs: 8000 });
      const body = await response.text();
      return send(res, response.status, body);
    }
    if (sub === 'trace') {
      const hex = String(url.searchParams.get('hex') || '').trim();
      if (!/^[0-9a-f]{4,12}$/i.test(hex)) return sendJson(res, 400, { error: 'bad hex' });
      const response = await fetchUpstream(`https://api.adsb.lol/v2/trace/${encodeURIComponent(hex)}`, { timeoutMs: 8000 });
      const body = await response.text();
      return send(res, response.status, body);
    }
    sendJson(res, 404, { error: 'not found' });
  } catch {
    sendJson(res, 502, { error: 'adsb.lol unreachable' });
  }
}

const ADSBDB_TTL_MS = 24 * 3600_000;
const adsbdbCache = { routes: new Map(), aircraft: new Map() };

function parseAdsbdbRoute(json) {
  const fr = json?.response?.flightroute;
  if (!fr?.origin || !fr?.destination) return null;
  const airport = (a) => ({
    code: a.iata_code || a.icao_code || '',
    name: a.municipality || a.name || '',
    lat: Number.isFinite(a.latitude) ? a.latitude : null,
    lon: Number.isFinite(a.longitude) ? a.longitude : null,
  });
  return { airline: fr.airline?.name || null, origin: airport(fr.origin), destination: airport(fr.destination) };
}

function parseAdsbdbAircraft(json) {
  const a = json?.response?.aircraft;
  if (!a) return null;
  return {
    typeCode: a.icao_type || null,
    typeName: a.manufacturer && a.type ? `${a.manufacturer} ${a.type}` : (a.type || null),
    registration: a.registration || null,
  };
}

async function adsbdbLookup(kind, key) {
  const store = kind === 'route' ? adsbdbCache.routes : adsbdbCache.aircraft;
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ADSBDB_TTL_MS) return hit.data;
  const upstream = kind === 'route'
    ? `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(key)}`
    : `https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(key)}`;
  try {
    const response = await fetchUpstream(upstream, { timeoutMs: 8000 });
    if (response.ok) {
      const json = await response.json();
      const data = kind === 'route' ? parseAdsbdbRoute(json) : parseAdsbdbAircraft(json);
      store.set(key, { at: Date.now(), data });
      return data;
    }
    if (response.status === 404) {
      store.set(key, { at: Date.now(), data: null }); // negative cache
      return null;
    }
    return hit ? hit.data : null;
  } catch {
    return hit ? hit.data : null;
  }
}

async function handleAdsbdb(res, tail) {
  const [kind, rawKey] = String(tail || '').split('/');
  if (kind === 'route') {
    const cs = String(rawKey || '').toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(cs)) return sendJson(res, 400, { error: 'invalid callsign' });
    const data = await adsbdbLookup('route', cs);
    return sendJson(res, 200, data ? { found: true, ...data } : { found: false });
  }
  if (kind === 'type') {
    const hex = String(rawKey || '').toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(hex)) return sendJson(res, 400, { error: 'invalid hex' });
    const data = await adsbdbLookup('aircraft', hex);
    return sendJson(res, 200, data ? { found: true, ...data } : { found: false });
  }
  sendJson(res, 404, { error: 'unknown endpoint' });
}

async function handleLaunches(res) {
  const cacheKey = 'launches:30d';
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < 900_000) return sendJson(res, 200, hit.body);

  const now = new Date();
  const from = new Date(now.getTime() - 10 * 86400_000).toISOString();
  const to = new Date(now.getTime() + 20 * 86400_000).toISOString();
  const urls = [
    `https://ll.thespacedevs.com/2.3.0/launches/?mode=detailed&limit=30&window_start__gte=${encodeURIComponent(from)}&window_start__lte=${encodeURIComponent(to)}`,
    `https://ll.thespacedevs.com/2.3.0/launches/?mode=detailed&limit=30`,
  ];
  for (const url of urls) {
    try {
      const response = await fetchUpstream(url, { timeoutMs: 9000 });
      if (!response.ok) continue;
      const body = await response.json();
      if (body && Array.isArray(body.results)) {
        cache.set(cacheKey, { at: Date.now(), body });
        return sendJson(res, 200, body);
      }
    } catch { /* try next */ }
  }
  sendJson(res, 502, { error: 'launch library unreachable' });
}

async function handleOverpass(req, res) {
  let dataParam = req.method === 'POST' ? null : url(req).searchParams.get('data');
  if (req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    const params = new URLSearchParams(raw);
    dataParam = params.get('data') || raw.slice(0, 8000);
  }
  if (!dataParam) return sendJson(res, 400, { error: 'missing data' });
  try {
    const response = await fetchUpstream('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(dataParam)}`,
      timeoutMs: 12000,
    });
    const body = await response.text();
    send(res, response.status, body, response.headers.get('content-type') || 'text/plain');
  } catch {
    sendJson(res, 502, { error: 'overpass unreachable' });
  }
}

function url(req) {
  return new URL(req.url, 'http://localhost');
}

async function handleTomtom(req, res, urlObj) {
  const key = process.env.TOMTOM_API_KEY || '';
  const path = urlObj.pathname; // /api/tomtom/status | /api/tomtom/flow/z/x/y.pbf

  if (path === '/api/tomtom/status' || path === '/api/tomtom/status/') {
    return sendJson(res, 200, {
      hasKey: Boolean(key),
      dailyCount: 0,
      budget: 40000,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  const flowMatch = /^\/api\/tomtom\/flow\/(\d{1,2})\/(\d{1,4})\/(\d{1,4})(?:\.pbf)?$/.exec(path);
  if (flowMatch) {
    if (!key) return sendJson(res, 503, { error: 'TOMTOM_API_KEY not configured' });
    const [, z, x, y] = flowMatch;
    const cacheKey = `tomtom:${z}:${x}:${y}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < 120_000) {
      return send(res, 200, hit.body, 'application/x-protobuf');
    }
    try {
      const upstream = `https://api.tomtom.com/traffic/map/4/tile/flow/relative/${z}/${x}/${y}.pbf?key=${encodeURIComponent(key)}`;
      const response = await fetchUpstream(upstream, { timeoutMs: 9000 });
      if (!response.ok) {
        const detail = await response.text();
        return sendJson(res, response.status, { error: `tomtom ${response.status}`, detail: detail.slice(0, 200) });
      }
      const body = Buffer.from(await response.arrayBuffer());
      cache.set(cacheKey, { at: Date.now(), body });
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return send(res, 200, body, 'application/x-protobuf');
    } catch {
      return sendJson(res, 502, { error: 'tomtom unreachable' });
    }
  }

  sendJson(res, 404, { error: 'not found' });
}

const GEOCODE_TTL_MS = 600_000;

async function handleGeocode(res, urlObj) {
  const q = String(urlObj.searchParams.get('q') || '').trim();
  if (!q || q.length > 120) return sendJson(res, 400, { results: [] });
  const cacheKey = `geocode:${q.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < GEOCODE_TTL_MS) return sendJson(res, 200, hit.body);
  try {
    const response = await fetchUpstream(
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=0&q='
      + encodeURIComponent(q),
      { headers: { 'User-Agent': 'third-eye-globe/1.0', Accept: 'application/json' }, timeoutMs: 9000 },
    );
    if (!response.ok) return sendJson(res, 502, { results: [], error: `nominatim ${response.status}` });
    const rows = await response.json();
    const results = (Array.isArray(rows) ? rows : []).map((row) => ({
      lat: parseFloat(row.lat),
      lon: parseFloat(row.lon),
      label: String(row.display_name || '').split(',').slice(0, 3).join(',').trim(),
      bbox: Array.isArray(row.boundingbox) ? row.boundingbox.map(Number) : null,
    })).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
    const body = { results };
    cache.set(cacheKey, { at: Date.now(), body });
    sendJson(res, 200, body);
  } catch {
    sendJson(res, 502, { results: [], error: 'nominatim unreachable' });
  }
}

// ————————————————————————— router —————————————————————————

export default async function handler(req, res) {
  let urlObj;
  try {
    urlObj = url(req);
  } catch {
    return sendJson(res, 400, { error: 'bad url' });
  }
  const path = urlObj.pathname.replace(/\/+$/, '') || '/';

  try {
    if (path === '/api/health') return sendJson(res, 200, { ok: true, service: 'third-eye-api' });

    if (path === '/api/opensky') return await handleOpensky(req, res, urlObj);
    if (path === '/api/opensky-track') return await handleOpenskyTrack(req, res, urlObj);

    const celestrakMatch = /^\/api\/celestrak\/([a-z0-9-]+)$/i.exec(path);
    if (celestrakMatch) return await handleCelestrak(res, celestrakMatch[1].toLowerCase());

    const adsblolMatch = /^\/api\/adsblol\/(mil|trace)$/i.exec(path);
    if (adsblolMatch) return await handleAdsbLol(res, adsblolMatch[1].toLowerCase(), urlObj);

    const adsbdbMatch = /^\/api\/adsbdb\/(.+)$/i.exec(path);
    if (adsbdbMatch) return await handleAdsbdb(res, adsbdbMatch[1]);

    if (path === '/api/launches') return await handleLaunches(res);

    if (path === '/api/overpass') return await handleOverpass(req, res);

    if (path === '/api/geocode') return await handleGeocode(res, urlObj);

    const milInstMatch = /^\/api\/military-installations$/.test(path);
    if (milInstMatch) return await handleMilitaryInstallations(req, res, urlObj);

    if (path === '/api/firms' || path === '/api/firms/status') return await handleFirms(res, urlObj);

    // AISStream ek WebSocket feed hai — serverless par proxy possible nahi.
    // Ye layer local dev app par chalti hai; Vercel par graceful-unavailable.
    if (path === '/api/ais-live' || path.startsWith('/api/ais-live/')) {
      return sendJson(res, 503, { error: 'AIS live feed needs the local dev server (WebSocket); unavailable on static hosting' });
    }

    // Client-side geoid fallback already in place (terrainHeights.js) — 503 with hint.
    if (path === '/api/terrain/heights') {
      return sendJson(res, 503, { error: 'terrain proxy unavailable on static hosting; client geoid fallback applies' });
    }

    if (path.startsWith('/api/tomtom')) return await handleTomtom(req, res, urlObj);

    return sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    return sendJson(res, 500, { error: 'internal', detail: String(error?.message || error).slice(0, 200) });
  }
}
