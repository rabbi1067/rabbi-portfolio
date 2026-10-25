/* Verify menu order, full labels, desktop spacing and mobile destinations. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.PREVIEW_URL || 'http://127.0.0.1:8000';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const qa=resolve(root,'.qa/navigation');
await mkdir(qa,{recursive:true});
const order=['home','about','projects','skills','education','research','certifications','reviews','contact'];
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try {
  for(const width of [1440,1200,1101,820,390]) {
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',isMobile:width<=640,hasTouch:width<=820});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin,{waitUntil:'networkidle'});
    assert.deepEqual(await page.locator('#primary-navigation a').evaluateAll(nodes=>nodes.map(node=>node.hash.slice(1))),order);
    assert.deepEqual(await page.locator('section[id]').evaluateAll(nodes=>nodes.map(node=>node.id)),order);
    const menu=page.locator('#primary-navigation');
    if(width>1100) {
      const boxes=await page.locator('#navbar').evaluate(nav=>{
        const logo=nav.querySelector('.nav-logo').getBoundingClientRect(),links=nav.querySelector('.nav-links').getBoundingClientRect(),right=nav.querySelector('.nav-right').getBoundingClientRect();
        return {logoRight:logo.right,linksLeft:links.left,linksRight:links.right,rightLeft:right.left};
      });
      assert.ok(boxes.linksLeft>=boxes.logoRight+8&&boxes.linksRight<=boxes.rightLeft-8,'Full menu labels fit between logo and controls');
      await page.screenshot({path:resolve(qa,`header-${width}.png`)});
    }
    for(const id of order) {
      if(width<=1100) await page.getByRole('button',{name:'Open navigation'}).click();
      await menu.locator(`a[href="#${id}"]`).click();
      await page.waitForFunction(id=>document.querySelector(`.nav-links a[href="#${id}"]`).getAttribute('aria-current')==='location',id);
      if(width<=1100) assert.equal(await page.locator('#navMenuToggle').getAttribute('aria-expanded'),'false');
    }
    if(width<=1100) {
      await page.getByRole('button',{name:'Open navigation'}).click();
      await page.screenshot({path:resolve(qa,`menu-${width}.png`)});
    }
    assert.equal(await menu.getByRole('link',{name:'Certifications',exact:true}).count(),1);
    assert.equal(await menu.getByRole('link',{name:'Reviews',exact:true}).count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('Passed: professional menu order matches page sections, all nine destinations/active states work, mobile menu closes, full labels fit at 1440/1200/1101/820/390px.');
} finally {await browser.close();}
