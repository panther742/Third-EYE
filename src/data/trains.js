/**
 * @module trains
 * @description Live rail vehicles on the globe — REAL moving trains, no keys.
 *
 * Two keyless, CORS-open live feeds (client-direct, works on local dev AND
 * Vercel static without any proxy):
 *
 *   1. Entur (Norway, nationwide) — GTFS-Realtime protobuf vehicle positions:
 *      https://api.entur.io/realtime/v1/gtfs-rt/vehicle-positions
 *      Parsed in-browser with a minimal protobuf walker (no dependency).
 *      Feed carries ALL modes (bus/tram/metro/rail/boat); rail-class modes are
 *      resolved per route id via the JourneyPlanner v3 GraphQL `lines` query
 *      (transportMode) and cached for the session. We keep rail + metro.
 *
 *   2. MBTA (Boston) — V3 REST JSON, commuter rail (route_type=2):
 *      https://api-v3.mbta.com/vehicles?filter[route_type]=2
 *
 * Entities render as color-coded points (rail = amber, metro = cyan) with a
 * click-to-inspect popup. Viewport-bounded every poll; hard point cap.
 *
 * India note: Indian Railways / NTES publishes no public live-position feed
 * with coordinates, so no Indian feed can be wired yet — never fake it.
 */

import * as Cesium from 'cesium';
import { registerSpriteCollection, restoreSpriteOrder } from './spriteOrder.js';
import { registerPickOwner, unregisterPickOwner } from './pickRegistry.js';

/** Poll cadence (ms) — manager calls update() on this clock. */
const TRAIN_POLL_MS = 30_000;
/** Per-fetch abort timeout (ms). */
const FETCH_TIMEOUT_MS = 15_000;
/** Hard cap on rendered train points (performance guard). */
const MAX_POINTS = 500;
/** Entur GTFS-RT vehicle positions feed (protobuf). */
const ENTUR_RT_URL = 'https://api.entur.io/realtime/v1/gtfs-rt/vehicle-positions';
/** Entur JourneyPlanner v3 GraphQL — route id → transportMode resolution. */
const ENTUR_GRAPHQL_URL = 'https://api.entur.io/journey-planner/v3/graphql';
/** Required polite identification header for Entur APIs. */
const ENTUR_CLIENT_NAME = 'third-eye-globe';
/** MBTA commuter-rail vehicles (route_type=2), keyless JSON. */
const MBTA_URL = 'https://api-v3.mbta.com/vehicles?filter%5Broute_type%5D=2';
/** Rail-class Entur transport modes kept on the globe. */
const ENTUR_MODES_KEPT = new Set(['rail', 'metro']);
/** Route ids batched per GraphQL lines() lookup. */
const MODE_LOOKUP_BATCH = 250;
/** Follow-cam range (m) beside/behind the selected train (flights-style view). */
const FOLLOW_RANGE_M = 1600;
/** Re-acquire radius (km) when matching the followed train across polls. */
const REACQUIRE_MAX_KM = 2.5;

const COLOR_RAIL = Cesium.Color.fromCssColorString('#ffa41b');
const COLOR_METRO = Cesium.Color.fromCssColorString('#28c7ff');
const COLOR_OUTLINE = Cesium.Color.fromCssColorString('#101018');

let _viewer = null;
let _pointCollection = null;
let _clickHandler = null;
let _enabled = false;
let _pollGeneration = 0;
let _count = 0;
let _lastUpdate = null;
let _error = null;
let _loading = false;
/** Per-source last-good counts for stats. */
const _sourceCounts = { entur: 0, mbta: 0 };
/** Render map: point id → inspection info (also the pick-owner registry). */
const _renderMap = new Map();
/** Clicked/followed train: point id + vehicle record (flights-style tracking). */
let _selectedKey = null;
let _selectedVehicle = null;
/** Session cache: Entur route id → transportMode ('unknown' negative-cached). */
const _modeByRoute = new Map();

// ---------------------------------------------------------------------------
// Minimal GTFS-Realtime protobuf walker (no deps).
// ---------------------------------------------------------------------------

/**
 * Sequential protobuf field reader over a Uint8Array.
 * Supports wire types 0 (varint), 1 (i64), 2 (len-delim), 5 (i32/fixed32).
 */
class ProtoReader {
  constructor(buf) {
    this.buf = buf;
    this.i = 0;
  }

  get eof() {
    return this.i >= this.buf.length;
  }

