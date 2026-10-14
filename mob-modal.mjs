// Mobile-UA boot + modal dismiss + longer wait — phir screenshot
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
    '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.emulate({
  viewport: { width: 393, height: 851, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 ThirdEyeApp/1.3',
});
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 9000));
try {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => /EXPLORE MANUALLY/i.test(x.textContent || ''));
    if (b) b.click();
  });
} catch {}
await new Promise(r => setTimeout(r, 14000));
await page.screenshot({ path: '/tmp/globe-mob2.png' });
console.log('mobile after-modal shot saved');
await browser.close();
