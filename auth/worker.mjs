/* OAuth exchange only. Deploy separately; never copy this service or its secrets to Pages. */
const COOKIE = '__Host-portfolio_oauth';
const COOKIE_OPTIONS = 'Path=/; HttpOnly; Secure; SameSite=Lax';
const encoder = new TextEncoder();

function random() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function response(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  } });
}

function configuration(env) {
  for (const key of ['GITHUB_CLIENT_ID','GITHUB_CLIENT_SECRET','GITHUB_REPOSITORY','ADMIN_ORIGIN','AUTH_ORIGIN','ALLOWED_USERS']) {
    if (!env[key]) throw new Error('Missing configuration');
  }
  for (const key of ['ADMIN_ORIGIN','AUTH_ORIGIN']) {
    const url = new URL(env[key]);
    if (url.protocol !== 'https:' || url.origin !== env[key]) throw new Error('Use exact HTTPS origins without a path or trailing slash');
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY)) throw new Error('Invalid repository');
  const users = env.ALLOWED_USERS.split(',').map(user => user.trim().toLowerCase()).filter(Boolean);
  if (!users.length || users.some(user => !/^[a-z0-9-]+$/.test(user))) throw new Error('Invalid allowlist');
  if (env.OAUTH_SCOPE && !['public_repo','repo'].includes(env.OAUTH_SCOPE)) throw new Error('Invalid scope');
  return users;
}

function popup(token, origin) {
  const nonce = random();
  const message = JSON.stringify('authorization:github:success:' + JSON.stringify({ token, provider: 'github' })).replaceAll('<', '\\u003c');
  const contents = `<!doctype html><html lang="en"><meta charset="utf-8"><title>GitHub authorization</title><p>Finishing authorization…</p><script nonce="${nonce}">
const origin = ${JSON.stringify(origin)};
const openerWindow = window.opener;
if (openerWindow) {
  window.addEventListener('message', function receive(event) {
    if (event.origin !== origin || event.source !== openerWindow || event.data !== 'authorizing:github') return;
    window.removeEventListener('message', receive);
    openerWindow.postMessage(${message}, origin);
    window.close();
  });
  openerWindow.postMessage('authorizing:github', origin);
}
</script></html>`;
  return response(contents, 200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`,
    'Set-Cookie': `${COOKIE}=; Max-Age=0; ${COOKIE_OPTIONS}`,
  });
}

async function github(path, token, fetcher) {
  const result = await fetcher('https://api.github.com' + path, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'portfolio-cms-oauth' },
  });
  if (!result.ok) throw new Error('GitHub authorization check failed');
  return result.json();
}

export async function handle(request, env, fetcher = fetch) {
  let users;
  try { users = configuration(env); }
  catch { return response('OAuth bridge is not configured.', 503); }
  const url = new URL(request.url);
  if (url.origin !== env.AUTH_ORIGIN) return response('Invalid authentication origin.', 400);
  if (request.method !== 'GET') return response('Method not allowed.', 405, { Allow: 'GET' });
  if (url.pathname === '/auth') {
    if (url.searchParams.get('provider') !== 'github') return response('Unsupported provider.', 400);
    const state = random();
    const verifier = random();
    const challenge = base64url(await crypto.subtle.digest('SHA-256', encoder.encode(verifier)));
    const cookie = encodeURIComponent(JSON.stringify({ state, verifier, created: Date.now() }));
    const destination = new URL('https://github.com/login/oauth/authorize');
    destination.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: env.AUTH_ORIGIN + '/callback', scope: env.OAUTH_SCOPE || 'public_repo',
      state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
    return response('', 302, { Location: destination.href, 'Set-Cookie': `${COOKIE}=${cookie}; Max-Age=600; ${COOKIE_OPTIONS}` });
  }
  if (url.pathname !== '/callback') return response('Not found.', 404);
  const expiredCookie = { 'Set-Cookie': `${COOKIE}=; Max-Age=0; ${COOKIE_OPTIONS}` };
  let session;
  try {
    const raw = (request.headers.get('Cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='));
    session = JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1)));
    if (!session.state || session.state !== url.searchParams.get('state') || !session.verifier || !session.created ||
        Date.now() - session.created > 600000 || session.created > Date.now() || !url.searchParams.get('code')) throw new Error('Invalid session');
  } catch { return response('Invalid or expired login. Close this popup and sign in again.', 400, expiredCookie); }
  try {
    const exchange = await fetcher('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
        code: url.searchParams.get('code'), redirect_uri: env.AUTH_ORIGIN + '/callback', code_verifier: session.verifier }),
    });
    if (!exchange.ok) throw new Error('Exchange failed');
    const result = await exchange.json();
    if (!result.access_token || result.error) throw new Error('Exchange failed');
    const user = await github('/user', result.access_token, fetcher);
    if (!users.includes(String(user.login).toLowerCase())) return response('This GitHub account is not authorized.', 403, expiredCookie);
    const repo = await github('/repos/' + env.GITHUB_REPOSITORY, result.access_token, fetcher);
    if (!repo.permissions?.push) return response('This GitHub account needs write permission on the portfolio repository.', 403, expiredCookie);
    return popup(result.access_token, env.ADMIN_ORIGIN);
  } catch {
    // Never log access tokens, authorization codes, client secrets or upstream error bodies.
    return response('GitHub authorization failed. Check OAuth configuration and repository permissions, then retry.', 502, expiredCookie);
  }
}

export default { fetch(request, env) { return handle(request, env); } };
