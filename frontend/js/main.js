/* ============================================================
   FAZLEY RABBI — PORTFOLIO  |  js/main.js
   Author : Fazley Rabbi
   Domain : fazleyrabbi.dev
   ============================================================ */

/* ---- 0. Dark / Light Theme Toggle ----
   How it works:
   1. On page load, check localStorage for a saved theme choice.
      If none is saved, fall back to the visitor's OS-level preference
      (prefers-color-scheme). Default to dark if nothing is detected.
   2. Apply the chosen theme by setting the `data-theme` attribute on
      the <html> element. The CSS variables in styles.css (see the
      :root and [data-theme="light"] blocks) react to this attribute
      and swap all the colors automatically.
   3. When the toggle button is clicked, flip the theme and save the
      new choice to localStorage so it persists on the next visit. */
const THEME_STORAGE_KEY = 'fazley-portfolio-theme'; // key used in localStorage
const htmlEl       = document.documentElement;
const themeToggle  = document.getElementById('themeToggle');

// Work out which theme to start with.
// Priority: saved choice in localStorage > DARK (default).
// Note: we intentionally do NOT check the OS/browser color-scheme
// preference here, so the site always opens in dark mode by default
// unless the visitor has explicitly switched to light mode before.
function getInitialTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return 'dark'; // default theme
}

// Apply a theme name ('dark' or 'light') to the page
function applyTheme(theme) {
  htmlEl.setAttribute('data-theme', theme);
  themeToggle.setAttribute('aria-pressed', theme === 'light');
}

// Switch between dark and light, then remember the choice
function toggleTheme() {
  const current = htmlEl.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
}

// Set the correct theme as soon as the script runs (before paint flicker)
applyTheme(getInitialTheme());

// Wire up the click on the toggle button in the navbar
themeToggle.addEventListener('click', toggleTheme);


/* ---- 1. Custom Cursor ---- */
const cursor   = document.getElementById('cursor');
const follower = document.getElementById('follower');
let mx = 0, my = 0, fx = 0, fy = 0;
const fineCursor = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

document.addEventListener('mousemove', e => {
  mx = e.clientX;
  my = e.clientY;
  cursor.style.left = mx + 'px';
  cursor.style.top  = my + 'px';
});

let cursorFrame = 0;
function animateCursor() {
  cursorFrame = 0;
  if (!fineCursor.matches || reducedMotion.matches) return;
  fx += (mx - fx) * 0.12;
  fy += (my - fy) * 0.12;
  follower.style.left = fx + 'px';
  follower.style.top  = fy + 'px';
  cursorFrame = requestAnimationFrame(animateCursor);
}
function syncCursorMotion() {
  cancelAnimationFrame(cursorFrame);
  animateCursor();
}
syncCursorMotion();
fineCursor.addEventListener('change', syncCursorMotion);
reducedMotion.addEventListener('change', syncCursorMotion);

document.querySelectorAll('a, button, .cp-card, .skill-card, .cert-card, .c-link, .proj-card')
  .forEach(el => {
    el.addEventListener('mouseenter', () => follower.classList.add('hovered'));
    el.addEventListener('mouseleave', () => follower.classList.remove('hovered'));
  });


/* ---- 2. Navbar: scroll shrink ---- */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});


/* ---- 3. Active nav link on scroll ---- */
const sections = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('.nav-links a');

let navFrame = 0;
function updateActiveSection() {
  navFrame = 0;
  const activationLine = Math.min(window.innerHeight * .25, 180);
  let current = sections[0];
  sections.forEach(section => {
    if (section.getBoundingClientRect().top <= activationLine) current = section;
  });
  navLinks.forEach(anchor => {
    const active = anchor.getAttribute('href') === `#${current?.id}`;
    anchor.classList.toggle('active', active);
    if (active) anchor.setAttribute('aria-current', 'location');
    else anchor.removeAttribute('aria-current');
  });
}
function scheduleNavUpdate() {
  if (!navFrame) navFrame = requestAnimationFrame(updateActiveSection);
}
window.addEventListener('scroll', scheduleNavUpdate, { passive: true });
window.addEventListener('resize', scheduleNavUpdate);
window.addEventListener('pageshow', scheduleNavUpdate);
updateActiveSection();


/* ---- 4. Scroll reveal ---- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));


/* ---- 5. Skill bar animation ---- */
const barObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.sk-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.w + '%';
      });
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('.skill-card').forEach(c => barObserver.observe(c));


/* ---- 6. Smooth nav click ---- */
navLinks.forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });
});
