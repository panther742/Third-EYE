import * as Cesium from 'cesium';
import { viewportBias, placesNearViewRecovery } from './annotations/annotationResolver.js';

/**
 * Points of Interest per city.
 * Each city has 5 POIs; the first is the default fly-to landmark.
 *
 * Field reference:
 *   alt     — RANGE (distance from target in meters), NOT absolute altitude
 *   heading — optimal camera heading in degrees (0=N, 90=E, 180=S, 270=W)
 *   pitch   — camera tilt in degrees (negative = looking down)
 *   buildingHeight — estimated height of landmark center above ground (meters)
 */
export const CITY_POIS = {
  austin: {
    name: 'Austin',
    groundElevation: 150, // meters above WGS84 ellipsoid
    viewBounds: { southwest: { lat: 30.10, lng: -97.95 }, northeast: { lat: 30.52, lng: -97.55 } },
    pois: [
      { name: 'Texas State Capitol', lat: 30.2747, lon: -97.7403, alt: 550, pitch: -28, heading: 180, buildingHeight: 35 },
      { name: 'Frost Bank Tower', lat: 30.2674, lon: -97.7434, alt: 550, pitch: -22, heading: 30, buildingHeight: 80 },
      { name: 'Pennybacker Bridge', lat: 30.3451, lon: -97.7951, alt: 500, pitch: -25, heading: 90, buildingHeight: 40 },
      { name: 'The Jenga Tower', lat: 30.2642, lon: -97.7500, alt: 500, pitch: -18, heading: 45, buildingHeight: 60 },
      { name: 'UT Tower', lat: 30.2862, lon: -97.7394, alt: 500, pitch: -22, heading: 180, buildingHeight: 50 },
    ],
  },
  sf: {
    name: 'San Francisco',
    groundElevation: 15,
    viewBounds: { southwest: { lat: 37.70, lng: -122.53 }, northeast: { lat: 37.84, lng: -122.35 } },
    pois: [
      { name: 'Golden Gate Bridge', lat: 37.8199, lon: -122.4783, alt: 1400, pitch: -20, heading: 45, buildingHeight: 100 },
      { name: 'Transamerica Pyramid', lat: 37.7952, lon: -122.4028, alt: 500, pitch: -25, heading: 30, buildingHeight: 85 },
      { name: 'Salesforce Tower', lat: 37.7897, lon: -122.3972, alt: 680, pitch: -25, heading: 330, buildingHeight: 100 },
      { name: 'Alcatraz Island', lat: 37.8267, lon: -122.4230, alt: 800, pitch: -30, heading: 0, buildingHeight: 20 },
      { name: 'Coit Tower', lat: 37.8024, lon: -122.4058, alt: 420, pitch: -30, heading: 45, buildingHeight: 30 },
    ],
  },
  nyc: {
    name: 'New York',
    groundElevation: 10,
    viewBounds: { southwest: { lat: 40.477, lng: -74.259 }, northeast: { lat: 40.918, lng: -73.700 } },
    pois: [
      { name: 'Statue of Liberty', lat: 40.6892, lon: -74.0445, alt: 450, pitch: -25, heading: 315, buildingHeight: 45 },
      {
        name: 'Empire State Building',
        lat: 40.7484,
        lon: -73.9857,
        alt: 850,
        pitch: -12,
        heading: 30,
        buildingHeight: 130,
        buildingBounds: { height: 443, width: 130, depth: 75 },
      },
      { name: 'One World Trade Center', lat: 40.7127, lon: -74.0134, alt: 850, pitch: -25, heading: 0, buildingHeight: 170 },
      { name: 'Brooklyn Bridge', lat: 40.7061, lon: -73.9969, alt: 850, pitch: -25, heading: 45, buildingHeight: 40 },
      { name: 'Chrysler Building', lat: 40.7516, lon: -73.9755, alt: 700, pitch: -20, heading: 225, buildingHeight: 100 },
    ],
  },
  tokyo: {
    name: 'Tokyo',
    groundElevation: 40,
    viewBounds: { southwest: { lat: 35.52, lng: 139.55 }, northeast: { lat: 35.90, lng: 139.92 } },
    pois: [
      { name: 'Tokyo Tower', lat: 35.6586, lon: 139.7454, alt: 850, pitch: -25, heading: 0, buildingHeight: 110 },
      { name: 'Tokyo Skytree', lat: 35.7101, lon: 139.8107, alt: 900, pitch: -25, heading: 30, buildingHeight: 200 },
      { name: 'Imperial Palace', lat: 35.6852, lon: 139.7528, alt: 900, pitch: -35, heading: 0, buildingHeight: 20 },
      { name: 'Senso-ji Temple', lat: 35.7148, lon: 139.7967, alt: 400, pitch: -30, heading: 180, buildingHeight: 25 },
      { name: 'Mode Gakuen Cocoon Tower', lat: 35.6929, lon: 139.6925, alt: 350, pitch: -20, heading: 30, buildingHeight: 70 },
    ],
  },
  london: {
    name: 'London',
    groundElevation: 15,
    viewBounds: { southwest: { lat: 51.28, lng: -0.51 }, northeast: { lat: 51.70, lng: 0.33 } },
    pois: [
      { name: 'Tower Bridge', lat: 51.5055, lon: -0.0754, alt: 400, pitch: -25, heading: 270, buildingHeight: 65 },
      { name: 'The Shard', lat: 51.5045, lon: -0.0865, alt: 850, pitch: -20, heading: 0, buildingHeight: 100 },
      { name: 'Big Ben / Parliament', lat: 51.5007, lon: -0.1246, alt: 600, pitch: -25, heading: 180, buildingHeight: 50 },
      { name: "St. Paul's Cathedral", lat: 51.5138, lon: -0.0984, alt: 400, pitch: -30, heading: 270, buildingHeight: 55 },
      { name: 'The Gherkin', lat: 51.5145, lon: -0.0803, alt: 350, pitch: -20, heading: 30, buildingHeight: 60 },
    ],
  },
  paris: {
    name: 'Paris',
    groundElevation: 35,
    viewBounds: { southwest: { lat: 48.815, lng: 2.224 }, northeast: { lat: 48.902, lng: 2.470 } },
    pois: [
      { name: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, alt: 750, pitch: -25, heading: 315, buildingHeight: 150 },
      { name: 'Arc de Triomphe', lat: 48.8738, lon: 2.2950, alt: 400, pitch: -28, heading: 45, buildingHeight: 25 },
      { name: 'Notre-Dame', lat: 48.8530, lon: 2.3499, alt: 400, pitch: -25, heading: 225, buildingHeight: 35 },
      { name: 'Sacré-Cœur', lat: 48.8867, lon: 2.3431, alt: 400, pitch: -30, heading: 180, buildingHeight: 40 },
      { name: 'Louvre Pyramid', lat: 48.8606, lon: 2.3376, alt: 500, pitch: -35, heading: 0, buildingHeight: 10 },
    ],
  },
  dubai: {
    name: 'Dubai',
    groundElevation: 5,
    viewBounds: { southwest: { lat: 24.95, lng: 54.90 }, northeast: { lat: 25.35, lng: 55.55 } },
    pois: [
      { name: 'Burj Khalifa', lat: 25.1972, lon: 55.2744, alt: 600, pitch: -20, heading: 200, buildingHeight: 270 },
      { name: 'Burj Al Arab', lat: 25.1412, lon: 55.1853, alt: 500, pitch: -25, heading: 90, buildingHeight: 100 },
      { name: 'Palm Jumeirah', lat: 25.1124, lon: 55.1390, alt: 1200, pitch: -40, heading: 0, buildingHeight: 20 },
      { name: 'Dubai Frame', lat: 25.2350, lon: 55.3003, alt: 400, pitch: -25, heading: 270, buildingHeight: 75 },
      { name: 'Museum of the Future', lat: 25.2197, lon: 55.2806, alt: 350, pitch: -20, heading: 30, buildingHeight: 35 },
    ],
  },
  dc: {
    name: 'Washington DC',
    groundElevation: 10,
    viewBounds: { southwest: { lat: 38.79, lng: -77.12 }, northeast: { lat: 38.995, lng: -76.91 } },
    pois: [
      { name: 'US Capitol', lat: 38.8897, lon: -77.0091, alt: 550, pitch: -25, heading: 270, buildingHeight: 45 },
      { name: 'Washington Monument', lat: 38.8895, lon: -77.0353, alt: 500, pitch: -30, heading: 0, buildingHeight: 85 },
      { name: 'Lincoln Memorial', lat: 38.8893, lon: -77.0502, alt: 400, pitch: -25, heading: 90, buildingHeight: 20 },
      { name: 'Pentagon', lat: 38.8711, lon: -77.0559, alt: 800, pitch: -40, heading: 0, buildingHeight: 20 },
      { name: 'Jefferson Memorial', lat: 38.8814, lon: -77.0365, alt: 400, pitch: -30, heading: 0, buildingHeight: 25 },
    ],
  },

  // ── INDIA (local addition) ─────────────────────────────────────────────
  surat: {
    name: 'Surat',
    groundElevation: 10,
    viewBounds: { southwest: { lat: 21.05, lng: 72.70 }, northeast: { lat: 21.30, lng: 72.98 } },
    pois: [
      { name: 'Tapi Riverfront', lat: 21.1702, lon: 72.8311, alt: 900, pitch: -30, heading: 20, buildingHeight: 40 },
      { name: 'Dumas Beach', lat: 21.0914, lon: 72.7078, alt: 900, pitch: -28, heading: 220, buildingHeight: 10 },
      { name: 'Surat Airport', lat: 21.1142, lon: 72.7418, alt: 900, pitch: -28, heading: 60, buildingHeight: 15 },
      { name: 'Dutch Garden', lat: 21.1959, lon: 72.8333, alt: 500, pitch: -30, heading: 0, buildingHeight: 12 },
      { name: 'Statue of Unity', lat: 21.8380, lon: 73.7192, alt: 1600, pitch: -25, heading: 130, buildingHeight: 180 },
    ],
  },
  mumbai: {
    name: 'Mumbai',
    groundElevation: 10,
    viewBounds: { southwest: { lat: 18.85, lng: 72.75 }, northeast: { lat: 19.20, lng: 73.00 } },
    pois: [
      { name: 'Gateway of India', lat: 18.9220, lon: 72.8347, alt: 700, pitch: -28, heading: 350, buildingHeight: 30 },
      { name: 'Marine Drive', lat: 18.9440, lon: 72.8230, alt: 1000, pitch: -30, heading: 20, buildingHeight: 40 },
      { name: 'Bandra-Worli Sea Link', lat: 19.0303, lon: 72.8185, alt: 1100, pitch: -30, heading: 340, buildingHeight: 0 },
      { name: 'CSMT Station', lat: 18.9400, lon: 72.8353, alt: 600, pitch: -28, heading: 250, buildingHeight: 40 },
      { name: 'Juhu Beach', lat: 19.0990, lon: 72.8265, alt: 1000, pitch: -28, heading: 270, buildingHeight: 10 },
    ],
  },
  delhi: {
    name: 'Delhi',
    groundElevation: 220,
    viewBounds: { southwest: { lat: 28.40, lng: 76.95 }, northeast: { lat: 28.88, lng: 77.42 } },
    pois: [
      { name: 'India Gate', lat: 28.6129, lon: 77.2295, alt: 800, pitch: -28, heading: 0, buildingHeight: 40 },
      { name: 'Red Fort', lat: 28.6562, lon: 77.2410, alt: 900, pitch: -28, heading: 90, buildingHeight: 30 },
      { name: 'Rashtrapati Bhavan', lat: 28.6144, lon: 77.1996, alt: 1000, pitch: -25, heading: 180, buildingHeight: 45 },
      { name: 'Qutub Minar', lat: 28.5245, lon: 77.1855, alt: 700, pitch: -25, heading: 45, buildingHeight: 73 },
      { name: 'IGI Airport T3', lat: 28.5562, lon: 77.1000, alt: 1000, pitch: -28, heading: 80, buildingHeight: 25 },
    ],
  },
  ahmedabad: {
    name: 'Ahmedabad',
    groundElevation: 55,
    viewBounds: { southwest: { lat: 22.90, lng: 72.40 }, northeast: { lat: 23.15, lng: 72.75 } },
    pois: [
      { name: 'Atal Bridge', lat: 23.0256, lon: 72.5777, alt: 550, pitch: -28, heading: 60, buildingHeight: 0 },
      { name: 'Sabarmati Riverfront', lat: 23.0225, lon: 72.5714, alt: 900, pitch: -30, heading: 15, buildingHeight: 25 },
      { name: 'Narendra Modi Stadium', lat: 23.0324, lon: 72.5855, alt: 900, pitch: -25, heading: 0, buildingHeight: 0 },
      { name: 'Sabarmati Ashram', lat: 23.0382, lon: 72.5786, alt: 500, pitch: -28, heading: 200, buildingHeight: 12 },
    ],
  },
  bengaluru: {
    name: 'Bengaluru',
    groundElevation: 920,
    viewBounds: { southwest: { lat: 12.83, lng: 77.40 }, northeast: { lat: 13.15, lng: 77.80 } },
    pois: [
      { name: 'Vidhana Soudha', lat: 12.9794, lon: 77.5912, alt: 700, pitch: -28, heading: 180, buildingHeight: 45 },
      { name: 'Chinnaswamy Stadium', lat: 12.9788, lon: 77.5996, alt: 800, pitch: -25, heading: 90, buildingHeight: 0 },
      { name: 'Lalbagh Glass House', lat: 12.9507, lon: 77.5848, alt: 700, pitch: -28, heading: 0, buildingHeight: 20 },
      { name: 'Electronic City Flyover', lat: 12.8452, lon: 77.6602, alt: 900, pitch: -30, heading: 350, buildingHeight: 0 },
    ],
  },
  hyderabad: {
    name: 'Hyderabad',
    groundElevation: 540,
    viewBounds: { southwest: { lat: 17.25, lng: 78.30 }, northeast: { lat: 17.60, lng: 78.65 } },
    pois: [
      { name: 'Charminar', lat: 17.3616, lon: 78.4747, alt: 600, pitch: -26, heading: 315, buildingHeight: 50 },
      { name: 'Hussain Sagar Buddha', lat: 17.4239, lon: 78.4685, alt: 800, pitch: -28, heading: 0, buildingHeight: 20 },
      { name: 'Golconda Fort', lat: 17.3833, lon: 78.4011, alt: 1000, pitch: -28, heading: 100, buildingHeight: 0 },
    ],
  },
  chennai: {
    name: 'Chennai',
    groundElevation: 15,
    viewBounds: { southwest: { lat: 12.90, lng: 80.15 }, northeast: { lat: 13.25, lng: 80.35 } },
    pois: [
      { name: 'Marina Beach', lat: 13.0552, lon: 80.2824, alt: 1100, pitch: -28, heading: 300, buildingHeight: 10 },
      { name: 'Fort St George', lat: 13.0792, lon: 80.2867, alt: 600, pitch: -28, heading: 0, buildingHeight: 20 },
      { name: 'Chennai Central', lat: 13.0827, lon: 80.2757, alt: 600, pitch: -28, heading: 270, buildingHeight: 35 },
    ],
  },
  kolkata: {
    name: 'Kolkata',
    groundElevation: 15,
    viewBounds: { southwest: { lat: 22.40, lng: 88.20 }, northeast: { lat: 22.70, lng: 88.50 } },
    pois: [
      { name: 'Howrah Bridge', lat: 22.5851, lon: 88.3468, alt: 700, pitch: -26, heading: 250, buildingHeight: 0 },
      { name: 'Victoria Memorial', lat: 22.5448, lon: 88.3426, alt: 700, pitch: -28, heading: 0, buildingHeight: 30 },
      { name: 'Eden Gardens', lat: 22.5646, lon: 88.3432, alt: 800, pitch: -25, heading: 340, buildingHeight: 0 },
    ],
  },
  jaipur: {
    name: 'Jaipur',
    groundElevation: 430,
    viewBounds: { southwest: { lat: 26.80, lng: 75.70 }, northeast: { lat: 27.05, lng: 75.95 } },
    pois: [
      { name: 'Hawa Mahal', lat: 26.9239, lon: 75.8267, alt: 550, pitch: -26, heading: 90, buildingHeight: 15 },
      { name: 'Amber Fort', lat: 26.9855, lon: 75.8513, alt: 1000, pitch: -28, heading: 200, buildingHeight: 0 },
      { name: 'Jal Mahal', lat: 26.9535, lon: 75.8462, alt: 800, pitch: -28, heading: 180, buildingHeight: 0 },
    ],
  },
  agra: {
    name: 'Agra',
    groundElevation: 170,
    viewBounds: { southwest: { lat: 27.05, lng: 77.95 }, northeast: { lat: 27.30, lng: 78.15 } },
    pois: [
      { name: 'Taj Mahal', lat: 27.1751, lon: 78.0421, alt: 900, pitch: -26, heading: 320, buildingHeight: 73 },
      { name: 'Agra Fort', lat: 27.1796, lon: 78.0211, alt: 900, pitch: -28, heading: 80, buildingHeight: 25 },
      { name: 'Mehtab Bagh', lat: 27.1731, lon: 78.0270, alt: 600, pitch: -24, heading: 90, buildingHeight: 0 },
    ],
  },
};

