/* Category filters and resilient covers; no third-party dependencies. */
(() => {
  document.querySelectorAll('.showcase-filters').forEach(group => {
    const grid = document.getElementById(group.dataset.filterGrid);
    const status = group.nextElementSibling;
    if (!grid) return;
    group.addEventListener('click', event => {
      const button = event.target.closest('button[data-filter]');
      if (!button || !group.contains(button)) return;
      let count = 0;
      Array.from(grid.children).forEach(card => {
        card.hidden = Boolean(button.dataset.filter && card.dataset.category !== button.dataset.filter);
        if (!card.hidden) { count++; card.classList.add('visible'); }
      });
      group.querySelectorAll('button').forEach(item => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      if (status) status.textContent = `${count} ${count === 1 ? 'item' : 'items'} shown: ${button.textContent}.`;
    });
  });
  document.querySelectorAll('img[data-fallback]').forEach(image => {
    const fallback = () => {
      const source = new URL(image.dataset.fallback, document.baseURI).href;
      if (image.src === source) return;
      image.closest('picture')?.querySelectorAll('source').forEach(source => source.remove());
      image.classList.add('is-fallback');
      image.src = source;
    };
    image.addEventListener('error', fallback);
    if (image.complete && !image.naturalWidth) fallback();
  });
})();
