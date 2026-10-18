/* Optional browser regression checks for the reference-inspired home section. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const qa = resolve(root, '.qa/home-redesign');
await mkdir(qa, { recursive: true });
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:8000';
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const errors = [];
const report = [];
const sizes = [
  ['pc',1920,1080], ['desktop',1440,1000], ['laptop',1366,768], ['small-laptop',1280,800],
  ['tablet-landscape',1024,768], ['tablet',820,1180], ['ipad',768,1024],
  ['small-tablet',600,900], ['large-phone',430,932], ['phone',390,844], ['small-phone',360,800], ['compact',320,640],
];
try {
  for (const [name,width,height] of sizes) {
    const context = await browser.newContext({ viewport: { width,height }, isMobile:width<=640, hasTouch:width<=1024, deviceScaleFactor:1 });
    const page = await context.newPage();
    page.on('pageerror',error=>errors.push(`${name}: ${error.message}`));
    await page.route('**/*',route=> {
      const url=route.request().url();
      if (url.includes('@emailjs/')) return route.fulfill({ contentType:'text/javascript',body:'window.emailjs={init(){},sendForm(){return Promise.resolve()}};' });
      if (url.startsWith(origin)) return route.continue();
      // Identical deterministic font fallbacks across all sizes; live fonts get a separate visual check.
      return route.abort();
    });
    await page.goto(origin+'/', { waitUntil:'networkidle' });
    await page.waitForFunction(()=>document.querySelector('.hero-portrait').complete && document.querySelector('.hero-portrait').naturalWidth>0);
    await page.waitForTimeout(1250);
    const dimensions=await page.evaluate(()=> {
      const rect=selector=> {
        const el=document.querySelector(selector),r=el.getBoundingClientRect();
        return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right,display:getComputedStyle(el).display};
      };
      return {viewport:innerWidth,document:document.documentElement.scrollWidth,home:rect('#home'),intro:rect('.hero-intro'),portrait:rect('.hero-portrait'),scene:rect('.hero-stage'),buttons:rect('.hero-btns'),stats:rect('.hero-stats'),scroll:rect('#scrollCue'),nav:rect('#navbar')};
    });
    assert.equal(dimensions.document,width,`${name}: horizontal page overflow`);
    assert.ok(dimensions.portrait.width>80&&dimensions.portrait.height>=250,`${name}: visible portrait`);
    assert.ok(dimensions.portrait.x>=0&&dimensions.portrait.right<=width,`${name}: portrait fits viewport`);
    assert.ok(dimensions.intro.bottom<=dimensions.scene.y+1,`${name}: intro and portrait must not overlap`);
    assert.ok(dimensions.scroll.bottom<=dimensions.home.bottom,`${name}: scroll button inside hero`);
    assert.ok(dimensions.buttons.width<=width,`${name}: buttons fit`);
    assert.ok(dimensions.stats.right<=width,`${name}: stats fit`);
    assert.equal(await page.locator('.hero-badges .float-card').count(),4);
    assert.ok(dimensions.stats.y>=dimensions.buttons.bottom,`${name}: statistics belong below the CV/Skills buttons`);
    assert.ok(Math.abs(dimensions.stats.x+dimensions.stats.width/2-width/2)<2,`${name}: statistics are centered`);
    const clippedText=await page.locator('#home').evaluate(el=>Array.from(el.querySelectorAll('strong, .float-card-text span, .stat-label')).filter(node=>node.scrollWidth>node.clientWidth+1).map(node=>node.textContent));
    assert.deepEqual(clippedText,[],`${name}: text must not clip`);
    if (width<=1100) {
      await page.getByRole('button',{name:'Open navigation'}).click();
      assert.equal(await page.locator('#navMenuToggle').getAttribute('aria-expanded'),'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#navMenuToggle').getAttribute('aria-expanded'),'false');
      await page.getByRole('button',{name:'Open navigation'}).click();
      await page.locator('#primary-navigation a[href="#skills"]').click();
      assert.equal(await page.locator('#navMenuToggle').getAttribute('aria-expanded'),'false');
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await page.waitForTimeout(250);
    }
    if (width>=1280) {
      const stage=await page.locator('.hero-stage').boundingBox();
      await page.mouse.move(stage.x+stage.width*.8,stage.y+stage.height*.4);
      await page.waitForTimeout(100);
      const angle=await page.locator('#heroScene').evaluate(el=>el.style.getPropertyValue('--scene-y'));
      assert.ok(parseFloat(angle)>0,'Desktop pointer activates portrait depth');
      await page.mouse.move(10,10);
    }
    await page.addStyleTag({ content:'.cursor,.cursor-follower{display:none!important}' });
    await page.screenshot({path:resolve(qa,name+'.png'),fullPage:false});
    if (['desktop','phone'].includes(name)) await page.screenshot({path:resolve(qa,name+'-full.png'),fullPage:true});
    await page.locator('#themeToggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.waitForTimeout(350);
    if (['desktop','phone','tablet'].includes(name)) await page.screenshot({path:resolve(qa,name+'-light.png'),fullPage:false});
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.hero-aura').evaluate(el=>getComputedStyle(el).animationName),'none');
    report.push({name,width,height,heroHeight:dimensions.home.height,overflow:dimensions.document-width,portraitVisible:true,navigation:true,lightTheme:true,reducedMotion:true});
    await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(resolve(qa,'report.json'),JSON.stringify({devices:report,errors},null,2));
  console.log(JSON.stringify({devices:report,errors},null,2));
} finally { await browser.close(); }
