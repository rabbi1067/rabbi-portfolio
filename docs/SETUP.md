# Fazley Rabbi — Portfolio + Decap CMS

The existing static HTML/CSS/JavaScript portfolio now builds from editable JSON content. Its original styles, theme toggle, cursor, animations, sections and responsive layout are retained. It does **not** use React and needs no React migration, database or application server.

**Status:** source and CMS fields are prepared for [rabbi1067/rabbi-portfolio](https://github.com/rabbi1067/rabbi-portfolio), branch `main`. The GitHub Actions workflow builds and deploys Pages after content changes. The OAuth Worker is configured at `https://portfolio-cms-oauth.fazlerabbicse65.workers.dev`; its client secret is stored only in Cloudflare encrypted secrets. Admin: https://rabbi1067.github.io/rabbi-portfolio/admin/. See [বাংলা editing guide](ADMIN_GUIDE_BN.md).

## Preview and test locally

The reference-inspired home redesign is documented in
[docs/HOME_REDESIGN.md](HOME_REDESIGN.md). Edit its portrait through
**Profile → Hero cutout photo**; the text and other CMS fields are unchanged.

Install Python 3.10+ and Node.js 22+ (Node is only for OAuth tests; CI uses Python 3.13 and Node 24). Pillow generates responsive WebP images; no npm install is needed to build. Run from the repository root:

```sh
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
node --test auth/worker.test.mjs
python scripts/build.py
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open `http://localhost:8000/` and `http://localhost:8000/admin/`. The source `index.html` is now a layout template: preview **dist/**, not raw source. Rebuild after local content edits. Stop the preview with Ctrl+C.

For a production-like project configuration:

```sh
python scripts/build.py --repository OWNER/REPOSITORY --branch main --site-url https://OWNER.github.io/REPOSITORY --source-prefix rabbi-portfolio-main
```

Omit `--source-prefix` if source files are at repository root. This prefix is a **GitHub file location**, not part of the public URL. The workflow detects it automatically.

Optional browser QA: `node tests/browser.mjs` uses an already installed `playwright` package and Chromium. `PLAYWRIGHT_MODULE` can point to an absolute installed module path; `BROWSER_EXECUTABLE` can point to an existing Chromium. The test mocks EmailJS and sends no real email. Screenshots go to ignored `.qa/`. Browser tooling is optional and is not added to production.

## 1. Configure GitHub Pages

The confirmed repository is `rabbi1067/rabbi-portfolio`, default branch `main`. Its publishing workflow is included at `.github/workflows/pages.yml` in the repository root.

1. Use your existing GitHub repository and its actual default branch. This integration supports either layout:
   - Repository root contains `rabbi-portfolio-main/index.html` and its siblings.
   - Repository root directly contains `index.html`, `scripts/`, `content/`, etc.
2. Put the supplied workspace-level `.github/workflows/pages.yml` at **repository root**. If uploading only the inner source folder, also copy this workflow into its `.github/workflows/` folder.
3. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**, replacing old branch publishing.
4. Enable Actions and allow official `actions/*` actions. The build uses read-only checkout/Pages metadata permissions; only deployment gets `pages: write` and `id-token: write`.
5. Check the `github-pages` environment permits the default branch. Keep existing domain/HTTPS settings. If you already have a custom domain, keep its `CNAME` in the source folder; the build copies it.
6. After you choose to upload/push, open **Actions → Build and deploy portfolio**. Every push and PR runs tests/builds. Only the default branch deploys. Manual **Run workflow** also works; select the default branch to publish.

Pages supplies its real URL to the build. Assets remain relative; uploads get the correct repository prefix. Canonical and `og:url` metadata update to that URL. The original `fazleyrabbi.dev` metadata is retained only when building locally without a configured URL; its hosting is unverified. Original title, description, keywords, Open Graph text and favicon are retained and editable. There was no sitemap/robots file; add either to the source root later and it will be copied.

Reference: [GitHub's Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## 2. Set up GitHub OAuth (required for login)

GitHub Pages cannot keep a client secret or exchange an OAuth code. The separate `auth/worker.mjs` Cloudflare Worker does only that exchange and validates GitHub identity/repository write permission. The portfolio remains on GitHub Pages. This follows [Decap's OAuth proxy flow](https://decapcms.org/docs/backends-overview/).

A Cloudflare account is required. The Worker uses no database, paid domain or storage; small personal use can fit within Workers Free. Check [current pricing and quotas](https://developers.cloudflare.com/workers/platform/pricing/) before enabling a paid plan. This integration does not enable billing.

1. Choose the Worker name and `workers.dev` address, such as `https://portfolio-cms-oauth.YOUR_SUBDOMAIN.workers.dev`.
2. In GitHub **Settings → Developer settings → OAuth Apps → New OAuth App**:
   - Application name: your portfolio CMS.
   - Homepage: your real portfolio URL, including repository path if used.
   - Authorization callback: `https://YOUR_WORKER_HOST/callback`. This belongs to the Worker, **not** `/admin/` on Pages.
3. Set non-secret values in `auth/wrangler.toml`:
   - `GITHUB_CLIENT_ID`: OAuth app client ID.
   - `GITHUB_REPOSITORY`: exact `OWNER/REPOSITORY`.
   - `ADMIN_ORIGIN`: just `https://OWNER.github.io` or `https://your-domain.com`. No repository path, `/admin`, or trailing slash.
   - `AUTH_ORIGIN`: exact Worker HTTPS origin, no trailing slash.
   - `ALLOWED_USERS`: comma-separated authorized GitHub usernames. Each must also have **Write** (or higher) access to the repository.
   - `OAUTH_SCOPE`: keep `public_repo` for a public repository. Use `repo` only for a private repository with a GitHub plan supporting its Pages setup.
4. From `auth/`, run the official Wrangler CLI on your computer:

   ```sh
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put GITHUB_CLIENT_SECRET
   ```

   Paste the OAuth client secret only into the last command's hidden prompt. The Worker rejects login until that secret exists. You can instead set an encrypted secret in Cloudflare's Worker dashboard. Never put the secret in `wrangler.toml`, JSON content, Pages artifacts, or frontend code. See [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
5. Edit `cms/settings.json`:

   ```json
   {
     "repository": "OWNER/REPOSITORY",
     "branch": "main",
     "oauth_base_url": "https://YOUR_WORKER_HOST",
     "site_url": "https://OWNER.github.io/REPOSITORY",
     "enabled": true
   }
   ```

   Set branch to the actual default/publishing branch. CI derives repository, branch and Pages URL from GitHub; these settings support local builds. Use your custom-domain URL when applicable. The OAuth base URL must be only the origin, no path/trailing slash.
6. Rebuild and publish through Actions. Open `/admin/`, allow popups, choose **Login with GitHub**, and authorize using an allowlisted account with Write access. Organization repositories may require an owner to approve OAuth/SSO.

The Worker implements random state, a ten-minute Secure/HttpOnly/SameSite cookie, PKCE, fixed callback, an account allowlist, repository write checks and an origin/opener-bound popup handshake. No PAT or client secret is embedded in static files. Decap receives a user OAuth token during sign-in and uses it in the authenticated browser to call GitHub, as the direct GitHub backend requires. Sign out on shared computers.

GitHub OAuth scopes are not limited to a single repository: `public_repo` can authorize access to other public repositories the account can write. The configured repository determines this CMS's edits; the Worker controls which accounts receive tokens. Review GitHub's authorization screen. Revoke the OAuth app to invalidate issued tokens. See [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

## 3. Open the dashboard and edit content

Bookmark `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/admin/`. For a user-site repository or custom domain, use `https://YOUR_SITE/admin/`.

No public Admin/Login link is added. The shell and field configuration are public; authentication and repository permission protect editing. A hidden URL is not access control.

Choose a collection or **Portfolio settings**, edit, and click **Publish** (or **Save**, depending on the screen). This setup commits directly to the publishing branch and does not bypass branch protection. For branches requiring PRs, use a compatible editorial workflow or reviewed GitHub edits instead of weakening protections.

| Editor area | Editable content |
| --- | --- |
| Profile | Names, title, hero, availability, photos/alt text, biography, CTAs, stats, badges, tags |
| Projects | CRUD, unique IDs, descriptions, category/tags/stack, links, media, dates, featured/order/publication |
| Research | THIRA/new research, plus area, abstract, dataset, methodology, authors, paper, DOI and publication status |
| Research papers | Add/edit/delete/hide publications; title, authors, abstract, venue, year, status, original URL, DOI, PDF and display order |
| Skills | Category/skill CRUD, icons/images, order, proficiency, animated percentages |
| Education | Institution, degree/department, period, description, CGPA/GPA, order |
| Experience | Organization, role, dates/period, current status, responsibilities/achievements and order; includes clubs, volunteering and CP |
| Achievements | Award/certificate title, issuer, date, description, credential URL, certificate file/image, order and existing badge appearance |
| Reviews | Names, roles, quotes, approval/sample status, stars, highlight badges, photos, profile/source links, show/hide/order; autoplay and starting card |
| Resume | Public CV PDF upload/replacement |
| Contact | Email, phone, location, social URLs/handles, placement and order |
| Site settings | Section copy, navigation labels, footer, SEO, form labels/messages and public EmailJS identifiers |

**Hide without deleting:** turn off **Show on website / Published** on a project,
paper, review, award, education/experience item, skill category/skill or social
account. The saved content remains available to edit and show again. To remove
an item, use the record/list Delete control. Projects, Research projects and
Research papers support creating and deleting files directly through the CMS.
Under Site Settings → Sections, **Show this section** hides a full section and
its navigation links. Content is retained; hidden section HTML is omitted from
the published build.

**Footer accounts:** Contact → Links has **Show in footer**, independently of
the hero and contact placements. The separate Find Me On section was removed.

**Papers:** the header Research link opens the publication section. Add records
under Research papers. Enter an original HTTP(S) URL, a DOI such as
`10.1234/identifier` (converted to a doi.org URL), and/or a PDF. Links open in new
tabs. No papers were supplied, so the section currently shows an editable empty
state. Research projects remain in Featured Projects.

**Review approval:** the owner confirmed approval of the current four reviews
and their 5-star ratings. New drafted text can retain the Sample switch; turn it
off and enable **Approved by the reviewer** only for approved text/rating.
The carousel centers a larger card, fades side cards, loops visually and keeps
loop copies out of the keyboard and accessibility tree. Star ratings, highlight
badges, autoplay interval and the initially focused reviewer are editable.

The content/build and mocked auth tests validate these flows. GitHub login and
live dashboard create, save and delete have also been verified against this
repository. Temporary QA records were removed.

### Projects and research

**Optional action buttons:** enter **GitHub repository URL (optional)** and/or
**Live demo URL (optional)** on a project record. Each supplied URL gets its own
labelled button that opens a new tab. Leave either field blank to omit that
button; no placeholder link or error is shown. Use a complete HTTPS URL. The
project Tags list supports up to 20 entries and wraps on smaller screens.

**Portrait roles:** under **Portfolio settings → Profile → Portrait role tags**,
add up to 20 role tags. The current four are AI Engineer, Researcher, Full Stack
Developer and Competitive Programmer. They are always visible around the
portrait on desktop and below it on mobile. The stats stay visible,
centered immediately below Download CV and View Skills.

- **Add:** Projects → New; enter a unique lowercase/hyphen ID, title, description, stack, links and order. Keep IDs stable. Set **Published** true to display the card.
- **Edit:** open the record; its existing card and `#project-YOUR-ID` anchor update after deployment. Existing section URLs are preserved.
- **Delete:** open record → Delete. Only its JSON record is deleted; unrelated assets and records are retained.
- **Draft:** Published false excludes the card/text; content source JSON is never copied into Pages. In a **public repository**, drafts are still readable on GitHub, and uploads are public. Do not put confidential drafts or credentials there.
- **Order:** featured cards first, then smaller Order first within each group. All published projects/research appear in the existing grid without HTML edits. Original cards are all featured and retain order.
- Optional detailed descriptions, category, gallery, dates and research metadata appear in expandable **Details** only when entered. Original cards have no added details controls. Plain text supports `**bold**` and line breaks in biography/details. Content HTML is escaped.

### Profile, phone, email, education and skills

**Contact → Email/Phone** control link destinations. **Phone display** controls the formatted visible number; update both when changing it, or clear Phone display to reuse Phone. The hero, Contact and footer share the primary LinkedIn URL. Leave **Contact URL** empty to keep using the primary URL everywhere.

**Education → Items → GPA** controls CGPA/GPA. It starts empty because none was displayed originally. Set Department/GPA label as needed. Experience's original Period stays until ISO start/end dates are entered; those dates and Current then determine the period.

Skill **Visualization** preserves bars/tags per category. For bars, update both Percent (0–100, controls animation) and Proficiency (visible label). Smaller Order comes first. List controls add/remove categories and skills.

### Replace the CV

**Resume → File**: upload/select a PDF, then publish. The build verifies it and copies it to **`CV.pdf`**. Existing Download CV buttons and the stable URL deliver the replacement after deployment. The original source `CV.pdf` is retained safely.

CV PDFs are **public to anyone with their URL**. Old uploads remain public in uploads and, for a public repository, Git history. Remove old uploads only after a successful replacement and verifying no fields reference them. Never delete the active PDF first. A missing/non-PDF file fails the build; the last deployed site stays live.

### Images and media

Upload through image/file fields or Media. Files go to source `uploads/`; generated CMS paths include the Pages prefix (`/REPOSITORY/uploads` or `/uploads` on a custom domain). Select the uploaded file in a field and publish. Add useful alternative text. New optional images load lazily; existing portrait sizing/cropping is preserved. Optimize sizes before upload.

Search content before deleting shared media. The build checks rendered local asset links and fails on missing files. It never automatically prunes media or Git history.

## 4. Automatic publication

**Admin publish → GitHub content commit → Actions tests/build → Pages publishes dist/ → updated public site.** Allow a few minutes (often about 1–5 depending on queues; an estimate, not a guarantee). The Actions deployment link is authoritative.

Generated `dist/` and QA files are ignored. The artifact contains public HTML/assets/media/CV and the separate admin shell/config. It excludes source content, draft JSON, Worker source/config, tests and credentials. Decap's bundle loads only on admin.

## Troubleshooting

- **Setup notice:** fill `cms/settings.json`, configure the Worker secret, set enabled true, rebuild/deploy. Inspect generated `dist/admin/config.yml` (JSON syntax is valid YAML); do not edit generated files as source.
- **No login button:** check CDN/internet access, console and deployment. The CMS version is pinned in `admin/bootstrap.js`; test upgrades before changing it.
- **Popup stuck:** allow popups; make oauth_base_url match AUTH_ORIGIN exactly. ADMIN_ORIGIN must have the correct HTTPS domain without path/trailing slash. GitHub callback must match `AUTH_ORIGIN/callback`. Retry after a ten-minute cookie expiry.
- **Forbidden:** use an allowlisted GitHub account with Write access; check organization OAuth/SSO policy.
- **Cannot publish:** check repository/branch, branch protection, authorization and generated source-prefix paths.
- **Saved but unchanged:** inspect the newest Actions run's first failing step. Fix the named field/missing upload. A failed build leaves the last successful site live.
- **Deploy fails:** check Pages source = Actions, default-branch environment access, official actions allowed and Pages/OIDC permissions. Check existing workflows before removing duplicates; none existed in this copy.
- **Media path wrong:** check Pages URL and generated public_folder. Re-select old manually entered URLs if needed. JavaScript/data URLs and parent-directory paths are rejected.
- **Contact delivery fails:** EmailJS is independent of CMS. Verify its service/template/public key, allowed domain and recipient in EmailJS. Changing Contact email changes mailto; change the EmailJS recipient separately. Browser tests mock EmailJS and do not verify delivery.

## Disable CMS

Set enabled false, rebuild and redeploy to disable the UI. To revoke effective access, disable/delete the OAuth app or revoke authorizations in GitHub, and remove unwanted collaborators. Disabling the UI/changing the allowlist does not revoke existing tokens. The portfolio works without CMS access.

## Files and verification

See [docs/IMPLEMENTATION.md](IMPLEMENTATION.md) for the inspection and [docs/CHANGES.md](CHANGES.md) for inventory/results/live checks. `cms/schema.json` defines CMS fields/build validation. `scripts/build.py` renders statically with Python and Pillow. Edit `index.html` for layout changes and content JSON/CMS for routine edits.

## Home, image delivery, certificate count and skills

- **Profile → Home headline role** controls the home title (currently `AI Engineer & Full Stack Developer`). Leave **Home secondary role** empty for one role. Biography and other sections remain independently editable.
- **Profile → Statistics / About statistics → Value source → certifications** shows the exact number of published Certifications & Awards entries. Add/delete/hide changes the count on the next build; drafts are excluded. Labels remain editable. Choose `manual` for unrelated statistics. Awards are included in this record count.
- **Skills → Categories** supports editable category names, icons or uploaded images, display order, show/hide, tag or bar presentation, and nested skills with editable names/images/alt text/order/show-hide. The current presentation has six categories and 31 skill chips without invented proficiency percentages. Add/delete using the list controls.
- Profile, hero, About, project, certificate, reviewer and skill images can be uploaded in the existing image fields. The build uses Pillow to create responsive WebP files from local raster images, preserving transparency and EXIF orientation. Browser-selected variants use `sizes`/`srcset`; logo variants are only 48/96 pixels. Below-fold images are lazy loaded. Original files and credential download links remain intact; remote and animated images retain their original delivery. Larger-than-original variants are omitted. `.qa/image-cache` is a disposable build cache keyed by image contents.
- LinkedIn now uses the same primary URL in hero, contact and footer. To change all three, edit **Contact → Links → LinkedIn → URL** and leave the optional contact URL override empty. The existing primary URL was retained; account ownership was not independently checked.
- Contact success/error/sending text is editable in **Site settings → Form**. Messages appear inside the form with a live status announcement; failures retain typed text, and submitting disables the button. Local QA simulates successful and failed EmailJS calls and unavailable SDK; it sends no real email. Delivery to the real inbox remains unverified.
- Uploads and JSON changes publish only after the content build/deployment succeeds. Live Decap login and save/publish are connected through the configured GitHub OAuth Worker.

## Mobile and optional-content refinements

- At widths up to 768px the fixed Scroll Down cue is hidden. Skills use six categories, merging Databases into Web & Backend; phones show a compact two-column grid.
- Experience bullets are editable through the existing Responsibilities list. Current bullets use information already present in the portfolio, without invented numerical outcomes.
- Reviews show quote, highlight, reviewer and role; stars/numeric ratings are not rendered. Stored ratings remain editable historical data.
- Project thumbnails are optional. No image means no empty media area, unless an administrator explicitly configures a site-wide default image. Certificate images/files are also optional; an image file can serve as its cover.
- A non-empty Verification URL renders **Verify credential**; a certificate file renders **View certificate**. Both open in new tabs; neither is fabricated from a truncated ID.
- Credential IDs are stored separately and hidden by default. Enable **Show credential ID** to display one. Add full issuer verification URLs when available.
- The ICPC display year follows the existing 2024 event description. AI CERTs validity dates remain visible; the badge no longer implies the credential is currently valid. Dark/light supporting text and status badges use stronger contrast.
