/* Local carousel and section scroll cue checks; external requests are blocked. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:8000';
const qa=resolve(root,'.qa/reviews');
await mkdir(qa,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try {
  for(const width of [1440,820,390,320]) {
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:width===1440?'no-preference':'reduce',isMobile:width<=640,hasTouch:width<=820});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin,{waitUntil:'networkidle'});
    assert.equal(await page.locator('.review-card:not([data-review-clone])').count(),4);
    assert.equal(await page.locator('.review-sample-label').count(),0);
    assert.equal(await page.locator('.review-card:not([data-review-clone]) blockquote').count(),4);
    assert.equal(await page.locator('.review-card:not([data-review-clone]) .review-rating').count(),0);
    await page.locator('#reviews').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await page.mouse.move(5,5);
    const track=page.locator('.review-track');
    const cue=page.locator('#scrollCue');
    await page.waitForFunction(()=>document.getElementById('scrollCue').getAttribute('aria-hidden')==='false');
    assert.equal(await cue.getAttribute('href'),'#contact');
    await page.waitForFunction(()=>document.querySelector('.review-track .is-active'));
    const focus=await track.evaluate(el=> {
      const active=el.querySelector('.is-active'),a=active.getBoundingClientRect(),t=el.getBoundingClientRect();
      const neighbor=active.nextElementSibling || active.previousElementSibling;
      return {center:a.x+a.width/2,viewport:t.x+t.width/2,activeWidth:a.width,neighborWidth:neighbor.getBoundingClientRect().width,activeOpacity:Number(getComputedStyle(active).opacity),neighborOpacity:Number(getComputedStyle(neighbor).opacity)};
    });
    assert.ok(Math.abs(focus.center-focus.viewport)<3,'Focused card is centered');
    assert.ok(focus.activeWidth>focus.neighborWidth,'Center card is larger');
    assert.ok(focus.activeOpacity>focus.neighborOpacity,'Side cards fade');
    assert.equal(await page.locator('[data-review-clone]:not([inert])').count(),0,'Loop copies cannot receive focus');
    const order=await page.locator('.review-card:not([data-review-clone])').evaluateAll(cards=>cards.map(card=>{
      const marker=card.querySelector('.review-quote-mark').getBoundingClientRect();
      const quote=card.querySelector('blockquote').getBoundingClientRect();
      const person=card.querySelector('.review-person').getBoundingClientRect();
      return {markerBottom:marker.bottom,quoteTop:quote.top,quoteBottom:quote.bottom,personTop:person.top};
    }));
    assert.ok(order.every(card=>card.markerBottom<=card.quoteTop+1 && card.quoteBottom<=card.personTop+1),'Quote marker appears above the review; names and roles appear below');
    if(width===1440) {
      await page.waitForFunction(()=>document.querySelector('.review-carousel').dataset.activeReview==='1',{},{timeout:7000});
      await page.getByRole('button',{name:'Pause automatic review movement'}).click();
      assert.equal(await page.getByRole('button',{name:'Play automatic review movement'}).getAttribute('aria-pressed'),'true');
      await page.waitForTimeout(600);
      const stopped=await track.evaluate(el=>el.scrollLeft);
      await page.mouse.move(5,5);
      await page.locator('#navbar a').first().focus();
      await page.waitForTimeout(4700);
      assert.ok(Math.abs((await track.evaluate(el=>el.scrollLeft))-stopped)<2,'Pause persists after focus/hover leaves');
    } else {
      assert.equal(await page.getByRole('button',{name:'Automatic movement disabled for reduced motion'}).isDisabled(),true);
      await page.getByRole('button',{name:'Next reviews'}).click();
      await page.waitForFunction(()=>document.querySelector('.review-carousel').dataset.activeReview==='1');
    }
    await track.focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(()=>document.querySelector('.review-carousel').dataset.activeReview==='0');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('.review-carousel').dataset.activeReview==='1');
    const clipping=await page.locator('.review-card figcaption strong, .review-card figcaption div > span').evaluateAll(nodes=>nodes.filter(node=>node.scrollWidth>node.clientWidth+2).map(node=>node.textContent));
    assert.deepEqual(clipping,[],'Reviewer names and positions wrap');
    await page.mouse.move(width-8,300);
    await page.mouse.wheel(0,120);
    await page.waitForFunction(()=>document.getElementById('scrollCue').getAttribute('aria-hidden')==='true');
    await page.locator('#projects').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await page.waitForFunction(()=>document.getElementById('scrollCue').getAttribute('aria-hidden')==='false');
    assert.equal(await cue.getAttribute('href'),'#skills');
    await page.locator('#reviews').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await page.locator('#navbar a').first().focus();
    await page.waitForTimeout(400);
    await page.screenshot({path:resolve(qa,`reviews-${width}.png`)});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    await page.locator('#themeToggle').click();
    await page.waitForTimeout(350);
    await page.screenshot({path:resolve(qa,`reviews-light-${width}.png`)});
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('Passed: four approved quote-only reviews; centered card with faded neighbors; automatic movement and pause; keyboard/manual navigation; reduced motion; per-section cue targets and hide-on-scroll; 1440/820/390/320px layouts.');
} finally { await browser.close(); }