/**
 * Absolute full-earth camera preset for the zoom_to_globe voice tool. The height
 * must stay inside the app's 'global' view-scale band (>12,000 km — classifyViewScale
 * in gevActions.js) so downstream context/screenshot policy treats it as a globe view,
 * and under the fly_to_location rangeM ceiling (20,000 km).
 */
export const GLOBE_VIEW = Object.freeze({
  heightM: 18000000,
  pitchDeg: -90,
  durationS: 2.8,
});

/**
 * Fly straight out to the full-earth globe view, keeping the current sub-camera
 * point centered so the user's continent stays in front of them.
 * @param {Cesium.Viewer} viewer
 * @param {{duration?: number, onComplete?: Function, onCancel?: Function}} options
 * @returns {{latitude: number, longitude: number, heightM: number}}
 */
export function flyToGlobeView(viewer, options = {}) {
  const carto = viewer.camera.positionCartographic;
  const longitude = Cesium.Math.toDegrees(carto.longitude);
  const latitude = Cesium.Math.toDegrees(carto.latitude);
  viewer.camera.cancelFlight();
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, GLOBE_VIEW.heightM),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(GLOBE_VIEW.pitchDeg),
      roll: 0,
    },
    duration: finitePositive(options.duration) || GLOBE_VIEW.durationS,
    endTransform: Cesium.Matrix4.IDENTITY,
    // Cesium's Camera.flyTo reads `complete`/`cancel`. `onComplete`/`onCancel`
    // are this module's OWN option names and are silently ignored by Cesium —
    // spelling them through to flyTo meant the reset never resolved on the
    // flight's own events and every caller fell back to its watchdog timeout.
    complete: options.onComplete,
    cancel: options.onCancel,
  });
  return { latitude, longitude, heightM: GLOBE_VIEW.heightM };
}

