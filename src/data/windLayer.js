/**
 * @module windLayer
 * @description Live surface-wind arrows on the globe — keyless, REAL data.
 *
 * Source: Open-Meteo current-weather bulk endpoint (keyless, CORS-open):
 *   https://api.open-meteo.com/v1/forecast?latitude=a,b,c&longitude=..&current=wind_speed_10m,wind_direction_10m
 * The camera viewport is sampled on a lat/lon grid (points snapped to 0.25°
 * cells so neighbouring views share the same upstream request); each sample
 * renders as a rotated arrow billboard colored by speed (Beaufort-ish ramp).
 * Meteorological wind_direction is WHERE WIND COMES FROM; the arrow points
 * where it goes (dir + 180°).
 *
 * Refresh: every POLL_MS, plus a debounced viewport refetch when the camera
 * moves far enough. Zero keys, client-direct — works on dev AND Vercel.
 */

import * as Cesium from 'cesium';
import { registerSpriteCollection, restoreSpriteOrder } from './spriteOrder.js';
import { governorRequestRender } from '../renderGovernor.js';

/** Poll cadence (ms) — winds update hourly-ish upstream; 20 min is plenty. */
const WIND_POLL_MS = 20 * 60_000;
/** Per-fetch timeout (ms). */
const FETCH_TIMEOUT_MS = 12_000;
/** Grid density across the viewport (cols × rows samples, capped upstream). */
const GRID_COLS = 7;
const GRID_ROWS = 4;
/** Snap grid points to this many degrees so requests stay cache-friendly. */
const GRID_SNAP_DEG = 0.25;
/** Camera-move refetch debounce (ms). */
const MOVE_DEBOUNCE_MS = 2500;
/** Minimum bbox change (fraction of span) to trigger a refetch. */
const MOVE_REFETCH_FRACTION = 0.15;

const WIND_URL = 'https://api.open-meteo.com/v1/forecast';

let _viewer = null;
let _billboards = null;
let _cameraHandler = null;
let _moveTimer = null;
let _enabled = false;
let _inFlight = false;
let _generation = 0;
let _count = 0;
let _lastUpdate = null;
let _error = null;
let _lastBbox = null;

/** Arrow SVG (points UP = north before rotation), tinted per speed band. */
function arrowDataUri(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">`
    + `<g fill="none" stroke="#101018" stroke-width="7" stroke-linecap="round">`
    + `<line x1="20" y1="34" x2="20" y2="10"/></g>`
    + `<path d="M20 3 L30 16 L10 16 Z" fill="#101018"/>`
    + `<g stroke="${color}" stroke-width="3.4" stroke-linecap="round" fill="none">`
    + `<line x1="20" y1="34" x2="20" y2="10"/></g>`
    + `<path d="M20 4 L28.6 15.4 L11.4 15.4 Z" fill="${color}"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const SPEED_BANDS = [
  { max: 15, color: '#35d2ff' },   // light — cyan
  { max: 30, color: '#9dff35' },   // fresh — green
  { max: 50, color: '#ffb81b' },   // strong — amber
  { max: 75, color: '#ff7a1b' },   // gale — orange
  { max: Infinity, color: '#ff3554' }, // storm — red
];

function colorForSpeed(kmh) {
  return SPEED_BANDS.find((band) => kmh < band.max).color;
}

/**
 * Build the sample grid for the camera's view rectangle: GRID_COLS×GRID_ROWS
 * points snapped to GRID_SNAP_DEG, deduplicated. Wide views (near globe
 * scale) fall back to a fixed world grid.
 * @param {Cesium.Viewer} viewer
 * @returns {Array<{lat:number,lon:number}>}
 */
function gridFor(viewer) {
  let rect;
  try {
    rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
  } catch {
    rect = undefined;
  }
  if (!rect) return worldGrid();
  const south = Cesium.Math.toDegrees(rect.south);
  const north = Cesium.Math.toDegrees(rect.north);
  const west = Cesium.Math.toDegrees(rect.west);
  const east = Cesium.Math.toDegrees(rect.east);
  const spanLat = north - south;
  const spanLon = east - west;
  if (spanLat > 140 || spanLon > 140 || spanLat <= 0 || spanLon <= 0) return worldGrid();
  const points = [];
  for (let r = 0; r < GRID_ROWS; r += 1) {
    for (let c = 0; c < GRID_COLS; c += 1) {
      const fx = GRID_COLS === 1 ? 0.5 : c / (GRID_COLS - 1);
      const fy = GRID_ROWS === 1 ? 0.5 : r / (GRID_ROWS - 1);
      const lat = south + spanLat * fy;
      const lon = west + spanLon * fx;
      points.push({
        lat: Math.round(lat / GRID_SNAP_DEG) * GRID_SNAP_DEG,
        lon: Math.round(lon / GRID_SNAP_DEG) * GRID_SNAP_DEG,
      });
    }
  }
  const seen = new Set();
  return points.filter((p) => {
    const key = `${p.lat},${p.lon}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function worldGrid() {
  const points = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lon = -165; lon <= 180; lon += 45) {
      points.push({ lat, lon });
    }
  }
  return points;
}

