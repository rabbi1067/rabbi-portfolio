# Reference-inspired home — 17 October 2026

The owner requested a centered portrait hero like the supplied screenshot, using
the existing text and colors that fit the portfolio, plus animation/3D effects
and responsive layouts. This supersedes the original home-design preservation
requirement for this section. The remaining section content/layouts and CMS
integration are retained.

## Changes

- `index.html`: centered hero with existing heading, introduction, availability,
  portrait, badges, identity, CV/Skills links, stats, social profiles and tags.
  Decorative name watermark is hidden from assistive technology. All original
  copy remains in the same CMS content files.
- `css/home.css`: scoped teal/cyan hero styling, serif italic role lines,
  orbit rings/glow, floating badges, portrait depth, light theme, keyboard focus
  and responsive navigation. No React, WebGL or animation library is needed.
- `js/home.js`: bounded pointer-driven 3D tilt on desktop; mobile navigation
  toggle, link/outside-click closure, Escape/focus handling and resize reset.
  Touch and reduced-motion preferences disable the portrait tilt.
- `js/main.js`: existing effects remain; cursor animation now respects fine
  pointers/reduced motion, and navigation uses immediate scroll when reduced
  motion is requested.
- `images/hero-cutout.png`: transparent portrait derived from the existing
  `images/My_pic.jpeg` using the imagegen skill. Original photos are retained.
- `content/profile.json`, `cms/schema.json`, `scripts/build.py`: optional
  **Hero cutout photo** field. The main profile image remains in the nav; the
  hero uses its separate cutout. Clearing the new field falls back to the main
  profile image. For best results upload a transparent PNG/WebP portrait.
- `tests/responsive.mjs`: optional Chromium checks at twelve desktop, laptop,
  tablet and phone sizes, including the theme, mobile menu, motion preference,
  portrait visibility and horizontal overflow. Set `PREVIEW_URL` when the local
  server differs from `http://127.0.0.1:8000`.
- `tests/browser.mjs`: the original-design comparison now checks the widths and
  heights of the unchanged sections; their page offsets may move with the new
  home section. Tests no longer require the old home geometry.
- `tests/test_build.py`: verifies CMS hero-photo replacement and fallback.

## Preview

Run `python scripts/build.py`, then serve `dist/`. The existing local preview
uses `http://127.0.0.1:8000/`; reload the browser to see the rebuilt output.
The new CSS uses the existing dark/light theme variables. Heading fonts are
Inter/Outfit and Instrument Serif, with local sans/Georgia fallbacks when Google
Fonts cannot load.

Animations are CSS-based; pointer tilt schedules work only on pointer movement.
Reduced motion disables hero animations, shows reveal content immediately and
uses the standard cursor. On small screens, the portrait stays visible and the
three badges reflow into rows instead of covering it. All content remains
reachable by scrolling; longer unchanged text naturally makes the hero taller
on narrow screens.

No OAuth settings, secrets, repository connection or deployment permissions
were changed. Live CMS authorization still requires the setup in README.

The original vertical mouse/Scroll Down indicator is fixed at the lower right
so it stays inside the first viewport, even on short screens. The single cue
updates its destination to the following section and hides while scrolling.
Home shows it only within 20px of the top; other sections restore it after 1.1s
of idle time, and it stays hidden at the page bottom. The page scrollbar is hidden
while native wheel, touch and keyboard scrolling remain enabled. Portrait role
badges are always visible: two columns flank the portrait on desktop, and a
wrapping rows follow the portrait on mobile. No hover, tap or JavaScript is
needed to read them. The C++, Python, C and Java language chips also remain
visible immediately below the statistics. `tests/home-interactions.mjs` checks
persistent visibility, scrolling and mobile layout.

The owner then requested centered statistics, four role labels (AI Engineer,
Researcher, Full Stack Developer, Competitive Programmer), and support for 20
tags. Profile role tags and project tags now support up to 20 entries, with CMS
limits and build validation. Role badges use two columns separated by the
portrait; longer lists expand the stage instead of overlapping. Mobile lists
expand below the portrait. Optional GitHub and Live Demo URLs now produce clear
labelled project buttons, opening new tabs. Empty URLs produce no button.
Project card readability, tag wrapping and button styling were refined.

Featured Projects and Certifications & Awards now use a matching gallery layout:
16:9 covers, category filters, three columns on desktop, two on tablets and one
on phones. Their existing text is preserved. Optional destinations retain their
existing new-tab behavior; GitHub and Live Demo keep fixed left/right half slots.

