"""Build the portfolio with editable repository content and responsive WebP images."""
import argparse
from datetime import date
import html
import json
import os
from pathlib import Path
import re
import shutil
import hashlib
from urllib.parse import quote as urlquote, unquote, urlsplit

from html_tools import Document
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def escape(value):
    return html.escape(str(value if value is not None else ''), quote=True)


def rich(value):
    # Deliberately support only bold emphasis and line breaks, never arbitrary HTML.
    return re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', escape(value)).replace('\n', '<br />')


def ordered(items):
    return sorted([item for item in items or [] if item.get('published', True)], key=lambda item: (item.get('order') or 0, item.get('id', item.get('title', item.get('name', '')))))


def validate_fields(value, definitions, location):
    if not isinstance(value, dict): raise ValueError(f'{location}: expected an object')
    for field in definitions:
        name, widget = field['name'], field['widget']
        item = value.get(name)
        where = f'{location}.{name}'
        if item is None or item == '':
            if field.get('required'): raise ValueError(f'{where}: required')
            continue
        if widget == 'object': validate_fields(item, field['fields'], where)
        elif widget == 'list':
            if not isinstance(item, list): raise ValueError(f'{where}: expected a list')
            if 'max' in field and len(item) > field['max']:
                raise ValueError(f'{where}: use at most {field["max"]} items')
            for index, entry in enumerate(item):
                if 'fields' in field: validate_fields(entry, field['fields'], f'{where}[{index}]')
                elif not isinstance(entry, str): raise ValueError(f'{where}: expected text items')
        elif widget == 'boolean':
            if type(item) is not bool: raise ValueError(f'{where}: expected true or false')
        elif widget == 'number':
            if type(item) is not int or item < field.get('min', 0) or item > field.get('max', 1000000):
                raise ValueError(f'{where}: number out of range')
        elif not isinstance(item, str): raise ValueError(f'{where}: expected text')
        elif field.get('pattern') and not re.fullmatch(field['pattern'][0], item):
            raise ValueError(f'{where}: {field["pattern"][1]}')
        elif widget == 'select' and item not in field['options']:
            raise ValueError(f'{where}: choose one of {field["options"]}')
        if isinstance(item, str) and (widget in ['image','file'] or name.endswith('_url') or name in ['url','file','certificate','image','thumbnail','profile_photo','hero_photo','about_photo','favicon']):
            safe_url(item)
        if isinstance(item, str) and name in ['start_date','end_date','completion_date','added_date']:
            try: date.fromisoformat(item)
            except ValueError as error: raise ValueError(f'{where}: invalid calendar date') from error
        if name == 'border_color' and not re.fullmatch(r'rgba?\([\d\s.,]+\)|#[a-fA-F0-9]{3,8}', str(item)):
            raise ValueError(f'{where}: invalid color')


def safe_url(value):
    if not value: return ''
    if any(ord(char) < 32 for char in value) or '\\' in value:
        raise ValueError('Invalid URL characters')
    parsed = urlsplit(value)
    if parsed.scheme and parsed.scheme not in ['https', 'http', 'mailto', 'tel']:
        raise ValueError(f'Unsupported URL scheme: {parsed.scheme}')
    if value.startswith('//') or '..' in unquote(parsed.path).split('/'):
        raise ValueError('Unsafe URL path')
    return value


def local_path(value, root, base_path=''):
    safe_url(value)
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or not parsed.path: return None
    path = unquote(parsed.path)
    if base_path and (path == base_path or path.startswith(base_path + '/')):
        path = path[len(base_path):]
    candidate = (root / path.lstrip('/')).resolve()
    if not candidate.is_relative_to(root.resolve()): raise ValueError(f'Asset outside site: {value}')
    return candidate


def icon(value, size=15):
    if value == 'github':
        svg = (ROOT / 'templates/icons/github.svg').read_text(encoding='utf-8')
        return svg.replace('width="13" height="13"', f'width="{size}" height="{size}"')
    return escape(value)


def link(url, label, cls, glyph=None):
    if not url: return ''
    safe_url(url)
    return f'<a href="{escape(url)}" target="_blank" rel="noopener" class="{cls}" title="{escape(label)}" aria-label="{escape(label)}">{glyph if glyph is not None else escape(label)}</a>'


def cover_image(source, fallback, alt, kind):
    source = source or fallback
    safe_url(source)
    safe_url(fallback)
    cls = ' is-fallback' if source == fallback else ''
    return f'<div class="showcase-media {kind}-media"><img class="{kind}-thumbnail{cls}" src="{escape(source)}" data-fallback="{escape(fallback)}" alt="{escape(alt)}" width="960" height="540" loading="lazy" decoding="async" /></div>'


COVER_PALETTES = [('#00d4aa', '#5fa4ff'), ('#8b5cf6', '#ec4899'), ('#f59e0b', '#f97316'), ('#38bdf8', '#818cf8'), ('#34d399', '#22d3ee'), ('#fb7185', '#f59e0b')]


def cover_pattern(uid, variant, accent):
    grid = f'<pattern id="cp-{uid}" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0v48" stroke="{accent}" stroke-opacity=".08"/></pattern>'
    dots = f'<pattern id="cp-{uid}" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="2.5" fill="{accent}" fill-opacity=".14"/></pattern>'
    stripes = f'<pattern id="cp-{uid}" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v30" stroke="{accent}" stroke-opacity=".07" stroke-width="7"/></pattern>'
    plus = f'<pattern id="cp-{uid}" width="52" height="52" patternUnits="userSpaceOnUse"><path d="M26 15v22m-11-11h22" stroke="{accent}" stroke-opacity=".12" stroke-width="2.5"/></pattern>'
    return [grid, dots, stripes, plus][variant]


