"""
"Find it for me": the person writes what they want ("a black jacket, not too long,
under 150 AZN") and gets 10-12 real products that are on sale now, suit their
profile and taste, and deliver to their own country.

Claude searches the web (the web_search server tool) and hands its picks to the
`submit_picks` tool, whose strict schema is the result format. Web search cites
its sources, which rules out the JSON response format, hence the tool.

A search takes 30-90 seconds, so it runs in a background thread (`start`) and
the app polls the FinderSearch row. Free accounts get FREE_PER_WEEK searches a
week, Premium PREMIUM_PER_DAY a day; failed searches are not counted.
"""
import logging
import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from urllib.parse import urlparse

import anthropic
import requests
from django.conf import settings
from django.utils import timezone

from . import taxonomy as tx

logger = logging.getLogger(__name__)

MODEL = os.environ.get('WEARWISE_FINDER_MODEL', 'claude-opus-5-5')
FREE_PER_WEEK = int(os.environ.get('FINDER_FREE_PER_WEEK', '1'))
PREMIUM_PER_DAY = int(os.environ.get('FINDER_PREMIUM_PER_DAY', '30'))
MAX_PICKS = 12
# A search still "running" after this was cut off (a worker restart); it is shown as failed.
STALE_AFTER = timedelta(minutes=10)
# Stores everyone searches when they have not chosen their own (choosing is Premium).
DEFAULT_STORES = ['Trendyol', 'Zara', 'H&M', 'Mango', 'ASOS', 'Amazon', 'Pull&Bear', 'Bershka', 'Massimo Dutti', 'Uniqlo', 'Zalando', 'Nike', 'Adidas']

COUNTRY_NAMES = {
    'AZ': 'Azerbaijan', 'TR': 'Turkey', 'GB': 'United Kingdom', 'DE': 'Germany', 'FR': 'France', 'US': 'United States',
    'AE': 'United Arab Emirates', 'RU': 'Russia', 'GE': 'Georgia', 'KZ': 'Kazakhstan', 'UZ': 'Uzbekistan', 'UA': 'Ukraine',
    'ES': 'Spain', 'IT': 'Italy', 'NL': 'Netherlands', 'PL': 'Poland', 'SA': 'Saudi Arabia', 'QA': 'Qatar', 'CA': 'Canada',
    'MX': 'Mexico', 'AR': 'Argentina', 'CO': 'Colombia', 'BR': 'Brazil', 'IR': 'Iran', 'IL': 'Israel', 'EG': 'Egypt',
}
LANG_NAMES = {'az': 'Azerbaijani', 'en': 'English', 'ru': 'Russian', 'tr': 'Turkish', 'es': 'Spanish'}


# ── Allowance ────────────────────────────────────────────────────────────

def allowance(user):
    """{plan, period, limit, used, remaining, resets_at}: how many searches are left right now."""
    from .models import FinderSearch
    premium = user.plan == 'premium'
    period = timedelta(days=1) if premium else timedelta(days=7)
    limit = PREMIUM_PER_DAY if premium else FREE_PER_WEEK
    since = timezone.now() - period
    counted = FinderSearch.objects.filter(user=user, created_at__gte=since).exclude(status='failed')
    used = counted.count()
    oldest = counted.order_by('created_at').first()
    return {
        'plan': 'premium' if premium else 'free', 'period': 'day' if premium else 'week',
        'limit': limit, 'used': used, 'remaining': max(0, limit - used),
        'resets_at': (oldest.created_at + period) if (oldest and used >= limit) else None,
    }


def country_for(user):
    """Where the picks must deliver: the country chosen in onboarding, else the phone's, else the connection's."""
    for c in (user.country, user.device_country, user.ip_country):
        if c and len(c) == 2 and c != 'other':
            return c.upper()
    return ''


def stores_for(user):
    """Premium searches the stores the person chose; everyone else the default list."""
    if user.plan == 'premium' and user.stores:
        return list(user.stores)
    return list(DEFAULT_STORES)


# ── The search ───────────────────────────────────────────────────────────

SUBMIT_TOOL = {
    'name': 'submit_picks',
    'description': 'Hand over the final product picks. Call this exactly once, at the end, with every pick.',
    'strict': True,
    'input_schema': {
        'type': 'object',
        'additionalProperties': False,
        'required': ['picks', 'note'],
        'properties': {
            'note': {'type': 'string', 'description': 'One short sentence for the person, in their language, or "".'},
            'picks': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'additionalProperties': False,
                    'required': ['name', 'store', 'url', 'image_url', 'price', 'currency', 'rating', 'reviews', 'reason', 'delivers'],
                    'properties': {
                        'name': {'type': 'string'},
                        'store': {'type': 'string'},
                        'url': {'type': 'string', 'description': "The product's own page, never a search or category page."},
                        'image_url': {'type': 'string', 'description': 'A product photo URL seen in the results, or "".'},
                        'price': {'type': ['number', 'null']},
                        'currency': {'type': 'string', 'description': 'ISO 4217 code, or "".'},
                        'rating': {'type': ['number', 'null'], 'description': 'Average rating out of 5, if shown.'},
                        'reviews': {'type': ['integer', 'null']},
                        'reason': {'type': 'string', 'description': 'Why it suits this person, one short line in their language.'},
                        'delivers': {'type': 'boolean', 'description': 'True when the store delivers this to their country.'},
                    },
                },
            },
        },
    },
}

