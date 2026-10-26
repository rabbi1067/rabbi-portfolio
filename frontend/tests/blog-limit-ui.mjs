import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.PREVIEW_URL||'http://127.0.0.1:8002';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
  await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await page.goto(origin+'/blogs/',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.cmsReady==='true');
  assert.equal(await page.locator('[data-blog-card]:visible').count(),4);
  assert.equal(await page.locator('[data-blog-more]:visible').count(),0);
  await page.evaluate(()=>{
   const template=document.querySelector('[data-blog-card]').cloneNode(true);
   template.querySelectorAll('.blog-slide:not(:first-child),.blog-photo-arrow,.blog-photo-controls').forEach(n=>n.remove());
   const collection=document.createElement('div');collection.dataset.blogCollection='';collection.dataset.previewLimit='6';
   const grid=document.createElement('div');grid.className='blog-grid';grid.id='fixture-grid';
   for(let i=0;i<9;i++){const card=template.cloneNode(true);card.dataset.category=i<7?'Category A':'Category B';card.querySelector('h3').textContent=`Fixture ${i}`;card.hidden=i>=6;grid.append(card);}
   collection.append(grid);const more=document.createElement('button');more.dataset.blogMore='';more.textContent='View More (3)';collection.append(more);
   document.body.innerHTML='<button data-blog-filter="all">All posts</button><button data-blog-filter="Category A">Category A</button><button data-blog-filter="Category B">Category B</button><input data-blog-search><p data-blog-result></p><p data-blog-empty hidden>No results</p>';
   document.body.append(collection);
  });
  await page.addScriptTag({url:origin+'/js/blogs.js'});
  const more=page.locator('[data-blog-more]');
  assert.equal(await page.locator('[data-blog-card]:visible').count(),6);assert.match(await more.innerText(),/3/);
  await more.click();assert.equal(await page.locator('[data-blog-card]:visible').count(),9);assert.equal(await more.isVisible(),false);
  await page.getByRole('button',{name:'Category A',exact:true}).click();assert.equal(await page.locator('[data-blog-card]:visible').count(),6);assert.match(await more.innerText(),/1/);
  await more.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-blog-card]:visible').count(),7);
  await page.getByRole('button',{name:'Category B',exact:true}).click();assert.equal(await page.locator('[data-blog-card]:visible').count(),2);assert.equal(await more.isVisible(),false);
  await page.locator('[data-blog-search]').fill('Fixture 8');assert.equal(await page.locator('[data-blog-card]:visible').count(),1);
  await page.locator('[data-blog-search]').fill('no-match');assert.equal(await page.locator('[data-blog-card]:visible').count(),0);assert.equal(await page.locator('[data-blog-empty]').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.close();
 }
 console.log('Passed: six initial stories, remaining counts, View More by mouse/keyboard, category/search reset, empty state and responsive layout with nine test-only cards.');
}finally{await browser.close();}
