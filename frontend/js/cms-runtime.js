/* A static fallback plus an optional Spring Boot content source. No secrets belong here. */
(async () => {
  const config = window.PORTFOLIO_CONFIG || {};
  const raw = config.apiBase || '';
  const api = raw === 'same-origin' ? location.origin : raw.replace(/\/$/, '');
  const base = new URL('../', document.currentScript.src);
  window.PORTFOLIO_API = api;
  if (api && /^https?:\/\//.test(api)) {
    try {
      const response = await fetch(api + '/api/public/page', {signal: AbortSignal.timeout(8000), cache:'no-store'});
      if (!response.ok) throw new Error('Content service unavailable');
      const incoming = new DOMParser().parseFromString(await response.text(), 'text/html');
      // DOMParser treats noscript markup as active HTML. Its no-JS fallback styles must not enter the live page.
      incoming.querySelectorAll('noscript').forEach(node => node.remove());
      // Only use content markup. Application scripts always come from this frontend deployment.
      incoming.querySelectorAll('script:not([type="application/json"])').forEach(node => node.remove());
      const mediaUrl = value => /^(?:images\/|uploads\/|CV\.pdf)/.test(value) ? api + '/media/' + value : value;
      incoming.querySelectorAll('[src],[href],[srcset],[data-full],[data-fallback]').forEach(node => {
        for (const attribute of ['src','href','data-full','data-fallback']) {
          const value=node.getAttribute(attribute);
          if(value) node.setAttribute(attribute,mediaUrl(value));
        }
        if(node.hasAttribute('srcset')) node.setAttribute('srcset',node.getAttribute('srcset').split(',').map(part=>{
          const [url,...size]=part.trim().split(/\s+/); return [mediaUrl(url),...size].join(' ');
        }).join(', '));
      });
      document.body.replaceChildren(...Array.from(incoming.body.childNodes));
      document.title=incoming.title;
      const description=incoming.querySelector('meta[name="description"]')?.content;
      if(description) document.querySelector('meta[name="description"]')?.setAttribute('content',description);
    } catch(error) {
      console.info('Showing the published static portfolio while the content service wakes up.');
    }
  }
  const scripts=['js/main.js','js/home.js','js/showcase.js','js/certifications.js','js/gallery.js','js/reviews.js','js/highlights.js',
    'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js','js/contact.js'];
  for(const path of scripts) await new Promise(resolve=>{
    const script=document.createElement('script');
    script.src=new URL(path,base).href;script.onload=resolve;script.onerror=resolve;document.body.append(script);
  });
  document.documentElement.dataset.cmsReady='true';
})();