/**
 * Flat list of locations for backward compatibility.
 */
export const LOCATIONS = Object.entries(CITY_POIS).map(([id, city]) => ({
  id,
  name: city.name,
  lat: city.pois[0].lat,
  lon: city.pois[0].lon,
}));

/**
 * Fly the camera to a landmark using lookAt-based targeting.
 * Guarantees the target is centered in viewport via flyToBoundingSphere + lookAt.
 *
 * @param {Cesium.Viewer} viewer
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {object} options
 * @param {number} options.range - Distance from target in meters (default 500)
 * @param {number} options.pitch - Camera tilt in degrees, negative = down (default -30)
 * @param {number} options.heading - Camera heading in degrees (default 0)
 * @param {number} options.buildingHeight - Estimated landmark center height above ground (default 30)
 * @param {number} options.groundElevation - Fallback ground elevation when terrain isn't loaded (default 0)
 * @param {number} options.duration - Flight duration in seconds (default 3.0)
 * @returns {{ targetPosition: Cesium.Cartesian3 }} The computed target for orbit use
 */
export function flyToLandmark(viewer, lat, lon, options = {}) {
  const {
    range = 500,
    pitch = -30,
    heading = 0,
    buildingHeight = 30,
    groundElevation = 0,
    duration = 3.0,
    onStart = null,
    onComplete = null,
    onCancel = null,
    buildingBounds = null,
  } = options;

  // Sample terrain height (sync — uses loaded tiles; 0 if globe/terrain not ready)
  const targetCartographic = Cesium.Cartographic.fromDegrees(lon, lat);
  const sampledHeight = viewer.scene.globe?.getHeight(targetCartographic);

  // Use sampled height if available, otherwise fall back to pre-baked city ground elevation.
  // Google 3D Tiles don't populate globe terrain, so first fly-to always gets the fallback.
  const terrainHeight = (sampledHeight != null && sampledHeight > 0) ? sampledHeight : groundElevation;

  const bounds = normalizeBuildingBounds(buildingBounds);
  const targetHeight = bounds ? terrainHeight + bounds.height / 2 : terrainHeight + buildingHeight;
  const targetPosition = Cesium.Cartesian3.fromDegrees(lon, lat, targetHeight);
  const boundingRadius = bounds ? buildingBoundingRadius(bounds) : 0;
  const framingRange = bounds
    ? Math.max(rangeForBoundingSphere(viewer, boundingRadius), boundingRadius * 1.35)
    : range;

  const hpr = new Cesium.HeadingPitchRange(
    Cesium.Math.toRadians(heading),
    Cesium.Math.toRadians(pitch),
    framingRange
  );

  if (typeof onStart === 'function') {
    try { onStart(); } catch { /* no-op */ }
  }

  // Fly to target, then lock with lookAt for guaranteed centering
  viewer.camera.flyToBoundingSphere(
    new Cesium.BoundingSphere(targetPosition, boundingRadius),
    {
      offset: hpr,
      duration,
      complete: () => {
        viewer.camera.lookAt(targetPosition, hpr);
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        if (typeof onComplete === 'function') {
          try { onComplete(); } catch { /* no-op */ }
        }
      },
      cancel: () => {
        if (typeof onCancel === 'function') {
          try { onCancel(); } catch { /* no-op */ }
        }
      },
    }
  );

  return {
    targetPosition,
    boundingRadius,
    range: framingRange,
    buildingBounds: bounds,
  };
}

/**
 * Fly to a preset location by ID (uses the first POI as default).
 * Returns target position for orbit controller.
 */
export function flyToPresetLocation(viewer, locationId, options = {}) {
  const city = CITY_POIS[locationId];
  if (!city) return null;
  if (options.viewMode === 'overview' && !finitePositive(options.range) && city.viewBounds) {
    return flyToViewportBounds(viewer, city.viewBounds, {
      duration: options.duration,
      onStart: options.onStart,
      onComplete: options.onComplete,
      onCancel: options.onCancel,
      navigationMode: 'city-overview',
    });
  }
  const poi = city.pois[0];
  return flyToLandmark(viewer, poi.lat, poi.lon, {
    range: poi.alt,
    pitch: poi.pitch,
    heading: poi.heading || 0,
    buildingHeight: poi.buildingHeight || 30,
    buildingBounds: poi.buildingBounds || null,
    groundElevation: city.groundElevation || 0,
    ...options,
  });
}

/**
 * Fly to a specific POI within a city.
 * Returns target position for orbit controller.
 */
