import puppeteer from 'puppeteer';

const url = process.env.URL || 'http://localhost:4173';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810 });

let refTiles = 0;
let imageryTiles = 0;
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('World_Boundaries_and_Places') || u.includes('World_Transportation')) refTiles++;
  if (u.includes('World_Imagery')) imageryTiles++;
});
page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 200)));

console.log('Loading', url);
await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 9000));

const firstRun = await page.$('#first-run-launcher:not([hidden])');
if (firstRun) {
  await page.click('#first-run-launcher [data-first-run-choice="explore"]').catch(() => {});
  console.log('First-run: EXPLORE');
}
await new Promise((r) => setTimeout(r, 15000));

console.log('Esri imagery tiles loaded:', imageryTiles);
console.log('REFERENCE overlay tiles (labels/roads) loaded:', refTiles);
console.log(refTiles > 0 ? '✅ HYBRID LAYER ACTIVE — labels are being drawn' : '❌ no reference tiles requested');

await page.screenshot({ path: '/home/user/hybrid-check.png' });
console.log('Screenshot: /home/user/hybrid-check.png');
await browser.close();
