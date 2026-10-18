# CMS implementation report — 17 October 2026

**Later revision:** the owner subsequently requested a reference-inspired home
redesign. See [HOME_REDESIGN.md](HOME_REDESIGN.md) for the current hero, responsive
navigation and motion changes. The original-design comparisons below record the
CMS integration baseline before that separately authorized redesign.

## Result

Enhanced the existing HTML/CSS/JavaScript portfolio with Decap CMS and a
dependency-free Python static build. No React migration, redesign, database or
portfolio application server. All eight sections and all original records are
retained. The original `css/styles.css`, `js/main.js`, five images and source
`CV.pdf` are unchanged.

Editable content includes personal/hero/about information; photos/alt text;
availability; CTAs; hero stats/badges/tags; all nine project cards with CRUD,
media, links, featured/order/publication fields; six skill categories and their
items/animated bars; education/CGPA; work/volunteer/CP experience; research fields;
eight awards/certificates; stable CV replacement; email/phone/location; social
profiles; section/navigation/form/footer copy; and SEO metadata.

THIRA is stored once under Research and rendered in its original project-grid
position. New research records use the same existing card design. Extra details
and media appear only when populated. There were no separate blog, service,
testimonial, publication or GitHub-statistics sections to migrate.

## File inventory

Paths in this inventory are relative to the workspace root unless under the
source-folder heading. Nothing was committed or pushed.

Workspace additions:

- `.github/workflows/pages.yml` — tests/builds and GitHub Pages deployment;
  automatically detects nested source or source at repository root.
- `.gitignore` — ignores generated output, QA files and local secrets.
- `README.md` — entry point and workflow-placement instructions.

Modified inside `rabbi-portfolio-main/`:

- `index.html` — original layout converted to escaped content placeholders;
  contact-form closing-tag repair; separate contact behavior/config.
- `README.md` — beginner setup, editing, media/CV, security and troubleshooting.

Added inside `rabbi-portfolio-main/`:

- `.gitignore`
- `admin/index.html`, `admin/bootstrap.js`
- `auth/worker.mjs`, `auth/worker.test.mjs`, `auth/wrangler.toml`
- `cms/settings.json`, `cms/schema.json`
- `content/profile.json`, `content/contact.json`, `content/skills.json`
- `content/education.json`, `content/experience.json`, `content/achievements.json`
- `content/resume.json`, `content/site-settings.json`
- `content/projects/algorithm-visualizer-sorting-pathfinding.json`
- `content/projects/bmi-calculator.json`
- `content/projects/competitive-programming-journey.json`
- `content/projects/ieee-cs-sbc-event-design-branding.json`
- `content/projects/ieee-research-paper-latex-template-suite.json`
- `content/projects/library-management-system.json`
- `content/projects/ml-learning-path-scikit-learn-numpy.json`
- `content/projects/parking-management-system.json`
- `content/research/thira-travel-health-impact-research-application.json`
- `content/projects/.gitkeep`, `content/research/.gitkeep`, `uploads/.gitkeep`
- `css/cms-content.css` — styling only for optional new media/details.
- `js/contact.js` — original EmailJS behavior with editable text/settings.
- `scripts/build.py`, `scripts/html_tools.py`
- `templates/icons/github.svg` — original GitHub icon, reused safely.
- `tests/test_build.py`, `tests/browser.mjs`
- `docs/IMPLEMENTATION.md`, `docs/CHANGES.md`

Generated, ignored output:

- `dist/` — deployable static website, stable CV, admin/config.yml/status.json.
- `.qa/` — editing-session baselines, downloaded pinned CMS bundle, screenshots
  and `browser-report.json`. These are local verification artifacts, not sources
  to upload or commit. The build does not publish this directory.

## Verification completed

The original repository had no tests or build command. New checks run with no
Python/npm package installation:

