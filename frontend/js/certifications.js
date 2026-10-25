/* Six visible credentials per category; only hidden matches enter the count. */
(() => {
  const grid = document.getElementById('certificate-cards');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('.cert-card'));
  const filters = document.querySelector('[data-filter-grid="certificate-cards"]');
  const status = filters?.nextElementSibling;
  const button = document.getElementById('view-all-certifications');
  const count = button?.querySelector('.view-all-count');
  let selected = '';
  let expanded = false;

  function render(announce = false) {
    const matches = cards.filter(card => !selected || card.dataset.category === selected);
    const visible = expanded ? matches : matches.slice(0, 6);
    cards.forEach(card => {
      card.hidden = !visible.includes(card);
      if (!card.hidden) card.classList.add('visible');
    });
    const remaining = Math.max(0, matches.length - 6);
    if (button) {
      button.hidden = expanded || remaining === 0;
      button.setAttribute('aria-label', `See all ${remaining} more certifications and awards`);
    }
    if (count) count.textContent = String(remaining);
    if (announce && status) status.textContent = `${visible.length} of ${matches.length} certifications and awards shown: ${selected || 'All'}.`;
    return matches;
  }

  filters?.addEventListener('click', event => {
    const filter = event.target.closest('button[data-filter]');
    if (!filter || !filters.contains(filter)) return;
    selected = filter.dataset.filter || '';
    expanded = false;
    filters.querySelectorAll('button[data-filter]').forEach(item => {
      item.classList.toggle('is-active', item === filter);
      item.setAttribute('aria-pressed', String(item === filter));
    });
    render(true);
  });

  button?.addEventListener('click', () => {
    expanded = true;
    const next = render(true)[6]?.querySelector('h4');
    if (next) {
      next.tabIndex = -1;
      next.focus({ preventScroll: true });
    }
  });
  render();
})();