export function flyToPOI(viewer, cityId, poiIndex, options = {}) {
  const city = CITY_POIS[cityId];
  if (!city || !city.pois[poiIndex]) return null;
  const poi = city.pois[poiIndex];
  return flyToLandmark(viewer, poi.lat, poi.lon, {
    range: poi.alt,
    pitch: poi.pitch,
    heading: poi.heading || 0,
    buildingHeight: poi.buildingHeight || 30,
    buildingBounds: poi.buildingBounds || null,
    groundElevation: city.groundElevation || 0,
    ...options,
  });
}

const POI_STOPWORDS = new Set(['the', 'a', 'an', 'at', 'of', 'in', 'on', 'to']);
/** Significant lowercased word set of a name (punctuation stripped, stopwords dropped). */
function poiNameTokens(s) {
  return new Set(
    String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter((w) => w && !POI_STOPWORDS.has(w)),
  );
}

/**
 * Find a curated preset POI whose name the query fully names, so a voice "fly to the Texas State
 * Capitol" reuses its hand-tuned camera pose (same framing as the LOCATIONS-panel button) instead
 * of generic geocode framing. Match is order-free word-set CONTAINMENT (the POI name's words must
 * all appear in the query — so "Frost Bank Tower" matches "frost tower bank", and extra words like
 * a trailing city are fine), and the POI name must be ≥2 words so a single shared token ("Texas",
 * "Tower") can't grab the wrong landmark. Returns { cityId, index } or null.
 * @param {string} query
 * @returns {{cityId: string, index: number} | null}
 */
export function findPoiByName(query) {
  const q = poiNameTokens(query);
  if (q.size === 0) return null;
  let best = null;
  for (const [cityId, city] of Object.entries(CITY_POIS)) {
    city.pois.forEach((poi, index) => {
      const name = poiNameTokens(poi.name);
      if (name.size < 2) return; // single-word POI names are too ambiguous to match loosely
      const fullyNamed = [...name].every((w) => q.has(w));
      if (fullyNamed && (!best || name.size > best.size)) best = { cityId, index, size: name.size };
    });
  }
  return best ? { cityId: best.cityId, index: best.index } : null;
}

/** Distinguishes an authority veto from a genuine not-found result. */
export const CANCELLED_SEARCH = Object.freeze({ cancelled: true });

/**
 * Offline gazetteer — name → [lat, lon] for ~150 world cities (India-heavy).
 * Last-resort fallback so the LOCATION box still flies somewhere useful when
 * BOTH the geocode proxy and Nominatim are unreachable (air-gapped preview,
 * captive portal). Never fakes precision — city-scale only, label = name.
 */
const OFFLINE_PLACES = Object.freeze([
  // India
  ['surat', 21.1702, 72.8311], ['ahmedabad', 23.0225, 72.5714], ['vadodara', 22.3072, 73.1812],
  ['rajkot', 22.3039, 70.8022], ['bhavnagar', 21.7645, 72.1519], ['jamnagar', 22.4707, 70.0577],
  ['gandhinagar', 23.2156, 72.6369], ['mumbai', 19.076, 72.8777], ['delhi', 28.6139, 77.209],
  ['new delhi', 28.6139, 77.209], ['bengaluru', 12.9716, 77.5946], ['bangalore', 12.9716, 77.5946],
  ['hyderabad', 17.385, 78.4867], ['chennai', 13.0827, 80.2707], ['kolkata', 22.5726, 88.3639],
  ['pune', 18.5204, 73.8567], ['jaipur', 26.9124, 75.7873], ['lucknow', 26.8467, 80.9462],
  ['varanasi', 25.3176, 82.9739], ['amritsar', 31.634, 74.8723], ['chandigarh', 30.7333, 76.7794],
  ['bhopal', 23.2599, 77.4126], ['indore', 22.7196, 75.8577], ['nagpur', 21.1458, 79.0882],
  ['patna', 25.5941, 85.1376], ['guwahati', 26.1445, 91.7362], ['bhubaneswar', 20.2961, 85.8245],
  ['kochi', 9.9312, 76.2673], ['kerala', 10.8505, 76.2711], ['trivandrum', 8.5241, 76.9366],
  ['mangalore', 12.9141, 74.856], ['goa', 15.2993, 74.124], ['panaji', 15.4909, 73.8278],
  ['udaipur', 24.5854, 73.7125], ['jodhpur', 26.2389, 73.0243], ['agra', 27.1767, 78.0081],
  ['shimla', 31.1048, 77.1734], ['srinagar', 34.0837, 74.7973], ['jammu', 32.7266, 74.857],
  ['kanpur', 26.4499, 80.3319], ['noida', 28.5355, 77.391], ['gurgaon', 28.4595, 77.0266],
  ['rishikesh', 30.0869, 78.2676], ['haridwar', 29.9457, 78.1642], ['allahabad', 25.4358, 81.8463],
  ['prayagraj', 25.4358, 81.8463], ['gaya', 24.7914, 85.0002], ['bodh gaya', 24.6961, 84.9911],
  ['dwarka', 22.2394, 68.9678], ['somnath', 20.888, 70.4012], ['golden temple', 31.62, 74.8765],
  // Asia-Pacific
  ['dubai', 25.2048, 55.2708], ['abu dhabi', 24.4539, 54.3773], ['doha', 25.2854, 51.531],
  ['riyadh', 24.7136, 46.6753], ['karachi', 24.8607, 67.0011], ['lahore', 31.5204, 74.3587],
  ['islamabad', 33.6844, 73.0479], ['dhaka', 23.8103, 90.4125], ['kathmandu', 27.7172, 85.324],
  ['colombo', 6.9271, 79.8612], ['bangkok', 13.7563, 100.5018], ['singapore', 1.3521, 103.8198],
  ['kuala lumpur', 3.139, 101.6869], ['jakarta', -6.2088, 106.8456], ['manila', 14.5995, 120.9842],
  ['hong kong', 22.3193, 114.1694], ['shanghai', 31.2304, 121.4737], ['beijing', 39.9042, 116.4074],
  ['shenzhen', 22.5431, 114.0579], ['tokyo', 35.6762, 139.6503], ['osaka', 34.6937, 135.5023],
  ['seoul', 37.5665, 126.978], ['taipei', 25.033, 121.5654], ['hanoi', 21.0278, 105.8342],
  ['sydney', -33.8688, 151.2093], ['melbourne', -37.8136, 144.9631], ['auckland', -36.8485, 174.7633],
  // Europe
  ['london', 51.5074, -0.1278], ['paris', 48.8566, 2.3522], ['berlin', 52.52, 13.405],
  ['rome', 41.9028, 12.4964], ['madrid', 40.4168, -3.7038], ['barcelona', 41.3874, 2.1686],
  ['lisbon', 38.7223, -9.1393], ['amsterdam', 52.3676, 4.9041], ['brussels', 50.8503, 4.3517],
  ['vienna', 48.2082, 16.3738], ['prague', 50.0755, 14.4378], ['warsaw', 52.2297, 21.0122],
  ['stockholm', 59.3293, 18.0686], ['oslo', 59.9139, 10.7522], ['copenhagen', 55.6761, 12.5683],
  ['helsinki', 60.1699, 24.9384], ['dublin', 53.3498, -6.2603], ['edinburgh', 55.9533, -3.1883],
  ['moscow', 55.7558, 37.6173], ['istanbul', 41.0082, 28.9784], ['athens', 37.9838, 23.7275],
  ['budapest', 47.4979, 19.0402], ['zurich', 47.3769, 8.5417], ['geneva', 46.2044, 6.1432],
  ['milan', 45.4642, 9.19], ['venice', 45.4408, 12.3155], ['frankfurt', 50.1109, 8.6821],
  ['munich', 48.1351, 11.582], ['kyiv', 50.4501, 30.5234],
  // Americas
  ['new york', 40.7128, -74.006], ['los angeles', 34.0522, -118.2437], ['chicago', 41.8781, -87.6298],
  ['san francisco', 37.7749, -122.4194], ['seattle', 47.6062, -122.3321], ['boston', 42.3601, -71.0589],
  ['washington', 38.9072, -77.0369], ['miami', 25.7617, -80.1918], ['houston', 29.7604, -95.3698],
  ['las vegas', 36.1699, -115.1398], ['toronto', 43.6532, -79.3832], ['vancouver', 49.2827, -123.1207],
  ['montreal', 45.5017, -73.5673], ['mexico city', 19.4326, -99.1332], ['rio de janeiro', -22.9068, -43.1729],
  ['sao paulo', -23.5505, -46.6333], ['buenos aires', -34.6037, -58.3816], ['santiago', -33.4489, -70.6693],
  ['lima', -12.0464, -77.0428], ['bogota', 4.711, -74.0721],
  // Africa & Middle East
  ['cairo', 30.0444, 31.2357], ['lagos', 6.5244, 3.3792], ['nairobi', -1.2921, 36.8219],
  ['johannesburg', -26.2041, 28.0473], ['cape town', -33.9249, 18.4241], ['casablanca', 33.5731, -7.5898],
  ['addis ababa', 9.03, 38.74], ['tel aviv', 32.0853, 34.7818], ['jerusalem', 31.7683, 35.2137],
  ['muscat', 23.588, 58.3829], ['kuwait city', 29.3759, 47.9774],
]);

