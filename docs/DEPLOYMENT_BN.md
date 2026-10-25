# Deploy ও edit করার গাইড

## Project structure

- `frontend/`: public portfolio, Administrator Studio, editable seed content, static build scripts, images.
- `backend/`: Java 21 + Spring Boot API, administrator authentication, uploads, content publishing ও backup export.
- `auth/`: আগে থেকে থাকা GitHub OAuth bridge; GitHub CMS-এর optional fallback হিসেবে রাখা হয়েছে। নতুন email/password login এটি ব্যবহার করে না।

Frontend কখনো admin password যাচাই করে না। `ADMIN_EMAIL`, `ADMIN_PASSWORD` বা `ADMIN_PASSWORD_HASH` **শুধু backend service-এর Environment-এ** থাকবে। Vercel-এর static frontend-এ এগুলো রাখবে না। Password repository বা browser code-এ যাবে না।

## Option A: Vercel frontend + Render backend

### 1. Backend — Render

1. New → Web Service → এই GitHub repository connect করো।
2. Runtime: **Docker**। Dockerfile: `backend/Dockerfile`; Docker build context: repository root (`.`)। Root Directory খালি রাখো, কারণ Docker build-এর জন্য `frontend/`-ও প্রয়োজন।
3. Environment-এ দাও:

| Variable | Value |
|---|---|
| `ADMIN_EMAIL` | তোমার admin login email |
| `ADMIN_PASSWORD` | আলাদা, দীর্ঘ password; কমপক্ষে ১২ অক্ষর |
| `ALLOWED_ORIGINS` | `https://your-site.vercel.app,https://rabbi1067.github.io` — trailing slash বা path নয় |
| `FRONTEND_URL` | সম্পূর্ণ frontend URL, যেমন `https://your-site.vercel.app` |
| `DATA_DIR` | `/var/data` |

4. **Persistent disk** attach করো: mount path `/var/data`, অন্তত 1 GB। Render-এর disk/paid service-এর খরচ dashboard-এ দেখে নিশ্চিত করো। Free ephemeral filesystem-এ edited content স্থায়ী থাকবে না।
5. Health check: `/api/public/health`। Deploy শেষ হলে backend URL রাখো, যেমন `https://your-backend.onrender.com`।

`render.yaml` ব্যবহার করেও একই service তৈরি করা যায়। Blueprint-এ backend-এর `starter` plan ও persistent disk আছে; apply করার আগে মূল্য দেখে নিও। এটি নিজে থেকে apply করা হয়নি।

### 2. Frontend — Vercel

1. Add New Project → repository import।
2. Root Directory: **`frontend`**। Framework Preset: **Other**। এই folder-এর `vercel.json` build/output settings দেয়।
3. Environment-এ `API_BASE_URL=https://your-backend.onrender.com` এবং `FRONTEND_URL=https://your-site.vercel.app` দাও।
4. Deploy। প্রথম deploy-এর URL পাওয়ার পর Render-এর `ALLOWED_ORIGINS` ও `FRONTEND_URL` ঠিক করো এবং frontend environment-ও সেই final URL-এ রাখো।
5. Footer-এর **ADMINISTRATOR** button → নিজের email/password দিয়ে sign in করো।

Preview deployment-এর hostname production থেকে আলাদা হয়। Preview-তে login প্রয়োজন হলে সেই exact origin Render-এর allowed list-এ যোগ করতে হবে; wildcard `*` দিও না।

## Option B: দুটোই Render

উপরের Docker backend deploy করো। এরপর আলাদা Static Site:

- Root Directory: `frontend`
- Build Command: `pip install -r requirements.txt && python scripts/build.py`
- Publish Directory: `dist`
- `API_BASE_URL`: backend URL
- `FRONTEND_URL`: static site URL
- Backend-এর allowed origins-এ static site-এর exact origin দাও।

একটি service দিয়েও চালানো যায়: Spring Boot backend নিজেই built frontend ও `/admin/` serve করে। তখন `FRONTEND_URL` ও `ALLOWED_ORIGINS` দুটোতেই backend-এর `https://…onrender.com` origin দাও। আলাদা frontend service লাগবে না।

## Option C: GitHub Pages frontend + Render backend

1. Render backend আগের মতো চালু রাখো; GitHub Pages Java server চালায় না।
2. GitHub repository → Settings → Secrets and variables → Actions → **Variables** → `API_BASE_URL` নামে backend URL দাও। এটি public URL, secret নয়।
3. Render-এ `ALLOWED_ORIGINS`-এ `https://rabbi1067.github.io` দাও; `FRONTEND_URL=https://rabbi1067.github.io/rabbi-portfolio`।
4. Actions → Build and deploy portfolio → Run workflow।
5. Site: `https://rabbi1067.github.io/rabbi-portfolio/`; Administrator: একই URL-এর `admin/`।

API_BASE_URL না থাকলে portfolio তার repository content থেকে তৈরি static version দেখায়। Footer-এর Administrator page তখন backend connection-এর নির্দেশনা এবং পুরোনো GitHub CMS-এর link দেখাবে। GitHub দিয়ে edit করতে `/admin/github/` ব্যবহার করো।

