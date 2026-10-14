/**
 * @module contactTrails
 * @description Fading light-pink trails behind live aircraft — the God's-Eye
 * "breathing sky" feel, built THIRD EYE-native and keyless.
 *
 * Source: adsb.lol V2 public API (keyless, CORS-open):
 *   https://api.adsb.lol/v2/point/{lat}/{lon}/{radiusNm}
 * The module polls the camera-centered circle every TRAIL_POLL_MS, keeps a
 * rolling per-aircraft position history (TRAIL_MAX_POINTS), and renders each
 * trail as a 3D polyline at the aircraft's own altitude history. Older
 * segments fade out. Independent from the flights layer — zero coupling.
 */

import * as Cesium from 'cesium';
import { registerSpriteCollection, restoreSpriteOrder } from './spriteOrder.js';
import { governorRequestRender } from '../renderGovernor.js';

const TRAIL_POLL_MS = 30_000;
const TRAIL_MAX_POINTS = 40;          // ~20 min of history @30s poll
const TRAIL_MAX_AGE_MS = 20 * 60_000;
const TRAIL_MAX_AIRCRAFT = 80;
const FETCH_TIMEOUT_MS = 12_000;
// Via same-origin proxy (api/index.js on Vercel, vite middleware in dev) —
// adsb.lol blocks browser-direct CORS.
const ADSB_URL = '/api/adsblol/point';

const TRAIL_COLOR = Cesium.Color.fromCssColorString('#ff4fd8').withAlpha(0.5);

let _viewer = null;
let _polylines = null;
let _timer = null;
let _enabled = false;
let _inFlight = false;
let _generation = 0;
let _error = null;
let _lastUpdate = null;
/** hex → Array<{lat,lon,altM,atMs}> */
let _history = new Map();

function circleFor(viewer) {
  try {
    const carto = viewer.camera.positionCartographic;
    const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
    const centerLat = Cesium.Math.toDegrees(carto.latitude);
    const centerLon = Cesium.Math.toDegrees(carto.longitude);
    let radiusNm = 40;
    if (rect) {
      const spanLat = Cesium.Math.toDegrees(rect.north - rect.south);
      radiusNm = Math.min(250, Math.max(15, (spanLat * 60) / 2));
    }
    return { centerLat, centerLon, radiusNm: Math.round(radiusNm) };
  } catch {
    return null;
  }
}

async function fetchCircle({ centerLat, centerLon, radiusNm }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${ADSB_URL}?lat=${centerLat.toFixed(3)}&lon=${centerLon.toFixed(3)}&rad=${radiusNm}`);
    if (!response.ok) throw new Error(`adsb.lol HTTP ${response.status}`);
    const body = await response.json();
    const rows = Array.isArray(body?.ac) ? body.ac : [];
    return rows.map((row) => ({
      hex: String(row.hex || '').trim().toLowerCase(),
      lat: Number(row.lat),
      lon: Number(row.lon),
      altM: Number.isFinite(Number(row.alt_geom)) ? Number(row.alt_geom) * 0.3048
        : Number.isFinite(Number(row.alt)) ? Number(row.alt) * 0.3048 : 0,
    })).filter((row) => row.hex && Number.isFinite(row.lat) && Number.isFinite(row.lon));
  } finally {
    clearTimeout(timer);
  }
}

function recordSamples(aircraft) {
  const now = Date.now();
  for (const ac of aircraft) {
    let points = _history.get(ac.hex);
    if (!points) {
      points = [];
      _history.set(ac.hex, points);
    }
    const last = points[points.length - 1];
    // Skip jitter duplicates (<80 m from the last sample).
    if (last) {
      const dLat = (ac.lat - last.lat) * 111_320;
      const dLon = (ac.lon - last.lon) * 111_320 * Math.cos((ac.lat * Math.PI) / 180);
      if (Math.hypot(dLat, dLon) < 80) continue;
    }
    points.push({ lat: ac.lat, lon: ac.lon, altM: ac.altM, atMs: now });
    if (points.length > TRAIL_MAX_POINTS) points.shift();
  }
  // Prune stale aircraft entirely.
  for (const [hex, points] of _history) {
    const newest = points[points.length - 1]?.atMs || 0;
    if (now - newest > TRAIL_MAX_AGE_MS) _history.delete(hex);
  }
  // Cap trail count: keep the richest histories.
  if (_history.size > TRAIL_MAX_AIRCRAFT) {
    const sorted = [..._history.entries()].sort((a, b) => b[1].length - a[1].length);
    _history = new Map(sorted.slice(0, TRAIL_MAX_AIRCRAFT));
  }
}

function renderTrails(viewer) {
  _polylines.removeAll();
  const now = Date.now();
  for (const points of _history.values()) {
    const fresh = points.filter((point) => now - point.atMs <= TRAIL_MAX_AGE_MS);
    if (fresh.length < 2) continue;
    const flat = [];
    for (const point of fresh) {
      flat.push(point.lon, point.lat, Math.max(point.altM, 100));
    }
    try {
      _polylines.add({
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(flat),
        width: 2,
        material: Cesium.Material.fromType('Color', { color: TRAIL_COLOR }),
      });
    } catch { /* skip malformed trail */ }
  }
  governorRequestRender('trails:refresh');
}

async function refresh() {
  if (!_enabled || !_viewer || _inFlight) return;
  const circle = circleFor(_viewer);
  if (!circle) return;
  _inFlight = true;
  const generation = ++_generation;
  try {
    const aircraft = await fetchCircle(circle);
    if (generation !== _generation || !_enabled) return;
    recordSamples(aircraft);
    renderTrails(_viewer);
    _lastUpdate = Date.now();
    _error = null;
  } catch (error) {
    if (generation !== _generation || !_enabled) return;
    _error = String(error?.message || error).slice(0, 90);
    window.__trailsDebug = { error: _error, at: Date.now() };
  } finally {
    _inFlight = false;
  }
}

const contactTrailsLayer = {
  id: 'contact-trails',
  name: 'Contact Trails',
  icon: '💫',
  source: 'adsb.lol',
  updateInterval: TRAIL_POLL_MS,

  init(viewer) {
    _viewer = viewer;
    _polylines = new Cesium.PolylineCollection();
    viewer.scene.primitives.add(_polylines);
    registerSpriteCollection('contact-trails', _polylines);
    _polylines.show = false;
    _enabled = false;
    _history = new Map();
    _error = null;
    _lastUpdate = null;
    restoreSpriteOrder(viewer);
    console.log('[Data:Trails] Initialized (adsb.lol keyless contact trails)');
  },

  enable(viewer) {
    _enabled = true;
    _error = null;
    _polylines.show = true;
    restoreSpriteOrder(viewer);
    void refresh();
    if (!_timer) _timer = setInterval(() => void refresh(), TRAIL_POLL_MS);
  },

  disable() {
    _enabled = false;
    _generation += 1;
    if (_timer) { clearInterval(_timer); _timer = null; }
    _polylines.removeAll();
    _polylines.show = false;
    _error = null;
    _lastUpdate = null;
  },

  async update() {
    await refresh();
  },

  getStats() {
    return {
      status: _error ? 'error' : _lastUpdate ? 'ok' : 'idle',
      count: _history.size,
      lastUpdate: _lastUpdate,
      error: _error,
    };
  },

  destroy(viewer) {
    this.disable();
    if (_polylines && _viewer) {
      _viewer.scene.primitives.remove(_polylines);
      _polylines = null;
    }
  },
};

export default contactTrailsLayer;