/**
 * Normalize a query for gazetteer matching: lowercase + collapse spaces.
 * @param {string} s
 */
function gazetteerKey(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Offline lookup: exact → prefix → substring. Returns a Nominatim-shaped hit
 * or null so the downstream fly logic stays identical.
 * @param {string} query
 */
function offlineGazetteerHit(query) {
  const key = gazetteerKey(query);
  if (!key) return null;
  let partial = null;
  for (const [name, lat, lon] of OFFLINE_PLACES) {
    if (name === key) return { lat: String(lat), lon: String(lon), display_name: name, boundingbox: null };
    if (partial === null && (name.startsWith(key) || name.includes(` ${key}`) || key.includes(name))) {
      partial = [name, lat, lon];
    }
  }
  if (partial) return { lat: String(partial[1]), lon: String(partial[2]), display_name: partial[0], boundingbox: null };
  return null;
}

/**
 * Geocode a place name using Google Geocoding API, then fly there at a scale
 * appropriate to the request. Countries and cities use their viewport by
 * default; precise landmarks/buildings use close landmark framing.
 */
/**
 * LIVE-DEFAULTS (local patch): keyless world search via OpenStreetMap Nominatim.
 * Runs whenever no Google Maps key is configured, so the location search box
 * keeps resolving "Surat", "Charminar", "Tokyo" — any name — without a key.
 * Small footprints fly like landmarks; wider ones frame the area bbox.
 */
async function searchAndFlyToKeyless(viewer, query, options = {}) {
  const beforeFly = typeof options.beforeFly === 'function' ? options.beforeFly : null;
  const mayFly = () => beforeFly === null || beforeFly() !== false;
  const duration = finitePositive(options.duration) || 3.0;

  let hit = null;
  // Tier 1: same-origin geocode proxy (vite dev + Vercel function). Works
  // everywhere the app is served from — including sandboxed/embedded previews
  // whose iframes cannot reach nominatim.openstreetmap.org directly.
  try {
    const response = await fetch('/api/geocode?q=' + encodeURIComponent(query), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(9000),
    });
    if (response.ok) {
      const body = await response.json();
      const first = Array.isArray(body?.results) ? body.results[0] : null;
      if (first) {
        hit = {
          lat: String(first.lat),
          lon: String(first.lon),
          display_name: first.label || query,
          boundingbox: Array.isArray(first.bbox) ? first.bbox.map(String) : null,
        };
      }
    }
  } catch { /* proxy unavailable — next tier */ }
  // Tier 2: direct browser → Nominatim (pure-static hosting without functions).
  if (!hit) {
    try {
      const response = await fetch(
        'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q='
        + encodeURIComponent(query),
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
      );
      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows) && rows.length) hit = rows[0];
      }
    } catch { /* network failure — fall through to offline */ }
  }
  // Tier 3: built-in offline gazetteer — a name always flies somewhere real.
  if (!hit) hit = offlineGazetteerHit(query);
  if (!hit) return null;

  const lat = parseFloat(hit.lat);
  const lng = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const label = String(hit.display_name || query).split(',').slice(0, 3).join(',').trim();

  // Nominatim boundingbox is [south, north, west, east] in degrees.
  const bb = Array.isArray(hit.boundingbox) ? hit.boundingbox.map(Number) : [];
  const spanDeg = bb.length === 4 && bb.every(Number.isFinite)
    ? Math.max(bb[1] - bb[0], bb[3] - bb[2])
    : (bb.length === 0 ? 0.12 : 0.02); // offline gazetteer hit → city scale
  const spanM = spanDeg * 111320;

  if (!mayFly()) return CANCELLED_SEARCH;

  if (spanM <= 900 || options.forceClose) {
    const range = finitePositive(options.range) || 900;
    const flight = flyToLandmark(viewer, lat, lng, {
      range,
      pitch: -32,
      heading: 30,
      buildingHeight: 30,
      duration,
      onStart: options.onStart,
      onComplete: options.onComplete,
      onCancel: options.onCancel,
    });
    return { label, navigationMode: 'precise-place', rangeM: Math.round(flight.range) };
  }

  // Area framing: camera height from the bbox so "Surat" lands at city scale
  // and "India" at country scale — the same intent as the Google viewport path.
  const heightM = Math.min(Math.max(spanM * 1.7, 1400), 13000000);
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lng, lat, heightM),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-38), roll: 0 },
    duration,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    onComplete: options.onComplete,
    onCancel: options.onCancel,
  });
  return {
    label,
    navigationMode: spanM > 900000 ? 'region-overview' : 'city-overview',
    rangeM: Math.round(heightM),
  };
}

