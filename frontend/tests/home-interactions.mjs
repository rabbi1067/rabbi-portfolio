/* Optional browser checks for persistent role tags and scroll hints. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:8000';
const qa = resolve(dirname(fileURLToPath(import.meta.url)), '../.qa/home-interactions');
await mkdir(qa, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath:process.env.BROWSER_EXECUTABLE } : {}) });
const errors = [];
async function prepare(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(origin, { waitUntil:'networkidle' });
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('hero-badges')).visibility==='visible');
  return { context, page };
}
try {
  const { context, page } = await prepare({ viewport:{ width:1440, height:1000 } });
  const trigger = page.locator('#heroPortraitTrigger');
  const hint = page.locator('#scrollCue');
  const badges = page.locator('#hero-badges');
  assert.equal(await badges.getAttribute('aria-hidden'),null);
  assert.equal(await badges.locator('.float-card').count(),4);
  assert.equal(await hint.evaluate(el=>getComputedStyle(el).flexDirection),'column');
  assert.equal(await page.locator('.scroll-mouse').evaluate(el=>getComputedStyle(el).width),'22px');
  const languages=page.locator('#hero-skill-tags');
  assert.deepEqual(await languages.locator('.photo-skill-tag').allTextContents(),['C++','Python','C','Java']);
  assert.equal(await languages.evaluate(el=>getComputedStyle(el).visibility),'visible');
  assert.equal(await languages.getAttribute('aria-hidden'),null);
  const hintBounds=await hint.boundingBox();
  assert.ok(hintBounds.y>=0 && hintBounds.y+hintBounds.height<=1000,'Scroll cue is visible in the first viewport');
  assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).scrollbarWidth),'none');
  assert.ok((await languages.boundingBox()).y>=(await page.locator('.hero-stats').boundingBox()).y,'Language chips follow the stats');
  await trigger.hover();
  await page.mouse.move(8,120);
  await page.waitForTimeout(2800);
  assert.equal(await badges.evaluate(el=>getComputedStyle(el).visibility),'visible','Roles stay visible after leaving the portrait');
  assert.equal(await badges.evaluate(el=>getComputedStyle(el).opacity),'1');
  await page.screenshot({path:resolve(qa,'tags-always-visible.png')});
  await page.mouse.wheel(0,140);
  await page.waitForFunction(()=>scrollY>20);
  await page.waitForFunction(()=>document.querySelector('.scroll-indicator').getAttribute('aria-hidden')==='true');
  assert.equal(await hint.getAttribute('tabindex'),'-1');
  await page.keyboard.press('Control+Home');
  await page.waitForFunction(()=>scrollY<=20);
  await page.waitForFunction(()=>document.querySelector('.scroll-indicator').getAttribute('aria-hidden')==='false');
  assert.equal(await hint.getAttribute('tabindex'),'0');
  await context.close();

  const mobile = await prepare({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  assert.ok(await mobile.page.locator('#scrollCue').isHidden(),'Phone scroll cue is hidden');
  assert.ok(await mobile.page.locator('#hero-badges').isVisible(),'Mobile roles need no tap');
  await mobile.page.waitForTimeout(2800);
  assert.equal(await mobile.page.locator('#hero-badges').evaluate(el=>getComputedStyle(el).visibility),'visible');
  assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth),390);
  assert.equal(await mobile.page.locator('#hero-skill-tags').evaluate(el=>getComputedStyle(el).visibility),'visible');
  await mobile.context.close();
  const staticPage = await prepare({ viewport:{width:390,height:844}, javaScriptEnabled:false });
  assert.ok(await staticPage.page.locator('#hero-badges').isVisible(),'Roles remain visible without JavaScript');
  await staticPage.context.close();
  assert.deepEqual(errors,[]);
  console.log('Passed: original scroll appearance; scroll hide/restore; always-visible roles after mouse leave; touch and no-JavaScript visibility; mobile overflow.');
} finally { await browser.close(); }
