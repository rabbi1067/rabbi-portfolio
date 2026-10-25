/* Subtle portrait depth for a fine pointer; no WebGL or animation dependency. */
(() => {
  const scene = document.getElementById('heroScene');
  const stage = scene?.parentElement;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 741px)');
  let frame = 0;
  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    scene?.style.setProperty('--scene-x', '0deg');
    scene?.style.setProperty('--scene-y', '0deg');
  }
  stage?.addEventListener('pointermove', event => {
    if (motion.matches || !pointer.matches || event.pointerType === 'touch') return;
    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      scene.style.setProperty('--scene-x', `${(-y * 5).toFixed(2)}deg`);
      scene.style.setProperty('--scene-y', `${(x * 7).toFixed(2)}deg`);
      frame = 0;
    });
  });
  stage?.addEventListener('pointerleave', reset);
  motion.addEventListener('change', reset);
  pointer.addEventListener('change', reset);

  const scrollHint = document.getElementById('scrollCue');
  const pageSections = Array.from(document.querySelectorAll('section[id], #selected-highlights'));
  let cueTimer = 0;
  function setScrollHint(hidden) {
    scrollHint?.classList.toggle('is-hidden', hidden);
    scrollHint?.setAttribute('aria-hidden', String(hidden));
    if (scrollHint) scrollHint.tabIndex = hidden ? -1 : 0;
  }
  function updateScrollHint() {
    clearTimeout(cueTimer);
    const activationLine = Math.min(window.innerHeight * .25, 180);
    let index = 0;
    pageSections.forEach((section, position) => {
      if (section.getBoundingClientRect().top <= activationLine) index = position;
    });
    const next = pageSections[index + 1] || document.getElementById('site-footer');
    if (next && scrollHint) {
      scrollHint.href = `#${next.id}`;
      scrollHint.setAttribute('aria-label', `Scroll to ${next.querySelector('h2')?.textContent.trim() || 'footer'}`);
    }
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
    if (window.scrollY <= 20) { setScrollHint(false); return; }
    setScrollHint(true);
    // Other sections get a fresh cue after scrolling stops; Home keeps its original top-only cue.
    if (index > 0 && !atBottom) cueTimer = setTimeout(() => setScrollHint(false), 1100);
  }
  window.addEventListener('scroll', updateScrollHint, { passive: true });
  window.addEventListener('pageshow', updateScrollHint);
  window.addEventListener('resize', updateScrollHint);
  updateScrollHint();

  const toggle = document.getElementById('navMenuToggle');
  const menu = document.getElementById('primary-navigation');
  function setMenu(open, restoreFocus = false) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    menu.dataset.open = String(open);
    if (restoreFocus) toggle.focus();
  }
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu?.addEventListener('click', event => {
    const anchor = event.target.closest('a');
    if (anchor) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') setMenu(false, true);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#navbar')) setMenu(false);
  });
  const smallScreen = window.matchMedia('(max-width: 1100px)');
  smallScreen.addEventListener('change', () => setMenu(false));
})();
