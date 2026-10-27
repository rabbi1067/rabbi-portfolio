/* Verify the highlights UI against the isolated local preview. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const origin=process.env.PREVIEW_URL||'http://127.0.0.1:8000';
await mkdir('.qa/highlights',{recursive:true});
try{
for(const width of [1440,820,390,320]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await page.goto(origin+'/#selected-highlights',{waitUntil:'networkidle'});
 const region=page.locator('#selected-highlights');const rail=page.locator('#highlights-rail');
 await region.scrollIntoViewIfNeeded();
 assert.equal(await rail.locator('.highlight-card:not([data-highlight-clone])').count(),10);
 assert.equal(await region.getByRole('button',{name:/view all/i}).count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
 assert.equal(await page.getByRole('button',{name:'Play highlight scrolling'}).count(),1,'Reduced motion disables autoplay');
 for(const theme of ['dark','light']){
   if(theme==='light')await page.getByRole('button',{name:'Toggle dark and light mode'}).click();
   await region.scrollIntoViewIfNeeded();
   for(const img of await rail.locator('.highlight-card:not([data-highlight-clone]) img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());}
   await rail.evaluate(el=>{el.scrollLeft=0});await region.scrollIntoViewIfNeeded();
   await page.screenshot({path:`.qa/highlights/gallery-${width}-${theme}.png`});
 }
 // Click a card image and card text, confirming both navigate directly.
 await rail.locator('.highlight-card:not([data-highlight-clone])').first().locator('img').click();
 assert.equal(new URL(page.url()).hash,'#project-orbitcart');
 assert.equal(await page.locator('#project-orbitcart').isVisible(),true);
 await region.scrollIntoViewIfNeeded();
 await rail.locator('.highlight-card:not([data-highlight-clone])[href="#project-hotel-booking"] h3').click();
 assert.equal(new URL(page.url()).hash,'#project-hotel-booking');
 // Even a filtered project is revealed before navigating to it.
 await page.locator('#projects').scrollIntoViewIfNeeded();
 await page.locator('[data-filter-grid="project-cards"] button[data-filter="Software"]').click();
 assert.equal(await page.locator('#project-argolink').isVisible(),false);
 await region.scrollIntoViewIfNeeded();
 await rail.locator('.highlight-card:not([data-highlight-clone])[href="#project-argolink"]').click();
 assert.equal(new URL(page.url()).hash,'#project-argolink');
 assert.equal(await page.locator('#project-argolink').isVisible(),true);
 assert.deepEqual(errors,[]);
 await page.close();
}
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
await page.goto(origin+'/#selected-highlights',{waitUntil:'networkidle'});
await page.locator('#selected-highlights').scrollIntoViewIfNeeded();await page.mouse.move(1400,950);
const position=()=>page.locator('#highlights-rail').evaluate(el=>el.scrollLeft);
let start=await position();await page.waitForTimeout(900);assert.ok((await position())>start+4,'Gallery automatically moves');
const bounds=await page.locator('#highlights-rail').boundingBox();await page.mouse.move(bounds.x+bounds.width*.3,bounds.y+bounds.height*.45);start=await position();await page.waitForTimeout(500);assert.ok(Math.abs((await position())-start)<2,'Hover pauses movement');
await page.mouse.move(1400,950);
await page.getByRole('button',{name:'Pause highlight scrolling'}).click();start=await position();await page.waitForTimeout(500);assert.ok(Math.abs((await position())-start)<2,'Pause control stops movement');
await page.close();
console.log('Passed: 10 highlights; no View all; direct image/text links; filtered project navigation; autoplay/hover/pause; reduced motion; dark/light 1440/820/390/320px; no overflow or JS errors.');
}finally{await browser.close()}
