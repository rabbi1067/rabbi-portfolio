/* Native, accessible scrolling with an optional gentle loop; no carousel dependency. */
(() => {
  const region=document.getElementById('selected-highlights');
  if(!region)return;
  const rail=region.querySelector('.highlights-rail');
  const originals=Array.from(rail.querySelectorAll('.highlight-card'));
  const play=region.querySelector('[data-highlights-play]');
  const prev=region.querySelector('[data-highlights-prev]');
  const next=region.querySelector('[data-highlights-next]');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let playing=region.dataset.autoplay!=='false'&&!reduced.matches;
  let hovered=false,focused=false,visible=false,frame=0,last=0,cycle=0,manualUntil=0;
  const clones=[];
  if(originals.length>1)for(const card of originals){
    const clone=card.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.tabIndex=-1;
    clone.dataset.highlightClone='true';rail.append(clone);clones.push(clone);
  }
  function measure(){
    cycle=clones.length?clones[0].offsetLeft-originals[0].offsetLeft:0;
    const canMove=rail.scrollWidth>rail.clientWidth+2;
    prev.disabled=next.disabled=!canMove;play.disabled=!canMove;
    last=0;
  }
  function syncButton(){
    play.setAttribute('aria-pressed',String(playing));
    play.setAttribute('aria-label',playing?'Pause highlight scrolling':'Play highlight scrolling');
    play.firstElementChild.textContent=playing?'Ⅱ':'▷';
  }
  function tick(time){
    frame=0;
    if(!visible||document.hidden||!playing)return;
    const delta=last?Math.min(time-last,50):0;last=time;
    if(playing&&!hovered&&!focused&&time>manualUntil&&cycle>0&&rail.scrollWidth>rail.clientWidth+2){
      rail.scrollLeft+=delta*.032;
      if(rail.scrollLeft>=cycle)rail.scrollLeft-=cycle;
    }
    frame=requestAnimationFrame(tick);
  }
  function start(){if(!frame&&visible&&!document.hidden&&playing){last=0;frame=requestAnimationFrame(tick)}}
  function stop(){cancelAnimationFrame(frame);frame=0;last=0}
  function manualPause(ms=2200){manualUntil=performance.now()+ms;last=0}
  rail.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')hovered=true});
  rail.addEventListener('pointerleave',()=>{hovered=false;manualPause(500)});
  rail.addEventListener('pointerdown',()=>manualPause(5000),{passive:true});
  rail.addEventListener('pointerup',()=>manualPause(2200),{passive:true});
  rail.addEventListener('wheel',()=>manualPause(),{passive:true});
  rail.addEventListener('focusin',()=>{focused=true});
  rail.addEventListener('focusout',()=>{focused=false;manualPause(800)});
  play.addEventListener('click',()=>{playing=!playing;syncButton();manualPause(300);if(playing)start();else stop()});
  function step(direction){
    manualPause(3000);
    if(direction<0&&rail.scrollLeft<1&&cycle>0)rail.scrollLeft=cycle;
    rail.scrollBy({left:direction*(originals[0]?.offsetWidth+16||280),behavior:reduced.matches?'instant':'smooth'});
  }
  prev.addEventListener('click',()=>step(-1));next.addEventListener('click',()=>step(1));
  rail.addEventListener('keydown',event=>{
    if(event.target!==rail)return;
    if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();step(event.key==='ArrowRight'?1:-1)}
  });
  rail.addEventListener('click',event=>{
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
    const card=event.target.closest('a.highlight-card');if(!card||!rail.contains(card))return;
    const hash=card.getAttribute('href');const target=document.getElementById(hash.slice(1));
    if(!target)return;
    event.preventDefault();manualPause(3000);
    if(target.classList.contains('proj-card')){
      if(target.classList.contains('proj-extra')&&target.hidden)document.getElementById('view-all-projects')?.click();
      document.querySelector('[data-filter-grid="project-cards"] button[data-filter=""]')?.click();
      target.classList.add('visible');
    }
    history.pushState(null,'',hash);
    target.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
    if(event.detail===0){if(!target.hasAttribute('tabindex'))target.tabIndex=-1;target.focus({preventScroll:true})}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start()});
  reduced.addEventListener('change',()=>{playing=!reduced.matches&&region.dataset.autoplay!=='false';syncButton();if(playing)start();else stop()});
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop()},{threshold:.05}).observe(region);
  new ResizeObserver(measure).observe(rail);
  syncButton();measure();
})();
