# Inspection and implementation plan

The supplied project is a static site, not React: one HTML page, one CSS file,
one JavaScript file, five images and CV.pdf. It has no package manifest, tests,
router, Git metadata, CNAME, robots file, sitemap or GitHub Actions workflow.
The README describes branch deployment. The HTML claims fazleyrabbi.dev in its
canonical metadata, but there is no evidence that domain is configured.
GitHub links identify Rabbi1067; they do not establish the repository or branch.

Content audit: eight anchors (home, about, projects, skills, experience,
competitive, certifications, contact), nine projects, six skill categories,
two education entries, three work/volunteer/CP entries, four social profiles,
eight awards/certificates, three hero statistics, three floating badges,
biography, photos, CTAs, contact details/form copy, footer and SEO. Research is
already represented by the THIRA project and research-writing projects.
There are no separate blog, service, testimonial or publication sections.
The contact form uses EmailJS public identifiers (not an OAuth secret).
The original contact form has misplaced closing tags; fix its nesting without
changing classes or layout. The contact LinkedIn URL differs from the hero URL;
retain that explicit override pending the owner's verification.

Plan and files:

1. Keep index.html as the layout template; retain css/styles.css and js/main.js.
2. Extract profile, copy/SEO, contacts, skills, education, experience, awards and
   projects/research into content/*.json. Preserve existing values and order.
3. Add scripts/build.py and cms/schema.json: dependency-free static generation,
   validation, asset checks, draft exclusion, stable CV.pdf and admin config.
4. Add admin/ shell and cms/settings.json with deliberately unconfigured OAuth.
5. Add auth/ Cloudflare Worker for the OAuth exchange only. No portfolio server
   or database. Validate state, origin, GitHub account and repository write access.
6. Add a GitHub Pages workflow at the workspace/repository root, allowing either
   this nested source folder or the source folder uploaded as repository root.
7. Add meaningful build/content/security tests and beginner setup documentation.

Generated dist/ contains only the public page/assets and admin shell/config.
Content source files, draft records, auth source and credentials are not shipped.
No commit, push, OAuth registration or remote deployment is authorized here.
