"""
"Complete your wardrobe": a few pieces worth buying, each with links to search
for it in online stores.

The picks are rule-based on the user's own closet: missing essentials first
(shoes, a bottom, a top, a jacket for the season), then a rain layer, then a
colour that pairs best with what they wear most but don't own yet, then
accessories. Links are
store searches, not specific products: real product links need a retailer or
affiliate feed, which can replace `links_for` without touching the rules.
"""
from collections import Counter
from urllib.parse import quote_plus

from django.utils import timezone

from . import taxonomy as tx
from .engine.describe import _cap, color_name, kind_name
from .models import Garment
from .services import pairs

# (store, search URL with {q} for the query). Trendyol and Zara both ship to Azerbaijan.
STORES = [
    ('Trendyol', 'https://www.trendyol.com/sr?q={q}'),
    ('Zara', 'https://www.zara.com/az/en/search?searchTerm={q}'),
    ('Google Shopping', 'https://www.google.com/search?tbm=shop&q={q}'),
]

AUDIENCE = {'menswear': 'men', 'womenswear': 'women'}

REASONS = {
    'shoes': ('Every outfit needs shoes, and your closet has none yet.',
              'Hər kombinə ayaqqabı lazımdır, qarderobunda isə hələ yoxdur.'),
    'bottom': ('A bottom unlocks full outfits with the tops you have.',
               'Alt geyim əlindəki üst geyimlərlə tam kombin yaratmağa imkan verir.'),
    'top': ('A simple top pairs with almost everything you own.',
            'Sadə üst geyim qarderobundakı demək olar hər şeylə gedir.'),
    'outerwear': ('A jacket for this season finishes your looks.',
                  'Bu mövsüm üçün gödəkçə kombinlərini tamamlayır.'),
    'rain': ('Nothing in your closet is made for rain.',
             'Qarderobunda yağışa uyğun geyim yoxdur.'),
    'tops': ('More basic tops mean more outfit combinations.',
             'Daha çox sadə üst geyim — daha çox kombin deməkdir.'),
    'color': ('Pairs best with the {owned} pieces you wear most.',
              'Ən çox geyindiyin {owned} geyimlərlə ən yaxşı uyğunlaşır.'),
    'accessory': ('A belt pulls trousers and jeans looks together.',
                  'Kəmər şalvar və cins kombinlərini tamamlayır.'),
    'bag': ('A neutral bag goes with every outfit in your closet.',
            'Neytral çanta qarderobundakı bütün kombinlərə yaraşır.'),
}


def links_for(query):
    return [{'store': name, 'url': url.format(q=quote_plus(query))} for name, url in STORES]


def _season(today):
    return {12: 'winter', 1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring',
            6: 'summer', 7: 'summer', 8: 'summer'}.get(today.month, 'autumn')


def suggestions(user, lang='en', limit=4):
    """[{id, title, reason, category, subcategory, color, rgb, links: [{store, url}]}]."""
    garments = list(Garment.objects.filter(user=user, status='available'))
    cats = Counter(g.category for g in garments)
    owned = {(g.subcategory, g.primary_color) for g in garments}
    picks = []  # (rule, category, subcategory, colour)

    def add(rule, category, sub, color):
        if (sub, color) not in owned and all(p[2:] != (sub, color) for p in picks):
            picks.append((rule, category, sub, color))

    if not cats['shoes']:
        add('shoes', 'shoes', 'sneakers', 'white')
    if not cats['bottom'] and not cats['dress']:
        add('bottom', 'bottom', 'jeans', 'navy')
    if not cats['top'] and not cats['dress']:
        add('top', 'top', 't_shirt', 'white')
    if not cats['outerwear']:
        cold = _season(timezone.localdate()) in ('autumn', 'winter')
        add('outerwear', 'outerwear', 'coat' if cold else 'denim_jacket', 'camel' if cold else 'blue')
    if not any(g.rain_ok for g in garments if g.category == 'outerwear'):
        add('rain', 'outerwear', 'rain_jacket', 'navy')
    if 0 < cats['top'] < 3:
        add('tops', 'top', 'shirt', 'white')

    worn = Counter(g.primary_color for g in garments if g.primary_color)
    if worn:
        base = worn.most_common(1)[0][0]
        have = set(worn)
        table = pairs()
        partner = max((c for c in tx.COLORS if c not in have), key=lambda c: table.color(base, c), default=None)
        if partner:
            # The garment type the user owns least of between tops and bottoms.
            if cats['top'] <= cats['bottom']:
                add(('color', base), 'top', 'sweater', partner)
            else:
                add(('color', base), 'bottom', 'trousers', partner)
    if not cats['accessory']:
        add('accessory', 'accessory', 'belt', 'brown')
    if garments and not cats['bag']:
        add('bag', 'bag', 'crossbody' if user.wardrobe_style == 'womenswear' else 'backpack', 'black')

    audience = AUDIENCE.get(user.wardrobe_style, '')
    out = []
    for rule, category, sub, color in picks[:limit]:
        key, fmt = (rule[0], {'owned': color_name(rule[1], lang)}) if isinstance(rule, tuple) else (rule, {})
        en, az = REASONS[key]
        query = ' '.join(filter(None, [color.replace('_', ' '), sub.replace('_', ' '), audience]))
        out.append({
            'id': f'{sub}-{color}',
            'title': _cap(f'{color_name(color, lang)} {kind_name(sub, lang)}'),
            'reason': (az if lang == 'az' else en).format(**fmt),
            'category': category,
            'subcategory': sub,
            'color': color,
            'rgb': list(tx.COLORS[color]),
            'links': links_for(query),
        })
    return out
