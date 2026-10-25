/* Local gallery regression checks; all external requests are blocked. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:8000';
const qa = resolve(root,'.qa/showcase');
await mkdir(qa,{recursive:true});
const browser = await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try {
  for (const width of [1440,820,390,320]) {
    const context = await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',isMobile:width<=640,hasTouch:width<=820});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin,{waitUntil:'networkidle'});
    assert.equal(await page.locator('#competitive').count(),0,'Duplicate profile section is removed');
    assert.equal(await page.locator('.footer-social').count(),4);
    for(const social of await page.locator('.footer-social').all()) {
      assert.equal(await social.getAttribute('target'),'_blank');
      assert.ok((await social.getAttribute('rel')).includes('noopener'));
    }
    await page.locator('.showcase-media img').evaluateAll(images=>images.forEach(image=>image.loading='eager'));
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('.showcase-media img')).every(image=>image.complete&&image.naturalWidth>0));
    assert.equal(await page.locator('.proj-thumbnail').count(),0);
    assert.equal(await page.locator('.cert-thumbnail').count(),1);
    for (const id of ['projects','certifications']) {
      const section=page.locator('#'+id);
      const cards=section.locator('.proj-card, .cert-card');
      const all=await cards.count();
      const filter=section.getByRole('button',{name:'Research',exact:true});
      await filter.click();
      assert.equal(await filter.getAttribute('aria-pressed'),'true');
      assert.equal(await cards.filter({visible:true}).count(),2);
      assert.ok((await section.locator('[role="status"]').textContent()).includes('2 items'));
      await section.getByRole('button',{name:'All',exact:true}).click();
      assert.equal(await cards.filter({visible:true}).count(),all);
      const ratios=await section.locator('.showcase-media').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return r.width/r.height;}));
      assert.ok(ratios.every(ratio=>Math.abs(ratio-16/9)<.02),'Covers retain a consistent 16:9 frame');
    }
    const firstImage=page.locator('.cert-thumbnail').first();
    await firstImage.evaluate(image=>{
      image.closest('picture')?.querySelectorAll('source').forEach(source=>source.srcset='images/missing-test-thumbnail.webp');
      image.src='images/missing-test-thumbnail.png';
    });
    await page.waitForFunction(()=>document.querySelector('.cert-thumbnail').src.endsWith('/images/certificate-default.svg')&&document.querySelector('.cert-thumbnail').naturalWidth>0);
    const button=page.locator('.proj-action-github').first();
    const slot=await button.evaluate(el=>({button:el.getBoundingClientRect().width,row:el.parentElement.getBoundingClientRect().width}));
    assert.ok(Math.abs(slot.button-(slot.row-10)/2)<1,'Single GitHub link keeps half the row');
    if(width<=1100) await page.getByRole('button',{name:'Open navigation'}).click();
    await page.locator('#primary-navigation').getByRole('link',{name:'Research',exact:true}).click();
    assert.ok((await page.locator('#research-heading').boundingBox()).y<400,'Research menu opens publications section');
    assert.equal(await page.locator('.paper-card').count(),0,'No fabricated papers');
    assert.equal(await page.locator('.research-empty').count(),1);
    if(width<=1100) await page.getByRole('button',{name:'Open navigation'}).click();
    await page.locator('#primary-navigation').getByRole('link',{name:'Reviews',exact:true}).click();
    assert.ok(await page.locator('#reviews-heading').isVisible());
    assert.ok((await page.locator('#reviews-heading').boundingBox()).y<400,'Review menu scrolls to the section');
    assert.equal(await page.locator('.review-card:not([data-review-clone])').count(),4,'Four owner-supplied reviewers');
    assert.equal(await page.locator('.review-card:not([data-review-clone]) .review-rating').count(),0,'Ratings are omitted');
    await page.getByRole('link',{name:'Share your experience'}).click();
    assert.equal(new URL(page.url()).hash,'#contact');
    await page.locator('#projects').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await page.waitForFunction(()=>document.querySelector('.nav-links a[href="#projects"]').getAttribute('aria-current')==='location');
    await page.screenshot({path:resolve(qa,`projects-${width}.png`)});
    await page.locator('#certifications').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await page.waitForFunction(()=>document.querySelector('.nav-links a[href="#certifications"]').getAttribute('aria-current')==='location');
    await page.screenshot({path:resolve(qa,`certifications-${width}.png`)});
    await page.locator('#reviews').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await page.screenshot({path:resolve(qa,`reviews-${width}.png`)});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'No horizontal page overflow');
    await page.locator('#themeToggle').click();
    await page.waitForTimeout(350);
    await page.screenshot({path:resolve(qa,`reviews-light-${width}.png`)});
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('Passed: responsive gallery covers, default and broken-image fallback, independent filters, optional half-width links, Review navigation and contact CTA at 1440/820/390/320px.');
} finally { await browser.close(); }
