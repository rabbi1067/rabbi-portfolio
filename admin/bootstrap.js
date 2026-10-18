/* The CMS runs only on /admin/. Repository permission is enforced by GitHub. */
(async () => {
  const status = document.getElementById('setup-status');
  try {
    const response = await fetch('./status.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Missing generated configuration');
    const settings = await response.json();
    if (!settings.configured) {
      status.textContent = 'CMS login is disabled until the repository, site URL and OAuth bridge are configured. Follow the README setup instructions, then rebuild.';
      return;
    }
    window.CMS_MANUAL_INIT = true;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/decap-cms@3.16.3/dist/decap-cms.js';
    script.integrity = 'sha384-A/Gdn928CNLufmnGWGs9RM4Q9o8bSNLeJERqBFrBjwzL7FRpoLT3MPF8Tl0+Wd2p';
    script.crossOrigin = 'anonymous';
    script.onerror = () => { status.textContent = 'Could not load Decap CMS. Check your connection and the browser console.'; };
    script.onload = () => { status.remove(); window.CMS.init(); };
    document.body.appendChild(script);
  } catch (error) {
    status.textContent = 'Could not load the CMS configuration. Build the site first and serve dist/ over HTTP. See README.';
    console.error(error);
  }
})();
