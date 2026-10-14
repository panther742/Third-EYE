import puppeteer from 'puppeteer';

const url = process.env.URL || 'http://localhost:4173';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810 });

const consoleErrors = [];
page.on('console', (msg) => {
  const type = msg.type();
  if (type === 'error' || type === 'warning') {
    consoleErrors.push(`[${type}] ${msg.text().slice(0, 300)}`);
  }
});
page.on('pageerror', (err) => {
  consoleErrors.push(`[pageerror] ${String(err).slice(0, 300)}`);
});

console.log('Loading', url, '...');
await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 8000));

// First-run dialog: click LIVE CONTACTS if present
const firstRun = await page.$('#first-run-launcher:not([hidden])');
if (firstRun) {
  console.log('First-run dialog visible → clicking LIVE CONTACTS');
  await page.click('#first-run-launcher [data-first-run-choice="contacts"]').catch((e) => console.log('click fail', e.message));
  await new Promise((r) => setTimeout(r, 2000));
}

// Wait for layers + data to come in
console.log('Waiting 40s for live data layers...');
await new Promise((r) => setTimeout(r, 40000));

const state = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const text = (s) => q(s)?.textContent?.trim() || null;
  const canvas = q('#cesiumContainer canvas');
  return {
    title: document.title,
    canvasExists: Boolean(canvas),
    canvasSize: canvas ? { w: canvas.width, h: canvas.height } : null,
    loadingScreenHidden: q('#loading-screen')?.hidden ?? null,
    hudVisible: !q('#intel-hud')?.hidden,
    activeStyle: text('#active-style-name'),
    firstRunStillVisible: Boolean(q('#first-run-launcher:not([hidden])')),
    cockpitEntryVisible: Boolean(q('#cockpit-entry:not([hidden])')),
    contextPanel: text('#context-mode-standby strong') || text('.global-context-modes'),
    keySetupChip: Boolean(q('#key-setup-chip:not([hidden])')),
  };
});
console.log('PAGE STATE:', JSON.stringify(state, null, 2));

await page.screenshot({ path: '/home/user/gev-live-check.png' });
console.log('Screenshot saved: /home/user/gev-live-check.png');

console.log('\n=== CONSOLE ISSUES (first 20) ===');
for (const line of consoleErrors.slice(0, 20)) console.log(line);
if (!consoleErrors.length) console.log('(none)');

await browser.close();
