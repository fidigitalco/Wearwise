"""
"Complete your wardrobe": a few pieces worth buying, each with links to search
for it in online stores, and "Will this fit my wardrobe?" for a piece the user
is thinking of buying (prototype spec §2.4, §3.4).

The picks are rule-based on the user's own closet: missing essentials first
(shoes, a bottom, a top, a jacket for the season), then a rain layer, boots, a
blazer, then a colour that pairs best with what they wear most, then
accessories. Each pick takes the colour that unlocks the most new outfits and
says how many.

Each pick carries `products`: up to two real pieces (added in the admin panel,
each with the link to its own product page) of that type and colour. Only when
there is none does the app fall back to `links`, searches in the stores. An
affiliate feed can fill the same Product table later without touching the
rules. Every link carries an anonymous sub-id so a network report can say which
suggestion sold.
"""
import hashlib
from collections import Counter
from itertools import combinations
from types import SimpleNamespace
from urllib.parse import quote, quote_plus

from django.conf import settings
from django.utils import timezone

from . import taxonomy as tx
from .engine.describe import _cap, color_name, kind_name
from .locale import say
from .models import Garment
from .services import pairs

AUDIENCE = {'menswear': 'men', 'womenswear': 'women'}

# Formality (1–5), warmth (0–5) and rain-proofness of a piece not yet owned,
# for counting the outfits it would make.
TYPE_DEFAULTS = {
    't_shirt': (1, 1), 'shirt': (3, 1), 'blouse': (3, 1), 'polo': (2, 1), 'sweater': (3, 3), 'hoodie': (1, 3),
    'cardigan': (3, 2), 'tank_top': (1, 0),
    'jeans': (2, 2), 'trousers': (4, 2), 'chinos': (3, 2), 'shorts': (1, 0), 'skirt': (3, 1), 'joggers': (1, 2),
    'leggings': (1, 1),
    'day_dress': (2, 1), 'evening_dress': (5, 1), 'jumpsuit': (3, 1),
    'blazer': (4, 2), 'jacket': (2, 3), 'rain_jacket': (2, 2), 'coat': (4, 4), 'puffer': (1, 5), 'trench': (3, 3),
    'denim_jacket': (2, 2),
    'sneakers': (1, 0), 'loafers': (3, 0), 'boots': (3, 1), 'heels': (4, 0), 'sandals': (1, 0), 'oxfords': (4, 0),
    'flats': (2, 0),
}
RAIN_PROOF = {'rain_jacket', 'puffer', 'trench'}

# Store search URLs; {q} is the query in the store's language.
STORES = [
    ('Trendyol', 'https://www.trendyol.com/sr?q={q}&utm_source=wearwise&utm_medium=affiliate&sub_id={sub_id}', 'tr'),
    ('AliExpress', 'https://www.aliexpress.com/w/wholesale-{path}.html', 'en'),
    ('Amazon', 'https://www.amazon.com/s?k={q}', 'en'),
]

