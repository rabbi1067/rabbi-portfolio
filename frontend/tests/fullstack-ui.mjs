/* Run against the isolated local backend and a frontend with API_BASE_URL configured. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.PREVIEW_URL||'http://127.0.0.1:8000';
const qa=resolve('.qa/fullstack');await mkdir(qa,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[];
try {
  for(const width of [1440,820,390,320]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>/^http:\/\/(127\.0\.0\.1|localhost):/.test(route.request().url())?route.continue():route.abort());
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelectorAll('.review-dot').length>0);
    assert.equal(await page.locator('#certificate-cards .cert-card:visible').count(),6);
    assert.ok(await page.locator('#site-footer .administrator-link').getAttribute('href'));
    assert.ok(await page.locator('.hero-portrait').evaluate(el=>el.currentSrc.includes('/media/')),'Public content uses backend-hosted media');
    for(const theme of ['dark','light']){
      if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#themeToggle').click();
      await page.locator('#site-footer').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,`${width}/${theme}: no horizontal overflow`);
      assert.equal(await page.locator('.footer-explore nav').evaluate(el=>getComputedStyle(el).position),'static');
      await page.screenshot({path:resolve(qa,`footer-${width}-${theme}.png`)});
    }
    await page.locator('.administrator-link').click();
    await page.getByRole('heading',{name:'Welcome back.',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'Admin login fits viewport');
    await page.screenshot({path:resolve(qa,`login-${width}.png`)});
    if(width===1440){
      await page.getByRole('textbox',{name:'Email',exact:true}).fill(process.env.SMOKE_EMAIL);
      await page.getByRole('textbox',{name:'Password',exact:true}).fill(process.env.SMOKE_PASSWORD);
      await page.getByRole('button',{name:'Sign in to Studio →',exact:true}).click();
      await page.getByRole('heading',{name:'Home & About',exact:true}).waitFor();
      assert.equal(await page.getByRole('navigation',{name:'Content sections'}).locator('button').count(),12);
      await page.getByRole('button',{name:'Projects',exact:true}).click();
      assert.ok(await page.locator('.record').count()>=6);
      await page.screenshot({path:resolve(qa,'studio-projects.png')});
      await page.getByRole('button',{name:'Research papers',exact:true}).click();
      await page.getByRole('button',{name:'+ New record',exact:true}).click();
      await page.getByRole('textbox',{name:'DOI or DOI URL',exact:true}).waitFor();
      await page.getByRole('checkbox',{name:'Peer-reviewed',exact:true}).waitFor();
      await page.getByRole('textbox',{name:'Publication date',exact:true}).waitFor();
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Passed: connected frontend, backend media URLs, preserved certificates preview, responsive dark/light footer, administrator login, all 12 editor sections, project list and publication fields.');
}finally{await browser.close();}