SYSTEM = """You are the personal shopper inside WearWise, a wardrobe and styling app.
A person describes something they want to buy. Find real products that are for sale right now and suit them.

How to work:
- Search the web for the item in the stores listed. Prefer them; another store is fine only when it clearly suits the person better.
- Every pick must deliver to the person's country. Check the store's shipping to that country; leave out anything that does not deliver there.
- Prefer well-rated products (4 stars or more where ratings exist) and stores that are reliable for that country.
- Respect their sizes, budget, styles, colours and the colours they avoid. Their own words in the request come first.
- Give the product's own page as the link, never a search results or category page. Never invent a product, link, price or rating: leave a value empty (null or "") rather than guess.
- Aim for 10 to 12 varied picks (different stores, cuts and prices), fewer only if that is all you can verify.
- Finish by calling submit_picks once with all picks. Write each reason and the note in {lang}."""


def _profile(user):
    """The person, in plain words, for the prompt: only what they told us or showed by liking."""
    from .catalog import learned_taste
    lines = []
    from .catalog import _wanted_gender
    depts = [g for g in _wanted_gender(user) if g != 'unisex']
    lines.append(f'Shops for: {" and ".join(depts)} (and unisex)')
    if user.age_range:
        lines.append(f'Age: {user.age_range}')
    sizes = {k: v for k, v in (user.sizes or {}).items() if v}
    if sizes:
        lines.append('Sizes: ' + ', '.join(f'{k} {v}' for k, v in sizes.items()))
    if user.height_cm:
        lines.append(f'Height: {user.height_cm} cm')
    if user.body_shape:
        lines.append(f'Body shape: {user.body_shape}')
    fits = user.fit_preferences or ([user.fit_preference] if user.fit_preference else [])
    if fits:
        lines.append('Fit: ' + ', '.join(fits))
    if user.budget_ranges:
        rng = [tx.BUDGET_RANGES[b] for b in user.budget_ranges if b in tx.BUDGET_RANGES]
        if rng:
            lo, hi = min(r[0] for r in rng), max(r[1] for r in rng)
            lines.append(f'Budget per piece: about {lo}-{hi} USD' if hi < 100000 else f'Budget per piece: from {lo} USD')
    styles = user.preferred_styles or ([user.style_direction] if user.style_direction else [])
    if styles:
        lines.append('Styles: ' + ', '.join(s.replace('_', ' ') for s in styles))
    if user.favorite_colors:
        lines.append('Favourite colours: ' + ', '.join(user.favorite_colors))
    if user.avoid_colors:
        lines.append('Avoids: ' + ', '.join(user.avoid_colors))
    if user.never_list:
        lines.append('Never show: ' + ', '.join(t.replace(':', ' ').replace('_', ' ') for t in user.never_list))
    lines.append(f'Quality bar: rating at least {user.min_rating}, at least {user.min_reviews} reviews where shown'
                 + ('; no sponsored or promoted listings' if user.hide_sponsored else ''))
    taste = learned_taste(user)
    liked = [k.split(':', 1)[1] for k, v in sorted(taste.items(), key=lambda kv: -kv[1]) if v > 0][:8]
    if liked:
        lines.append('Has been liking: ' + ', '.join(x.replace('_', ' ') for x in liked))
    return '\n'.join(lines) or 'No profile details yet.'


def _prompt(search, user):
    country = COUNTRY_NAMES.get(search.country, search.country) or 'their country (unknown: prefer stores that ship internationally)'
    return (
        f'The request: "{search.query}"\n\n'
        f'Deliver to: {country}{f" ({search.country})" if search.country else ""}\n'
        f'Stores to search: {", ".join(search.stores)}\n\n'
        f'About the person:\n{_profile(user)}'
    )


def _web_search_tool(country):
    tool = {'type': 'web_search_20260209', 'name': 'web_search', 'max_uses': 15}
    if country:
        tool['user_location'] = {'type': 'approximate', 'country': country}
    return tool


