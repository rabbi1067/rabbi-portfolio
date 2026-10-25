/* Optional browser checks for certificate previews, filters and remaining counts. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const qa = resolve(root, '.qa/certifications');
await mkdir(qa, { recursive: true });
const records = JSON.parse(await readFile(resolve(root,'content/achievements.json'),'utf8')).items.filter(item=>item.published!==false);
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:8000';
const browser = await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[];
try {
  for (const width of [1440,820,390,320]) {
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    await page.goto(origin,{waitUntil:'networkidle'});
    const grid=page.locator('#certificate-cards');
    const button=page.locator('#view-all-certifications');
    const visible=()=>grid.locator('.cert-card:visible').count();
    assert.equal(await grid.locator('.cert-card').count(),records.length);
    assert.equal(await visible(),Math.min(6,records.length));
    if(records.length>6) {
      assert.equal((await button.locator('.view-all-count').innerText()).trim(),String(records.length-6));
      await button.click();
      assert.equal(await visible(),records.length);
      assert.ok(await button.isHidden());
      assert.ok(await page.locator('h4').evaluateAll(headings=>headings.includes(document.activeElement)),'Focus moves to a revealed credential');
    }
    const category=records.find(item=>item.category)?.category;
    if(category) {
      const group=page.locator('[data-filter-grid="certificate-cards"]');
      await group.getByRole('button',{name:category,exact:true}).click();
      const matches=records.filter(item=>item.category===category).length;
      assert.equal(await visible(),Math.min(6,matches));
      if(records.length>6) assert.equal(await button.isHidden(),matches<=6);
      await group.getByRole('button',{name:'All',exact:true}).click();
      assert.equal(await visible(),Math.min(6,records.length),'All resets the six-card preview');
      if(records.length>6) assert.equal((await button.locator('.view-all-count').innerText()).trim(),String(records.length-6));
    }
    for(const theme of ['dark','light']) {
      const checkbox=page.locator('#themeToggle');
      if(await page.locator('html').getAttribute('data-theme')!==theme) await checkbox.click();
      await page.locator('#certifications h2').scrollIntoViewIfNeeded();
      const geometry=await grid.evaluate(el=>Array.from(el.querySelectorAll('.cert-card:not([hidden])')).map(card=>{
        const box=card.getBoundingClientRect();
        return {left:box.left,right:box.right,clipped:card.scrollWidth>card.clientWidth+2};
      }));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
      assert.ok(geometry.every(card=>card.left>=0&&card.right<=width+1&&!card.clipped),`${width}/${theme}: no clipped cards`);
      assert.ok(await grid.locator('.cert-action').evaluateAll(links=>links.every(link=>link.target==='_blank'&&link.rel.includes('noopener'))));
      await page.screenshot({path:resolve(qa,`${width}-${theme}.png`)});
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Passed: six initial certificates; remaining count; reveal all; category reset; keyboard focus; dark/light layouts at 1440/820/390/320px; external document links.');
} finally {await browser.close();}
