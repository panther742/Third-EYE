// Contact-trails Mumbai proof: enable, fly to BOM, wait 3 poll cycles
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
    '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
await page.setViewport({ width: 1200, height: 800 });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 6000));

// dismiss modal
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /EXPLORE MANUALLY/i.test(b.textContent || ''))?.click());
await new Promise(r => setTimeout(r, 2000));

// enable trails
await page.evaluate(() => {
  const row = document.querySelector('#data-toggles .data-toggle-row[data-layer-id="contact-trails"]');
  if (row) row.querySelector('button')?.click();
});
await new Promise(r => setTimeout(r, 3000));

// fly to Mumbai via location pill
const pillInfo = await page.evaluate(() => {
  const pills = [...document.querySelectorAll('#location-pills button, #location-pills .location-pill')];
  return pills.map(p => (p.textContent || '').trim()).slice(0, 12);
});
console.log('PILLS:', JSON.stringify(pillInfo));
const clicked = await page.evaluate(() => {
  const pill = [...document.querySelectorAll('#location-pills button, #location-pills .location-pill')]
    .find(p => /mumbai/i.test(p.textContent || ''));
  if (pill) { pill.click(); return true; }
  return false;
});
console.log('Mumbai pill clicked:', clicked);
console.log('fly attempted (viewer ref may be internal)');
await new Promise(r => setTimeout(r, 75000));

const state = await page.evaluate(() => {
  const row = document.querySelector('#data-toggles .data-toggle-row[data-layer-id="contact-trails"]');
  return {
    debug: window.__trailsDebug || 'no-render-hook(<2pts each)',
    countChip: row?.querySelector('.data-count')?.textContent || '—',
    active: row?.querySelector('.data-toggle-btn')?.classList.contains('active'),
  };
});
console.log('TRAILS STATE:', JSON.stringify(state));
console.log('ERRORS:', errors.length ? errors.slice(0, 3) : 'none');
await page.screenshot({ path: '/tmp/trails-bom.png' });
console.log('shot: /tmp/trails-bom.png');
await browser.close();
