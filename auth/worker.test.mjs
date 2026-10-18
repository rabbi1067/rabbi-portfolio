import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { handle } from './worker.mjs';

const env = { GITHUB_CLIENT_ID:'test-client', GITHUB_CLIENT_SECRET:'test-secret',
  GITHUB_REPOSITORY:'owner/portfolio', ADMIN_ORIGIN:'https://owner.github.io',
  AUTH_ORIGIN:'https://oauth.example.com', ALLOWED_USERS:'owner', OAUTH_SCOPE:'public_repo' };
const req = path => new Request(env.AUTH_ORIGIN + path);

async function login() {
  const result = await handle(req('/auth?provider=github'),env);
  const cookie = result.headers.get('set-cookie').split(';')[0];
  const state = new URL(result.headers.get('location')).searchParams.get('state');
  const request = new Request(env.AUTH_ORIGIN + '/callback?code=test-code&state='+state,{headers:{Cookie:cookie}});
  return { request, cookie, state, result };
}
function mockGithub({login='owner',push=true,exchangeError=false}={}) {
  return async (url, options) => {
    if (url.endsWith('/access_token')) {
      const payload=JSON.parse(options.body);
      assert.equal(payload.client_secret,'test-secret');
      assert.ok(payload.code_verifier);
      return Response.json(exchangeError?{error:'denied'}:{access_token:'MOCK_ACCESS_TOKEN'});
    }
    if (url.endsWith('/user')) return Response.json({login});
    if (url.endsWith('/repos/owner/portfolio')) return Response.json({permissions:{push}});
    throw new Error('Unexpected upstream');
  };
}

test('unconfigured service fails closed, including the Worker entry point',async()=>{
  assert.equal((await worker.fetch(req('/auth'),{},{})).status,503);
});
test('auth uses state, PKCE, a secure HttpOnly cookie, a fixed callback and limited scope',async()=>{
  const {result}=await login();
  assert.equal(result.status,302);
  const url=new URL(result.headers.get('location'));
  assert.equal(url.origin,'https://github.com');
  assert.equal(url.searchParams.get('scope'),'public_repo');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('redirect_uri'),env.AUTH_ORIGIN+'/callback');
  assert.equal(url.searchParams.get('state').length,64);
  assert.match(result.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
});
test('missing and mismatched states are rejected before any GitHub exchange',async()=>{
  const {cookie}=await login();
  assert.equal((await handle(req('/callback?code=test&state=wrong'),env)).status,400);
  const response=await handle(new Request(env.AUTH_ORIGIN+'/callback?code=test&state=wrong',{headers:{Cookie:cookie}}),env,()=>{throw Error('Must not exchange');});
  assert.equal(response.status,400);
});
test('expired login is rejected',async()=>{
  const session=encodeURIComponent(JSON.stringify({state:'test',verifier:'test',created:Date.now()-601000}));
  const request=new Request(env.AUTH_ORIGIN+'/callback?state=test&code=test',{headers:{Cookie:'__Host-portfolio_oauth='+session}});
  assert.equal((await handle(request,env)).status,400);
});
test('authorized account with write permission receives the Decap handshake on the exact origin',async()=>{
  const {request}=await login();
  const result=await handle(request,env,mockGithub());
  const html=await result.text();
  assert.equal(result.status,200);
  assert.match(html,/authorization:github:success:/);
  assert.match(html,/MOCK_ACCESS_TOKEN/);
  assert.match(html,/event.source !== openerWindow/);
  assert.match(html,/event.origin !== origin/);
  assert.ok(html.includes('https://owner.github.io'));
  assert.ok(!html.includes('postMessage("*"'));
  assert.match(result.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.ok(!html.includes('test-secret'));
});
test('account allowlist denies other GitHub accounts without exposing the token',async()=>{
  const {request}=await login();
  const result=await handle(request,env,mockGithub({login:'stranger'}));
  assert.equal(result.status,403);
  assert.ok(!(await result.text()).includes('MOCK_ACCESS_TOKEN'));
});
test('allowlisted read-only account is denied',async()=>{
  const {request}=await login();
  assert.equal((await handle(request,env,mockGithub({push:false}))).status,403);
});
test('upstream OAuth failure returns no secret or token',async()=>{
  const {request}=await login();
  const result=await handle(request,env,mockGithub({exchangeError:true}));
  assert.equal(result.status,502);
  const text=await result.text();
  assert.ok(!text.includes('test-secret')&&!text.includes('MOCK_ACCESS_TOKEN'));
});
test('rejects unknown methods, providers, origins and insecure configuration',async()=>{
  assert.equal((await handle(new Request(env.AUTH_ORIGIN+'/auth',{method:'POST'}),env)).status,405);
  assert.equal((await handle(req('/auth?provider=other'),env)).status,400);
  assert.equal((await handle(new Request('https://evil.example/auth?provider=github'),env)).status,400);
  assert.equal((await handle(req('/auth?provider=github'),{...env,ADMIN_ORIGIN:'http://example.com'})).status,503);
});
