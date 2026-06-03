/**
 * Empirically measure the final processed passport photo quality.
 * Drives /capture -> upload high-res fixture -> process -> /review, then reads
 * the rendered processed <img>: natural dimensions, byte size, and saves it for
 * visual inspection. Compares against the source upload resolution.
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { writeFileSync, statSync } from 'node:fs';

const APP = process.env.APP_URL || 'http://127.0.0.1:8790';
const FIX = resolve('public', 'test-fixtures', process.env.FIXTURE || 'WhatsApp Image 2026-04-07 at 11.06.38 PM.jpeg');
const OUT = resolve('.codex-logs', 'e2e');

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage();
const enhanceCalls = [];
page.on('response', (r) => { if (r.url().includes('/api/enhance-photo')) enhanceCalls.push(r.status()); });

console.log('source fixture bytes:', statSync(FIX).size);
await page.goto(`${APP}/capture`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.locator('input[type="file"][accept="image/*"]:not([capture])').first().setInputFiles(FIX);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /Use (This )?Photo/i }).first().click();

// Wait until /review (processing done).
const deadline = Date.now() + 90000;
while (Date.now() < deadline) {
  if (new URL(page.url()).pathname === '/review') break;
  await page.waitForTimeout(1500);
}
await page.waitForTimeout(2500);

const data = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img'))
    .filter((i) => i.src && i.src.startsWith('data:image'))
    .map((i) => ({ w: i.naturalWidth, h: i.naturalHeight, len: i.src.length, mime: i.src.slice(5, i.src.indexOf(';')), src: i.src }))
    .sort((a, b) => (b.w * b.h) - (a.w * a.h));
  const main = imgs[0] || null;
  return {
    count: imgs.length,
    main: main ? { w: main.w, h: main.h, mime: main.mime, approxBytes: Math.round(main.len * 0.75) } : null,
    src: main ? main.src : null,
  };
});

console.log('processed images on /review:', data.count);
console.log('final image:', JSON.stringify(data.main));
console.log('enhance-photo API calls (status):', JSON.stringify(enhanceCalls));

if (data.src) {
  const b64 = data.src.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  const ext = data.main.mime.includes('png') ? 'png' : 'jpg';
  const path = resolve(OUT, `final-quality.${ext}`);
  writeFileSync(path, buf);
  console.log('saved final image:', path, 'bytes:', buf.length);
}
await browser.close();
