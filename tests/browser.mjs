/* Optional browser QA. Supply an installed Playwright module/browser; never sends email. */
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const qa = resolve(root, '.qa');
await mkdir(qa, { recursive: true });
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.yml':'text/yaml', '.pdf':'application/pdf', '.png':'image/png', '.jpeg':'image/jpeg', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const original = url.pathname.startsWith('/original/');
    const base = original ? root : output;
    let pathname = decodeURIComponent(url.pathname.replace(/^\/(original|portfolio)\//, '/'));
    if (original && pathname === '/') pathname = '/.qa/original.html';
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(base, '.' + pathname);
    if (!file.startsWith(base + sep)) throw new Error('Invalid path');
    response.writeHead(200, { 'Content-Type':types[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const report = { checks: [], geometry: {}, consoleErrors: [] };
try {
  browser = await chromium.launch({ headless:true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath:process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport:{ width:1440,height:1000 } });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('@emailjs/browser')) return route.fulfill({contentType:'text/javascript',body:'window.emailjs={init(){},sendForm(){window.testEmailSent=true;return Promise.resolve()}};'});
    if (url.includes('decap-cms@3.16.3')) {
      try { return await route.fulfill({contentType:'text/javascript',body:await readFile(resolve(qa,'decap-cms.js')),headers:{'access-control-allow-origin':'*'}}); }
      catch { return route.abort(); }
    }
    if (url.startsWith(origin)) return route.continue();
    return route.abort();
  });
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  await page.goto(origin+'/portfolio/');
  await page.locator('#themeToggle').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.locator('#themeToggle').click();
  report.checks.push('Keyboard theme toggle and saved preference');
  for (const selector of ['#home','#about','#projects','#skills','#experience','#research','#certifications','#reviews','#contact']) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
  }
  assert.equal(await page.locator('.proj-card').count(),9);
  assert.equal(await page.locator('.cert-card').count(),8);
  assert.equal(await page.locator('.skill-card').count(),6);
  assert.equal(await page.locator('.sk-tag').count(),31);
  assert.equal(await page.locator('a[href="CV.pdf"]').count(),1);
  assert.equal((await page.request.get(origin+'/portfolio/CV.pdf')).status(),200);
  report.checks.push('All nine sections, grouped skill chips, projects, certificates and stable CV');
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#fname').fill('Browser QA');
  await page.locator('#femail').fill('qa@example.com');
  await page.locator('#fsubject').fill('Local simulated test');
  await page.locator('#fmessage').fill('No real message is sent.');
  await page.locator('.form-submit').click();
  await page.waitForFunction(()=>window.testEmailSent===true);
  await page.waitForFunction(()=>document.querySelector('.form-submit').disabled===false);
  assert.equal(await page.locator('#fname').inputValue(),'');
  report.checks.push('Contact form with mocked EmailJS: validation, submit, reset, re-enable');
  await page.route('**/hidden-sections.html',async route=>route.fulfill({contentType:'text/html',body:await readFile(resolve(qa,'hidden-sections.html'),'utf8')}));
  await page.goto(origin+'/portfolio/hidden-sections.html');
  assert.equal(await page.locator('#contact, #projects, #reviews, #research').count(),0);
  await page.locator('#themeToggle').click();
  report.checks.push('Hidden sections are omitted and remaining scripts/theme still work');
  await page.goto(origin+'/portfolio/admin/');
  await page.waitForFunction(()=>document.querySelector('#setup-status').textContent.includes('disabled'));
  report.checks.push('Unconfigured admin fails closed');
  try {
    await stat(resolve(qa,'decap-cms.js'));
    await page.route('**/admin/status.json',route=>route.fulfill({json:{configured:true}}));
    await page.goto(origin+'/portfolio/admin/');
    try { await page.getByRole('button',{name:/Login with GitHub/i}).waitFor({timeout:30000}); }
    catch (error) {
      await page.screenshot({path:resolve(qa,'admin-error.png')});
      console.error(await page.locator('body').innerText());
      throw error;
    }
    await page.screenshot({path:resolve(qa,'admin-login.png')});
    report.checks.push('Pinned Decap bundle accepts generated schema and displays GitHub login (no sign-in attempted)');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const [label,width] of [['desktop',1440],['mobile',390]]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(origin+'/portfolio/');
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1!important;transform:none!important}'});
    report.geometry[label] = { current: await page.locator('section').evaluateAll(nodes=>Object.fromEntries(nodes.map(el=>[el.id,{x:el.offsetLeft,y:el.offsetTop,width:el.offsetWidth,height:el.offsetHeight}]))) };
    await page.screenshot({path:resolve(qa,`${label}.png`),fullPage:true});
    const overflow = await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));
    report.geometry[label].overflow = overflow;
    try {
      await stat(resolve(qa,'original.html'));
      await page.goto(origin+'/original/');
      await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1!important;transform:none!important}'});
      report.geometry[label].original = await page.locator('section').evaluateAll(nodes=>Object.fromEntries(nodes.map(el=>[el.id,{x:el.offsetLeft,y:el.offsetTop,width:el.offsetWidth,height:el.offsetHeight}])));
      for (const [id, geometry] of Object.entries(report.geometry[label].original)) {
        if (id === 'home' || !report.geometry[label].current[id]) continue;
        const current = report.geometry[label].current[id];
        assert.equal(current.width, geometry.width, `${id} width must be preserved`);
        if (!['projects','skills','experience','certifications','reviews','research'].includes(id)) assert.equal(current.height, geometry.height, `${id} height must be preserved`);
      }
      await page.screenshot({path:resolve(qa,`${label}-original.png`),fullPage:true});
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  assert.deepEqual(report.consoleErrors,[]);
  report.checks.push('No uncaught JavaScript errors at desktop/mobile sizes');
  await (await import('node:fs/promises')).writeFile(resolve(qa,'browser-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
