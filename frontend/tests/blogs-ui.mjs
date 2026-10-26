import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.PREVIEW_URL||'http://127.0.0.1:8001';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
await mkdir('frontend/.qa/blogs',{recursive:true});
try{
 for(const width of [1440,820,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/blogs/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.cmsReady==='true');
  assert.equal(await page.locator('[data-blog-card]').count(),3);
  await page.locator('[data-blog-search]').fill('not-a-story');assert.equal(await page.locator('[data-blog-card]:visible').count(),0);
  await page.locator('[data-blog-search]').fill('meetup');assert.equal(await page.locator('[data-blog-card]:visible').count(),1);
  await page.locator('[data-blog-card]:visible .blog-read').click();
  await page.waitForFunction(()=>document.documentElement.dataset.cmsReady==='true');
  assert.match(await page.locator('h1').innerText(),/Competitive Programming Meetup/);
  assert.equal(await page.locator('.blog-article > [data-blog-carousel] .blog-slide').count(),2);
  const gallery=page.locator('.blog-article > [data-blog-carousel]');
  for(const index of [1,0]){
   await gallery.locator(`[data-blog-dot="${index}"]`).click();
   const image=gallery.locator('.blog-slide.is-active img');await image.evaluate(img=>img.decode());
   assert.ok(await image.evaluate(img=>img.naturalWidth>0));
   assert.equal(await gallery.getAttribute('data-index'),String(index));
  }
  for(const theme of ['dark','light']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#themeToggle').click();
   await page.waitForTimeout(450);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  }
  await page.locator('#themeToggle').click();await page.waitForTimeout(450);await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`frontend/.qa/blogs/article-${width}.png`});
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Passed: blog search, article navigation, both photos, dark/light themes, no overflow or JS errors at 1440/820/390/320px.');
}finally{await browser.close();}
