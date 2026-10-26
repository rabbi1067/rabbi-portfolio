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