def cover_art(item):
    seed = hashlib.sha1(f"{item['id']}|{item.get('title', '')}".encode('utf-8')).digest()
    accent, accent_b = COVER_PALETTES[seed[0] % len(COVER_PALETTES)]
    uid, variant = seed.hex()[:6], seed[1] % 4
    glyph = escape(item.get('icon') or '🛠️')
    label = escape(item.get('category') or 'Project')
    rings = f'<circle cx="758" cy="128" r="176" stroke="{accent}" stroke-opacity=".12" stroke-dasharray="5 9"/><circle cx="128" cy="430" r="150" stroke="{accent_b}" stroke-opacity=".12"/>' if variant == 3 else ''
    diamonds = f'<path d="m142 120 16 18-16 18-16-18z" fill="{accent_b}" fill-opacity=".4"/><path d="m820 400 12 14-12 14-12-14z" fill="{accent}" fill-opacity=".45"/>' if variant == 1 else ''
    bits = f'<rect x="330" y="428" width="118" height="5" rx="2.5" fill="{accent}" fill-opacity=".55"/><rect x="462" y="428" width="132" height="5" rx="2.5" fill="{accent_b}" fill-opacity=".3"/>' if variant in (0, 2) else f'<rect x="640" y="392" width="64" height="44" rx="10" fill="url(#ca-{uid})" fill-opacity=".16" stroke="{accent}" stroke-opacity=".3"/>'
    return f'''<svg class="proj-cover-art" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="cbg-{uid}" x1="0" y1="0" x2="960" y2="540" gradientUnits="userSpaceOnUse"><stop stop-color="#0a1524"/><stop offset="1" stop-color="#0d1e30"/></linearGradient><linearGradient id="ca-{uid}" x1="300" y1="140" x2="700" y2="440" gradientUnits="userSpaceOnUse"><stop stop-color="{accent}"/><stop offset="1" stop-color="{accent_b}"/></linearGradient>{cover_pattern(uid, variant, accent)}</defs>
  <rect width="960" height="540" fill="url(#cbg-{uid})"/>
  <rect width="960" height="540" fill="url(#cp-{uid})"/>
  <circle cx="810" cy="96" r="230" fill="url(#ca-{uid})" fill-opacity=".07"/>
  <circle cx="480" cy="272" r="216" stroke="url(#ca-{uid})" stroke-opacity=".28"/>{rings}{diamonds}
  <text x="480" y="278" font-size="168" text-anchor="middle" dominant-baseline="central">{glyph}</text>
  <text x="480" y="375" text-anchor="middle" fill="{accent}" font-family="Inter,Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="7">{label}</text>{bits}
</svg>'''


def category_filters(items, grid, label):
    categories = sorted(set(item.get('category') or 'Other' for item in items))
    buttons = '<button type="button" class="showcase-filter is-active" data-filter="" aria-pressed="true">All</button>'
    buttons += ''.join(f'<button type="button" class="showcase-filter" data-filter="{escape(category)}" aria-pressed="false">{escape(category)}</button>' for category in categories)
    return f'<div class="showcase-filters" role="group" aria-label="Filter {escape(label)}" data-filter-grid="{grid}">{buttons}</div><p class="sr-only showcase-status" role="status" aria-live="polite"></p>' if items else ''


def pretty_date(value):
    stamp = date.fromisoformat(str(value))
    return f'{stamp.strftime("%b")} {stamp.day}, {stamp.year}'


def project_card(item, fallback='images/project-default.svg', extra=False):
    links = link(item.get('documentation_url'), 'Documentation', 'proj-link', 'Docs')
    for entry in item.get('links') or []:
        links += link(entry.get('url'), entry.get('label', 'Link'), 'proj-link', escape(entry.get('icon') or entry.get('label')))
    status = item.get('status') or ''
    badge = f'<span class="proj-status {escape(item.get("status_style") or "status-wip")}">{escape(status)}</span>' if status else ''
    chips = ''
    if item.get('category'): chips += f'<span class="proj-cat">{escape(item["category"])}</span>'
    if item.get('added_date'): chips += f'<span class="proj-added"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>Added {pretty_date(item["added_date"])}</span>'
    meta = badge + chips
    tags = ''.join(f'<span class="proj-tag">{escape(tag)}</span>' for tag in (item.get('stack') or []) + (item.get('tags') or []))
    images = [image for image in (item.get('gallery') or []) if image.get('image')]
    has_screen = bool(item.get('thumbnail') or fallback)
    cover_source = item.get('thumbnail') or (fallback or '')
    strip = ''
    if images:
        safe_url(cover_source) if cover_source else safe_url(fallback or '')
        slides = []
        if has_screen:
            slides.append(f'<img class="proj-slide is-active" src="{escape(cover_source)}" data-full="{escape(cover_source)}" data-caption="{escape(item.get("thumbnail_alt") or f"Project cover: {item['title']}")}" alt="{escape(item.get("thumbnail_alt") or item["title"])}" loading="lazy" decoding="async" />')
        for index, image in enumerate(images):
            safe_url(image['image'])
            alt = escape(image.get('alt') or item['title'])
            slides.append(f'<img class="proj-slide{"" if has_screen or index else " is-active"}" src="{escape(image["image"])}" data-full="{escape(image["image"])}" data-caption="{escape(image.get("caption") or image.get("alt") or item["title"])}" alt="{alt}" loading="lazy" decoding="async" />')
        total = len(slides)
        chip = f'<span class="proj-open-chip" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h18v14H3zM8.5 11a2 2 0 1 0 0-.01M21 16l-5-5-8 7" /></svg>{total}</span>'
        prev = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>'
        next = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>'
        cover = f'''<div class="showcase-media proj-media proj-carousel" data-index="0" tabindex="-1">
        <div class="proj-slides">{''.join(slides)}</div>
        <button type="button" class="proj-carrow proj-carrow-prev" aria-label="Previous screenshot">{prev}</button>
        <button type="button" class="proj-carrow proj-carrow-next" aria-label="Next screenshot">{next}</button>
        {chip}</div>'''
    else:
        cover = cover_image(item.get('thumbnail'), fallback or 'images/project-default.svg', item.get('thumbnail_alt') or f'Project cover: {item["title"]}', 'proj') if has_screen else ''
        if not has_screen:
            safe_url(fallback or '')
            cover = f'<div class="showcase-media proj-media">{cover_art(item)}</div>'
    notes = ''
    for field, label in [('details',''),('abstract','Abstract'),('research_area','Research area'),('dataset','Dataset'),('methodology','Methodology'),('publication_status','Publication status'),('start_date','Started'),('completion_date','Completed')]:
        if item.get(field): notes += f'<p>{("<strong>" + label + ":</strong> ") if label else ""}{rich(item[field])}</p>'
    if item.get('authors'): notes += f'<p><strong>Authors:</strong> {escape(", ".join(item["authors"]))}</p>'
    notes += link(item.get('paper_url'), 'Paper', 'proj-tag') + link(item.get('doi_url'), 'DOI', 'proj-tag')
    if notes: notes = f'<details class="cms-details"><summary>Details</summary>{notes}</details>'
    external = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>'
    play = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="3" /><path d="M8 21h8M12 18v3m-2-14 5 4-5 3z" /></svg>'
    actions = link(item.get('github_url'), 'GitHub', 'proj-action proj-action-github', icon('github', 15) + '<span>GitHub</span>' + external)
    actions += link(item.get('demo_url'), 'Live Demo', 'proj-action proj-action-demo', play + '<span>Live Demo</span>' + external)
    if actions: actions = f'<div class="proj-actions">{actions}</div>'
    hidden = ' hidden' if extra else ''
    mods = ' proj-extra' if extra else ''
    return f'''<div class="proj-card reveal{mods}" id="project-{escape(item['id'])}" data-category="{escape(item.get('category') or 'Other')}"{hidden}>
      {cover}<div class="showcase-body">
      <div class="proj-top"><div class="proj-title-row"><div class="proj-icon">{escape(item.get('icon') or '💻')}</div><div class="proj-title">{escape(item['title'])}</div></div><div class="proj-links">{links}</div></div>
      <div class="proj-meta">{meta}</div>
      <div class="proj-desc-box"><p class="proj-desc">{escape(item.get('description'))}</p></div>
      <div class="proj-stack">{tags}</div>{notes}{actions}</div></div>'''