/**
 * Fetch current wind for a point list (one bulk Open-Meteo call).
 * @param {Array<{lat:number,lon:number}>} points
 * @returns {Promise<Array<{lat:number,lon:number,kmh:number,dirDeg:number}>>}
 */
async function fetchWind(points) {
  if (!points.length) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${WIND_URL}?latitude=${points.map((p) => p.lat).join(',')}`
      + `&longitude=${points.map((p) => p.lon).join(',')}`
      + '&current=wind_speed_10m,wind_direction_10m';
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
    const body = await response.json();
    const rows = Array.isArray(body) ? body : [body];
    const out = [];
    rows.forEach((row, i) => {
      const cur = row?.current || {};
      const kmh = Number(cur.wind_speed_10m);
      const dirDeg = Number(cur.wind_direction_10m);
      const point = points[i];
      if (point && Number.isFinite(kmh) && Number.isFinite(dirDeg)) {
        out.push({ lat: point.lat, lon: point.lon, kmh, dirDeg });
      }
    });
    return out;
  } finally {
    clearTimeout(timer);
  }
}

function renderWind(samples) {
  _billboards.removeAll();
  for (const sample of samples) {
    const height = Math.max(_viewer.scene.globe.getHeight(
      Cesium.Cartographic.fromDegrees(sample.lon, sample.lat),
    ) || 0, 0) + 8000;
    _billboards.add({
      position: Cesium.Cartesian3.fromDegrees(sample.lon, sample.lat, height),
      image: arrowDataUri(colorForSpeed(sample.kmh)),
      width: 26,
      height: 26,
      // Meteorological "from" direction → arrow shows travel bearing (dir+180),
      // clockwise from north; Cesium billboard rotation is CCW-positive.
      rotation: -Cesium.Math.toRadians((sample.dirDeg + 180) % 360),
      alignedAxis: Cesium.Cartesian3.ZERO,
      scale: 1,
    });
  }
  _count = samples.length;
  // Lightweight boot-debug hook (harmless in prod; helps field diagnosis).
  window.__windDebug = { count: _count, at: Date.now(), error: _error };
  governorRequestRender('wind:refresh');
}

function bboxSignature(viewer) {
  try {
    const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
    if (!rect) return null;
    return [rect.south, rect.west, rect.north, rect.east].map((v) => Cesium.Math.toDegrees(v).toFixed(1)).join(',');
  } catch {
    return null;
  }
}

async function refresh(force = false) {
  if (!_enabled || !_viewer || _inFlight) return;
  const signature = bboxSignature(_viewer);
  if (!force && signature && signature === _lastBbox) return;
  _inFlight = true;
  const generation = ++_generation;
  const points = gridFor(_viewer);
  try {
    const samples = await fetchWind(points);
    if (generation !== _generation || !_enabled) return;
    renderWind(samples);
    _lastUpdate = Date.now();
    _error = null;
    _lastBbox = signature;
  } catch (error) {
    if (generation !== _generation || !_enabled) return;
    _error = String(error?.message || error).slice(0, 90);
    window.__windDebug = { count: -1, at: Date.now(), error: _error };
    console.warn('[Data:Wind] refresh failed:', _error);
  } finally {
    _inFlight = false;
  }
}

function onCameraMoved() {
  if (!_enabled) return;
  clearTimeout(_moveTimer);
  _moveTimer = setTimeout(() => void refresh(false), MOVE_DEBOUNCE_MS);
}

const windLayer = {
  id: 'wind',
  name: 'Live Wind',
  icon: '🌬️',
  source: 'Open-Meteo',
  updateInterval: WIND_POLL_MS,

  init(viewer) {
    _viewer = viewer;
    _billboards = new Cesium.BillboardCollection({ scene: viewer.scene });
    viewer.scene.primitives.add(_billboards);
    registerSpriteCollection('wind', _billboards);
    _billboards.show = false;
    _enabled = false;
    _generation = 0;
    _count = 0;
    _lastUpdate = null;
    _error = null;
    _lastBbox = null;
    restoreSpriteOrder(viewer);
    console.log('[Data:Wind] Initialized (Open-Meteo keyless wind arrows)');
  },

  enable(viewer) {
    _enabled = true;
    _error = null;
    _billboards.show = true;
    restoreSpriteOrder(viewer);
    if (!_cameraHandler) {
      _cameraHandler = () => onCameraMoved();
      viewer.camera.changed.addEventListener(_cameraHandler);
    }
    void refresh(true);
  },

  disable() {
    _enabled = false;
    _generation += 1;
    clearTimeout(_moveTimer);
    if (_cameraHandler && _viewer) {
      _viewer.camera.changed.removeEventListener(_cameraHandler);
      _cameraHandler = null;
    }
    _billboards.removeAll();
    _billboards.show = false;
    _count = 0;
    _inFlight = false;
    _lastBbox = null;
  },

  async update() {
    await refresh(true);
  },

  getStats() {
    return {
      status: _error ? 'error' : _lastUpdate ? 'ok' : 'idle',
      count: _count,
      lastUpdate: _lastUpdate,
      error: _error,
    };
  },

  destroy(viewer) {
    this.disable();
    if (_billboards && _viewer) {
      _viewer.scene.primitives.remove(_billboards);
      _billboards = null;
    }
  },
};

export default windLayer;