| Check | Result |
| --- | --- |
| `python -m unittest discover -s tests -v` | 14 passed |
| `node --test auth/worker.test.mjs` | 9 passed, GitHub responses mocked |
| `python scripts/build.py` | Passed, nine project records, OAuth disabled |
| JavaScript syntax: contact.js, bootstrap.js, worker.mjs | Passed |
| Project creation/edit/deletion and empty collections | Passed in isolated content copies |
| Draft omission and excluding source/Worker files from deployment | Passed |
| Profile/email/phone/location/social/skill/education/CGPA/research edits | Passed |
| Uploaded project thumbnail/gallery, dates and featured ordering | Passed |
| PDF replacement at stable CV.pdf URL | Passed |
| Missing assets, bad PDFs, duplicate IDs, invalid proficiency/unsafe URLs | Rejected as expected |
| Project-site and custom-domain media paths/canonical URLs | Passed |
| HTML escaping and script-configuration escaping | Passed |
| Optional fields, empty lists and disabled availability | Passed |
| Output directory cannot overwrite source | Passed |
| Actual pinned Decap 3.16.3 bundle + generated config | GitHub login screen rendered successfully |

The local Chromium run used 1440×1000 and 390×1000 viewports. All eight sections
had identical measured x/y/width/height to the original at both sizes. Both had
zero horizontal overflow. Screenshots were inspected; original stylesheet and
animation script were additionally verified byte-for-byte. Key hero, project,
skill and certificate text was compared against the original and matched.
External Google Fonts were blocked consistently in both test pages, so this is
a controlled layout regression check, not a claim of pixel identity across all
fonts/browsers/devices.

Browser checks also passed keyboard theme activation, saved theme preference,
scroll reveal/skill bars, record counts, CV HTTP response, correctly nested form
fields, simulated EmailJS success/reset/re-enable, disabled-admin messaging and
zero uncaught JavaScript errors. Actual Decap configuration parsing was tested
by enabling the admin status only in the browser interception; delivered
`cms/settings.json` and `dist/admin/status.json` remain disabled.

OAuth unit checks cover configuration failure, state/cookie/PKCE generation,
missing/mismatched/expired state, success handshake, account allowlist,
repository write checks, upstream failure and origin/method/provider rejection.
These use fake credentials/tokens and do not establish live authentication.

The Pages workflow was inspected for source detection, content-push triggers,
default-branch publication, read-only checkout, build-before-deploy dependency,
Pages/OIDC permissions, environment and artifact directory. It has not run on
GitHub because this workspace has no connected Git repository.

## Manual setup and live checks still required

1. Confirm the actual repository, default branch and public URL/custom domain.
   Put `.github/workflows/pages.yml` at repository root and select **Settings →
   Pages → GitHub Actions**. There was no existing workflow to conflict with.
2. Register a GitHub OAuth app; callback is `https://YOUR_WORKER_HOST/callback`.
3. Configure/deploy `auth/` to Cloudflare Workers. Store the client secret only
   as a Worker secret; set exact origins, repository and allowed usernames.
4. Fill `cms/settings.json` and set enabled true. Every authorized account also
   needs repository write access. GitHub organization/SSO policy may apply.
5. After an explicitly authorized upload/push, verify the Pages deployment and
   real GitHub OAuth sign-in, then publish a small edit and confirm the complete
   GitHub → Actions → Pages round trip. Verify a non-allowlisted/read-only account
   cannot sign in. No live account was used here.
6. Verify real media uploads/deletions and PDF replacement through authenticated
   Decap. Build-level equivalents passed; authenticated GitHub writes were not
   attempted. Public CV/media and public-repository drafts remain public.
7. Verify actual EmailJS delivery from the deployed domain. No email was sent.

Admin URL: `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/admin/`, or
`https://YOUR_CUSTOM_DOMAIN/admin/` (user-site repositories also use `/admin/`).

Publication flow: admin save/publish → GitHub commit → Actions tests/build →
Pages deployment. Usually allow a few minutes; examine the Actions run for
failures. Full, beginner-oriented instructions are in the source README.

This is an implemented, locally verified integration with explicit live setup
remaining. It is not represented as a deployed or authenticated production CMS.
