"""Static, accessible blog pages shared by GitHub Pages and the content service."""
import html
import re
from datetime import date
from html_tools import Document


def esc(value):
    return html.escape(str(value or ''), quote=True)


def posts(data):
    if not data.get('site-settings', {}).get('sections', {}).get('blogs', {}).get('visible', True):
        return []
    return sorted((p for p in data.get('blogs', []) if p.get('published', True)), key=lambda p: (p.get('published_date', ''), -p.get('order', 0)), reverse=True)


def reading_time(post):
    return max(1, (len(post.get('body', '').split()) + 199) // 200)


def meta(post):
    return esc(post.get('event_label') or date.fromisoformat(post['published_date']).strftime('%B %Y')) + ' · ' + str(reading_time(post)) + ' min read'


def carousel(post, hero=False):
    images = [dict(image=post['cover'], alt=post.get('cover_alt') or post['title'], caption='')]
    for item in post.get('gallery', []):
        existing = next((image for image in images if image['image'] == item['image']), None)
        if existing is not None:
            existing.update({key:value for key,value in item.items() if value})
        else:
            images.append(item)
    slides = ''
    for index, item in enumerate(images):
        image = f'<img class="{ "blog-hero-image" if hero else "blog-card-image" }" src="{esc(item["image"])}" alt="{esc(item.get("alt") or post["title"])}" { "fetchpriority=high" if hero and index == 0 else "loading=lazy" } />'
        destination = item['image'] if hero else 'blogs/' + post['id'] + '/'
        link_attrs = 'target="_blank" rel="noopener"' if hero else f'data-blog-slug="{esc(post["id"])}"'
        slides += f'<div class="blog-slide{ " is-active" if index == 0 else "" }" data-caption="{esc(item.get("caption"))}" aria-hidden="{ "false" if index == 0 else "true" }"><a href="{esc(destination)}" {link_attrs} tabindex="{ "0" if index == 0 else "-1" }">{image}</a></div>'
    controls = ''
    if len(images)>1:
        dots = ''.join(f'<button type="button" class="blog-dot{ " is-active" if i == 0 else "" }" data-blog-dot="{i}" aria-label="Show photo {i+1}" aria-pressed="{ "true" if i == 0 else "false" }"></button>' for i in range(len(images)))
        controls = '<button type="button" class="blog-photo-arrow blog-photo-prev" aria-label="Previous photo">‹</button><button type="button" class="blog-photo-arrow blog-photo-next" aria-label="Next photo">›</button><div class="blog-photo-controls"><span class="blog-photo-count">1 / ' + str(len(images)) + '</span><div class="blog-dots">' + dots + '</div><button type="button" class="blog-photo-pause" aria-label="Pause automatic photos" aria-pressed="false">Ⅱ</button></div>'
    caption = '<p class="blog-photo-caption">' + esc(images[0].get('caption')) + '</p>' if hero else ''
    return '<div class="blog-carousel' + (' blog-carousel-hero' if hero else '') + '" data-blog-carousel role="group" aria-roledescription="carousel" aria-label="' + esc(post['title']) + ' photos"><div class="blog-slides">' + slides + controls + '</div>' + caption + '</div>'


def card(post):
    return f'''<article class="blog-card" data-blog-card data-category="{esc(post.get('category'))}">{carousel(post)}<a href="blogs/{esc(post['id'])}/" data-blog-slug="{esc(post['id'])}"><div class="blog-card-copy"><span class="blog-category">{esc(post.get('category') or 'Journal')}</span><p class="blog-meta">{meta(post)}</p><h3>{esc(post['title'])}</h3><p>{esc(post.get('excerpt'))}</p><span class="blog-read">Read story <span aria-hidden="true">↗</span></span></div></a></article>'''


def render_collection(items, grid_id, empty_text='New stories will be shared here.'):
    cards = []
    for index, item in enumerate(items):
        markup = card(item)
        if index >= 6:
            markup = markup.replace('data-blog-card ', 'data-blog-card hidden ', 1)
        cards.append(markup)
    more = f'<button type="button" class="blog-outline blog-more" data-blog-more aria-expanded="false" aria-controls="{esc(grid_id)}">View More ({max(0,len(items)-6)}) <span aria-hidden="true">↓</span></button>' if len(items)>6 else ''
    fallback = '<noscript><style>[data-blog-collection] .blog-card[hidden]{display:block!important}[data-blog-more]{display:none!important}</style></noscript>'
    return '<div data-blog-collection data-preview-limit="6"><div class="blog-grid" id="' + esc(grid_id) + '">' + (''.join(cards) or '<p class="blog-empty">' + esc(empty_text) + '</p>') + '</div><div class="blog-more-wrap">' + more + '</div>' + fallback + '</div>'


def render_blog_preview(data):
    visible = [p for p in posts(data) if p.get('featured', True)]
    if not data.get('site-settings', {}).get('sections', {}).get('blogs', {}).get('visible', True):
        return ''
    settings = data.get('site-settings', {}).get('sections', {}).get('blogs', {})
    return '<section class="blog-preview" id="blogs" aria-label="Blog stories"><div class="blog-heading"><div><span class="blog-eyebrow">' + esc(settings.get('label') or 'Notes & Perspectives') + '</span><h2>' + esc(settings.get('heading') or 'From the Blog') + '</h2><p>' + esc(settings.get('subtitle') or 'Experiences, ideas, and lessons from my journey.') + '</p></div><a class="blog-outline" href="blogs/">Explore blog ↗</a></div>' + render_collection(visible, 'blog-home-grid') + '</section>'


def related_posts(current, candidates, limit=3):
    """Prefer shared categories and tags, then keep the published listing order."""
    tags = set(current.get('tags') or [])
    others = [item for item in candidates if item['id'] != current['id'] and item.get('published', True)]
    return sorted(others, key=lambda item: (item.get('category') == current.get('category'), len(tags.intersection(item.get('tags') or []))), reverse=True)[:limit]


def render_related(current, candidates):
    related = related_posts(current, candidates)
    if not related:
        return ''
    return '<aside class="blog-related" aria-labelledby="related-heading"><div class="blog-heading"><div><span class="blog-eyebrow">Continue reading</span><h2 id="related-heading">More from My Journey</h2><p>More experiences and ideas from my journey.</p></div><a class="blog-outline" href="blogs/">All stories <span aria-hidden="true">↗</span></a></div><div class="blog-grid">' + ''.join(map(card, related)) + '</div></aside>'


def render_body(text):
    blocks = []
    for block in re.split(r'\n\s*\n', text.strip()):
        tag = 'p'
        if block.startswith('### '): tag, block = 'h3', block[4:]
        elif block.startswith('## '): tag, block = 'h2', block[3:]
        content = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', esc(block)).replace('\n', '<br />')
        blocks.append(f'<{tag}>{content}</{tag}>')
    return ''.join(blocks)


def write_blog_pages(data, output, home_html, site_url, base_path, responsive_images):
    document = Document(home_html)
    head = document.inside(document.root.find(tag='head'))
    nav = document.outside(document.root.find(tag='nav', id='navbar'))
    footer = document.outside(document.root.find(tag='footer'))
    nav = re.sub(r' class="active"', '', nav)
    nav = nav.replace('data-blog-nav', 'data-blog-nav class="active" aria-current="page"')
    shared = lambda value: re.sub(r'href="#([^" ]+)"', r'href="index.html#\1"', value)
    nav, footer = shared(nav), shared(footer)
    visible = posts(data)
    def write(relative, title, description, content, slug=''):
        page_head = re.sub(r'<title>.*?</title>', '<title>' + esc(title) + '</title>', head, flags=re.S)
        page_head = re.sub(r'<meta (?:name="description"|property="og:(?:title|description|url|type)")[^>]*>', '', page_head)
        page_head = re.sub(r'<link rel="canonical"[^>]*>', '', page_head)
        url = site_url + '/' + relative.removesuffix('index.html')
        page_head = '<base href="' + ('../../' if slug else '../') + '" />' + page_head + f'<meta name="description" content="{esc(description)}" /><meta property="og:title" content="{esc(title)}" /><meta property="og:description" content="{esc(description)}" /><meta property="og:type" content="{ "article" if slug else "website" }" /><meta property="og:url" content="{esc(url)}" /><link rel="canonical" href="{esc(url)}" />'
        source = '<!DOCTYPE html><html lang="en" data-theme="dark"><head>' + page_head + '</head><body class="blog-page" data-blog-page="' + esc(slug) + '"><div class="cursor" id="cursor"></div><div class="cursor-follower" id="follower"></div>' + nav + '<main class="blog-main">' + content + '</main>' + footer + '<script src="frontend-config.js"></script><script src="js/blog-runtime.js?v=20261026-blog-navigation"></script></body></html>'
        source = responsive_images(source, output, base_path)
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(source, encoding='utf-8')
    categories = sorted({p.get('category') for p in visible if p.get('category')})
    filters = '<button type="button" class="is-active" data-blog-filter="all" aria-pressed="true">All posts</button>' + ''.join(f'<button type="button" data-blog-filter="{esc(c)}" aria-pressed="false">{esc(c)}</button>' for c in categories)
    listing = '<a class="blog-back" href="index.html">← Back to portfolio</a><header class="blog-intro"><span class="blog-eyebrow">Notes & Perspectives</span><h1>Stories behind<br /><em>the journey.</em></h1><p>Experiences, ideas, and lessons from programming, research, and building software.</p></header><div class="blog-toolbar"><div class="blog-filters" aria-label="Filter blog posts">' + filters + '</div><label class="blog-search"><span class="sr-only">Search blog posts</span><input type="search" placeholder="Search stories…" data-blog-search /></label></div><p class="blog-result" aria-live="polite" data-blog-result></p>' + render_collection(visible, 'blog-list-grid', 'No stories published yet.') + '<p class="blog-empty" data-blog-empty hidden>No stories found. Try a different search.</p>'
    write('blogs/index.html', 'Blog | Fazley Rabbi', 'Stories and experiences from Fazley Rabbi’s programming and research journey.', listing)
    for post in visible:

        tags = ''.join('<span>' + esc(tag) + '</span>' for tag in post.get('tags', []))
        article = '<a class="blog-back" href="blogs/">← All stories</a><article class="blog-article"><header class="blog-article-header"><span class="blog-category">' + esc(post.get('category') or 'Journal') + '</span><h1>' + esc(post['title']) + '</h1><p class="blog-deck">' + esc(post.get('excerpt')) + '</p><div class="blog-byline"><span>By ' + esc(post.get('author') or 'Fazley Rabbi') + '</span><span>' + meta(post) + '</span></div></header>' + carousel(post, hero=True) + '<div class="blog-prose">' + render_body(post.get('body', '')) + '</div><footer class="blog-article-end"><div class="blog-tags">' + tags + '</div><a href="blogs/">← Back to all stories</a></footer></article>'
        write('blogs/' + post['id'] + '/index.html', post['title'] + ' | Fazley Rabbi', post.get('excerpt', ''), article + render_related(post, visible), post['id'])