Both accept a `thumbnail` and `thumbnail_alt` through the CMS. Certificates can
also use an image uploaded as `certificate`; a PDF remains a click destination
and can have a separate image preview. Blank covers use the bundled project or
certificate SVG artwork, and broken image requests switch to the same default.
Global defaults can be replaced in Site Settings → Default thumbnail images.
The THIRA certificate image is preserved and displayed without cropping.

The header Review link opens Reviews & Testimonials. Portfolio Settings → Reviews
supports name, role, optional quote/rating/photo/profile/source link, ordering
and a published switch. The owner confirmed that the four supplied reviewers
approved the text and 5-star ratings, so those entries now display Reviewer
approved. The `sample` switch labels future drafts and sample star ratings,
and suppresses approval/source claims. A blank quote shows Review coming soon,
and an empty collection shows an editable invitation with a contact link.

Cards use a centered carousel matching the latest reference: a larger focused
card, smaller faded neighbors, quote badge, topic badge and stars. Inert visual
loop copies make the animation circular without duplicate accessible entries.
Stars sit at the top of each card. Reviewer names, roles and approval/profile
details appear below the review, with larger wrapping text and stronger contrast.
Navigation and page sections follow the same work-first sequence: Home, About,
Projects, Skills, Experience, Research, Certifications, Reviews, Contact. Research
comes after the existing work and background; menu labels use full names.
Automatic movement runs only while
the carousel is visible and pauses on hover, keyboard focus, browser background,
or the Pause control. Reduced motion disables autoplay. Arrows, pagination,
keyboard arrows/Home/End and native touch scrolling provide manual navigation.
The same layout supports six, seven or more entries added through the CMS.
Admin authentication setup remains
as documented in README; this change does not enable OAuth or deploy publicly.

The duplicate Find Me On section was removed. Footer social links reuse Contact
records and have their own placement toggle. A new Research section and Research
papers CMS collection support titles, authors, abstracts, venues/years, status,
DOI/original URLs and PDF links opening in new tabs. No papers were supplied;
the current empty state is intentional. Records across content collections have
show/hide toggles, and whole sections can be omitted without deleting content.

## Verification

- 24 content/build tests and nine mocked OAuth tests passed; production build
  and JavaScript syntax checks passed.
- Browser checks passed all eight sections, the CV response, theme persistence,
  mocked contact form, admin disabled state and actual Decap configuration/login
  screen rendering. No live OAuth sign-in or email delivery was attempted.
- Responsive checks cover 1920, 1440, 1366, 1280, 1024, 820, 768, 600, 430, 390,
  360 and 320px widths. They verify no horizontal overflow, visible portraits,
  readable badge/stat text, working mobile navigation/Escape, light mode,
  reduced motion and desktop pointer depth. Screenshots and the test report are
  in ignored `.qa/home-redesign/`.
- Inter, Outfit and Instrument Serif were also loaded for a separate visual
  inspection. Offline font fallbacks were tested across the full device matrix.
- The initial redesign preserved every pre-existing profile field; the owner
  subsequently replaced the four portrait roles explicitly. Other profile copy
  remains unchanged. The hero_photo field is an added content value. Source
  markup for unrelated sections remains unchanged. Projects and certificates
  use the requested cover layouts and filters, and a Reviews section was added.
  Card height adapts to tags, complete descriptions and optional actions.
- `tests/project-ui.mjs` verifies generated 20-tag fixtures at desktop, tablet
  and phone sizes, including no badge/portrait overlap, all four optional-link
  combinations, 20 project tags and actual new-tab behavior with mocked
  destinations. Fixture URLs are never written into published content.
- `tests/showcase.mjs` checks 1440/820/390/320px layouts, both independent category
  filters, all cover assets, broken-image fallback, half-width optional buttons,
  Review navigation and its contact CTA. Screenshots are in `.qa/showcase/`.
- `tests/reviews.mjs` checks approval/stars, centered focus and faded side cards,
  carousel movement/pause, keyboard navigation, inert loop copies, reduced motion and section-aware scroll
  cues at 1440/820/390/320px. Screenshots are in `.qa/reviews/`.

The local preview remains available on port 8000. This work does not constitute
a public deployment. The deployment source and publishing status are recorded in GitHub history and Actions.
