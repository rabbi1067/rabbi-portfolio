# Portfolio edit করার গাইড

Website: https://rabbi1067.github.io/rabbi-portfolio/

Admin: https://rabbi1067.github.io/rabbi-portfolio/admin/

## Login এবং publish

1. Admin link খোলো এবং **Login with GitHub** চাপো।
2. **Rabbi1067** account দিয়ে login করো; প্রথমবার portfolio CMS app authorize করতে হবে।
3. বাম পাশের collection অথবা **Portfolio settings** থেকে প্রয়োজনীয় অংশ খোলো।
4. তথ্য বদলে **Publish / Publish now** চাপো। Publish confirmation থাকলে confirm করো।
5. পরিবর্তন GitHub repository-তে save হবে। **Actions → Build and deploy portfolio** সবুজ হলে live website refresh করো। সাধারণত কিছু সময় লাগে; build চলার সময় আগের website দেখা স্বাভাবিক।
6. কাজ শেষে user menu থেকে log out করো, বিশেষ করে shared computer হলে।

## কোথায় কী বদলাবে

| কাজ | Admin-এর জায়গা |
|---|---|
| Home heading ও role | Portfolio settings → Profile → Greeting / Full name / Home headline role |
| Home-এর ছোট identity role | Profile → Home identity role |
| Home portrait | Profile → Hero cutout photo; transparent PNG/WebP ভালো |
| Logo/profile photo ও About photo | Profile → Profile photo / About photo |
| পরিচিতি ও About লেখা | Profile → Introduction / Biography |
| Hover tags | Profile → Portrait role tags; সর্বোচ্চ ২০টি |
| C++, Python ইত্যাদি chips | Profile → Programming language chips |
| Social, email, phone | Portfolio settings → Contact |
| Footer social | Contact → Links → Footer toggle |
| Skills ও category | Portfolio settings → Skills → Categories → Items |
| Education / Experience | Portfolio settings → Education / Experience |
| Experience bullets | Experience → role → Responsibilities list |
| Certificate / award | Portfolio settings → Achievements → Items |
| CV PDF | Portfolio settings → Resume → File |
| Reviews | Portfolio settings → Reviews → Items |
| Section title, form message, SEO | Portfolio settings → Site settings |

## Project যোগ, edit এবং delete

- **Projects → New** খুলে একটি unique ID দাও, যেমন `my-new-project`। ID-তে ছোট ইংরেজি অক্ষর, সংখ্যা ও hyphen ব্যবহার করো।
- Title, description, category, stack/tags এবং order দাও। Tags সর্বোচ্চ ২০টি।
- Thumbnail optional: ছবি দিলে দেখাবে; খালি থাকলে ফাঁকা image area দেখাবে না।
- GitHub URL ও Live Demo URL আলাদা এবং optional। যেটি দেবে শুধু সেই button দেখাবে; নতুন tab-এ খুলবে। আসল repository/demo-এর সম্পূর্ণ HTTPS link দাও।
- **Published** বন্ধ করলে project লুকাবে। Delete করলে record মুছে যাবে; আগে hide ব্যবহার করে দেখাও যায়।
- **Research projects** collection-এ THIRA-র মতো research project; **Research papers** collection-এ প্রকাশনা। Paper-এর title, authors, year, DOI/original URL/PDF যোগ করতে পারবে।

## Certificate ও verification

- Achievements → Items-এ Add দিয়ে certificate/award যোগ করো; বিদ্যমান item খুলে edit করো।
- **Verification URL**-এ issuer-এর সম্পূর্ণ verification link দিলে **Verify credential** দেখাবে। Link না থাকলে button দেখাবে না। ছোট/অসম্পূর্ণ ID থেকে URL বানাবে না।
- **Certificate**-এ PDF/image দিলে **View certificate** দেখাবে। **Thumbnail image** দিয়ে আলাদা cover দিতে পারবে।
- **Credential ID** optional। ID দেখাতে চাইলে **Show credential ID** চালু করো।
- Certificate/award যোগ, delete বা **Show on website** বন্ধ করলে hero ও About-এর count পরের successful build-এ আপডেট হবে। Count হাতে বদলাতে হবে না।

## Skills, reviews ও hide

- Skills → Categories-তে category যোগ/delete/reorder করতে পারবে। প্রতিটি category-এর Items-এ skill name ও optional image/icon বদলাবে। **Order** ছোট হলে আগে আসবে।
- Reviews-এর নাম, position, quote, highlight, photo এবং profile/source link editable। Rating সংরক্ষিত থাকলেও website-এ number/star দেখানো হয় না। অন্যের বক্তব্য ও approval কেবল তাঁদের অনুমোদন অনুযায়ী দেবে।
- List item-এর **Show on website / Published** বন্ধ করে hide করো; তথ্য delete হবে না।
- পুরো section লুকাতে Site settings → Sections → ওই section-এর **Visible** বন্ধ করো। সংশ্লিষ্ট header link-ও লুকাবে।
- নতুন image upload করলে build-এর সময় ছোট responsive WebP version হয়। Original certificate/PDF file অক্ষত থাকে।

## সমস্যায় পড়লে

- Login denied: সঠিক GitHub account এবং repository write permission আছে কি দেখো।
- Save হয়েছে, live হয়নি: GitHub Actions build সবুজ হয়েছে কি দেখো; failed build হলে error অনুযায়ী content ঠিক করো। আগের successful deployment চালু থাকে।
- Hide করেও দেখা যাচ্ছে: Publish হয়েছে কি এবং build সফল কি যাচাই করে refresh করো।
- Cloudflare-এর `portfolio-cms-oauth` Worker শুধু login-এর জন্য। সেখানে portfolio content edit করতে হবে না।
- GitHub OAuth client secret, Cloudflare credentials বা access token কখনো content field, repository বা chat-এ দেবে না।