export async function searchAndFlyTo(viewer, query, options = {}) {
  const apiKey = window.__GOOGLE_MAPS_API_KEY__ || import.meta.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return searchAndFlyToKeyless(viewer, query, options);

  const beforeFly = typeof options.beforeFly === 'function' ? options.beforeFly : null;
  const mayFly = () => beforeFly === null || beforeFly() !== false;

  // Viewport-biased geocode — the same bias annotationResolver's geocodePlace uses:
  // "Sixth Street" spoken over Austin must prefer the Sixth Street on screen, not a
  // same-named road in another city (or the wrong end of town — the W 6th vs E 6th bug).
  let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
  const bias = viewportBias(viewer);
  if (bias) url += `&bounds=${bias}`;
  const response = await fetch(url);
  const data = await response.json();

  const result = (data.status === 'OK' && data.results?.length) ? data.results[0] : null;
  let lat = result?.geometry.location.lat;
  let lng = result?.geometry.location.lng;
  let label = result ? result.formatted_address : null;
  let types = result?.types || [];
  let viewport = result ? (result.geometry.bounds || result.geometry.viewport) : null;

  // Places-near-view recovery (annotationResolver's twin): a missed geocode, or one
  // that landed implausibly far from the view centre, snaps back to a view-biased
  // Places hit within the trust bound — "the Capitol" means the one on screen.
  const recovered = await placesNearViewRecovery(viewer, query, result ? { lat, lon: lng } : null);
  if (recovered) {
    lat = recovered.lat;
    lng = recovered.lon;
    label = recovered.label || label || query;
    types = recovered.types || [];
    viewport = placesViewportToBounds(recovered.viewport) || viewport;
  } else if (!result) {
    return null;
  }

  const requestedRange = finitePositive(options.range);
  const duration = finitePositive(options.duration) || 3.0;
  const navigationMode = geocodeNavigationMode(types);

  const explicitOverview = options.viewMode === 'overview';

  // Frame the geocode viewport for area-like modes — and for an EXPLICIT overview ask
  // ("give me an overview of X"), which previously fell through to building range.
  if (!requestedRange && !options.forceClose
      && (shouldFrameGeocodeViewport(navigationMode) || explicitOverview)) {
    // Natural regions (mountain ranges, deserts, seas) geocode as area-overview with
    // enormous viewports — fitting the whole box flies the camera to space (owner field
    // test 2026-07-23, "Rocky Mountains"). Frame a capped oblique swath over the center
    // instead. Countries/states (region-overview) intentionally keep whole-place framing.
    const swath = navigationMode === 'area-overview' ? regionFramingPlan(viewport) : null;
    if (swath?.mode === 'swath') {
      if (!mayFly()) return CANCELLED_SEARCH;
      flyToLandmark(viewer, swath.centerLat, swath.centerLng, {
        range: swath.rangeM,
        pitch: swath.pitchDeg,
        heading: swath.headingDeg,
        buildingHeight: 0,
        duration,
        onStart: options.onStart,
        onComplete: options.onComplete,
        onCancel: options.onCancel,
      });
      return {
        label,
        navigationMode: 'natural-region-swath',
        rangeM: swath.rangeM,
      };
    }
    // An administrative geocode can carry a viewport far larger than the place
    // anyone means — "Tokyo" is the PREFECTURE, which owns islands ~1,000 km out,
    // and framing that whole box landed the camera in the open Pacific at 2,885 km.
    // A box that is both bigger than any city and not centred on its own geocoded
    // location falls back to a metro box on that location. Everything else — every
    // city, every state, every country, parks and streets — frames untouched.
    //
    // EXCEPT when the caller asked for an overview outright ("show me an overview
    // of Hawaii", voice `viewMode: 'overview'` — gevActions.js). That is an explicit
    // request for the whole administrative area, so the sanity gate stands down:
    // it exists to guess what an ambiguous place name meant, and there is nothing
    // left to guess once the user has said.
    const gateFraming = !explicitOverview
      && (navigationMode === 'city-overview' || navigationMode === 'region-overview');
    const framedViewport = gateFraming
      ? placeFramingViewport(viewport, lat, lng, types)
      : viewport;
    const flight = flyToViewportBounds(viewer, framedViewport, {
      duration,
      navigationMode,
      beforeFly: mayFly,
      onStart: options.onStart,
      onComplete: options.onComplete,
      onCancel: options.onCancel,
    });
    if (flight === CANCELLED_SEARCH) return CANCELLED_SEARCH;
    if (flight) {
      return {
        label,
        navigationMode,
        rangeM: null,
      };
    }
  }

  const shouldResolveBuilding = navigationMode === 'precise-place';
  const buildingBounds = shouldResolveBuilding
    ? await resolveBuildingBounds(lat, lng, query)
    : null;
  const range = requestedRange || defaultRangeForNavigationMode(navigationMode);
  if (!mayFly()) return CANCELLED_SEARCH;
  const flight = flyToLandmark(viewer, buildingBounds?.lat ?? lat, buildingBounds?.lon ?? lng, {
    range,
    pitch: buildingPitch(buildingBounds),
    heading: 30,
    buildingHeight: 30,
    buildingBounds,
    duration,
    onStart: options.onStart,
    onComplete: options.onComplete,
    onCancel: options.onCancel,
  });
  return {
    label,
    navigationMode: requestedRange
      ? 'explicit-range'
      : (options.forceClose ? navigationMode.replace('-overview', '-close') : navigationMode),
    rangeM: Math.round(flight.range),
  };
}

/** Places {low,high} viewport → the geocode {southwest,northeast} bounds shape
 *  flyToViewportBounds consumes (used when the Places recovery replaces a geocode). */
function placesViewportToBounds(vp) {
  const low = vp?.low;
  const high = vp?.high;
  if (![low?.latitude, low?.longitude, high?.latitude, high?.longitude].every(Number.isFinite)) return null;
  return {
    southwest: { lat: low.latitude, lng: low.longitude },
    northeast: { lat: high.latitude, lng: high.longitude },
  };
}

/**
 * Map a geocode result's `types` to a camera-framing mode. Exported for tests.
 * Parks/campuses/lakes and streets are NOT precise POIs: flying to "Zilker Park" at
 * building range lands on a random rooftop, and a `route` result framed at 250 m looks
 * like the camera picked one arbitrary building on the street (field test 8 / rootcause
 * doc §3) — both frame their geocode viewport instead.
 */
export function geocodeNavigationMode(types) {
  const values = new Set(types);
  if (
    values.has('country')
    || values.has('administrative_area_level_1')
    || values.has('administrative_area_level_2')
  ) {
    return 'region-overview';
  }
  if (values.has('locality') || values.has('postal_town')) return 'city-overview';
  if (
    values.has('sublocality')
    || values.has('sublocality_level_1')
    || values.has('neighborhood')
    || values.has('postal_code')
  ) {
    return 'neighborhood-close';
  }
  if (values.has('route') || values.has('intersection')) return 'street-corridor';
  if (
    values.has('park')
    || values.has('natural_feature')
    || values.has('campus')
    || values.has('university')
    || values.has('airport')
    || values.has('stadium')
    || values.has('amusement_park')
    || values.has('zoo')
    || values.has('cemetery')
    || values.has('shopping_mall')
  ) {
    return 'area-overview';
  }
  return 'precise-place';
}

/**
 * Region-scale span (bbox diagonal, km) above which a geocode viewport is a natural
 * REGION (mountain range, desert, sea) rather than a place: framing the whole box
 * would fly the camera to space, so we frame a representative swath instead.
 * Sized so real parks/lakes (Tahoe ~50 km) keep full framing while ranges
 * (Rockies ~2,700 km, Alps ~880 km) go swath.
 */
export const REGION_SWATH_SPAN_KM = 400;

/** Capped camera range for the representative swath (regional scale, not space). */
const REGION_SWATH_RANGE_M = 280000;

/** Oblique cinematic tilt for the swath — matches the annotation-assist angle. */
const REGION_SWATH_PITCH_DEG = -35;

/** Mean km per degree of latitude (WGS84), the basis for every span estimate here. */
const KM_PER_DEGREE = 111.32;

/**
 * Measure a geocode {southwest,northeast} box. Pure; shared by the region-swath
 * and locality-sanity heuristics so both read the antimeridian the same way.
 * @param {{southwest:{lat:number,lng:number}, northeast:{lat:number,lng:number}}|null} viewport
 * @returns {null | {latSpanDeg:number, lonSpanDeg:number, latSpanKm:number,
 *   lonSpanKm:number, spanKm:number, centerLat:number, centerLng:number}}
 */
export function viewportMetrics(viewport) {
  const southwest = viewport?.southwest;
  const northeast = viewport?.northeast;
  if (
    !Number.isFinite(southwest?.lat)
    || !Number.isFinite(southwest?.lng)
    || !Number.isFinite(northeast?.lat)
    || !Number.isFinite(northeast?.lng)
  ) {
    return null;
  }

  const latSpanDeg = northeast.lat - southwest.lat;
  // Longitude span measured the short way round so an antimeridian-crossing box
  // (Pacific features) doesn't read as ~340° wide.
  const lonSpanDeg = ((northeast.lng - southwest.lng) % 360 + 360) % 360;
  const centerLat = (southwest.lat + northeast.lat) / 2;
  let centerLng = southwest.lng + lonSpanDeg / 2;
  if (centerLng > 180) centerLng -= 360;

  const latSpanKm = Math.abs(latSpanDeg) * KM_PER_DEGREE;
  const lonSpanKm = lonSpanDeg * KM_PER_DEGREE * Math.cos(Cesium.Math.toRadians(centerLat));
  return {
    latSpanDeg,
    lonSpanDeg,
    latSpanKm,
    lonSpanKm,
    spanKm: Math.hypot(latSpanKm, lonSpanKm),
    centerLat,
    centerLng,
  };
}

/** Wrap a longitude in degrees into [-180, 180). */
function wrapLongitude(lng) {
  return ((lng + 180) % 360 + 360) % 360 - 180;
}

/**
 * Diagonal span (km) above which a geocode viewport is bigger than any city, so
 * the off-centre test below is worth applying. Every locality Google returns is
 * far under this (the widest measured is Anchorage at ~135 km), so a city can
 * never be gated on span alone.
 */
export const PLACE_VIEWPORT_MAX_SPAN_KM = 300;