## Content edit

1. Footer → **ADMINISTRATOR** → sign in।
2. **Home & About**: introduction, biography, role tags, profile/hero/about images, counters ও buttons।
3. **Projects**: New record → unique lowercase `id` → title, description, thumbnail, screenshot gallery, tags, GitHub/live links। পুরোনো record-এর Edit/Delete আছে।
4. **Skills / Education / Experience**: category ও list item add, remove ও reorder করো।
5. **Research papers**: title, authors, journal/conference, type, status, year, publication date, topics, DOI, paper URL, PDF ও optional image। Peer-reviewed সত্যি হলে toggle করো। DOI না থাকলে খালি রাখো।
6. **Certifications & Awards**: item add/remove, image ও PDF/verification link। Counter ও See all count published records থেকে স্বয়ংক্রিয়ভাবে গণনা হয়।
7. **Reviews**: name, role, text, photo, profile URL। Sample/approval settings আগের মতো আছে।
8. **Contact**: email, WhatsApp number, location, social link add/remove/edit। WhatsApp number country code-সহ দাও।
9. **Site settings**: menu labels, section headings/subtitles, visibility, form settings, footer tagline, contact labels ও SEO।
10. Image/File field-এ upload করো। Upload-এর পর **Save & publish** না চাপা পর্যন্ত ওই section-এর পরিবর্তন প্রকাশিত হবে না। File preview-এর পাশে Clear আছে।
11. **Published / Show on website** বন্ধ করলে item মুছে না দিয়ে hide করা যাবে। Section hide করতে Site settings ব্যবহার করো।
12. **Save & publish** validation ও static rendering চালায়। ভুল content হলে previous version পুনরুদ্ধার হয় এবং error দেখায়। Connected frontend refresh করলেই নতুন content আসে; frontend redeploy লাগে না।
13. **Download backup** নিয়মিত রাখো। ZIP-এ `content/` ও `uploads/` থাকে; admin credentials থাকে না।

## Data ও backups

Backend এক instance-এ disk-ভিত্তিক JSON এবং uploads রাখে। `/var/data/site` persistent হতে হবে। নতুন deploy code refresh করে, কিন্তু existing content/uploads overwrite করে না। একাধিক replicas-এর জন্য এই storage model ব্যবহার করো না।

Backend edits repository-তে auto-commit হয় না। Static fallback ও GitHub-only CMS repository content ব্যবহার করে; connected site backend-এর latest content ব্যবহার করে। GitHub-এ fallback update করতে backup-এর `content/` ও `uploads/` পরীক্ষা করে `frontend/`-এ restore করে commit করো। Credentials ও generated runtime data commit করো না।

Backend অনুপলব্ধ হলে frontend published static fallback দেখাবে। Render cold start বা network সমস্যার কারণে সে ক্ষেত্রে latest backend edit সাময়িকভাবে নাও দেখা যেতে পারে।

## Local development

Java 21, Maven 3.9+, Python 3.12+ দরকার।

```powershell
python -m pip install -r frontend/requirements.txt
$env:ADMIN_EMAIL='owner@example.com'
$env:ADMIN_PASSWORD='your-long-local-password'
$env:PORTFOLIO_SOURCE=(Resolve-Path frontend).Path
$env:DATA_DIR=(Join-Path (Get-Location) 'backend/data')
$env:PYTHON_COMMAND='python'
$env:FRONTEND_URL='http://localhost:8080'
mvn -f backend/pom.xml spring-boot:run
```

Open `http://localhost:8080/` এবং `http://localhost:8080/admin/`। Local password example-এর বদলে নিজের value দাও; password chat-এ পাঠানোর প্রয়োজন নেই।

শুধু static frontend:

```powershell
$env:API_BASE_URL='http://localhost:8080'
python frontend/scripts/build.py --source-prefix frontend
python -m http.server 8000 --directory frontend/dist
```

`http://localhost:8000`-এর allowed origin backend-এ default দেওয়া আছে। Credentials runtime environment থেকে নেয়; `.env` files নিজে থেকে load হয় না। IDE run configuration বা hosting dashboard ব্যবহার করো।

## Security ও behaviour

- Password backend startup-এ BCrypt hash হয়; চাইলে `ADMIN_PASSWORD_HASH` দিয়ে আগে থেকেই BCrypt hash সেট করা যায়।
- ৮ ঘণ্টা মেয়াদের random bearer session; sign out করলে token invalid হয়। Browser sessionStorage-এ থাকে, persistent localStorage-এ নয়।
- Wrong login ৫ বার হলে ওই source address ১৫ মিনিটের জন্য rate limited।
- Exact CORS origin allowlist; API কোনো auth cookie ব্যবহার করে না।
- Upload file signature checked; PNG/JPEG/WebP/GIF/PDF accepted, executable ও SVG upload rejected।
- Content validation, safe URL checks, path restrictions ও rollback আছে। ছবি edit করা যায়; broken references publish হতে দেওয়া হয় না।
- Production-এ HTTPS URL ব্যবহার করো। Admin credentials পরিবর্তন করলে backend redeploy/restart করো; আগের sessions invalid হবে।