def _ask_claude(search, user):
    """Run the search; returns the submit_picks input ({picks, note})."""
    client = anthropic.Anthropic(timeout=300.0, max_retries=2)
    system = SYSTEM.replace('{lang}', LANG_NAMES.get(search.lang, 'English'))
    messages = [{'role': 'user', 'content': _prompt(search, user)}]
    country = search.country
    nudged = False
    for _ in range(8):
        try:
            response = client.beta.messages.create(
                model=MODEL,
                max_tokens=16000,
                system=system,
                messages=messages,
                tools=[_web_search_tool(country), SUBMIT_TOOL],
                tool_choice={'type': 'auto'},
                output_config={'effort': 'medium'},
                # On a policy decline the API retries on a fallback model inside the same call.
                betas=['server-side-fallback-2026-07-01'],
                fallbacks='default',
            )
        except anthropic.BadRequestError as e:
            # The search provider does not cover every country for localisation; search without it.
            if country and 'user_location' in str(e):
                country = ''
                continue
            raise
        for block in response.content:
            if block.type == 'tool_use' and block.name == 'submit_picks':
                return block.input
        if response.stop_reason == 'refusal':
            raise RuntimeError('The search was declined.')
        messages.append({'role': 'assistant', 'content': [b.to_dict() for b in response.content]})
        if response.stop_reason == 'pause_turn':
            continue  # the server resumes its search loop
        if nudged:
            break
        nudged = True
        messages.append({'role': 'user', 'content': 'Call submit_picks now with the products you found.'})
    raise RuntimeError('No picks came back.')


_SEARCH_PATH = re.compile(r'/(search|sr|s|catalogsearch|arama)(/|$|\?)|[?&](q|query|searchterm|search|k)=', re.I)


def _clean(picks):
    """Only usable picks: a real https product page (not a search page), deduplicated, at most MAX_PICKS."""
    out, seen = [], set()
    for p in picks:
        url = (p.get('url') or '').strip()
        u = urlparse(url)
        if u.scheme not in ('http', 'https') or not u.netloc or _SEARCH_PATH.search(url) or url in seen:
            continue
        if p.get('delivers') is False:
            continue
        seen.add(url)
        img = (p.get('image_url') or '').strip()
        out.append({
            'name': (p.get('name') or '').strip()[:160],
            'store': (p.get('store') or u.netloc.removeprefix('www.')).strip()[:60],
            'url': url,
            'image_url': img if img.startswith('https://') else '',
            'price': p.get('price'),
            'currency': (p.get('currency') or '').strip().upper()[:3],
            'rating': p.get('rating') if isinstance(p.get('rating'), (int, float)) and 0 < p['rating'] <= 5 else None,
            'reviews': p.get('reviews') if isinstance(p.get('reviews'), int) and p['reviews'] >= 0 else None,
            'reason': (p.get('reason') or '').strip()[:240],
        })
        if len(out) >= MAX_PICKS:
            break
    return out


_OG_IMAGE = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', re.I)


def _og_image(url):
    """The product page's share image, for picks that came back without a photo. Best effort."""
    try:
        r = requests.get(url, timeout=6, headers={'User-Agent': 'Mozilla/5.0 (compatible; WearWiseBot/1.0)'})
        m = _OG_IMAGE.search(r.text[:300000]) if r.ok else None
        img = m.group(1).strip() if m else ''
        return img if img.startswith('https://') else ''
    except requests.RequestException:
        return ''


def _fill_images(picks):
    missing = [p for p in picks if not p['image_url']]
    if not missing:
        return
    with ThreadPoolExecutor(max_workers=6) as pool:
        for p, img in zip(missing, pool.map(lambda p: _og_image(p['url']), missing)):
            p['image_url'] = img


def run(search_id):
    """Do one search and store its outcome on the row. Never raises."""
    from .models import FinderSearch
    search = FinderSearch.objects.select_related('user').get(pk=search_id)
    try:
        out = _ask_claude(search, search.user)
        picks = _clean(out.get('picks') or [])
        if not picks:
            raise RuntimeError('Nothing suitable that delivers there was found.')
        _fill_images(picks)
        search.results, search.note, search.status = picks, (out.get('note') or '')[:500], 'done'
    except Exception as e:  # noqa: BLE001 - every failure ends up on the row for the app to show
        logger.exception('Finder search %s failed', search_id)
        search.status, search.error = 'failed', str(e)[:300]
    search.finished_at = timezone.now()
    search.save(update_fields=['results', 'note', 'status', 'error', 'finished_at'])


def start(search):
    """Run the search in the background; the suite runs it itself."""
    if settings.TESTING:
        return
    threading.Thread(target=run, args=(search.pk,), daemon=True).start()


def expire_stale(qs):
    """Searches cut off by a restart would stay "running" for ever; call them failed."""
    qs.filter(status='running', created_at__lt=timezone.now() - STALE_AFTER).update(
        status='failed', error='The search was interrupted.', finished_at=timezone.now())
