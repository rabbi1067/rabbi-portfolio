(() => {
  const cards=[...document.querySelectorAll('[data-blog-card]')];
  const search=document.querySelector('[data-blog-search]');
  const filters=[...document.querySelectorAll('[data-blog-filter]')];
  let category='all';
  function update(){
    const query=(search?.value||'').trim().toLocaleLowerCase();
    let count=0;
    cards.forEach(card=>{card.hidden=!( (category==='all'||card.dataset.category===category)&&card.textContent.toLocaleLowerCase().includes(query));if(!card.hidden)count++;});
    const result=document.querySelector('[data-blog-result]');if(result)result.textContent=`${count} ${count===1?'story':'stories'}`;
    const empty=document.querySelector('[data-blog-empty]');if(empty)empty.hidden=count>0;
  }
  filters.forEach(button=>button.addEventListener('click',()=>{category=button.dataset.blogFilter;filters.forEach(b=>{const active=b===button;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});update();}));
  search?.addEventListener('input',update);update();
})();

/* Match project galleries: gentle automatic changes, with manual and reduced-motion controls. */
(() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 document.querySelectorAll('[data-blog-carousel]').forEach(carousel=>{
  const slides=[...carousel.querySelectorAll('.blog-slide')];
  if(slides.length<2)return;
  const dots=[...carousel.querySelectorAll('[data-blog-dot]')];
  const pause=carousel.querySelector('.blog-photo-pause');
  let index=0, paused=reduced.matches, onScreen=false, idleUntil=0, startX=0;
  function render(at){
   index=(at+slides.length)%slides.length;carousel.dataset.index=String(index);
   slides.forEach((slide,i)=>{const active=i===index;slide.classList.toggle('is-active',active);slide.setAttribute('aria-hidden',String(!active));slide.querySelector('a').tabIndex=active?0:-1;});
   dots.forEach((dot,i)=>{dot.classList.toggle('is-active',i===index);dot.setAttribute('aria-pressed',String(i===index));});
   const selected=dots[index];if(selected)selected.parentElement.scrollTo({left:selected.offsetLeft-selected.parentElement.offsetLeft-(selected.parentElement.clientWidth-selected.clientWidth)/2,behavior:reduced.matches?'instant':'smooth'});
   carousel.querySelector('.blog-photo-count').textContent=`${index+1} / ${slides.length}`;
   const caption=carousel.querySelector('.blog-photo-caption');if(caption)caption.textContent=slides[index].dataset.caption||'';
  }
  function syncPause(){pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',paused?'Play automatic photos':'Pause automatic photos');pause.setAttribute('aria-pressed',String(paused));}
  function manual(at){idleUntil=Date.now()+6000;render(at);}
  carousel.querySelector('.blog-photo-prev').addEventListener('click',()=>manual(index-1));
  carousel.querySelector('.blog-photo-next').addEventListener('click',()=>manual(index+1));
  dots.forEach((dot,i)=>dot.addEventListener('click',()=>manual(i)));
  pause.addEventListener('click',()=>{paused=!paused;syncPause();});
  carousel.addEventListener('touchstart',event=>{startX=event.touches[0].clientX;},{passive:true});
  carousel.addEventListener('touchend',event=>{const distance=event.changedTouches[0].clientX-startX;if(Math.abs(distance)>45)manual(index+(distance<0?1:-1));},{passive:true});
  new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;}).observe(carousel);
  reduced.addEventListener('change',()=>{paused=reduced.matches;syncPause();});
  setInterval(()=>{
   if(paused||!onScreen||document.hidden||carousel.matches(':hover')||carousel.contains(document.activeElement)||Date.now()<idleUntil)return;
   const next=slides[(index+1)%slides.length].querySelector('img');if(next.complete&&next.naturalWidth)render(index+1);
  },4500);
  render(0);syncPause();
 });
})();