def render_highlights(data):
    settings = data['profile'].get('highlights') or {}
    if not settings.get('enabled', True): return ''
    visibility = data['site-settings'].get('sections') or {}
    targets = {'#home', '#site-footer'}
    targets.update('#'+name for name,item in visibility.items() if item.get('visible', True))
    if '#skills' not in targets: targets.discard('#experience')
    if '#projects' in targets:
        targets.update('#project-'+item['id'] for item in ordered(data['projects']+data['research']))
    cards = []
    for item in ordered(settings.get('items')):
        target = item.get('url') or ''
        if target not in targets or not item.get('image'): continue
        fit = item.get('fit') if item.get('fit') in ['cover','contain','portrait'] else 'cover'
        number = str(len(cards)+1).zfill(2)
        cards.append(f'<a class="highlight-card" href="{escape(target)}" data-fit="{fit}" aria-label="{escape(item["title"])} — explore {escape(item.get("category") or "highlight")}"><div class="highlight-media"><img src="{escape(item["image"])}" alt="{escape(item.get("image_alt") or item["title"])}" loading="lazy" decoding="async" /></div><span class="highlight-category">{escape(item.get("category"))}</span><span class="highlight-arrow" aria-hidden="true">↗</span><div class="highlight-caption"><span class="highlight-number" aria-hidden="true">{number}</span><div><h3>{escape(item["title"])}</h3><p>{escape(item.get("description"))}</p></div></div></a>')
    if not cards: return ''
    autoplay = str(settings.get('autoplay', True)).lower()
    return f'''<div class="selected-highlights" id="selected-highlights" role="region" aria-labelledby="highlights-heading" data-autoplay="{autoplay}"><div class="max-w"><div class="highlights-heading-row"><div><span class="highlights-eyebrow"><i aria-hidden="true"></i>{escape(settings.get('label') or 'A curated snapshot')}</span><h2 id="highlights-heading">{escape(settings.get('heading') or 'Selected Highlights')}</h2><p>{escape(settings.get('subtitle'))}</p></div><div class="highlights-controls" aria-label="Highlights controls"><button type="button" data-highlights-prev aria-label="Previous highlights" aria-controls="highlights-rail">←</button><button type="button" data-highlights-play aria-label="Pause highlight scrolling" aria-pressed="true" aria-controls="highlights-rail"><span aria-hidden="true">Ⅱ</span></button><button type="button" data-highlights-next aria-label="Next highlights" aria-controls="highlights-rail">→</button></div></div><div class="highlights-frame"><div class="highlights-rail" id="highlights-rail" tabindex="0" aria-label="Selected portfolio highlights">{''.join(cards)}</div></div><div class="highlights-footnote"><span><i aria-hidden="true"></i>Click any highlight to explore</span><span class="highlights-counter">{str(len(cards)).zfill(2)} selected stories</span></div></div></div>'''


