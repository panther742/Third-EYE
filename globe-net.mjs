// Instrumented boot: capture tile requests + map stack state + render probe
import puppeteer from 'puppeteer';

const target = process.argv[2] || 'http://localhost:4173/';
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
    '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 700 });

const tileHits = [];
page.on('request', (req) => {
  const u = req.url();
  if (/arcgisonline|openstreetmap|ion\.cesium|mapbox|google.*xyz|earthbuilder|tile\.openstreet/i.test(u)) {
    tileHits.push({ type: 'REQ', url: u.slice(0, 130) });
  }
});
page.on('requestfailed', (req) => {
  const u = req.url();
  if (/arcgisonline|openstreetmap|ion\.cesium|earthbuilder|tile/i.test(u)) {
    tileHits.push({ type: 'FAIL', url: u.slice(0, 130), err: (req.failure()?.errorText || '').slice(0, 60) });
  }
});
page.on('response', (res) => {
  const u = res.url();
  if (/arcgisonline|openstreetmap|ion\.cesium|earthbuilder/i.test(u)) {
    if (res.status() >= 300) tileHits.push({ type: 'HTTP' + res.status(), url: u.slice(0, 130) });
  }
});
page.on('console', (m) => {
  const t = m.text();
  if (/MapStack|terrain|Esri|OSM|cesium|Cesium|error/i.test(t)) console.log('CONSOLE[' + m.type() + ']:', t.slice(0, 180));
});
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));

await page.goto(target, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 20000));

// probe: read the actual painted pixels of the center of the canvas
const probe = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'no canvas' };
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return { error: 'no gl on main canvas (context owned by cesium)' };
  const px = new Uint8Array(4);
  gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { centerRGB: [px[0], px[1], px[2]], w: gl.drawingBufferWidth, h: gl.drawingBufferHeight };
}).catch(e => ({ error: String(e).slice(0, 100) }));
console.log('PIXEL PROBE:', JSON.stringify(probe));

console.log('TILE HITS (' + tileHits.length + '):');
tileHits.slice(0, 20).forEach(h => console.log(' ', h.type, h.url, h.err || ''));

// capture fresh screenshot after dismissing the modal (click EXPLORE MANUALLY)
try {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => /EXPLORE MANUALLY/i.test(x.textContent || ''));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 6000));
} catch {}
await page.screenshot({ path: '/tmp/globe-after.png' });
console.log('after-shot: /tmp/globe-after.png');
await browser.close();
