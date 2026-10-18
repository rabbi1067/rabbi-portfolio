/* Centered review carousel. Loop copies are visual only; originals remain editable and accessible. */
(() => {
  const carousel = document.querySelector('.review-carousel');
  if (!carousel) return;
  const track = carousel.querySelector('.review-track');
  const originals = Array.from(track.children);
  const count = originals.length;
  if (!count) return;
  if (count > 1) {
    const copies = () => originals.map(card => {
      const copy = card.cloneNode(true);
      copy.dataset.reviewClone = '';
      copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('role', 'presentation');
      copy.inert = true;
      copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      return copy;
    });
    track.prepend(...copies());
    track.append(...copies());
  }
  const cards = Array.from(track.children);
  const base = count > 1 ? count : 0;
  const pagination = carousel.querySelector('.review-pagination');
  const previous = carousel.querySelector('[data-review-prev]');
  const next = carousel.querySelector('[data-review-next]');
  const autoplay = carousel.querySelector('[data-review-autoplay]');
  const status = carousel.querySelector('.review-status');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = carousel.dataset.autoplay !== 'false';
  const delay = Math.max(3000, Number(carousel.dataset.delay) || 5000);
  let index = Math.min(count - 1, Math.max(0, (Number(carousel.dataset.initial) || 1) - 1));
  let positions = [], timer = 0, frame = 0, settleTimer = 0;
  let userPaused = false, hovering = false, focused = false, inView = false;
  const logical = physical => ((physical % count) + count) % count;
  function schedule() {
    clearTimeout(timer);
    if (!enabled || userPaused || hovering || focused || !inView || motion.matches || document.hidden || count < 2) return;
    timer = setTimeout(() => { moveTo(index + 1); schedule(); }, delay);
  }
  function sync() {
    frame = 0;
    if (!positions.length) return;
    const physical = positions.reduce((nearest, position, i) => Math.abs(position - track.scrollLeft) < Math.abs(positions[nearest] - track.scrollLeft) ? i : nearest, 0);
    index = logical(physical);
    carousel.dataset.activeReview = String(index);
    const width = cards[0].offsetWidth + parseFloat(getComputedStyle(track).gap || 0);
    cards.forEach((card, i) => {
      const distance = Math.abs((positions[i] - track.scrollLeft) / width);
      card.style.setProperty('--review-scale', String(Math.max(.78, 1 - distance * .13)));
      card.style.setProperty('--review-opacity', String(Math.max(.16, 1 - distance * .38)));
      card.style.setProperty('--review-y', `${Math.min(42, distance * 32)}px`);
      card.style.zIndex = String(Math.max(0, 10 - Math.round(distance)));
      card.classList.toggle('is-active', i === physical);
    });
    pagination.querySelectorAll('button').forEach((button, i) => {
      button.classList.toggle('is-active', i === index);
      button.setAttribute('aria-pressed', String(i === index));
    });
  }
  function normalize() {
    if (count < 2 || !positions.length) return;
    const nearest = positions.reduce((best, pos, i) => Math.abs(pos - track.scrollLeft) < Math.abs(positions[best] - track.scrollLeft) ? i : best, 0);
    if ((nearest < base || nearest >= base + count) && Math.abs(positions[nearest] - track.scrollLeft) < 3) {
      track.scrollTo({left:positions[base+index], behavior:'instant'});
      sync();
    }
  }
  function moveTo(target, announce = false) {
    const nextIndex = logical(target);
    const candidates = positions.map((position, physical) => ({position, physical})).filter(entry => logical(entry.physical) === nextIndex);
    const nearest = candidates.reduce((best, entry) => Math.abs(entry.position-track.scrollLeft)<Math.abs(best.position-track.scrollLeft)?entry:best);
    track.scrollTo({left:nearest.position, behavior:motion.matches?'instant':'smooth'});
    if (announce) status.textContent = `Review ${nextIndex+1} of ${count}: ${originals[nextIndex].querySelector('.review-person strong')?.textContent}.`;
  }
  function rebuild() {
    positions = cards.map(card => Math.max(0, card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2));
    track.scrollTo({left:positions[base+index],behavior:'instant'});
    previous.disabled = next.disabled = count < 2;
    autoplay.disabled = !enabled || motion.matches || count < 2;
    autoplay.textContent = !enabled || motion.matches ? 'Auto off' : userPaused ? 'Play' : 'Pause';
    autoplay.setAttribute('aria-label', !enabled ? 'Automatic movement disabled in settings' : motion.matches ? 'Automatic movement disabled for reduced motion' : userPaused ? 'Play automatic review movement' : 'Pause automatic review movement');
    sync();
    schedule();
  }
  originals.forEach((card, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'review-dot';
    button.setAttribute('aria-label', `Show review ${i+1}`);
    button.setAttribute('aria-controls', 'review-track');
    button.addEventListener('click', () => { moveTo(i, true); schedule(); });
    pagination.append(button);
  });
  previous.addEventListener('click', () => { moveTo(index-1,true); schedule(); });
  next.addEventListener('click', () => { moveTo(index+1,true); schedule(); });
  autoplay.addEventListener('click', () => {
    userPaused = !userPaused;
    autoplay.setAttribute('aria-pressed', String(userPaused));
    rebuild();
  });
  carousel.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hovering = true; schedule(); } });
  carousel.addEventListener('pointerleave', () => { hovering = false; schedule(); });
  carousel.addEventListener('focusin', () => { focused = true; schedule(); });
  carousel.addEventListener('focusout', () => queueMicrotask(() => { focused = carousel.contains(document.activeElement); schedule(); }));
  track.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(sync);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(normalize, 180);
  }, {passive:true});
  track.addEventListener('keydown', event => {
    if (event.target !== track || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    moveTo(event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : index + (event.key === 'ArrowRight' ? 1 : -1), true);
  });
  new IntersectionObserver(entries => { inView=entries[0].isIntersecting; schedule(); },{threshold:.15}).observe(carousel);
  new ResizeObserver(rebuild).observe(track);
  motion.addEventListener('change', rebuild);
  document.addEventListener('visibilitychange', schedule);
  rebuild();
})();
