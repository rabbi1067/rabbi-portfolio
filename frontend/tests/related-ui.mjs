import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.PREVIEW_URL||'http://127.0.0.1:8002';
const slug='three-zeros-yunus-centre-grameen-bank-september-2024';
await mkdir('frontend/.qa/blogs',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
try{
 for(const width of [1440,820,390,320]){
  const context=await browser.newContext({viewport:{width,height:1100},reducedMotion:'reduce'});
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/blogs/'+slug+'/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.cmsReady==='true');
  const related=page.getByRole('complementary',{name:'More from My Journey'});
  assert.equal(await related.locator('[data-blog-card]').count(),3);
  assert.equal(await related.locator(`[data-blog-slug="${slug}"]`).count(),0);
  await related.scrollIntoViewIfNeeded();
  for(const img of await related.locator('.blog-slide.is-active img').all())await img.evaluate(i=>i.decode());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  await page.screenshot({path:`frontend/.qa/blogs/related-${width}.png`});
  const destination=await related.locator('.blog-card-copy').first().locator('..').getAttribute('href');
  await related.locator('.blog-read').first().click();
  await page.waitForFunction(()=>document.documentElement.dataset.cmsReady==='true');
  assert.ok(page.url().includes(destination));
  assert.equal(await page.getByRole('heading',{name:'More from My Journey',exact:true}).count(),1);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Passed: related stories exclude the current article, links open another article, photos load and layouts fit desktop/tablet/phone.');
}finally{await browser.close();}