  varint() {
    let value = 0;
    let shift = 0;
    for (;;) {
      const byte = this.buf[this.i];
      this.i += 1;
      value += (byte & 0x7f) * 2 ** shift;
      if (!(byte & 0x80)) break;
      shift += 7;
      if (shift > 70) throw new Error('varint too long');
    }
    return value;
  }

  /** @returns {[number, number, number|Uint8Array]} [fieldNumber, wireType, value] */
  next() {
    const tag = this.varint();
    const fieldNumber = tag >>> 3;
    const wireType = tag & 7;
    if (wireType === 0) return [fieldNumber, wireType, this.varint()];
    if (wireType === 1) {
      const v = this.buf.subarray(this.i, this.i + 8);
      this.i += 8;
      return [fieldNumber, wireType, v];
    }
    if (wireType === 2) {
      const len = this.varint();
      const v = this.buf.subarray(this.i, this.i + len);
      this.i += len;
      return [fieldNumber, wireType, v];
    }
    if (wireType === 5) {
      const v = this.buf.subarray(this.i, this.i + 4);
      this.i += 4;
      return [fieldNumber, wireType, v];
    }
    throw new Error(`unsupported wire type ${wireType}`);
  }
}

function decodeUtf8(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function fixed32(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getFloat32(0, true);
}

/**
 * Parse an Entur GTFS-RT VehiclePosition feed into flat vehicle records.
 * FeedMessage{ header=1, entity=2 } → entity{ id=1, vehicle=4 } — Entur puts
 * the standard VehiclePosition message in entity field 4. Inside it:
 * trip=1{trip_id=1, route_id=5}, position=2{lat=1, lon=2, bearing=3},
 * vehicle=8{id=1}, current_status=4, timestamp=5.
 * @param {ArrayBuffer} buffer
 * @returns {Array<{lat:number,lon:number,bearing:?number,routeId:?string,vehicleId:?string,status:?number}>}
 */
export function parseEnturVehiclePositions(buffer) {
  const root = new ProtoReader(new Uint8Array(buffer));
  const vehicles = [];
  while (!root.eof) {
    const [field, wire, value] = root.next();
    if (field !== 2 || wire !== 2) continue; // entity
    let lat = null;
    let lon = null;
    let bearing = null;
    let routeId = null;
    let vehicleId = null;
    let status = null;
    try {
      const entity = new ProtoReader(value);
      while (!entity.eof) {
        const [f1, w1, v1] = entity.next();
        if (f1 !== 4 || w1 !== 2) continue; // VehiclePosition
        const vp = new ProtoReader(v1);
        while (!vp.eof) {
          const [f2, w2, v2] = vp.next();
          if (f2 === 2 && w2 === 2) { // Position
            const pos = new ProtoReader(v2);
            while (!pos.eof) {
              const [f3, w3, v3] = pos.next();
              if (w3 === 5) {
                if (f3 === 1) lat = fixed32(v3);
                if (f3 === 2) lon = fixed32(v3);
                if (f3 === 3) bearing = fixed32(v3);
              }
            }
          } else if (f2 === 1 && w2 === 2) { // TripDescriptor
            const trip = new ProtoReader(v2);
            while (!trip.eof) {
              const [f3, w3, v3] = trip.next();
              if (f3 === 5 && w3 === 2) routeId = decodeUtf8(v3);
            }
          } else if (f2 === 8 && w2 === 2) { // VehicleDescriptor
            const vd = new ProtoReader(v2);
            while (!vd.eof) {
              const [f3, w3, v3] = vd.next();
              if (f3 === 1 && w3 === 2) vehicleId = decodeUtf8(v3);
            }
          } else if (f2 === 4 && w2 === 0) {
            status = v2;
          }
        }
      }
    } catch {
      // Malformed entity — skip it, keep the rest of the feed.
    }
    if (lat !== null && lon !== null) {
      vehicles.push({ lat, lon, bearing, routeId, vehicleId, status });
    }
  }
  return vehicles;
}

// ---------------------------------------------------------------------------
// Entur route-id → transportMode resolution (rail + metro only).
// ---------------------------------------------------------------------------

/**
 * Resolve unknown route ids to transport modes via one batched GraphQL query.
 * Results (including 'unknown' misses) are cached for the session.
 * @param {Iterable<string>} routeIds
 */
async function resolveEnturModes(routeIds) {
  const missing = [...new Set(routeIds)].filter((id) => id && !_modeByRoute.has(id));
  for (let i = 0; i < missing.length; i += MODE_LOOKUP_BATCH) {
    const batch = missing.slice(i, i + MODE_LOOKUP_BATCH);
    const idsLiteral = batch.map((id) => `"${id.replace(/["\\]/g, '')}"`).join(',');
    const query = `{ lines(ids: [${idsLiteral}]) { id transportMode } }`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(ENTUR_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ET-Client-Name': ENTUR_CLIENT_NAME,
        },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
      if (response.ok) {
        const body = await response.json();
        for (const line of body?.data?.lines || []) {
          _modeByRoute.set(line.id, String(line.transportMode || 'unknown'));
        }
      }
    } catch {
      // GraphQL unavailable — fall through, ids stay unresolved this round.
    } finally {
      clearTimeout(timer);
    }
  }
  for (const id of missing) {
    if (!_modeByRoute.has(id)) _modeByRoute.set(id, 'unknown');
  }
}

