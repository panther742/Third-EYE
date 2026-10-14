// Deep check: globe render + console errors + Cesium imagery status
import puppeteer from 'puppeteer';

const target = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || '/tmp/globe-check.png';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
    '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
const errors = [];
const warnings = [];
page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error') errors.push(text.slice(0, 200));
  else if (msg.type() === 'warning' && /cesium|webgl|gpu|imagery/i.test(text)) warnings.push(text.slice(0, 160));
});
page.on('pageerror', (err) => errors.push('PAGEERROR: ' + String(err).slice(0, 200)));

await page.setViewport({ width: 1280, height: 800 });
await page.goto(target, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 18000)); // boot + Surat fly complete

const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  let glInfo = 'no-gl';
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (gl) glInfo = gl.getParameter(gl.RENDERER) || 'gl-no-renderer';
  } catch (e) { glInfo = 'gl-error: ' + e.message; }
  let cesiumState = 'n/a';
  try {
    // window.thirdEye debug hooks if any; else check widgets
    const vw = document.querySelector('.cesium-viewer');
    cesiumState = vw ? 'cesium-viewer-present' : 'NO cesium-viewer element';
  } catch {}
  return {
    title: document.title,
    canvas: canvas ? `${canvas.width}x${canvas.height}` : 'NONE',
    glInfo,
    cesiumState,
    bodyChildren: document.body.children.length,
    hasErrorOverlay: !!document.querySelector('#error-overlay, .app-error'),
  };
});
console.log('INFO:', JSON.stringify(info));
console.log('CONSOLE ERRORS (' + errors.length + '):');
errors.slice(0, 12).forEach(e => console.log('  •', e));
console.log('RELEVANT WARNINGS (' + warnings.length + '):');
warnings.slice(0, 6).forEach(w => console.log('  •', w));
await page.screenshot({ path: out });
console.log('shot:', out);
await browser.close();