# Trendyol is searched in Turkish (spec §2.4): "lacivert yağmurluk".
TYPE_TR = {
    't_shirt': 'tişört', 'shirt': 'gömlek', 'blouse': 'bluz', 'polo': 'polo yaka tişört', 'sweater': 'kazak',
    'hoodie': 'kapüşonlu sweatshirt', 'cardigan': 'hırka', 'tank_top': 'atlet', 'jeans': 'jean',
    'trousers': 'kumaş pantolon', 'chinos': 'chino pantolon', 'shorts': 'şort', 'skirt': 'etek',
    'joggers': 'eşofman altı', 'leggings': 'tayt', 'day_dress': 'elbise', 'evening_dress': 'abiye elbise',
    'jumpsuit': 'tulum', 'blazer': 'blazer ceket', 'jacket': 'ceket', 'rain_jacket': 'yağmurluk', 'coat': 'kaban',
    'puffer': 'şişme mont', 'trench': 'trençkot', 'denim_jacket': 'kot ceket', 'sneakers': 'sneaker',
    'loafers': 'loafer ayakkabı', 'boots': 'bot', 'heels': 'topuklu ayakkabı', 'sandals': 'sandalet',
    'oxfords': 'oxford ayakkabı', 'flats': 'babet', 'belt': 'kemer', 'scarf': 'atkı', 'hat': 'şapka',
    'watch': 'saat', 'jewellery': 'takı', 'tie': 'kravat', 'sunglasses': 'güneş gözlüğü', 'tote': 'tote çanta',
    'backpack': 'sırt çantası', 'crossbody': 'çapraz çanta', 'clutch': 'clutch çanta', 'briefcase': 'evrak çantası',
}
COLOR_TR = {
    'black': 'siyah', 'white': 'beyaz', 'cream': 'krem', 'grey': 'gri', 'charcoal': 'antrasit', 'navy': 'lacivert',
    'blue': 'mavi', 'light_blue': 'açık mavi', 'teal': 'petrol', 'green': 'yeşil', 'olive': 'haki yeşil',
    'khaki': 'haki', 'beige': 'bej', 'camel': 'camel', 'brown': 'kahverengi', 'burgundy': 'bordo', 'red': 'kırmızı',
    'pink': 'pembe', 'purple': 'mor', 'yellow': 'sarı', 'orange': 'turuncu', 'mustard': 'hardal',
}
AUDIENCE_TR = {'menswear': 'erkek', 'womenswear': 'kadın'}

REASONS = {
    'shoes': ('Every outfit needs shoes, and your closet has none yet.',
              'Hər kombinə ayaqqabı lazımdır, qarderobunda isə hələ yoxdur.'),
    'bottom': ('A bottom unlocks full outfits with the tops you have.',
               'Alt geyim olsa, mövcud üst geyimlərinlə tam kombinlər alınar.'),
    'top': ('A simple top pairs with almost everything you own.',
            'Sadə üst geyim qarderobundakı demək olar hər şeyə yaraşır.'),
    'outerwear': ('A jacket for this season finishes your looks.',
                  'Bu mövsümə uyğun gödəkçə kombinlərini tamamlayacaq.'),
    'rain': ('Nothing in your closet is made for rain.',
             'Qarderobunda yağışlı hava üçün paltar yoxdur.'),
    'boots': ('Boots keep rainy and snowy days covered.',
              'Çəkmə yağışlı və qarlı günlərdə köməyinə çatacaq.'),
    'blazer': ('A blazer turns your everyday pieces into work and dinner looks.',
               'Pencək gündəlik paltarlarını iş və axşam kombinlərinə çevirir.'),
    'tops': ('More basic tops mean more outfit combinations.',
             'Sadə üst geyim çox olduqca kombin də çox olur.'),
    'color': ('Pairs best with the {owned} pieces you wear most.',
              'Ən çox geyindiyin {owned} rəngli paltarlarla yaxşı uyğun gəlir.'),
    'accessory': ('A belt pulls trousers and jeans looks together.',
                  'Kəmər şalvar və cins kombinlərini tamamlayır.'),
    'bag': ('A neutral bag goes with every outfit in your closet.',
            'Neytral rəngli çanta qarderobundakı bütün kombinlərə yaraşır.'),
}

# "Will this fit my wardrobe?" (spec §2.4): outfits it would unlock → verdict.
GREAT_BUY, WORKS = 8, 3
# A colour pair below this reads as a clash and the outfit does not count.
CLASH = 50


def sub_id(user, sub, color):
    """Anonymous per-user tag for a link, so a network report can attribute a sale without naming anyone."""
    who = hashlib.sha256(f'{settings.SECRET_KEY}:{user.pk}'.encode()).hexdigest()[:10] if user else 'anon'
    return f'ww_{sub}_{color}_{who}'