/**
 * Fetch + parse + mode-filter the Entur feed down to rail-class vehicles
 * inside the given viewport bbox (degrees).
 * @returns {Promise<Array<object>>}
 */
async function fetchEnturTrains(bbox) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let buffer;
  try {
    const response = await fetch(ENTUR_RT_URL, {
      headers: { 'ET-Client-Name': ENTUR_CLIENT_NAME },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Entur HTTP ${response.status}`);
    buffer = await response.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
  const all = parseEnturVehiclePositions(buffer);
  const inView = bbox
    ? all.filter((v) => v.lat >= bbox.south && v.lat <= bbox.north && v.lon >= bbox.west && v.lon <= bbox.east)
    : all;
  await resolveEnturModes(inView.map((v) => v.routeId));
  return inView.filter((v) => {
    const mode = _modeByRoute.get(v.routeId || '');
    return mode === 'rail' || mode === 'metro';
  });
}

// ---------------------------------------------------------------------------
// MBTA commuter rail (JSON, keyless).
// ---------------------------------------------------------------------------

async function fetchMbtaTrains(bbox) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(MBTA_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`MBTA HTTP ${response.status}`);
    const body = await response.json();
    const rows = Array.isArray(body?.data) ? body.data : [];
    return rows.map((row) => {
      const a = row?.attributes || {};
      return {
        lat: a.latitude,
        lon: a.longitude,
        bearing: Number.isFinite(a.bearing) ? a.bearing : null,
        speed: Number.isFinite(a.speed) ? a.speed : null,
        status: a.current_status || null,
        routeId: row?.relationships?.route?.data?.id || null,
        label: a.label || null,
        mode: 'rail',
        source: 'MBTA',
      };
    }).filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon)
      && (!bbox || (v.lat >= bbox.south && v.lat <= bbox.north && v.lon >= bbox.west && v.lon <= bbox.east)));
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Viewport + rendering.
// ---------------------------------------------------------------------------

/**
 * Current camera view rectangle as an expanded degrees bbox, or null.
 * @param {Cesium.Viewer} viewer
 */
function viewBbox(viewer) {
  try {
    const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
    if (!rect) return null;
    const south = Cesium.Math.toDegrees(rect.south);
    const north = Cesium.Math.toDegrees(rect.north);
    const west = Cesium.Math.toDegrees(rect.west);
    const east = Cesium.Math.toDegrees(rect.east);
    const latPad = Math.max((north - south) * 0.15, 0.05);
    const lonPad = Math.max((east - west) * 0.15, 0.05);
    return {
      south: Math.max(south - latPad, -90),
      north: Math.min(north + latPad, 90),
      west: Math.max(west - lonPad, -180),
      east: Math.min(east + lonPad, 180),
    };
  } catch {
    return null;
  }
}

function colorFor(vehicle) {
  return vehicle.mode === 'metro' ? COLOR_METRO : COLOR_RAIL;
}

function shortLineName(vehicle) {
  const id = vehicle.routeId || '';
  const tail = id.split(':').pop();
  return (vehicle.label || (tail && tail !== id ? `Line ${tail}` : id) || 'Train');
}

const STATUS_TEXT = {
  0: 'INCOMING_AT',
  1: 'STOPPED_AT',
  2: 'IN_TRANSIT_TO',
};

function inspectionHtml(vehicle) {
  const rows = [
    ['Line / Route', shortLineName(vehicle)],
    ['Mode', vehicle.mode === 'metro' ? 'Metro 🚇' : 'Train 🚆'],
    ['Source', vehicle.source === 'MBTA' ? 'MBTA (Boston)' : 'Entur (Norway)'],
  ];
  if (Number.isFinite(vehicle.bearing)) rows.push(['Bearing', `${Math.round(vehicle.bearing)}°`]);
  if (Number.isFinite(vehicle.speed)) rows.push(['Speed', `${vehicle.speed.toFixed(1)} mph`]);
  if (vehicle.status != null && STATUS_TEXT[vehicle.status]) rows.push(['Status', STATUS_TEXT[vehicle.status]]);
  if (vehicle.vehicleId) rows.push(['Vehicle', vehicle.vehicleId]);
  if (vehicle.routeId) rows.push(['Route ref', vehicle.routeId]);
  return `<table class="trains-info">${rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('')}</table>`;
}

function haversineKm(aLat, aLon, bLat, bLon) {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(s));
}

function pointHeight(vehicle) {
  const ground = _viewer.scene.globe.getHeight(
    Cesium.Cartographic.fromDegrees(vehicle.lon, vehicle.lat),
  ) || 0;
  return Math.max(ground, 0) + 30;
}

/**
 * Fly the camera alongside the train — flights-style view from behind,
 * heading aligned to the train's bearing when the feed provides one.
 */
function flyToVehicle(vehicle, duration) {
  if (!_viewer) return;
  const headingRad = Number.isFinite(vehicle.bearing) ? Cesium.Math.toRadians(vehicle.bearing) : 0;
  _viewer.camera.flyToBoundingSphere(
    new Cesium.BoundingSphere(
      Cesium.Cartesian3.fromDegrees(vehicle.lon, vehicle.lat, pointHeight(vehicle)),
      450,
    ),
    {
      offset: new Cesium.HeadingPitchRange(headingRad, Cesium.Math.toRadians(-32), FOLLOW_RANGE_M),
      duration,
    },
  );
}

function updateInfoBox() {
  if (!_viewer || !_selectedVehicle) return;
  const vehicle = _selectedVehicle;
  _viewer.selectedEntity = new Cesium.Entity({
    position: Cesium.Cartesian3.fromDegrees(vehicle.lon, vehicle.lat, pointHeight(vehicle)),
    name: `🚆 ${shortLineName(vehicle)}${vehicle.mode === 'metro' ? ' 🚇' : ''}`,
    description: inspectionHtml(vehicle),
  });
}

/** Enlarge + white-ring the selected point immediately (pre-next-poll feedback). */
function highlightSelectedPoint() {
  if (!_selectedKey) return;
  for (let i = 0; i < _pointCollection.length; i += 1) {
    const point = _pointCollection.get(i);
    if (point.id === _selectedKey) {
      point.pixelSize = 11;
      point.outlineColor = Cesium.Color.WHITE;
      point.outlineWidth = 2;
    }
  }
}

function selectVehicle(id) {
  const vehicle = _renderMap.get(id);
  if (!vehicle || !_viewer) return;
  _selectedKey = id;
  _selectedVehicle = vehicle;
  updateInfoBox();
  highlightSelectedPoint();
  flyToVehicle(vehicle, 1.6);
}

/** Stop following (empty click, layer disable, train lost between polls). */
function clearSelection() {
  _selectedKey = null;
  _selectedVehicle = null;
  if (_viewer && _viewer.selectedEntity) _viewer.selectedEntity = undefined;
}

function renderVehicles(vehicles) {
  // Re-lock onto the SAME physical train before rebuilding (nearest ≤2.5 km),
  // so the follow-cam survives point-id changes across polls.
  if (_selectedVehicle) {
    let bestIdx = -1;
    let bestKm = REACQUIRE_MAX_KM;
    for (let i = 0; i < vehicles.length && i < MAX_POINTS; i += 1) {
      const v = vehicles[i];
      const km = haversineKm(_selectedVehicle.lat, _selectedVehicle.lon, v.lat, v.lon);
      if (km <= bestKm) {
        bestKm = km;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) _selectedVehicle = vehicles[bestIdx];
    else clearSelection();
  }

  _pointCollection.removeAll();
  _renderMap.clear();
  let key = 0;
  for (const vehicle of vehicles) {
    if (_renderMap.size >= MAX_POINTS) break;
    const id = `train-${key}`;
    const isSelected = _selectedVehicle === vehicle;
    if (isSelected) _selectedKey = id;
    _pointCollection.add({
      id,
      position: Cesium.Cartesian3.fromDegrees(vehicle.lon, vehicle.lat, pointHeight(vehicle)),
      pixelSize: isSelected ? 11 : (vehicle.mode === 'metro' ? 6 : 7),
      color: colorFor(vehicle),
      outlineColor: isSelected ? Cesium.Color.WHITE : COLOR_OUTLINE,
      outlineWidth: isSelected ? 2 : 1,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    _renderMap.set(id, vehicle);
    key += 1;
  }
  _count = _renderMap.size;

  if (_selectedVehicle) {
    // Follow-cam: refresh info box + keep the camera alongside (flights jaisa).
    updateInfoBox();
    flyToVehicle(_selectedVehicle, 1.4);
  }
  governorRequestRender('trains:refresh');
}

function installClickHandler() {
  if (_clickHandler || !_viewer) return;
  _clickHandler = new Cesium.ScreenSpaceEventHandler(_viewer.scene.canvas);
  _clickHandler.setInputAction((movement) => {
    const picked = _viewer.scene.pick(movement.position);
    const id = picked?.id;
    if (typeof id === 'string' && _renderMap.has(id)) {
      selectVehicle(id);
    } else {
      // Train ke alawa kahin bhi click → follow release (dusri layer ko camera).
      clearSelection();
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// ---------------------------------------------------------------------------
// Poll cycle.
// ---------------------------------------------------------------------------

async function refresh() {
  if (!_enabled || !_viewer || _loading) return;
  const generation = ++_pollGeneration;
  _loading = true;
  _error = null;
  const bbox = viewBbox(_viewer);
  const [entur, mbta] = await Promise.allSettled([
    fetchEnturTrains(bbox),
    fetchMbtaTrains(bbox),
  ]);
  if (generation !== _pollGeneration || !_enabled) return; // stale cycle
  const trains = [];
  if (entur.status === 'fulfilled') {
    _sourceCounts.entur = entur.value.length;
    for (const v of entur.value) trains.push({ ...v, mode: _modeByRoute.get(v.routeId || '') === 'metro' ? 'metro' : 'rail', source: 'Entur' });
  } else {
    _sourceCounts.entur = 0;
  }
  if (mbta.status === 'fulfilled') {
    _sourceCounts.mbta = mbta.value.length;
    trains.push(...mbta.value);
  } else {
    _sourceCounts.mbta = 0;
  }
  if (entur.status === 'rejected' && mbta.status === 'rejected') {
    _error = 'Entur + MBTA dono feeds unreachable';
  }
  renderVehicles(trains);
  _lastUpdate = Date.now();
  _loading = false;
}

// ---------------------------------------------------------------------------
// Layer module (DataLayerManager contract).
// ---------------------------------------------------------------------------

const trainsLayer = {
  id: 'trains',
  name: 'Live Trains',
  icon: '🚆',
  source: 'Entur · MBTA',
  updateInterval: TRAIN_POLL_MS,

  init(viewer) {
    _viewer = viewer;
    _pointCollection = new Cesium.PointPrimitiveCollection({
      blendOption: Cesium.BlendOption.TRANSLUCENT,
    });
    viewer.scene.primitives.add(_pointCollection);
    registerSpriteCollection('trains', _pointCollection);
    _pointCollection.show = false;
    _enabled = false;
    _pollGeneration = 0;
    _count = 0;
    _lastUpdate = null;
    _error = null;
    _loading = false;
    _selectedKey = null;
    _selectedVehicle = null;
    _renderMap.clear();
    restoreSpriteOrder(viewer);
    console.log('[Data:Trains] Initialized (Entur Norway + MBTA Boston, keyless live)');
  },

  enable(viewer) {
    _enabled = true;
    _error = null;
    _pointCollection.show = true;
    installClickHandler(viewer);
    registerPickOwner('trains', (pickedId) => _renderMap.has(pickedId));
    restoreSpriteOrder(viewer);
    void refresh();
  },

  disable(viewer) {
    _enabled = false;
    _pollGeneration += 1;
    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
    unregisterPickOwner('trains');
    clearSelection();
    _pointCollection.removeAll();
    _renderMap.clear();
    _pointCollection.show = false;
    _count = 0;
    _loading = false;
  },

  async update() {
    await refresh();
  },

  getStats() {
    return {
      status: _error ? 'error' : _loading ? 'loading' : _lastUpdate ? 'ok' : 'idle',
      count: _count,
      lastUpdate: _lastUpdate,
      error: _error,
      sources: { ..._sourceCounts },
      following: Boolean(_selectedVehicle),
    };
  },

  destroy(viewer) {
    this.disable(viewer);
    if (_pointCollection && _viewer) {
      _viewer.scene.primitives.remove(_pointCollection);
      _pointCollection = null;
    }
  },
};

export default trainsLayer;
