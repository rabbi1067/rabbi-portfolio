/* Published HTML fallback works without a content service. */
(async()=>{
 const base=new URL('../',document.currentScript.src);
 const raw=window.PORTFOLIO_CONFIG?.apiBase||'';
 const api=raw==='same-origin'?location.origin:raw.replace(/\/$/,'');
 const slug=document.body.dataset.blogPage||'';
 if(api&&/^https?:\/\//.test(api)){
  try{
   const response=await fetch(api+'/api/public/blogs'+(slug?'/'+encodeURIComponent(slug):''),{cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(response.status===404){document.querySelector('.blog-main').innerHTML='<h1>Story unavailable</h1><p>This story is no longer published.</p><a href="blogs/">Back to blog</a>';}
   else{
    if(!response.ok)throw new Error('Unavailable');
    const incoming=new DOMParser().parseFromString(await response.text(),'text/html');
    incoming.querySelectorAll('script,noscript').forEach(n=>n.remove());
    const media=value=>/^(?:images\/|uploads\/|CV\.pdf)/.test(value)?api+'/media/'+value:value;
    incoming.querySelectorAll('[src],[href],[srcset]').forEach(node=>{
     for(const attr of ['src','href']){const value=node.getAttribute(attr);if(value)node.setAttribute(attr,media(value));}
     if(node.hasAttribute('srcset'))node.setAttribute('srcset',node.getAttribute('srcset').split(',').map(part=>{const[url,...size]=part.trim().split(/\s+/);return[media(url),...size].join(' ');}).join(', '));
    });
    incoming.querySelectorAll('[data-blog-slug]').forEach(a=>a.href=api+'/blogs/'+encodeURIComponent(a.dataset.blogSlug)+'/');
    document.body.replaceChildren(...incoming.body.childNodes);document.title=incoming.title;
   }
  }catch(error){console.info('Showing the static blog while the content service wakes up.');}
 }
 for(const path of ['js/main.js','js/home.js','js/blogs.js'])await new Promise(resolve=>{const script=document.createElement('script');script.src=new URL(path,base).href;script.onload=resolve;script.onerror=resolve;document.body.append(script);});
 document.documentElement.dataset.cmsReady='true';
})();