def query_for(sub, color, wardrobe_style='', lang='en'):
    if lang == 'tr':
        parts = [COLOR_TR.get(color, ''), TYPE_TR.get(sub, sub.replace('_', ' ')), AUDIENCE_TR.get(wardrobe_style, '')]
    else:
        parts = [color.replace('_', ' '), sub.replace('_', ' '), AUDIENCE.get(wardrobe_style, '')]
    return ' '.join(p for p in parts if p)


def links_for(sub, color, user=None):
    style = getattr(user, 'wardrobe_style', '') or ''
    tag = sub_id(user, sub, color)
    out = []
    for name, url, lang in STORES:
        q = query_for(sub, color, style, lang)
        out.append({'store': name, 'url': url.format(q=quote_plus(q), path=quote(q.replace(' ', '-')), sub_id=tag)})
    return out


def products_for(sub, color, user=None, n=2):
    """
    Up to `n` real catalogue pieces of this type in this colour, for the user's
    wardrobe: the pieces an admin added with a link to the product's own page.
    Demo rows are left out, their links are only store searches.
    """
    from .catalog import _wanted_gender
    from .models import Product
    qs = Product.objects.filter(active=True, is_demo=False, subcategory=sub, color=color)
    if user is not None:
        qs = qs.filter(gender__in=_wanted_gender(user))
    return [{
        'id': p.id, 'name': p.name, 'store': p.store, 'brand': p.brand, 'price': float(p.price),
        'currency': p.currency, 'image_url': p.image_url,
    } for p in qs.order_by('sponsored', 'price', '-created_at')[:n]]


def _season(today):
    return {12: 'winter', 1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring',
            6: 'summer', 7: 'summer', 8: 'summer'}.get(today.month, 'autumn')


def _category_of(sub):
    return next((c for c, subs in tx.CATEGORIES.items() if sub in subs), None)


def hypothetical(sub, color):
    """A stand-in garment for a piece the user does not own yet."""
    formality, warmth = TYPE_DEFAULTS.get(sub, (2, 1))
    return SimpleNamespace(id=f'new:{sub}:{color}', category=_category_of(sub), subcategory=sub,
                           primary_color=color, formality=formality, warmth=warmth, rain_ok=sub in RAIN_PROOF)


def _good(pieces, table):
    """An outfit counts when its formality spread is at most 1 and no colour pair clashes (spec §3.4)."""
    forms = [g.formality for g in pieces]
    if max(forms) - min(forms) > 1:
        return False
    names = [g.primary_color for g in pieces if g.primary_color]
    return all(table.color(a, b) >= CLASH for a, b in combinations(names, 2) if a != b)


def unlocks(new, garments, table):
    """How many good outfits the closet would gain with `new` in it: only outfits that wear it are built."""
    by = {c: [g for g in garments if g.category == c] for c in ('top', 'bottom', 'dress', 'outerwear', 'shoes')}
    if new.category not in by:
        return 0
    by[new.category] = [new]
    outers = by['outerwear'] if new.category == 'outerwear' else [None] + by['outerwear']
    bases = [(d,) for d in by['dress']] if new.category == 'dress' else (
        [(t, b) for t in by['top'] for b in by['bottom']] + ([] if new.category in ('top', 'bottom') else [(d,) for d in by['dress']]))
    n = 0
    for shoes in by['shoes']:
        for outer in outers:
            for base in bases:
                if _good([*base, shoes] + ([outer] if outer else []), table):
                    n += 1
    return n


def matched_pieces(new, garments, table):
    """Owned pieces that pair with `new`: the same formality band and no colour clash."""
    return sum(1 for g in garments if g.category != new.category and g.category in ('top', 'bottom', 'dress', 'outerwear', 'shoes')
               and _good([g, new], table))


def best_color(sub, garments, table, skip=()):
    """(colour, unlocks) for the colour that opens the most outfits, leaving out colours in `skip`."""
    scored = [(unlocks(hypothetical(sub, c), garments, table), c) for c in tx.COLORS if c not in skip]
    n, c = max(scored, key=lambda x: (x[0], x[1] in tx.NEUTRALS))
    return c, n