/**
 * Fraction of a viewport's diagonal that its own geocoded location may sit away
 * from the box centre before the box is judged NOT to be centred on the place.
 *
 * The 2026-08-20 QA hunt defect: "Tokyo" flew the camera ~977 km from Tokyo, out
 * over the open Pacific at 2,885 km altitude. Tokyo geocodes as
 * `administrative_area_level_1` (the prefecture), and Tokyo Metropolis owns the
 * Izu and Ogasawara chains ~1,000 km out to sea, so its bounding box is mostly
 * ocean and its centroid is nowhere near the city.
 *
 * Neither span nor offset alone separates that from a legitimately huge region;
 * the ratio does. Measured against the live Geocoding API (2026-08-20):
 *
 *   gated    Tokyo      2,462 km box, anchor  977 km off  → ratio 0.397
 *            Hawaii     2,642 km box, anchor 1,204 km off → ratio 0.456
 *   not      Nunavut    4,394 km box, anchor   426 km off → ratio 0.097
 *            Alaska     3,820 km box, anchor   337 km off → ratio 0.088
 *            Japan      4,047 km box, anchor   357 km off → ratio 0.088
 *            Newfoundl. 1,834 km box, anchor   132 km off → ratio 0.072
 *            Texas      1,725 km box, anchor    90 km off → ratio 0.052
 *            California 1,398 km box, anchor    56 km off → ratio 0.040
 *
 * 0.15 sits in the 2.2x gap between the two groups. States and provinces keep
 * whole-place framing — "California" must still frame California.
 */
export const PLACE_ANCHOR_OFFSET_RATIO = 0.15;

/**
 * Half-extent of the box synthesized when the gate trips — a 40 x 40 km square,
 * matching the hand-tuned city pills (Tokyo's own pill is 42 x 34 km). Framing a
 * box rather than picking a range keeps the flight on the same tested code path
 * the pills use, so a gated search and its pill land at the same scale.
 */
const PLACE_FALLBACK_HALF_SPAN_KM = 20;

/** Great-circle distance in km (small enough here that the spherical model is fine). */
function greatCircleKm(lat1, lng1, lat2, lng2) {
  const dLat = Cesium.Math.toRadians(lat2 - lat1);
  const dLng = Cesium.Math.toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(Cesium.Math.toRadians(lat1)) * Math.cos(Cesium.Math.toRadians(lat2))
      * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Sanity-gate a geocode viewport before framing it. Pure — exported for unit tests.
 *
 * Returns the viewport unchanged unless the box is BOTH bigger than any city AND
 * not actually centred on its own geocoded location; in that case it returns a
 * metro box around `geometry.location` (Tokyo proper) instead of the box centroid
 * (a point in the open Pacific).
 *
 * `country` results are deliberately EXEMPT. Several countries have the identical
 * pathology from overseas territories — France 12,262 km / ratio 0.387, Portugal
 * 0.378, Ecuador 0.303, Chile 0.256, Spain 0.216 — but country framing is shipped,
 * demoed behavior that no one has reviewed a change to, and reframing a country to
 * a 40 km box is a much bigger call than fixing a prefecture. Left as-is on purpose;
 * flagged for the owner rather than changed silently.
 *
 * @param {{southwest:{lat:number,lng:number}, northeast:{lat:number,lng:number}}|null} viewport
 * @param {number} anchorLat Geocode result latitude (`geometry.location`).
 * @param {number} anchorLng Geocode result longitude.
 * @param {string[]} [types] Raw geocode result types, used only for the country exemption.
 * @returns {{southwest:{lat:number,lng:number}, northeast:{lat:number,lng:number}}|null}
 */
export function placeFramingViewport(viewport, anchorLat, anchorLng, types = []) {
  if (Array.isArray(types) && types.includes('country')) return viewport;
  const metrics = viewportMetrics(viewport);
  if (!metrics || metrics.spanKm <= PLACE_VIEWPORT_MAX_SPAN_KM) return viewport;
  if (!Number.isFinite(anchorLat) || !Number.isFinite(anchorLng)) return viewport;

  const offsetKm = greatCircleKm(anchorLat, anchorLng, metrics.centerLat, metrics.centerLng);
  if (offsetKm <= metrics.spanKm * PLACE_ANCHOR_OFFSET_RATIO) return viewport;

  const latHalfDeg = PLACE_FALLBACK_HALF_SPAN_KM / KM_PER_DEGREE;
  // Guard the cosine so a near-polar anchor cannot blow the longitude half-extent up.
  const cosLat = Math.max(0.05, Math.cos(Cesium.Math.toRadians(anchorLat)));
  const lngHalfDeg = PLACE_FALLBACK_HALF_SPAN_KM / (KM_PER_DEGREE * cosLat);
  const wrapLng = (lng) => ((lng + 180) % 360 + 360) % 360 - 180;
  return {
    southwest: {
      lat: Math.max(-89.9, anchorLat - latHalfDeg),
      lng: wrapLng(anchorLng - lngHalfDeg),
    },
    northeast: {
      lat: Math.min(89.9, anchorLat + latHalfDeg),
      lng: wrapLng(anchorLng + lngHalfDeg),
    },
  };
}

/**
 * Natural-region framing heuristic (owner field test 2026-07-23). Pure — exported
 * for unit tests. Given geocode {southwest,northeast} bounds, decide whether to
 * frame the full viewport or a capped oblique swath over the feature's center,
 * looking along the feature's long axis.
 *
 * @param {{southwest:{lat:number,lng:number}, northeast:{lat:number,lng:number}}|null} viewport
 * @returns {null
 *   | {mode:'full', spanKm:number}
 *   | {mode:'swath', spanKm:number, centerLat:number, centerLng:number,
 *      rangeM:number, pitchDeg:number, headingDeg:number}}
 */
export function regionFramingPlan(viewport) {
  const metrics = viewportMetrics(viewport);
  if (!metrics) return null;
  const { latSpanKm, lonSpanKm, spanKm, centerLat, centerLng } = metrics;

  if (spanKm <= REGION_SWATH_SPAN_KM) return { mode: 'full', spanKm };

  return {
    mode: 'swath',
    spanKm,
    centerLat,
    centerLng,
    rangeM: REGION_SWATH_RANGE_M,
    pitchDeg: REGION_SWATH_PITCH_DEG,
    // Look along the feature's long axis so the swath reads as the range receding
    // toward the horizon (N-S ranges → face north, E-W ranges → face east).
    headingDeg: latSpanKm >= lonSpanKm ? 0 : 90,
  };
}

function defaultRangeForNavigationMode(mode) {
  // Fallback ranges when the geocode has no usable viewport to frame.
  if (mode === 'area-overview') return 1400;
  if (mode === 'street-corridor') return 900;
  return 250;
}

function shouldFrameGeocodeViewport(mode) {
  return mode === 'region-overview' || mode === 'city-overview'
    || mode === 'area-overview' || mode === 'street-corridor';
}

function flyToViewportBounds(viewer, viewport, options = {}) {
  const {
    duration = 3.0,
    beforeFly = null,
    onStart = null,
    onComplete = null,
    onCancel = null,
    navigationMode = 'overview',
  } = options;
  const southwest = viewport?.southwest;
  const northeast = viewport?.northeast;
  if (
    !Number.isFinite(southwest?.lat)
    || !Number.isFinite(southwest?.lng)
    || !Number.isFinite(northeast?.lat)
    || !Number.isFinite(northeast?.lng)
  ) {
    return false;
  }

  // Pad from the SHORT-way-round longitude span. Raw subtraction breaks any box
  // that crosses the antimeridian: Alaska (sw 172.3E, ne -130.0) subtracts to
  // -302, and a 0.4-degree metro box straddling the dateline subtracts to -359.6,
  // whose 12% padding alone is 43 degrees — that box framed 86.7 degrees of ocean
  // instead of a city. Cesium's Rectangle does NOT normalize past +/-180, so the
  // padded edges are wrapped here into a proper east<west crossing rectangle.
  const metrics = viewportMetrics(viewport);
  const latitudePadding = Math.max(0.05, Math.abs(metrics.latSpanDeg) * 0.12);
  const longitudePadding = Math.max(0.05, metrics.lonSpanDeg * 0.12);
  const paddedLonSpan = metrics.lonSpanDeg + longitudePadding * 2;
  const south = Math.max(-89.9, southwest.lat - latitudePadding);
  const north = Math.min(89.9, northeast.lat + latitudePadding);
  const rectangle = paddedLonSpan >= 360
    ? Cesium.Rectangle.fromDegrees(-180, south, 180, north)
    : Cesium.Rectangle.fromDegrees(
      wrapLongitude(southwest.lng - longitudePadding),
      south,
      wrapLongitude(southwest.lng + metrics.lonSpanDeg + longitudePadding),
      north,
    );
  if (typeof beforeFly === 'function' && beforeFly() === false) return CANCELLED_SEARCH;
  if (typeof onStart === 'function') {
    try { onStart(); } catch { /* no-op */ }
  }
  viewer.camera.flyTo({
    destination: rectangle,
    duration,
    endTransform: Cesium.Matrix4.IDENTITY,
    complete: () => {
      if (typeof onComplete === 'function') {
        try { onComplete(); } catch { /* no-op */ }
      }
    },
    cancel: () => {
      if (typeof onCancel === 'function') {
        try { onCancel(); } catch { /* no-op */ }
      }
    },
  });
  // Same short-way-round rule for the reported centre: averaging raw longitudes
  // puts a dateline-crossing box's centre on the opposite side of the planet.
  return {
    targetPosition: Cesium.Cartesian3.fromDegrees(metrics.centerLng, metrics.centerLat, 0),
    boundingRadius: 0,
    range: null,
    viewBounds: viewport,
    navigationMode,
  };
}

function normalizeBuildingBounds(bounds) {
  if (!bounds) return null;
  const height = finitePositive(bounds.height);
  const width = finitePositive(bounds.width);
  const depth = finitePositive(bounds.depth);
  if (!height || !width || !depth) return null;
  return { ...bounds, height, width, depth };
}

function buildingBoundingRadius(bounds) {
  const halfHeight = bounds.height / 2;
  const halfWidth = bounds.width / 2;
  const halfDepth = bounds.depth / 2;
  return Math.hypot(halfHeight, halfWidth, halfDepth) * 1.18;
}

function rangeForBoundingSphere(viewer, radius) {
  const frustum = viewer.camera.frustum;
  const verticalFov = Number(frustum?.fov) || Cesium.Math.toRadians(60);
  const aspectRatio = Math.max(0.5, Number(frustum?.aspectRatio) || 1);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspectRatio);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  // Target 57% sphere occupancy so perspective still leaves at least 40%
  // measured roof-to-base breathing room in ordinary oblique building views.
  const occupiedViewportFraction = 0.57;
  const desiredAngularRadius = limitingFov * occupiedViewportFraction / 2;
  return radius / Math.sin(desiredAngularRadius) * 1.05;
}

