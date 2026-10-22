/* Optional local fixtures: popup destinations are mocked, never real outbound requests. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = resolve(root,'.qa/ui-fixtures');
await mkdir(fixture,{recursive:true});
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:8000';
const browser = await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try {
  for (const width of [1440,820,390]) {
    const context = await browser.newContext({viewport:{width,height:1000},isMobile:width<=740,hasTouch:width<=740,reducedMotion:'reduce'});
    await context.route('**/*',route=> {
      const url=route.request().url();
      if(url.startsWith('https://github.example.test/') || url.startsWith('https://demo.example.test/')) return route.fulfill({contentType:'text/html',body:'<h1>Mock destination</h1>'});
      if(url.startsWith(origin)) return route.continue();
      return route.abort();
    });
    const page=await context.newPage();
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.locator('#hero-badges').evaluate((el,html)=>{el.innerHTML=html;},await readFile(resolve(fixture,'badges.html'),'utf8'));
    await page.locator('#home').evaluate(el=>el.style.setProperty('--badge-rows','10'));
    assert.equal(await page.locator('#hero-badges').evaluate(el=>getComputedStyle(el).visibility),'visible');
    assert.equal(await page.locator('.hero-badges .float-card').count(),20);
    const geometry=await page.locator('#heroScene').evaluate(el=> {
      const box=el.getBoundingClientRect(),photo=el.querySelector('.hero-portrait').getBoundingClientRect();
      const cards=Array.from(el.querySelectorAll('.float-card')).map(node=> {
        const r=node.getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
      });
      return {box:{top:box.top,bottom:box.bottom,left:box.left,right:box.right},photo:{left:photo.left,right:photo.right,bottom:photo.bottom},cards};
    });
    for(const [index,card] of geometry.cards.entries()) {
      assert.ok(card.left>=-1&&card.right<=width+1,`${width}: badge fits horizontally`);
      assert.ok(card.top>=geometry.box.top-2&&card.bottom<=geometry.box.bottom+2,`${width}: all 20 badges fit the scene`);
      if(width>740) assert.ok(index%2===0 ? card.right<=geometry.photo.left+2 : card.left>=geometry.photo.right-2,`${width}: badge must not cover the portrait`);
      else assert.ok(card.top>=geometry.photo.bottom-3,`${width}: mobile badges follow the portrait`);
      for(const previous of geometry.cards.slice(0,index)) assert.ok(card.right<=previous.left+1||card.left>=previous.right-1||card.bottom<=previous.top+1||card.top>=previous.bottom-1,`${width}: badge overlap`);
    }
    await page.screenshot({path:resolve(fixture,`roles-20-${width}.png`),fullPage:false});
    await page.locator('.projects-grid').evaluate((el,html)=>{el.innerHTML=html;},await readFile(resolve(fixture,'projects.html'),'utf8'));
    await page.addStyleTag({content:'.reveal{opacity:1!important;transform:none!important}'});
    assert.equal(await page.locator('#project-no-links .proj-action').count(),0);
    assert.equal(await page.locator('#project-only-github .proj-action').count(),1);
    assert.equal(await page.locator('#project-only-demo .proj-action').count(),1);
    assert.equal(await page.locator('#project-both-links .proj-action').count(),2);
    assert.equal(await page.locator('#project-both-links .proj-tag').count(),20);
    const slots = await page.locator('#projects').evaluate(section => {
      const size = selector => {
        const row = section.querySelector(selector + ' .proj-actions').getBoundingClientRect();
        const button = section.querySelector(selector + ' .proj-action').getBoundingClientRect();
        return { rowWidth:row.width, rowLeft:row.left, rowRight:row.right, buttonWidth:button.width, buttonLeft:button.left, buttonRight:button.right };
      };
      return { github:size('#project-only-github'), demo:size('#project-only-demo') };
    });
    for (const slot of Object.values(slots)) assert.ok(Math.abs(slot.buttonWidth-(slot.rowWidth-10)/2)<1,'One optional button still occupies only half the row');
    assert.equal(slots.github.buttonLeft,slots.github.rowLeft,'GitHub stays in the left half');
    assert.equal(slots.demo.buttonRight,slots.demo.rowRight,'Live Demo stays in the right half');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    for(const cls of ['proj-action-github','proj-action-demo']) {
      const button=page.locator(`#project-both-links .${cls}`);
      const nextPage=context.waitForEvent('page');
      await button.click();
      const popup=await nextPage;
      await popup.waitForLoadState('domcontentloaded');
      assert.ok(popup.url().startsWith(cls==='proj-action-github'?'https://github.example.test/':'https://demo.example.test/'));
      assert.equal(new URL(page.url()).origin,origin);
      await popup.close();
    }
    await page.locator('#project-both-links').scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(fixture,`project-buttons-${width}.png`)});
    await context.close();
  }
  console.log('Passed: 20 portrait tags without overlap at desktop/tablet/phone; optional project buttons; 20 project tags; GitHub/Live Demo open new tabs; original page stays open.');
} finally {await browser.close();}