def render_sections(data, source_root):
    profile, contact = data['profile'], data['contact']
    sections = {}
    sections['highlights'] = render_highlights(data)
    sections['hero_photo'] = profile.get('hero_photo') or profile.get('profile_photo') or ''
    sections['availability'] = f'<div class="available-badge"><div class="badge-dot"></div>{escape(profile.get("availability_text"))}</div>' if profile.get('available') else ''
    visible_projects = ordered(data['projects'] + data['research'])
    def statistic(item):
        if item.get('source') == 'projects':
            return str(len(visible_projects))
        if item.get('source') == 'certifications':
            return str(len(ordered(data['achievements'].get('items'))))
        return str(item.get('value') or '') + str(item.get('suffix') or '')
    sections['statistics'] = ''.join(f'<div class="stat-item"><div class="stat-num">{escape(statistic(item))}</div><div class="stat-label">{escape(item["label"])}</div></div>' for item in profile.get('statistics') or [])
    sections['about_statistics'] = ''.join(f'<div class="about-stat-box"><div class="num">{escape(statistic(item))}</div><div class="lbl">{escape(item["label"])}</div></div>' for item in profile.get('about_statistics') or [])
    sections['photo_tags'] = ''.join(f'<span class="photo-skill-tag">{escape(tag)}</span>' for tag in profile.get('photo_tags') or [])
    sections['biography'] = ''.join(f'<p>{rich(paragraph)}</p>' for paragraph in profile.get('biography') or [])
    sections['biography'] += '<div class="about-tags">' + ''.join(f'<span class="about-tag">{escape(tag)}</span>' for tag in profile.get('about_tags') or []) + '</div>'
    badges = profile.get('badges') or []
    sections['badge_rows'] = max(1, (len(badges) + 1) // 2)
    sections['badges'] = ''.join(f'<div class="float-card fc-{i+1}"><div class="float-card-icon" aria-hidden="true">{escape(item.get("icon"))}</div><div class="float-card-text"><strong>{escape(item.get("title"))}</strong>{("<span>" + escape(item["subtitle"]) + "</span>") if item.get("subtitle") else ""}</div></div>' for i,item in enumerate(badges))
    socials = ordered(contact.get('links'))
    sections['hero_socials'] = ''.join(link(item.get('url'), item['name'], 'social-btn', icon(item.get('icon'))) for item in sorted(socials, key=lambda item:item.get('hero_order',0)) if item.get('hero'))
    sections['footer_availability'] = f'<span class="footer-availability"><i aria-hidden="true"></i>{escape(profile.get("availability_text"))}</span>' if profile.get('available') else ''
    sections['footer_email'] = link('mailto:' + contact['email'], contact['email'], 'footer-email', escape(contact['email']) + ' <span aria-hidden="true">↗</span>') if contact.get('email') else ''
    sections['footer_socials'] = ''.join(link(item.get('url'), item['name'], 'footer-social', f'<span aria-hidden="true">{icon(item.get("icon"),16)}</span><span>{escape(item["name"])}</span><span aria-hidden="true">↗</span>') for item in socials if item.get('footer', True))
    def contact_card(url, glyph, label, text):
        contents = f'<div class="c-icon">{escape(glyph)}</div><div class="c-text"><strong>{escape(label)}</strong><span>{escape(text)}</span></div>'
        return link(url,label,'c-link',contents) if url else f'<div class="c-link" style="cursor:default">{contents}</div>'
    sections['contacts'] = contact_card('mailto:' + contact['email'], '✉️', contact.get('email_label'), contact['email']) if contact.get('email') else ''
    sections['contacts'] += ''.join(contact_card(item.get('contact_url') or item.get('url'), item.get('contact_icon'), item['name'], item.get('handle')) for item in sorted(socials,key=lambda item:item.get('contact_order',0)) if item.get('contact'))
    if contact.get('phone'):
        phone_digits = re.sub(r'\D', '', contact['phone'])
        sections['contacts'] += contact_card('https://wa.me/' + phone_digits, '💬', contact.get('phone_label') or 'WhatsApp', contact.get('phone_display') or contact['phone'])
    if contact.get('location'): sections['contacts'] += contact_card('', '📍', contact.get('location_label'), contact['location'])
    projects = visible_projects.copy()
    projects.sort(key=lambda item: (item.get('order') or 0, not item.get('featured', True), item['id']))
    projects.sort(key=lambda item: item.get('added_date') or '0000-00-00', reverse=True)
    media_settings = data['site-settings'].get('media') or {}
    fallback = media_settings.get('project_fallback') or ''
    sections['projects'] = ''.join(project_card(item, fallback, index >= 6) for index, item in enumerate(projects))
    sections['projects_view_all'] = f'<div class="projects-foot"><button type="button" id="view-all-projects" class="view-all-btn" aria-controls="project-cards">View all projects<span class="view-all-count">{len(projects) - 6}</span></button></div>' if len(projects) > 6 else ''
    sections['project_filters'] = category_filters(projects, 'project-cards', 'projects')
    sections['papers'] = ''
    for i,item in enumerate(ordered(data['papers'])):
        doi = item.get('doi') or ''
        doi_url = ('https://doi.org/' + urlquote(doi, safe='/().;:-_')) if doi.startswith('10.') else doi
        actions = link(item.get('paper_url') or doi_url or item.get('file'), 'Read paper', 'paper-action', 'Read paper <span aria-hidden="true">↗</span>')
        if doi_url and item.get('paper_url'): actions += link(doi_url, 'DOI', 'paper-action paper-action-secondary', 'DOI <span aria-hidden="true">↗</span>')
        if item.get('file') and (item.get('paper_url') or doi_url): actions += link(item['file'], 'Paper PDF', 'paper-action paper-action-secondary', 'PDF <span aria-hidden="true">↗</span>')
        authors = ', '.join(item.get('authors') or [])
        venue = ' · '.join(filter(None,[item.get('venue'),item.get('year')]))
        badges = ''.join(f'<span class="paper-badge">{escape(value)}</span>' for value in [item.get('venue'), item.get('publication_type'), 'Peer-reviewed' if item.get('peer_reviewed') else '', item.get('status')] if value)
        topics = '<div class="paper-topics"><span>Research topics</span><div>' + ''.join(f'<span>{escape(topic)}</span>' for topic in item.get('topics') or []) + '</div></div>' if item.get('topics') else ''
        published = f'<p class="paper-date">▦ &nbsp; Published · {escape(item["publication_date"])}</p>' if item.get('publication_date') else ''
        doi_line = '<div class="paper-doi"><span>↗ &nbsp; DOI available</span>' + link(doi_url, 'Open DOI', '', escape(doi)) + '</div>' if doi_url else ''
        if actions and item.get('button_label'): actions = actions.replace('Read paper <span', escape(item['button_label']) + ' <span', 1)
        thumbnail = cover_image(item.get('thumbnail'), '', item['title'], 'paper') if item.get('thumbnail') else ''
        sections['papers'] += f'<article class="paper-card" id="paper-{escape(item["id"])}"><div class="paper-body">{thumbnail}<div class="paper-meta"><div>{badges}</div><span>{escape(item.get("year"))}</span></div><h3>{escape(item["title"])}</h3><p class="paper-authors">{escape(authors)}</p><p class="paper-venue">{escape(venue)}</p><p class="paper-abstract">{rich(item.get("abstract"))}</p>{topics}<div class="paper-publication">{published}{doi_line}</div><div class="paper-actions">{actions if actions else "<span class=paper-pending>Paper link coming soon</span>"}</div></div></article>'
    if not sections['papers']:
        sections['papers'] = f'<div class="research-empty"><span aria-hidden="true">⌘</span><h3>{escape(data["site-settings"].get("copy",{}).get("research_empty_heading") or "Research in progress")}</h3><p>{escape(data["site-settings"].get("copy",{}).get("research_empty_text") or "Research papers and publication links will appear here as they are added.")}</p></div>'
    visibility = data['site-settings'].get('sections') or {}
    sections['first_scroll_target'] = '#selected-highlights' if sections['highlights'] else '#' + next((name for name in ['about','education','projects','skills','research','certifications','reviews','contact'] if visibility.get(name,{}).get('visible',True)), 'site-footer')
    sections['skills'] = ''
    for category in ordered(data['skills'].get('categories')):
        glyph = escape(category.get('icon'))
        if category.get('image'): glyph = f'<img src="{escape(category["image"])}" alt="{escape(category.get("image_alt") or category["name"])}" width="24" height="24" loading="lazy" />'
        body = ''
        for item in ordered(category.get('items')):
            name = escape(item['name'])
            if item.get('image'): name = f'<img src="{escape(item["image"])}" alt="{escape(item.get("image_alt") or item["name"])}" width="20" height="20" loading="lazy" /> ' + name
            if category.get('visualization') == 'bars':
                body += f'<div class="sk-bar-item"><div class="sk-bar-label"><span>{name}</span><span>{escape(item.get("proficiency"))}</span></div><div class="sk-bar-track"><div class="sk-bar-fill" data-w="{item.get("percent") or 0}"></div></div></div>'
            else: body += f'<span class="sk-tag">{name}</span>'
        cls = 'sk-bars' if category.get('visualization') == 'bars' else 'sk-tags'
        sections['skills'] += f'<div class="skill-card reveal"><div class="sk-head"><div class="sk-icon">{glyph}</div><div class="sk-title">{escape(category["name"])}</div></div><div class="{cls}">{body}</div></div>'
    for collection in ['education','experience']:
        sections[collection] = ''
        entries = ordered(data[collection].get('items'))
        for i,item in enumerate(entries):
            line = '<div class="tl-line"></div>' if i < len(entries)-1 or collection=='education' else ''
            badge = item.get('badge') or ('Current' if item.get('current') else '')
            badge = f'<div class="tl-badge">{escape(badge)}</div>' if badge else ''
            description = rich(item.get('description'))
            if item.get('department'): description += '<br />' + escape(item['department'])
            if item.get('gpa'): description += '<br />' + escape(item.get('gpa_label') or 'CGPA / GPA') + ': ' + escape(item['gpa'])
            responsibilities = item.get('responsibilities') or []
            if responsibilities: description += '<ul>' + ''.join(f'<li>{rich(row)}</li>' for row in responsibilities) + '</ul>'
            dates = ' — '.join(filter(None,[item.get('start_date'), 'Present' if item.get('current') else item.get('end_date')]))
            period = dates if item.get('start_date') or item.get('end_date') else item.get('period') or ''
            if collection == 'education':
                image = item.get('image') or ''
                zoom = max(1, min(3, float(item.get('image_zoom') or 100) / 100))
                fit = 'contain' if item.get('image_fit') == 'contain' else 'cover'
                backdrop = f'<span class="education-photo-backdrop" aria-hidden="true"><img src="{escape(image)}" alt="{escape(item.get("organization"))} backdrop" loading="lazy" decoding="async" /></span>' if image and fit == 'contain' else ''
                photo = f'<div class="education-photo education-fit-{fit}" style="--image-zoom:{zoom}">{backdrop}<img src="{escape(image)}" alt="{escape(item.get("image_alt") or item.get("organization"))}" loading="lazy" decoding="async" /></div>' if image else '<div class="education-photo education-photo-empty" aria-hidden="true">⌂</div>'
                kind = f'<span class="education-type">{escape(item.get("institution_type") or "Education")}</span>'
                current = f'<span class="education-status">{escape(item["badge"])}</span>' if item.get('badge') else ''
                organization = link(item.get('institution_url'), item.get('organization') or '', 'education-institution', escape(item.get('organization'))) if item.get('institution_url') else escape(item.get('organization'))
                sections[collection] += f'<article class="education-card reveal">{photo}<div class="education-body"><div class="education-meta">{kind}{current}</div><h3>{organization}</h3><p class="education-degree">{escape(item["title"])}</p><p class="education-period">{escape(period)}</p><div class="education-description">{description}</div></div></article>'
                continue
            sections[collection] += f'<div class="tl-item reveal"><div class="tl-left"><div class="tl-dot"></div>{line}</div><div class="tl-card">{badge}<h4>{escape(item["title"])}</h4><div class="tl-org">{escape(item.get("organization"))}</div><div class="tl-desc">{description}</div><div class="tl-year">{escape(period)}</div></div></div>'
    sections['achievements'] = ''
    achievements = ordered(data['achievements'].get('items'))
    sections['achievement_filters'] = category_filters(achievements, 'certificate-cards', 'certifications and awards')
    sections['achievements_view_all'] = f'<div class="certifications-foot"><button type="button" id="view-all-certifications" class="view-all-btn" aria-controls="certificate-cards">See all<span class="view-all-count">{len(achievements) - 6}</span></button></div>' if len(achievements) > 6 else ''
    if not achievements:
        sections['achievements'] = '<p class="cert-empty">Certificates and awards will appear here as they are added.</p>'
    for index, item in enumerate(achievements):
        thumbnail = item.get('thumbnail') or ''
        certificate = item.get('certificate') or ''
        if not thumbnail and Path(urlsplit(certificate).path).suffix.lower() in ['.jpg','.jpeg','.png','.webp','.avif','.gif','.svg']:
            thumbnail = certificate
        fallback = media_settings.get('certificate_fallback') or ''
        media = cover_image(thumbnail, fallback or 'images/certificate-default.svg', item.get('thumbnail_alt') or item['title'], 'cert') if thumbnail or fallback else ''
        action = link(item.get('credential_url'), 'Verify credential', 'cert-action', '<span>Verify credential</span><span aria-hidden="true">↗</span>')
        action += link(certificate, 'View certificate', 'cert-action', '<span>View certificate</span><span aria-hidden="true">↗</span>')
        for document in item.get('supporting_files') or []:
            label = document.get('label') or 'Supporting document'
            action += link(document.get('file'), label, 'cert-action', f'<span>{escape(label)}</span><span aria-hidden="true">↗</span>')
        credential_id = f'<p class="credential-id">Credential ID: {escape(item["credential_id"])}</p>' if item.get('show_credential_id') and item.get('credential_id') else ''
        badge = f'<span class="proj-status {escape(item.get("status_style") or "status-done")}">{escape(item["badge"])}</span>' if item.get('badge') else ''
        footer = f'<div class="cert-footer"><div class="cert-actions">{action}</div><div class="cert-year">{escape(item.get("date"))}</div></div>' if action or item.get('date') else ''
        hidden = ' hidden' if index >= 6 else ''
        extra = ' cert-extra' if index >= 6 else ''
        sections['achievements'] += f'<article class="cert-card reveal{extra}" data-category="{escape(item.get("category") or "Other")}" style="--cert-accent:{escape(item.get("border_color") or "rgba(0,212,170,.28)")}"{hidden}>{media}<div class="showcase-body"><div class="cert-top"><div class="cert-emoji" aria-hidden="true">{escape(item.get("icon") or "✦")}</div>{badge}</div><h4>{escape(item["title"])}</h4><div class="cert-org">{escape(item.get("organization"))}</div><p class="cert-desc">{escape(item.get("description"))}</p>{credential_id}{footer}</div></article>'
    reviews = data['reviews']
    review_heading = data['site-settings']['sections'].get('reviews') or {}
    sections['reviews_heading'] = (f'<span class="review-heading-accent">{escape(review_heading["heading_accent"])}</span> ' if review_heading.get('heading_accent') else '') + escape(review_heading.get('heading'))
    sections['reviews'] = ''
    for item in ordered(reviews.get('items')):
        if not item.get('published', True): continue
        avatar = f'<img src="{escape(item["photo"])}" alt="{escape(item["name"])}" width="48" height="48" loading="lazy" />' if item.get('photo') else f'<span aria-hidden="true">{escape("".join(part[0] for part in item["name"].split()[:2]))}</span>'
        rating = item.get('rating')
        source = link(item.get('source_url'), 'Original review', 'review-source', 'Original review ↗')
        profile_link = link(item.get('profile_url'), f'{item["name"]} profile', 'review-source review-profile', 'View profile ↗')
        quote = item.get('quote') or ''
        sample = bool(item.get('sample'))
        approved = bool(item.get('reviewer_approved')) and not sample and bool(quote)
        stars = ''
        approval_label = '<span class="review-approval review-sample-label">Sample review</span>' if sample else ''
        highlight = f'<div class="review-highlight"><span aria-hidden="true">✦</span>{escape(item["highlight"])}</div>' if item.get('highlight') else ''
        body = f'<blockquote>{escape(quote)}</blockquote>' if quote else '<div class="review-pending"><span>Review coming soon</span><p>Feedback will appear here once added.</p></div>'
        review_links = (source if quote and approved else '') + profile_link
        author_meta = f'<div class="review-author-meta">{approval_label}<div class="review-card-links">{review_links}</div></div>' if approval_label or review_links else ''
        sections['reviews'] += f'<figure class="review-card" role="listitem"><div class="review-card-top">{stars}<div class="review-quote-mark" aria-hidden="true">”</div></div>{body}{highlight}<figcaption class="review-card-footer"><div class="review-person"><div class="review-avatar">{avatar}</div><div class="review-person-copy"><strong>{escape(item["name"])}</strong><span>{escape(item.get("role"))}</span></div></div>{author_meta}</figcaption></figure>'
    if sections['reviews']:
        options = f'data-autoplay="{str(reviews.get("autoplay", True)).lower()}" data-delay="{(reviews.get("autoplay_seconds") or 5) * 1000}" data-initial="{reviews.get("initial_review") or 1}"'
        sections['reviews'] = f'<div class="review-carousel" {options} role="region" aria-roledescription="carousel" aria-label="Testimonials"><div class="review-track" id="review-track" role="list" tabindex="0" aria-label="Reviewer cards">' + sections['reviews'] + '</div><div class="review-controls"><div class="review-pagination" aria-label="Review positions"></div><div class="review-navigation"><button type="button" class="review-control" data-review-prev aria-label="Previous reviews" aria-controls="review-track">‹</button><button type="button" class="review-control review-autoplay" data-review-autoplay aria-label="Pause automatic review movement" aria-pressed="false">Pause</button><button type="button" class="review-control" data-review-next aria-label="Next reviews" aria-controls="review-track">›</button></div></div><p class="sr-only review-status" role="status" aria-live="polite"></p></div><div class="review-contact"><span>' + escape(reviews.get('contact_prompt') or 'Have we worked together?') + '</span><a href="#contact">' + escape(reviews.get('cta_label') or 'Share your experience') + ' <span aria-hidden="true">↗</span></a></div>'
    else:
        sections['reviews'] = f'<div class="review-invitation reveal"><span class="review-invitation-icon" aria-hidden="true">“</span><div><h3>{escape(reviews.get("empty_heading"))}</h3><p>{escape(reviews.get("empty_text"))}</p></div><a class="btn-outline" href="#contact">{escape(reviews.get("cta_label"))}<span aria-hidden="true">↗</span></a></div>'
    sections['contact_settings'] = json.dumps(dict(emailjs=data['site-settings']['emailjs'], form=data['site-settings']['form']),ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    return sections


def resolve(context, path):
    current = context
    for key in path.split('.'):
        if isinstance(current, list): current = current[int(key)]
        else: current = current.get(key, '') if isinstance(current,dict) else ''
    return current


def render_template(source, context):
    pattern = r'\{\{\{([\w.]+)\}\}\}|\{\{([\w.]+)\}\}'
    return re.sub(pattern, lambda match: str(resolve(context, match[1])) if match[1] else escape(resolve(context, match[2])), source)


def hide_sections(source, settings):
    hidden = {name for name,item in settings.get('sections',{}).items() if item.get('visible') is False}
    if not hidden: return source
    document = Document(source)
    nodes = [node for node in document.root.find_all() if node.attrs.get('id') in hidden and (node.tag == 'section' or node.attrs.get('id') == 'experience')]
    for node in document.root.find_all(tag='a'):
        if node.attrs.get('href','').lstrip('#') in hidden and node.attrs.get('href','').startswith('#'):
            nodes.append(node.parent if node.parent.tag == 'li' or 'review-contact' in node.parent.attrs.get('class','').split() else node)
    ranges = []
    for node in sorted(nodes,key=lambda node:(node.start,-node.end)):
        if not ranges or node.start >= ranges[-1][1]: ranges.append((node.start,node.end))
    for start,end in reversed(ranges): source = source[:start]+source[end:]
    return source


def validate_output(output, base_path=''):
    source = (output/'index.html').read_text(encoding='utf-8')
    if re.search(r'\{\{[\w.]', source): raise ValueError('Unrendered template field')
    document = Document(source)
    ids = [node.attrs['id'] for node in document.root.find_all() if node.attrs.get('id')]
    if len(ids) != len(set(ids)): raise ValueError('Duplicate HTML IDs')
    for node in document.root.find_all():
        for attr in ['href','src']:
            value = node.attrs.get(attr)
            if not value: continue
            if value.startswith('#'):
                if value[1:] not in ids: raise ValueError(f'Missing section {value}')
                continue
            candidate = local_path(value, output, base_path)
            if candidate and not candidate.exists(): raise ValueError(f'Missing asset: {value}')
        if node.tag == 'img' and not node.attrs.get('alt'): raise ValueError('Image needs alternative text')
    return document


def responsive_images(source, output, base_path=''):
    """Keep original uploads as fallbacks; browsers select cached, correctly sized WebP files."""
    document = Document(source)
    changes = []
    cache = ROOT / '.qa/image-cache'
    for node in document.root.find_all(tag='img'):
        original = node.attrs.get('src', '')
        path = local_path(original, output, base_path)
        if not path or not path.is_file() or path.suffix.lower() not in ['.png','.jpg','.jpeg','.webp','.avif']:
            continue
        classes = node.attrs.get('class', '').split()
        if 'nav-logo-icon' in node.parent.attrs.get('class','').split():
            widths, sizes = [48,96], '32px'
        elif 'hero-portrait' in classes:
            widths, sizes = [240,480,720], '(max-width: 640px) 52vw, 250px'
        elif 'about-photo' in classes:
            widths, sizes = [320,640,960], '(max-width: 740px) 85vw, 420px'
        elif 'education-photo' in node.parent.attrs.get('class','').split():
            widths, sizes = [640,1280], '(max-width: 680px) 92vw, 46vw'
        elif 'review-avatar' in node.parent.attrs.get('class','').split() or node.attrs.get('width') in ['20','24']:
            widths, sizes = [48,96], '48px'
        else:
            widths, sizes = [480,960], '(max-width: 640px) 92vw, (max-width: 1050px) 46vw, 400px'
        digest = hashlib.sha256(b'webp-q82-v1' + path.read_bytes()).hexdigest()[:20]
        with Image.open(path) as opened:
            # Animated uploads retain their animation and original delivery.
            if getattr(opened, 'is_animated', False): continue
            image = ImageOps.exif_transpose(opened).convert('RGBA' if 'A' in opened.getbands() or 'transparency' in opened.info else 'RGB')
            widths = sorted({min(width,image.width) for width in widths})
            variants = []
            for width in widths:
                name = f'{digest}-{width}.webp'
                cached = cache / name
                if not cached.exists():
                    cache.mkdir(parents=True,exist_ok=True)
                    scaled = image.resize((width,max(1,round(image.height*width/image.width))),Image.Resampling.LANCZOS)
                    scaled.save(cached,'WEBP',quality=82,method=4)
                # A rendition must actually save bytes compared with the original.
                if cached.stat().st_size >= path.stat().st_size: continue
                target = output / 'images/responsive' / name
                target.parent.mkdir(parents=True,exist_ok=True)
                if not target.exists(): shutil.copyfile(cached,target)
                variants.append(f'images/responsive/{name} {width}w')
            if not variants: continue
            attrs = dict(node.attrs)
            attrs.setdefault('width',str(image.width))
            attrs.setdefault('height',str(image.height))
            attrs.setdefault('decoding','async')
            if not attrs.get('fetchpriority') and 'nav-logo-icon' not in node.parent.attrs.get('class','').split():
                attrs.setdefault('loading','lazy')
            img = '<img ' + ' '.join(f'{key}="{escape(value)}"' for key,value in attrs.items()) + ' />'
            picture = f'<picture class="responsive-image"><source type="image/webp" srcset="{escape(", ".join(variants))}" sizes="{escape(sizes)}" />{img}</picture>'
            changes.append((node.start,node.inner,picture))
    for start,end,replacement in reversed(changes): source = source[:start]+replacement+source[end:]
    return source


def build(source_root=ROOT, output=None, repository=None, branch=None, site_url=None, prefix=''):
    source_root = Path(source_root).resolve()
    output = Path(output or source_root/'dist').resolve()
    # Output cleanup is limited to a verified dedicated dist directory inside the source root.
    if output.name not in ['dist','dist-next'] or output.parent != source_root:
        raise ValueError('Output must be the dedicated source-root/dist directory')
    settings = read_json(source_root/'cms/settings.json')
    repository = repository or settings['repository']
    branch = branch or settings['branch']
    site_url = (site_url or os.environ.get('FRONTEND_URL') or ('https://' + os.environ['VERCEL_URL'] if os.environ.get('VERCEL_URL') else '') or os.environ.get('RENDER_EXTERNAL_URL') or settings['site_url'] or '').rstrip('/')
    if site_url:
        if urlsplit(site_url).scheme not in ['http','https']: raise ValueError('Site URL must be absolute')
        safe_url(site_url)
    base_path = urlsplit(site_url).path.rstrip('/')
    prefix = prefix.strip('/') + '/' if prefix.strip('/') else ''
    if '..' in prefix.split('/') or '\\' in prefix: raise ValueError('Invalid source prefix')
    schemas = read_json(source_root/'cms/schema.json')
    data = {}
    for name in ['profile','contact','skills','education','experience','achievements','resume','site-settings','reviews']:
        data[name] = read_json(source_root/f'content/{name}.json')
        validate_fields(data[name], schemas[name], name)
    ids = set()
    for name in ['projects','research','papers']:
        data[name] = []
        for file in sorted((source_root/f'content/{name}').glob('*.json')):
            item = read_json(file)
            validate_fields(item, schemas[name], str(file.relative_to(source_root)))
            if item['id'] in ids: raise ValueError(f'Duplicate project ID: {item["id"]}')
            ids.add(item['id'])
            data[name].append(item)
    if site_url:
        data['site-settings']['seo'].update(canonical=site_url+'/', og_url=site_url+'/')
    if settings.get('oauth_base_url'):
        oauth = urlsplit(settings['oauth_base_url'])
        if oauth.scheme != 'https' or not oauth.netloc: raise ValueError('OAuth bridge must use HTTPS')
        if oauth.path or oauth.query or oauth.fragment or oauth.username or oauth.password:
            raise ValueError('OAuth bridge URL must be an HTTPS origin without path, query or trailing slash')
        safe_url(settings['oauth_base_url'])
    ready = bool(settings.get('enabled') and repository and settings.get('oauth_base_url') and site_url)
    if output.is_symlink(): raise ValueError('Output cannot be a symlink')
    if output.exists(): shutil.rmtree(output)
    output.mkdir()
    # Explicit allowlist: never publish content/, cms/, auth/, source templates or draft JSON.
    for folder in ['css','js','images','uploads']:
        origin = source_root/folder
        if origin.exists(): shutil.copytree(origin, output/folder)
    cv = local_path(data['resume'].get('file') or 'CV.pdf', source_root, base_path)
    if not cv or not cv.is_file() or cv.suffix.lower() != '.pdf' or not cv.read_bytes().startswith(b'%PDF-'):
        raise ValueError('Resume must point to an existing PDF in this repository')
    shutil.copyfile(cv, output/'CV.pdf')
    source = (source_root/'index.html').read_text(encoding='utf-8')
    result = render_template(source, dict(profile=data['profile'],site=data['site-settings'],render=render_sections(data,source_root)))
    result = hide_sections(result, data['site-settings'])
    result = responsive_images(result, output, base_path)
    result = result.replace('href="CV.pdf"', 'href="CV.pdf?v=' + hashlib.sha256(cv.read_bytes()).hexdigest()[:12] + '"')
    (output/'index.html').write_text(result,encoding='utf-8')
    for file in ['CNAME','robots.txt','sitemap.xml']:
        if (source_root/file).exists(): shutil.copyfile(source_root/file, output/file)
    (output/'.nojekyll').touch()
    shutil.copytree(source_root/'admin', output/'admin')
    collections = [dict(name='portfolio',label='Portfolio settings',format='json',editor=dict(preview=False),files=[dict(name=name,label='Testimonials' if name == 'reviews' else name.replace('-',' ').title(),file=prefix+f'content/{name}.json',fields=schemas[name]) for name in ['profile','contact','skills','education','experience','achievements','resume','site-settings','reviews']])]
    for name in ['projects','research','papers']:
        collections.append(dict(name=name,label={'projects':'Projects','research':'Research projects','papers':'Research papers'}[name],folder=prefix+f'content/{name}',create=True,delete=True,extension='json',format='json',identifier_field='id',slug='{{slug}}',summary='{{title}} — order {{order}}',sortable_fields=['title','order','published'],fields=schemas[name],editor=dict(preview=False)))
    config = dict(backend=dict(name='github',repo=repository or 'OWNER/REPOSITORY',branch=branch,base_url=settings.get('oauth_base_url') or 'https://configure-oauth.invalid',auth_endpoint='auth'),publish_mode='simple',media_folder=prefix+'uploads',public_folder=base_path+'/uploads',site_url=site_url,display_url=site_url,show_preview_links=False,collections=collections)
    (output/'admin/config.yml').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (output/'admin/status.json').write_text(json.dumps(dict(configured=ready)),encoding='utf-8')
    shutil.copyfile(output/'admin/config.yml', output/'admin/github/config.yml')
    shutil.copyfile(output/'admin/status.json', output/'admin/github/status.json')
    api_base = os.environ.get('API_BASE_URL', '').rstrip('/')
    if api_base and api_base != 'same-origin':
        safe_url(api_base)
        if urlsplit(api_base).scheme not in ['http','https']: raise ValueError('API_BASE_URL must be an HTTP or HTTPS URL')
    (output/'frontend-config.js').write_text('window.PORTFOLIO_CONFIG = ' + json.dumps(dict(apiBase=api_base)).replace('<','\\u003c') + ';\n', encoding='utf-8')
    validate_output(output,base_path)
    print(f'Built {output}: {len(data["projects"])+len(data["research"])} project records; OAuth {"configured (live verification still required)" if ready else "disabled until setup"}.')
    return data


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository',default=os.environ.get('GITHUB_REPOSITORY'))
    parser.add_argument('--branch',default=os.environ.get('GITHUB_REF_NAME'))
    parser.add_argument('--site-url',default=os.environ.get('PAGES_SITE_URL'))
    parser.add_argument('--source-prefix',default='frontend' if ROOT.name == 'frontend' else '')
    parser.add_argument('--output-dir',choices=['dist','dist-next'],default='dist')
    args = parser.parse_args()
    try: build(output=ROOT/args.output_dir,repository=args.repository,branch=args.branch,site_url=args.site_url,prefix=args.source_prefix)
    except (ValueError,KeyError,TypeError,OSError) as error:
        raise SystemExit(f'Build failed: {error}') from error
