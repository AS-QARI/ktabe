/**
 * لقطات شاشة بمقاس جوال حقيقي (iPhone 11 Pro Max: 414×896) لكل تبويبات
 * التطبيق، مع رصد أخطاء الـ Console. يتطلب خادم التطوير شغالاً.
 *
 * الاستخدام:  node scripts/screenshot.mjs [مجلد-الإخراج]
 * ملاحظة: يعتمد على #dev-unlock (يعمل في وضع التطوير فقط) لتجاوز شاشة القفل.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE_URL = 'http://localhost:5173';
const OUT_DIR = process.argv[2] ?? 'screenshots';
const TABS = ['day', 'calendar', 'summary'];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
});

const page = await browser.newPage();
await page.setViewport({
  width: 414,
  height: 896,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

// COLOR_SCHEME=light node scripts/screenshot.mjs — لالتقاط الوضع الفاتح
if (process.env.COLOR_SCHEME) {
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: process.env.COLOR_SCHEME },
  ]);
}

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

for (const tab of TABS) {
  // تغيير الاستعلام (?v=) يجبر على تحميل كامل — تغيير الـ hash وحده لا يعيد التحميل
  await page.goto(`${BASE_URL}/?v=${tab}#dev-unlock&tab=${tab}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('.tabbar', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1800)); // مهلة لاكتمال البيانات والحركات
  const path = join(OUT_DIR, `${tab}.png`);
  await page.screenshot({ path });
  console.log(`saved ${path}`);
}

await browser.close();

if (errors.length) {
  console.log('\nconsole errors:');
  for (const e of errors) console.log(' -', e);
  process.exitCode = 1;
} else {
  console.log('\nno console errors ✓');
}