def check_fit(user, sub, color, lang='en'):
    """{verdict: great|works|skip, unlocks, matches, better: {color, unlocks, title}|null, links}."""
    garments = list(Garment.objects.filter(user=user, status='available'))
    table = pairs()
    new = hypothetical(sub, color)
    n = unlocks(new, garments, table)
    verdict = 'great' if n >= GREAT_BUY else 'works' if n >= WORKS else 'skip'
    alt_color, alt_n = best_color(sub, garments, table)
    better = None
    if alt_color != color and alt_n > n:
        better = {'color': alt_color, 'unlocks': alt_n,
                  'title': _cap(say(lang, '{color} {kind}', '{color} {kind}', color=color_name(alt_color, lang), kind=kind_name(sub, lang)))}
    return {
        'verdict': verdict,
        'unlocks': n,
        'matches': matched_pieces(new, garments, table),
        'better': better,
        'title': _cap(say(lang, '{color} {kind}', '{color} {kind}', color=color_name(color, lang), kind=kind_name(sub, lang))),
        'links': links_for(sub, color, user),
        'products': products_for(sub, color, user),
    }


def suggestions(user, lang='en', limit=4):
    """[{id, title, reason, category, subcategory, color, rgb, unlocks, links: [{store, url}], products: [...]}]."""
    garments = list(Garment.objects.filter(user=user, status='available'))
    table = pairs()
    cats = Counter(g.category for g in garments)
    subs = Counter(g.subcategory for g in garments)
    owned = {(g.subcategory, g.primary_color) for g in garments}
    picks = []  # (rule, category, subcategory, colour or None for "the best one")

    def add(rule, category, sub, color=None):
        if all(p[2] != sub for p in picks) and (color is None or (sub, color) not in owned):
            picks.append((rule, category, sub, color))

    if not cats['shoes']:
        add('shoes', 'shoes', 'sneakers', 'white')
    if not cats['bottom'] and not cats['dress']:
        add('bottom', 'bottom', 'jeans', 'navy')
    if not cats['top'] and not cats['dress']:
        add('top', 'top', 't_shirt', 'white')
    if not cats['outerwear']:
        cold = _season(timezone.localdate()) in ('autumn', 'winter')
        add('outerwear', 'outerwear', 'coat' if cold else 'denim_jacket')
    if not any(g.rain_ok for g in garments if g.category == 'outerwear'):
        add('rain', 'outerwear', 'rain_jacket')
    if cats['shoes'] and not subs['boots']:
        add('boots', 'shoes', 'boots')
    if cats['top'] and not subs['blazer']:
        add('blazer', 'outerwear', 'blazer')
    if 0 < cats['top'] < 3:
        add('tops', 'top', 'shirt')

    worn = Counter(g.primary_color for g in garments if g.primary_color)
    if worn:
        base = worn.most_common(1)[0][0]
        have = set(worn)
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

    out = []
    for rule, category, sub, color in picks[:limit]:
        body = category in ('top', 'bottom', 'dress', 'outerwear', 'shoes')
        if color is None:
            color, n = best_color(sub, garments, table, skip={c for s_, c in owned if s_ == sub})
        else:
            n = unlocks(hypothetical(sub, color), garments, table) if body else 0
        key, fmt = (rule[0], {'owned': color_name(rule[1], lang)}) if isinstance(rule, tuple) else (rule, {})
        en, az = REASONS[key]
        reason = say(lang, en, az, **fmt)
        out.append({
            'id': f'{sub}-{color}',
            'title': _cap(say(lang, '{color} {kind}', '{color} {kind}', color=color_name(color, lang), kind=kind_name(sub, lang))),
            'reason': reason,
            'category': category,
            'subcategory': sub,
            'color': color,
            'rgb': list(tx.COLORS[color]),
            'unlocks': n,
            'links': links_for(sub, color, user),
            'products': products_for(sub, color, user),
        })
    return out
