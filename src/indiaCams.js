/**
 * LIVE-DEFAULTS (local patch) — INDIA LIVE CAMS
 *
 * India's police / smart-city CCTV networks (Surat Safe City, Delhi ICCC, …)
 * run on secure government networks with no public feed API, and private
 * cameras cannot be accessed without the owner's consent. What CAN be shown
 * legitimately are official public broadcasts the operators themselves run —
 * temple trusts and city agencies streaming their own cameras on YouTube.
 *
 * This panel lists verified official sources. WATCH opens the operator's own
 * live page in a new tab (channel-level links survive daily stream rotation);
 * FLY moves the globe camera over that exact location.
 */

import * as Cesium from 'cesium';

const CAMS = Object.freeze([
  {
    id: 'dwarka',
    name: 'Dwarkadhish Temple',
    city: 'Dwarka, Gujarat',
    lat: 22.2394,
    lon: 68.9676,
    // Verified official channel: youtube.com/channel/UCBAvMHZO3BIfMMhOK9LMOYQ
    // live_stream embed auto-plays the channel's CURRENT live stream.
    channelId: 'UCBAvMHZO3BIfMMhOK9LMOYQ',
    watch: 'https://www.youtube.com/@shridwarkadhishmandirofficial/live',
    site: 'https://www.dwarkadhish.org/',
    embeddable: true,
  },
  {
    id: 'somnath',
    name: 'Somnath Temple (Jyotirlinga)',
    city: 'Somnath, Gujarat',
    lat: 20.8880,
    lon: 70.4012,
    watch: 'https://www.youtube.com/channel/UCSC247kC0JDn9V_MntmEDRA',
    site: 'https://somnath.org/',
    note: 'Trust official channel — Live Darshan daily',
    embeddable: false,
  },
  {
    id: 'goldentemple',
    name: 'Sri Harmandir Sahib (Golden Temple)',
    city: 'Amritsar, Punjab',
    lat: 31.6200,
    lon: 74.8765,
    watch: 'https://www.youtube.com/watch?v=Uabf-vJJHzs',
    embeddable: false,
  },
  {
    id: 'suratsmartcity',
    name: 'Surat Smart City',
    city: 'Surat, Gujarat',
    lat: 21.1702,
    lon: 72.8311,
    watch: 'https://suratsmartcity.com/Videos',
    site: 'https://suratsmartcity.com/',
    note: 'SMC official channel — Safe City CCTV project',
    embeddable: false,
  },
]);

let _modal = null;
let _embedFrame = null;
let _viewerRef = null;

function _el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function _flyTo(viewer, cam) {
  if (!viewer?.camera) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 1400),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-38),
      roll: 0,
    },
    duration: 2.6,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
  });
}

function _renderCards(viewer) {
  const list = _modal.querySelector('[data-india-cam-list]');
  list.textContent = '';
  for (const cam of CAMS) {
    const card = _el('div', 'india-cam-card');

    const info = _el('div', 'india-cam-info');
    const name = _el('strong', null, cam.name);
    const meta = _el('small', null, cam.city + (cam.note ? ` · ${cam.note}` : ''));
    info.append(name, meta);

    const actions = _el('div', 'india-cam-actions');

    const watch = _el('button', 'india-cam-btn india-cam-watch', 'WATCH');
    watch.type = 'button';
    watch.title = 'Open the operator’s own live page in a new tab';
    watch.addEventListener('click', () => {
      window.open(cam.watch, '_blank', 'noopener');
    });

    const fly = _el('button', 'india-cam-btn india-cam-fly', 'FLY');
    fly.type = 'button';
    fly.title = 'Fly the globe camera over this location';
    fly.addEventListener('click', () => {
      _flyTo(viewer, cam);
      _closeModal();
    });

    actions.append(watch, fly);
    card.append(info, actions);
    list.append(card);
  }
}

function _ensureEmbed(cam) {
  const stage = _modal.querySelector('[data-india-cam-stage]');
  if (_embedFrame) {
    _embedFrame.remove();
    _embedFrame = null;
  }
  if (!cam || !cam.embeddable || !cam.channelId) {
    stage.hidden = true;
    return;
  }
  stage.hidden = false;
  const frame = document.createElement('iframe');
  frame.className = 'india-cam-embed';
  frame.src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(cam.channelId)}`;
  frame.title = `${cam.name} — official live`;
  frame.allow = 'encrypted-media; picture-in-picture';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  stage.append(frame);
  _embedFrame = frame;
}

function _openModal(viewer) {
  _modal.hidden = false;
  _renderCards(viewer);
  _ensureEmbed(CAMS.find((cam) => cam.embeddable) || null);
}

function _closeModal() {
  if (!_modal || _modal.hidden) return;
  _modal.hidden = true;
  if (_embedFrame) {
    _embedFrame.remove();
    _embedFrame = null;
  }
}

export function initIndiaCams(viewer) {
  if (!viewer) return null;
  _viewerRef = viewer;
  const button = document.getElementById('cctv-india-btn');
  _modal = document.getElementById('india-cams-modal');
  if (!button || !_modal) return null;

  button.addEventListener('click', () => {
    if (_modal.hidden) _openModal(viewer);
    else _closeModal();
  });

  const closeButton = _modal.querySelector('[data-india-cams-close]');
  closeButton?.addEventListener('click', _closeModal);

  // Click on the backdrop (outside the card) closes it.
  _modal.addEventListener('mousedown', (event) => {
    if (event.target === _modal) _closeModal();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !_modal.hidden) {
      event.stopPropagation();
      _closeModal();
    }
  }, true);

  return { open: () => _openModal(viewer), close: _closeModal };
}

export const INDIA_CAMS = CAMS;
