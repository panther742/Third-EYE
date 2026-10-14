// Wind layer + ISS button e2e: enable wind toggle, count billboards, click ISS
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
    '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
const errors = [];
const omReq = [];
page.on('request', (r) => { if (/open-meteo/.test(r.url())) omReq.push(r.url().slice(0, 110)); });
page.on('requestfailed', (r) => { if (/open-meteo/.test(r.url())) omReq.push('FAILED: ' + r.url().slice(0, 80) + ' ' + (r.failure()?.errorText || '')); });
page.on('response', async (r) => {
  if (/open-meteo/.test(r.url())) {
    const body = await r.text().catch(() => '');
    omReq.push('RESP ' + r.status() + ' len=' + body.length + ' head=' + body.slice(0, 120));
  }
});
page.on('pageerror', (e) => errors.push(String(e).slice(0, 150)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
await page.setViewport({ width: 1200, height: 800 });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 6000));

// enable wind via the data-layer toggle panel (find the wind toggle)
const windState = await page.evaluate(() => {
  const row = document.querySelector('#data-toggles .data-toggle-row[data-layer-id="wind"]');
  if (!row) return 'row missing';
  row.querySelector('button')?.click();
  return 'clicked wind toggle';
});
console.log('WIND TOGGLE:', windState);
await new Promise(r => setTimeout(r, 15000));

const stats = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#data-toggles .data-toggle-row')];
  const windRow = rows.find(r => r.dataset.layerId === 'wind');
  return {
    countText: windRow?.querySelector('.data-count')?.textContent || '—',
    active: windRow?.querySelector('.data-toggle-btn')?.classList.contains('active'),
  };
});
const dbg = await page.evaluate(() => window.__windDebug || 'no-hook');
console.log('WIND STATS UI:', JSON.stringify(stats), '| DEBUG:', JSON.stringify(dbg));

await page.evaluate(() => {
  const row = document.querySelector('#data-toggles .data-toggle-row[data-layer-id="satellites"]');
  if (row && !row.querySelector('.data-toggle-btn')?.classList.contains('active')) row.querySelector('button')?.click();
});
await new Promise(r => setTimeout(r, 12000));
// enable contact trails + fly to Mumbai (adsb coverage)
await page.evaluate(() => {
  const row = document.querySelector('#data-toggles .data-toggle-row[data-layer-id="contact-trails"]');
  if (row) row.querySelector('button')?.click();
});
await new Promise(r => setTimeout(r, 4000));
console.log('TRAILS DEBUG 1:', JSON.stringify(await page.evaluate(() => window.__trailsDebug || 'pending')));
await new Promise(r => setTimeout(r, 16000));
const trailsDbg = await page.evaluate(() => window.__trailsDebug || 'no-hook');
console.log('TRAILS DEBUG:', JSON.stringify(trailsDbg));
// ISS button click + capture toast text
await page.evaluate(() => document.getElementById('iss-pass-btn')?.click());
await new Promise(r => setTimeout(r, 1500));
const toast = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div,span')];
  const t = els.find(e => /ISS pass/.test(e.textContent || '') && e.children.length === 0);
  return t ? t.textContent.trim() : 'toast not found';
});
console.log('ISS TOAST:', toast);
console.log('OPEN-METEO REQS:', omReq.length ? omReq.slice(0, 3) : 'NONE!');
console.log('PAGE ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
await page.screenshot({ path: '/tmp/wind-iss.png' });
console.log('shot: /tmp/wind-iss.png');
await browser.close();