function buildingPitch(bounds) {
  if (!bounds) return -25;
  const footprint = Math.max(bounds.width, bounds.depth);
  const ratio = bounds.height / Math.max(footprint, 1);
  if (ratio >= 2.5) return -12;
  if (ratio >= 1.2) return -22;
  if (ratio <= 0.35) return -45;
  return -32;
}

async function resolveBuildingBounds(lat, lon, query) {
  const overpassQuery = `
    [out:json][timeout:10];
    (
      way(around:180,${lat},${lon})["building"];
      relation(around:180,${lat},${lon})["building"];
      way(around:180,${lat},${lon})["man_made"];
      relation(around:180,${lat},${lon})["man_made"];
      way(around:180,${lat},${lon})["tourism"="attraction"];
      relation(around:180,${lat},${lon})["tourism"="attraction"];
    );
    out tags center geom;
  `;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('/api/overpass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return selectBuildingBounds(data?.elements || [], lat, lon, query);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function selectBuildingBounds(elements, targetLat, targetLon, query) {
  const queryWords = normalizedWords(query);
  const candidates = [];
  for (const element of elements) {
    const coordinates = elementCoordinates(element);
    if (coordinates.length < 3) continue;
    const bounds = coordinateBounds(coordinates, targetLat);
    if (!bounds || bounds.width < 2 || bounds.depth < 2) continue;
    const tags = element.tags || {};
    const center = element.center || averageCoordinate(coordinates);
    const distanceM = approximateDistanceM(targetLat, targetLon, center.lat, center.lon);
    const nameWords = normalizedWords([
      tags.name,
      tags['name:en'],
      tags.official_name,
      tags.alt_name,
    ].filter(Boolean).join(' '));
    const nameScore = wordOverlap(queryWords, nameWords);
    const containsTarget = pointInPolygon(targetLon, targetLat, coordinates);
    const height = buildingHeightFromTags(tags, bounds);
    candidates.push({
      lat: center.lat,
      lon: center.lon,
      height,
      width: bounds.width,
      depth: bounds.depth,
      osmName: tags.name || tags['name:en'] || null,
      osmType: element.type,
      osmId: element.id,
      score: nameScore * 1000 + (containsTarget ? 500 : 0) - distanceM,
    });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  const { score, ...best } = candidates[0];
  return best;
}

function elementCoordinates(element) {
  if (Array.isArray(element.geometry)) {
    return element.geometry.filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lon));
  }
  if (!Array.isArray(element.members)) return [];
  return element.members.flatMap((member) => (
    Array.isArray(member.geometry)
      ? member.geometry.filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lon))
      : []
  ));
}

function coordinateBounds(coordinates, latitude) {
  const latitudes = coordinates.map((point) => point.lat);
  const longitudes = coordinates.map((point) => point.lon);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  return {
    width: approximateDistanceM(latitude, west, latitude, east),
    depth: approximateDistanceM(south, west, north, west),
  };
}

function buildingHeightFromTags(tags, bounds) {
  const explicitHeight = parseMeters(tags.height || tags['building:height']);
  if (explicitHeight) return explicitHeight;
  const levels = Number.parseFloat(tags['building:levels']);
  const roofHeight = parseMeters(tags['roof:height']) || 0;
  if (Number.isFinite(levels) && levels > 0) return levels * 3.3 + roofHeight;
  return Math.max(12, Math.min(80, Math.max(bounds.width, bounds.depth) * 0.8));
}

function parseMeters(value) {
  if (value == null) return 0;
  const number = Number.parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(number) || number <= 0) return 0;
  return /\b(ft|feet|foot)\b/i.test(String(value)) ? number * 0.3048 : number;
}

function averageCoordinate(coordinates) {
  const total = coordinates.reduce((sum, point) => ({
    lat: sum.lat + point.lat,
    lon: sum.lon + point.lon,
  }), { lat: 0, lon: 0 });
  return {
    lat: total.lat / coordinates.length,
    lon: total.lon / coordinates.length,
  };
}

function normalizedWords(value) {
  return new Set(String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2));
}

function wordOverlap(left, right) {
  let matches = 0;
  for (const word of left) {
    if (right.has(word)) matches++;
  }
  return matches;
}

function pointInPolygon(lon, lat, coordinates) {
  let inside = false;
  for (let index = 0, previous = coordinates.length - 1; index < coordinates.length; previous = index++) {
    const a = coordinates[index];
    const b = coordinates[previous];
    const intersects = ((a.lat > lat) !== (b.lat > lat)) &&
      (lon < (b.lon - a.lon) * (lat - a.lat) / ((b.lat - a.lat) || Number.EPSILON) + a.lon);
    if (intersects) inside = !inside;
  }
  return inside;
}

function approximateDistanceM(latA, lonA, latB, lonB) {
  const latitudeScale = 111320;
  const longitudeScale = latitudeScale * Math.cos(Cesium.Math.toRadians((latA + latB) / 2));
  return Math.hypot(
    (latB - latA) * latitudeScale,
    (lonB - lonA) * longitudeScale
  );
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
