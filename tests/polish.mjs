/* Verify image delivery, skill content, responsive layout and simulated contact states. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.PREVIEW_URL || 'http://127.0.0.1:8000';
const qa=resolve(dirname(fileURLToPath(import.meta.url)),'../.qa/polish');
await mkdir(qa,{recursive:true});
const report=[];
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try {
  for(const width of [1440,820,769,768,390,320]) {
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',isMobile:width<=640,hasTouch:width<=820});
    await context.route('**/*',route=>{
      const url=route.request().url();
      if(url.includes('@emailjs/browser')) return route.fulfill({contentType:'text/javascript',body:`window.emailjs={init(){},sendForm(){return new Promise((resolve,reject)=>{window.completeTestSend=()=>window.failTestSend?reject(new Error('Simulated failure')):resolve();});}};`});
      return url.startsWith(origin)?route.continue():route.abort();
    });
    const page=await context.newPage();
    const errors=[],dialogs=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
    await page.goto(origin,{waitUntil:'networkidle'});
    assert.equal((await page.locator('#hero-heading').innerText()).trim(),"Hello I’m Fazley Rabbi\nAI Engineer & Full Stack Developer");
    assert.equal((await page.locator('#home .stat-num').allTextContents())[1],'8');
    const images=await page.locator('.nav-logo img,.hero-portrait').evaluateAll(nodes=>nodes.map(img=>({src:img.currentSrc,loaded:img.naturalWidth>0,width:img.naturalWidth})));
    assert.ok(images.every(img=>img.loaded && img.src.includes('/images/responsive/') && img.src.endsWith('.webp')));
    assert.ok(images[0].width<=96,'Logo uses a small image instead of downloading the 3MB original');
    for(const link of await page.getByRole('link',{name:'LinkedIn',exact:true}).all()) assert.equal(await link.getAttribute('href'),'https://www.linkedin.com/in/fazleyrabbi1067');
    assert.equal(await page.locator('#scrollCue').evaluate(el=>getComputedStyle(el).display==='none'),width<=768);
    await page.screenshot({path:resolve(qa,`home-${width}.png`)});
    await page.locator('#skills').scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.skill-card').count(),6);
    assert.equal(await page.locator('.sk-tag').count(),31);
    assert.deepEqual(await page.locator('.sk-title').allTextContents(),['Languages','Web & Backend','Development','AI & Machine Learning','Research & Writing','Design & Content']);
    assert.ok(await page.locator('.skill-card').evaluateAll(cards=>cards.every(card=>card.scrollWidth<=card.clientWidth+1)),'Skill labels stay inside their cards');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
    assert.equal(await page.locator('#experience .tl-desc li').count(),9);
    assert.equal(await page.locator('.review-rating').count(),0);
    assert.equal(await page.locator('.credential-id').count(),0);
    assert.equal(await page.locator('.proj-thumbnail').count(),0);
    for(const theme of ['dark','light']) {
      if(await page.locator('html').getAttribute('data-theme')!==theme) await page.locator('#themeToggle').click();
      await page.waitForTimeout(350);
      const contrasts=await page.locator('.sk-tag').evaluateAll(nodes=>{
        const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
        const lum=values=>values.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
        return nodes.map(node=>{
          const fg=lum(rgb(getComputedStyle(node).color));
          const bg=lum(rgb(getComputedStyle(node.closest('.skill-card')).backgroundColor));
          return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
        });
      });
      assert.ok(contrasts.every(value=>value>=4.5),'Skill chip text meets 4.5:1 contrast in '+theme);
    }
    await page.locator('#themeToggle').click();
    if(width<=768) assert.equal(await page.locator('.skills-wrapper').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
    await page.screenshot({path:resolve(qa,`skills-${width}.png`)});
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.locator('#fname').fill('Local QA');
    await page.locator('#femail').fill('qa@example.test');
    await page.locator('#fsubject').fill('Simulated submission');
    await page.locator('#fmessage').fill('This test never sends real email.');
    await page.locator('.form-submit').click();
    await page.waitForFunction(()=>typeof window.completeTestSend==='function');
    assert.equal(await page.locator('#contact-status').getAttribute('data-state'),'sending');
    assert.ok(await page.locator('.form-submit').isDisabled());
    await page.evaluate(()=>window.completeTestSend());
    await page.waitForFunction(()=>document.querySelector('#contact-status').dataset.state==='success');
    assert.equal(await page.locator('#fname').inputValue(),'');
    assert.ok(await page.locator('.form-submit').isEnabled());
    await page.screenshot({path:resolve(qa,`contact-success-${width}.png`)});
    await page.locator('#fname').fill('Preserved name');
    await page.locator('#femail').fill('qa@example.test');
    await page.locator('#fsubject').fill('Retry test');
    await page.locator('#fmessage').fill('Preserved message');
    await page.evaluate(()=>{window.failTestSend=true;window.completeTestSend=undefined;});
    await page.locator('.form-submit').click();
    await page.waitForFunction(()=>typeof window.completeTestSend==='function');
    await page.evaluate(()=>window.completeTestSend());
    await page.waitForFunction(()=>document.querySelector('#contact-status').dataset.state==='error');
    assert.equal(await page.locator('#fmessage').inputValue(),'Preserved message');
    assert.ok(await page.locator('.form-submit').isEnabled());
    await page.evaluate(()=>window.emailjs=undefined);
    await page.locator('.form-submit').click();
    await page.waitForFunction(()=>document.querySelector('#contact-form').getAttribute('aria-busy')==='false');
    assert.equal(await page.locator('#contact-status').getAttribute('data-state'),'error');
    assert.deepEqual(dialogs,[],'Contact status never opens popup alerts');
    assert.deepEqual(errors,[]);
    report.push({width,images,skillCount:31,certificateCount:8,inlineContactStates:['sending','success','error','SDK unavailable']});
    await context.close();
  }
  await writeFile(resolve(qa,'report.json'),JSON.stringify(report,null,2));
  console.log('Passed: AI Engineer headline, responsive WebP/logo images, unified LinkedIn, 6 skill categories/31 chips, exact certificate count, inline contact loading/success/error/retry with preserved input; 1440/820/390/320px. No real email sent.');
} finally {await browser.close();}
