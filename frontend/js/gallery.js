/* Project cover carousels and screenshot lightbox; no third-party dependencies. */
(() => {
  const AUTO_MS = 4500;
  const IDLE_MS = 6000;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const carousels = document.querySelectorAll('.proj-carousel');
  const idle = new WeakMap();

  const show = (carousel, at) => {
    const slides = carousel.querySelectorAll('.proj-slide');
    if (!slides.length) return;
    const index = (at + slides.length) % slides.length;
    carousel.dataset.index = String(index);
    slides.forEach((slide, position) => slide.classList.toggle('is-active', position === index));
  };

  const autoplayPause = carousel =>
    document.hidden ||
    document.body.classList.contains('lb-open') ||
    carousel.matches(':hover') ||
    Date.now() < (idle.get(carousel) || 0) ||
    carousel.classList.contains('is-offscreen');

  const loop = carousel => {
    if (REDUCED) return;
    setTimeout(() => {
      const slides = carousel.querySelectorAll('.proj-slide');
      const next = slides[(Number(carousel.dataset.index || 0) + 1) % slides.length];
      if (!autoplayPause(carousel) && next && next.complete && next.naturalWidth > 0) show(carousel, Number(carousel.dataset.index || 0) + 1);
      loop(carousel);
    }, AUTO_MS);
  };

  carousels.forEach((carousel, position) => {
    new IntersectionObserver(entries => entries.forEach(entry => carousel.classList.toggle('is-offscreen', !entry.isIntersecting)), { rootMargin: '40px 0px' }).observe(carousel);
    setTimeout(loop, (position * 83) % AUTO_MS, carousel);
  });

  document.addEventListener('click', event => {
    const arrow = event.target.closest('.proj-carrow');
    if (arrow) {
      const carousel = arrow.closest('.proj-carousel');
      idle.set(carousel, Date.now() + IDLE_MS);
      show(carousel, Number(carousel.dataset.index || 0) + (arrow.classList.contains('proj-carrow-next') ? 1 : -1));
      return;
    }
    const carousel = event.target.closest('.proj-carousel');
    if (carousel && event.target.classList.contains('proj-slide')) open(carousel, Number(carousel.dataset.index || 0));
  });

  let slides = [];
  let index = 0;
  let opener = null;

  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.hidden = true;
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'Project screenshots');
  lightbox.innerHTML = `
    <div class="lightbox-frame">
      <img class="lightbox-image" src="" alt="" />
      <p class="lightbox-caption"></p>
    </div>
    <button type="button" class="lightbox-nav lightbox-prev" aria-label="Previous image"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
    <button type="button" class="lightbox-nav lightbox-next" aria-label="Next image"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
    <span class="lightbox-counter" aria-live="polite"></span>
    <button type="button" class="lightbox-close" aria-label="Close screenshots"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>`;
  document.body.appendChild(lightbox);

  const image = lightbox.querySelector('.lightbox-image');
  const caption = lightbox.querySelector('.lightbox-caption');
  const counter = lightbox.querySelector('.lightbox-counter');

  const render = () => {
    const slide = slides[index];
    image.src = slide.dataset.full;
    image.alt = slide.dataset.caption || '';
    caption.textContent = slide.dataset.caption || '';
    caption.hidden = !slide.dataset.caption;
    counter.textContent = `${index + 1} / ${slides.length}`;
    const many = slides.length > 1;
    lightbox.querySelector('.lightbox-prev').hidden = !many;
    lightbox.querySelector('.lightbox-next').hidden = !many;
  };

  const step = at => {
    if (slides.length) {
      index = (at + slides.length) % slides.length;
      render();
    }
  };

  function open(target, at) {
    slides = Array.from(target.querySelectorAll('.proj-slide'));
    opener = target;
    lightbox.hidden = false;
    document.body.classList.add('lb-open');
    step(at);
    lightbox.querySelector('.lightbox-close').focus();
  }

  const close = () => {
    lightbox.hidden = true;
    document.body.classList.remove('lb-open');
    image.src = '';
    if (opener) { show(opener, index); opener.focus(); opener = null; }
  };

  document.addEventListener('click', event => {
    if (event.target === lightbox) close();
    if (event.target.closest('.lightbox-close')) close();
    if (event.target.closest('.lightbox-prev')) step(index - 1);
    if (event.target.closest('.lightbox-next')) step(index + 1);
  });

  document.addEventListener('keydown', event => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') step(index - 1);
    if (event.key === 'ArrowRight') step(index + 1);
  });
})();
