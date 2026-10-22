<div align="center">

![Fazley Rabbi — AI Engineer & Full Stack Developer, animated geometric banner](docs/assets/readme-hero.svg)

# Hello, I’m Fazley Rabbi

**AI Engineer & Full Stack Developer**<br />
CSE at Southeast University · Competitive programmer · Research enthusiast

[**Explore my portfolio ↗**](https://rabbi1067.github.io/rabbi-portfolio/) · [LinkedIn](https://www.linkedin.com/in/fazleyrabbi1067) · [Email](mailto:fazlerabbicse65@gmail.com)

[![Build and deploy portfolio](https://github.com/rabbi1067/rabbi-portfolio/actions/workflows/pages.yml/badge.svg)](https://github.com/rabbi1067/rabbi-portfolio/actions/workflows/pages.yml)

**1,000+ problems solved** &nbsp; · &nbsp; **ICPC Asia Dhaka 2024 — Honorable Mention**

</div>

---

### A place for the work, and the thinking behind it

My portfolio brings together software projects, AI and machine learning exploration, competitive programming, research experience and credentials. A calm dark palette, teal accents and subtle portrait depth keep the focus on the work.

[![Portfolio home preview with four visible role tags](docs/assets/portfolio-preview.webp)](https://rabbi1067.github.io/rabbi-portfolio/)

### Explore

| Section | What you’ll find |
| :--- | :--- |
| [Projects](https://rabbi1067.github.io/rabbi-portfolio/#projects) | Selected work, technology tags and optional source/demo links |
| [Skills & Tools](https://rabbi1067.github.io/rabbi-portfolio/#skills) | Languages, web development, AI, research and design tools |
| [Experience](https://rabbi1067.github.io/rabbi-portfolio/#experience) | Roles, responsibilities and practical experience |
| [Certifications & Awards](https://rabbi1067.github.io/rabbi-portfolio/#certifications) | Credentials with optional verification and certificate links |
| [Reviews](https://rabbi1067.github.io/rabbi-portfolio/#reviews) | Reviewer-approved feedback in a responsive carousel |
| [Contact](https://rabbi1067.github.io/rabbi-portfolio/#contact) | Social links, email and the contact form |

### Built with care

- **Responsive by design.** Layouts for phones, tablets and desktops; compact mobile skills and navigation.
- **Motion with restraint.** Pointer-driven portrait depth, floating role tags and reduced-motion support.
- **Smaller images.** Responsive WebP variants, lazy loading below the fold and original uploads preserved.
- **Content you can maintain.** Edit text, images, links, ordering and visibility through the CMS. Certificate counters follow published records automatically.
- **Automatic publishing.** Content changes become Git commits; GitHub Actions validates, builds and deploys the site.

### Under the hood

| Layer | Technology |
| :--- | :--- |
| Website | Semantic HTML · CSS · JavaScript |
| Content | JSON records · Decap CMS |
| Build & images | Python · Pillow |
| Hosting & deployment | GitHub Pages · GitHub Actions |
| Editor authentication | GitHub OAuth · Cloudflare Worker |

The public website is static. The Worker handles editor authentication; it stores the OAuth secret outside the repository.

### Run locally

Use Python 3.10 or newer. From the repository root:

```sh
python -m pip install -r requirements.txt
python scripts/build.py
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open [localhost:8000](http://localhost:8000/). Rebuild after changing content or templates. `dist/` is generated output; edit source files instead.

```sh
python -m unittest discover -s tests -v
node --test auth/worker.test.mjs
```

Node.js 22+ is needed for the OAuth tests. Optional browser checks and deployment configuration are covered in the [setup guide](docs/SETUP.md).

<details>
<summary><strong>For the owner — edit content & publish</strong></summary>

1. Open the [admin panel](https://rabbi1067.github.io/rabbi-portfolio/admin/) and choose **Login with GitHub**.
2. Sign in with an authorized GitHub account that has repository write access.
3. Select **Portfolio settings**, **Projects**, **Research**, **Certifications** or **Reviews**; edit the record and choose **Publish**.
4. To hide an item, turn off **Published**. Use **Delete** to remove the record.
5. Wait for [Build and deploy portfolio](https://github.com/rabbi1067/rabbi-portfolio/actions/workflows/pages.yml) to finish, then refresh the website.

**বাংলায় ধাপে ধাপে:** [Portfolio edit করার গাইড](docs/ADMIN_GUIDE_BN.md)<br />
**Full configuration:** [Setup & troubleshooting](docs/SETUP.md)

The admin URL is public; editing requires authorization. Public repository content and uploaded files are public too. Keep credentials in the Worker’s encrypted secrets.

</details>

<details>
<summary><strong>Source map & further documentation</strong></summary>

```text
content/           Profile, skills and collection records
cms/               Editable field schema and non-secret settings
index.html         Page layout template
css/ · js/         Styles, interactions and accessible navigation
scripts/           Static build and responsive image generation
admin/             CMS application entry point
auth/              OAuth Worker and its tests
tests/             Content, build and browser regression checks
docs/              Editing guide, setup notes and design documentation
```

[Design notes](docs/HOME_REDESIGN.md) · [Implementation](docs/IMPLEMENTATION.md) · [Changes](docs/CHANGES.md)

</details>

---

<div align="center">

**Let’s build something useful.**<br />
[Get in touch](https://rabbi1067.github.io/rabbi-portfolio/#contact) · [Codeforces](https://codeforces.com/profile/rabbi1067) · [CodeChef](https://www.codechef.com/users/rabbi1067)

<sub>Designed around clarity. Built to keep evolving.</sub>

</div>
