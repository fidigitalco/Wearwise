"""
The shopping catalogue and the rules that pick from it (MVP v2): Discovery,
"Why this?", the day's look, occasion outfits and the wishlist's price watch.

Until the affiliate networks approve us, `DEMO` is the catalogue (loaded by
`manage.py load_catalog`): realistic pieces whose Shop link is a search in the
store. A feed import fills the same Product table later; nothing here changes.
"""
from collections import Counter
from datetime import timedelta
from decimal import Decimal
from itertools import combinations
from urllib.parse import quote_plus

from django.utils import timezone

from . import taxonomy as tx
from .locale import name as vocab, say
from .services import pairs

# Store search URLs for the demo catalogue's Shop links.
STORE_SEARCH = {
    'Trendyol': 'https://www.trendyol.com/sr?q={q}',
    'ASOS': 'https://www.asos.com/search/?q={q}',
    'Zara': 'https://www.zara.com/search?searchTerm={q}',
    'H&M': 'https://www2.hm.com/en_gb/search-results.html?q={q}',
    'Mango': 'https://shop.mango.com/search?q={q}',
    'Amazon': 'https://www.amazon.com/s?k={q}',
    'COS': 'https://www.cos.com/search?q={q}',
    'Massimo Dutti': 'https://www.massimodutti.com/search?term={q}',
    'Uniqlo': 'https://www.uniqlo.com/search?q={q}',
    'Nike': 'https://www.nike.com/w?q={q}',
}
ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL']
EU_SHOES = [str(n) for n in range(36, 42)]

# (name, store, price, previous price or None, category, subcategory, colour, material, styles, formality, warmth, rating, small brand)
DEMO = [
    ('Oversized merino cardigan', 'Trendyol', 49, None, 'top', 'cardigan', 'beige', 'wool', ['minimal', 'scandi', 'casual'], 2, 2, 4.5, False),
    ('Straight-leg raw denim', 'ASOS', 62, None, 'bottom', 'jeans', 'navy', 'denim', ['casual', 'minimal', 'classic'], 2, 2, 4.4, False),
    ('Washed linen shirt', 'Mango', 39, None, 'top', 'shirt', 'cream', 'linen', ['old_money', 'coastal', 'minimal'], 3, 1, 4.6, False),
    ('Satin midi skirt', 'Zara', 45, None, 'bottom', 'skirt', 'burgundy', 'silk', ['parisian_chic', 'romantic', 'glam'], 3, 1, 4.2, False),
    ('Leather loafers', 'Amazon', 79, None, 'shoes', 'loafers', 'brown', 'leather', ['old_money', 'classic', 'preppy'], 3, 0, 4.5, False),
    ('Cable-knit vest', 'Trendyol', 34, None, 'top', 'sweater', 'cream', 'wool', ['preppy', 'old_money', 'vintage'], 2, 2, 4.6, True),
    ('Wide-leg wool trousers', 'COS', 69, None, 'bottom', 'trousers', 'charcoal', 'wool', ['quiet_luxury', 'minimal', 'business'], 4, 2, 4.5, False),
    ('Clean leather sneakers', 'ASOS', 55, None, 'shoes', 'sneakers', 'white', 'leather', ['minimal', 'casual', 'scandi', 'korean'], 1, 0, 4.4, False),
    ('Structured leather tote', 'Mango', 59, None, 'bag', 'tote', 'brown', 'leather', ['classic', 'old_money', 'business'], 3, 0, 4.3, False),
    ('Silk slip dress', 'Massimo Dutti', 89, None, 'dress', 'evening_dress', 'navy', 'silk', ['parisian_chic', 'glam', 'quiet_luxury'], 4, 0, 4.7, False),
    ('Leather ankle boots', 'Trendyol', 74, None, 'shoes', 'boots', 'black', 'leather', ['edgy', 'classic', 'scandi'], 3, 1, 4.4, False),
    ('Relaxed wool blazer', 'Zara', 79, None, 'outerwear', 'blazer', 'beige', 'wool', ['quiet_luxury', 'old_money', 'smart_casual'], 4, 2, 4.3, False),
    ('Rib-knit jumper', 'ASOS', 38, None, 'top', 'sweater', 'brown', 'wool', ['casual', 'scandi', 'minimal'], 2, 3, 4.2, False),
    ('Wool blend coat', 'ASOS', 98, 129, 'outerwear', 'coat', 'camel', 'wool', ['classic', 'old_money', 'quiet_luxury'], 4, 4, 4.6, False),
    ('Poplin button-down', 'Uniqlo', 29, None, 'top', 'shirt', 'white', 'cotton', ['classic', 'business', 'minimal'], 3, 1, 4.6, False),
    ('Fine-gauge turtleneck', 'COS', 49, None, 'top', 'sweater', 'black', 'wool', ['minimal', 'parisian_chic', 'quiet_luxury'], 3, 2, 4.5, False),
    ('Breton stripe top', 'Mango', 25, None, 'top', 't_shirt', 'navy', 'cotton', ['parisian_chic', 'coastal', 'preppy'], 2, 1, 4.4, False),
    ('Organic cotton tee', 'H&M', 12, None, 't_shirt', 't_shirt', 'white', 'cotton', ['minimal', 'casual', 'scandi'], 1, 1, 4.1, False),
    ('Cropped denim jacket', 'Zara', 49, None, 'outerwear', 'denim_jacket', 'light_blue', 'denim', ['casual', 'y2k', 'western'], 2, 2, 4.0, False),
    ('Pleated midi skirt', 'H&M', 32, None, 'bottom', 'skirt', 'olive', 'polyester', ['romantic', 'vintage', 'modest'], 3, 1, 4.1, False),
    ('Tailored straight trousers', 'Massimo Dutti', 69, 89, 'bottom', 'trousers', 'black', 'wool', ['business', 'classic', 'minimal'], 4, 2, 4.6, False),
    ('Floral wrap dress', 'Mango', 59, None, 'dress', 'day_dress', 'pink', 'viscose', ['romantic', 'cottagecore', 'bohemian'], 2, 1, 4.3, False),
    ('Knit midi dress', 'COS', 79, None, 'dress', 'day_dress', 'grey', 'wool', ['minimal', 'scandi', 'modest'], 3, 2, 4.5, False),
    ('Black blazer dress', 'Zara', 69, None, 'dress', 'day_dress', 'black', 'polyester', ['glam', 'business', 'edgy'], 4, 1, 4.1, False),
    ('Trench coat', 'Mango', 119, 149, 'outerwear', 'trench', 'beige', 'cotton', ['classic', 'parisian_chic', 'old_money'], 3, 3, 4.7, False),
    ('Quilted puffer jacket', 'Uniqlo', 79, None, 'outerwear', 'puffer', 'black', 'nylon', ['gorpcore', 'casual', 'athleisure'], 1, 5, 4.6, False),
    ('Waterproof rain jacket', 'Amazon', 59, None, 'outerwear', 'rain_jacket', 'olive', 'nylon', ['gorpcore', 'casual', 'techwear'], 1, 2, 4.4, True),
    ('Leather biker jacket', 'ASOS', 99, None, 'outerwear', 'jacket', 'black', 'leather', ['edgy', 'grunge', 'y2k'], 2, 3, 4.2, False),
    ('High-rise mom jeans', 'Trendyol', 36, None, 'bottom', 'jeans', 'light_blue', 'denim', ['casual', 'y2k', 'vintage'], 1, 2, 4.3, False),
    ('Wide-leg cargo trousers', 'H&M', 35, None, 'bottom', 'trousers', 'khaki', 'cotton', ['streetwear', 'gorpcore', 'y2k'], 1, 2, 4.0, False),
    ('Tailored shorts', 'Zara', 29, None, 'bottom', 'shorts', 'beige', 'linen', ['coastal', 'smart_casual', 'old_money'], 2, 0, 4.0, False),
    ('Ballet flats', 'Mango', 39, None, 'shoes', 'flats', 'black', 'leather', ['parisian_chic', 'classic', 'romantic'], 3, 0, 4.3, False),
    ('Block-heel pumps', 'Zara', 49, None, 'shoes', 'heels', 'beige', 'leather', ['glam', 'business', 'classic'], 4, 0, 4.1, False),
    ('Strappy sandals', 'Trendyol', 29, None, 'shoes', 'sandals', 'brown', 'leather', ['coastal', 'bohemian', 'casual'], 2, 0, 4.2, True),
    ('Running trainers', 'Nike', 89, None, 'shoes', 'sneakers', 'grey', 'mesh', ['athleisure', 'sporty', 'gorpcore'], 1, 0, 4.7, False),
    ('Knee-high riding boots', 'Massimo Dutti', 149, None, 'shoes', 'boots', 'brown', 'leather', ['old_money', 'western', 'classic'], 3, 1, 4.6, False),
    ('Mini crossbody bag', 'H&M', 25, None, 'bag', 'crossbody', 'black', 'faux leather', ['minimal', 'korean', 'casual'], 2, 0, 4.0, False),
    ('Canvas tote', 'Uniqlo', 19, None, 'bag', 'tote', 'cream', 'cotton', ['casual', 'scandi', 'coastal'], 1, 0, 4.4, False),
    ('Evening clutch', 'Mango', 35, None, 'bag', 'clutch', 'burgundy', 'satin', ['glam', 'parisian_chic', 'romantic'], 4, 0, 4.2, False),
    ('Silk square scarf', 'Massimo Dutti', 39, None, 'accessory', 'scarf', 'navy', 'silk', ['parisian_chic', 'old_money', 'vintage'], 3, 0, 4.5, False),
    ('Leather belt', 'COS', 35, None, 'accessory', 'belt', 'black', 'leather', ['minimal', 'classic', 'business'], 3, 0, 4.4, False),
    ('Hoodie in heavy cotton', 'Nike', 65, None, 'top', 'hoodie', 'grey', 'cotton', ['athleisure', 'streetwear', 'sporty'], 1, 3, 4.6, False),
    ('Seamless leggings', 'Nike', 45, None, 'bottom', 'leggings', 'black', 'nylon', ['athleisure', 'sporty'], 1, 1, 4.5, False),
    ('Puff-sleeve blouse', 'Zara', 35, None, 'top', 'blouse', 'white', 'cotton', ['romantic', 'cottagecore', 'parisian_chic'], 3, 1, 4.0, False),
    ('Satin blouse', 'Mango', 45, None, 'top', 'blouse', 'cream', 'silk', ['quiet_luxury', 'glam', 'business'], 4, 1, 4.3, False),
    ('Polo knit top', 'Massimo Dutti', 49, None, 'top', 'polo', 'navy', 'wool', ['preppy', 'old_money', 'smart_casual'], 3, 2, 4.5, False),
    ('Graphic boxy tee', 'ASOS', 19, None, 'top', 't_shirt', 'black', 'cotton', ['streetwear', 'grunge', 'y2k'], 1, 1, 3.9, False),
    ('Modest maxi dress', 'Trendyol', 54, None, 'dress', 'day_dress', 'olive', 'viscose', ['modest', 'bohemian', 'romantic'], 3, 1, 4.4, True),
    ('Tweed jacket', 'Zara', 89, None, 'outerwear', 'blazer', 'cream', 'wool', ['old_money', 'parisian_chic', 'glam'], 4, 2, 4.2, False),
    ('Chunky knit jumper', 'H&M', 39, 49, 'top', 'sweater', 'cream', 'wool', ['cottagecore', 'scandi', 'casual'], 1, 4, 4.2, False),
    ('Chino trousers', 'Uniqlo', 39, None, 'bottom', 'chinos', 'beige', 'cotton', ['smart_casual', 'preppy', 'classic'], 3, 2, 4.5, False),
    ('Denim midi skirt', 'Trendyol', 33, None, 'bottom', 'skirt', 'blue', 'denim', ['casual', 'y2k', 'western'], 2, 1, 4.1, True),
    ('Cashmere crew jumper', 'COS', 135, None, 'top', 'sweater', 'grey', 'cashmere', ['quiet_luxury', 'minimal', 'old_money'], 3, 3, 4.8, False),
    ('Western ankle boots', 'Amazon', 89, None, 'shoes', 'boots', 'camel', 'suede', ['western', 'bohemian', 'vintage'], 2, 1, 4.3, True),
]

# Pieces anyone wears; the rest of DEMO is womenswear (the MVP launches for women).
UNISEX = {
    'Clean leather sneakers', 'Running trainers', 'Quilted puffer jacket', 'Waterproof rain jacket', 'Hoodie in heavy cotton',
    'Canvas tote', 'Leather belt', 'Organic cotton tee', 'Silk square scarf', 'Chunky knit jumper', 'Cashmere crew jumper',
    'Fine-gauge turtleneck', 'Leather biker jacket', 'Wool blend coat', 'Trench coat',
}

# A first menswear shelf, so a man who signs up before the men's launch does not land on an empty app.
MEN = [
    ('Oxford button-down shirt', 'Uniqlo', 35, None, 'top', 'shirt', 'light_blue', 'cotton', ['classic', 'smart_casual', 'preppy'], 3, 1, 4.6, False),
    ('Slim stretch chinos', 'H&M', 30, None, 'bottom', 'chinos', 'beige', 'cotton', ['smart_casual', 'classic', 'preppy'], 3, 2, 4.3, False),
    ('Straight selvedge jeans', 'ASOS', 69, None, 'bottom', 'jeans', 'navy', 'denim', ['casual', 'minimal', 'vintage'], 2, 2, 4.4, False),
    ('Unstructured wool blazer', 'Massimo Dutti', 129, 159, 'outerwear', 'blazer', 'navy', 'wool', ['old_money', 'quiet_luxury', 'business'], 4, 2, 4.7, False),
    ('Suede loafers', 'Zara', 69, None, 'shoes', 'loafers', 'brown', 'suede', ['old_money', 'smart_casual', 'classic'], 3, 0, 4.2, False),
    ('Chelsea boots', 'Trendyol', 79, None, 'shoes', 'boots', 'black', 'leather', ['classic', 'edgy', 'minimal'], 3, 1, 4.4, False),
    ('Merino polo', 'COS', 59, None, 'top', 'polo', 'charcoal', 'wool', ['quiet_luxury', 'minimal', 'smart_casual'], 3, 2, 4.5, False),
    ('Heavyweight tee', 'Uniqlo', 15, None, 'top', 't_shirt', 'white', 'cotton', ['minimal', 'casual', 'streetwear'], 1, 1, 4.6, False),
    ('Tailored wool trousers', 'Mango', 59, None, 'bottom', 'trousers', 'grey', 'wool', ['business', 'classic', 'minimal'], 4, 2, 4.3, False),
    ('Overshirt in twill', 'Zara', 45, None, 'outerwear', 'jacket', 'olive', 'cotton', ['casual', 'gorpcore', 'scandi'], 2, 2, 4.1, False),
    ('Leather briefcase', 'Amazon', 89, None, 'bag', 'briefcase', 'brown', 'leather', ['business', 'classic'], 4, 0, 4.4, True),
    ('Cargo trousers', 'ASOS', 42, None, 'bottom', 'trousers', 'khaki', 'cotton', ['streetwear', 'gorpcore', 'techwear'], 1, 2, 4.0, False),
    ('Navy crew jumper', 'H&M', 29, None, 'top', 'sweater', 'navy', 'wool', ['preppy', 'classic', 'casual'], 2, 3, 4.2, False),
    ('Camel overcoat', 'COS', 190, None, 'outerwear', 'coat', 'camel', 'wool', ['old_money', 'quiet_luxury', 'classic'], 4, 4, 4.8, False),
]


def demo_photos():
    """{product name: {url, photographer, page}}: free Unsplash photos for the demo catalogue (catalog_photos.json)."""
    import json
    from pathlib import Path
    path = Path(__file__).with_name('catalog_photos.json')
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def demo_rows():
    """DEMO as Product field dicts."""
    photos = demo_photos()
    out = []
    rows = [(r, 'unisex' if r[0] in UNISEX else 'women') for r in DEMO] + [(r, 'men') for r in MEN]
    for (name, store, price, prev, cat, sub, color, material, styles, formality, warmth, rating, small), gender in rows:
        if cat not in tx.CATEGORIES:  # a typo in the table should not slip into the catalogue
            cat = next(c for c, subs in tx.CATEGORIES.items() if sub in subs)
        out.append({
            'name': name, 'store': store, 'price': Decimal(price), 'previous_price': Decimal(prev) if prev else None,
            'category': cat, 'subcategory': sub, 'color': color, 'material': material, 'styles': styles,
            'formality': formality, 'warmth': warmth, 'rating': rating, 'small_brand': small,
            'sizes': EU_SHOES if cat == 'shoes' else ([] if cat in ('bag', 'accessory') else ALL_SIZES),
            'url': STORE_SEARCH.get(store, STORE_SEARCH['Amazon']).format(q=quote_plus(name)),
            'gender': gender, 'is_demo': True,
            'image_url': (photos.get(name) or {}).get('url', ''),
        })
    return out


# ── Taste ─────────────────────────────────────────────────────────────────

ACTION_WEIGHT = {'like': 1.0, 'save': 1.5, 'shop': 2.0, 'not_me': -1.5}


def learned_taste(user):
    """
    Weights per style, colour, type and store from the user's Like / Not me /
    Save / Shop history and from what they shared to their inspiration board.
    """
    from .models import Inspiration, Product, ProductAction
    w = Counter()
    for a in ProductAction.objects.filter(user=user).select_related('product')[:400]:
        k = ACTION_WEIGHT.get(a.action, 0)
        p = a.product
        for s in p.styles:
            w[f's:{s}'] += k
        w[f'c:{p.color}'] += k
        w[f't:{p.subcategory}'] += k
        w[f'store:{p.store}'] += 0.5 * k
    # A shared piece weighs like a save. Its styles are borrowed from catalogue pieces of the same type and colour.
    shared = list(Inspiration.objects.filter(user=user)[:100])
    if shared:
        k = ACTION_WEIGHT['save']
        look_alike = {}
        for p in Product.objects.filter(subcategory__in={i.subcategory for i in shared if i.subcategory}):
            look_alike.setdefault((p.subcategory, p.color), p.styles)
        for i in shared:
            if i.color:
                w[f'c:{i.color}'] += k
            if i.subcategory:
                w[f't:{i.subcategory}'] += k
                for s in look_alike.get((i.subcategory, i.color), []):
                    w[f's:{s}'] += 0.5 * k
    return w


def profile_learned(user):
    """0–100: how much of the style profile has been learned, for the Discover meter."""
    from .models import ProductAction
    from .models import Inspiration
    answers = ProductAction.objects.filter(user=user).count() + 2 * Inspiration.objects.filter(user=user).count()
    base = 25 if user.onboarded else 0
    return min(100, base + answers * 5)


def in_budget(price, ranges):
    if not ranges:
        return True
    return any(tx.BUDGET_RANGES[r][0] <= float(price) < tx.BUDGET_RANGES[r][1] for r in ranges if r in tx.BUDGET_RANGES)


def _lowest_range(ranges):
    known = [r for r in ranges if r in tx.BUDGET_RANGES]
    return min(known, key=lambda r: tx.BUDGET_RANGES[r][0]) if known else None


def score_product(p, user, taste):
    """How well a product fits the user's profile and what they have liked; higher is better."""
    styles = set(user.preferred_styles or ([user.style_direction] if user.style_direction else []))
    s = 3.0 * len(styles & set(p.styles))
    if p.color in (user.favorite_colors or []):
        s += 2.5
    if p.color in (user.avoid_colors or []):
        s -= 8
    if in_budget(p.price, user.budget_ranges):
        s += 2
        low = _lowest_range(user.budget_ranges)
        if low and in_budget(p.price, [low]):
            s += 1  # everyday picks come from the lower range they chose (MVP §1, step 5)
    elif user.budget_ranges:
        s -= 4
    if user.stores and p.store in user.stores:
        s += 1.5
    # Yes / no from the onboarding swipe weighs about as much as a matching style.
    s += 3.0 * (user.type_prefs or {}).get(p.subcategory, 0)
    if p.small_brand:
        s += 0.8
    if p.rating:
        s += (p.rating - 4.0) * 1.5
    s += sum(taste.get(f's:{x}', 0) for x in p.styles) * 0.4
    s += taste.get(f'c:{p.color}', 0) * 0.5 + taste.get(f't:{p.subcategory}', 0) * 0.5 + taste.get(f'store:{p.store}', 0) * 0.3
    return s


def match_percent(p, user, taste):
    """The profile score as a percentage for the card's "92% match" tag (55–98)."""
    return int(max(55, min(98, round(62 + 3.2 * score_product(p, user, taste)))))


def _wanted_gender(user):
    return {'female': ['women', 'unisex'], 'male': ['men', 'unisex']}.get(user.gender, ['women', 'men', 'unisex'])


def candidates(user):
    from .models import Product
    return list(Product.objects.filter(active=True, gender__in=_wanted_gender(user)))


def why(p, user, lang='en'):
    """The "Why this?" line under a product: the strongest true reason, never a made-up one."""
    if (user.type_prefs or {}).get(p.subcategory) == 1:
        kind = vocab(lang, 'kinds', p.subcategory, tx.KIND_AZ)
        return say(lang, 'You said yes to {kind}', '{kind} sənə xoş gəlir dedin', kind=kind)
    styles = [s for s in (user.preferred_styles or []) if s in p.styles]
    if styles:
        st = vocab(lang, 'styles', styles[0], tx.STYLE_AZ, styles[0].replace('_', ' ').title())
        if p.color in (user.favorite_colors or []):
            return say(lang, 'Your {style} style, in a colour you love', 'Sənin {style} üslubunda, sevdiyin rəngdə', style=st)
        return say(lang, 'Matches your {style} style', '{style} üslubuna uyğundur', style=st)
    if p.color in (user.favorite_colors or []):
        return say(lang, 'In a colour you love', 'Sevdiyin rəngdədir')
    if user.budget_ranges and in_budget(p.price, user.budget_ranges):
        return say(lang, 'Within your budget', 'Büdcənə uyğundur')
    if p.small_brand and p.rating:
        return say(lang, 'Small brand, {rating}★, not ad-boosted', 'Kiçik brend, {rating}★, reklamla önə çəkilməyib', rating=p.rating)
    return say(lang, 'Well rated and easy to wear', 'Yüksək reytinqli, geyinməsi rahat')


# ── Discovery ─────────────────────────────────────────────────────────────

FIRST_DROP, DROP_SIZE = 10, 3
DROP_DAYS = (0, 2, 4)  # Monday, Wednesday, Friday


def drop_key(day=None):
    """The current drop: the last Mon/Wed/Fri on or before `day`."""
    day = day or timezone.localdate()
    back = min((day.weekday() - d) % 7 for d in DROP_DAYS)
    start = day - timedelta(days=back)
    iso = start.isocalendar()
    return f'{iso[0]}-W{iso[1]:02d}-{start.weekday()}', start


def next_drop(day=None):
    day = day or timezone.localdate()
    for i in range(1, 8):
        d = day + timedelta(days=i)
        if d.weekday() in DROP_DAYS:
            return d
    return day


def discovery(user):
    """The products in today's drop, best first: 10 on the first drop, then 3 a drop (MVP §1–2)."""
    from .models import DiscoveryDrop, Product, ProductAction
    key, _ = drop_key()
    drop = DiscoveryDrop.objects.filter(user=user, key=key).first()
    if drop is None:
        first = not DiscoveryDrop.objects.filter(user=user).exists()
        seen = set(ProductAction.objects.filter(user=user).values_list('product_id', flat=True))
        for d in DiscoveryDrop.objects.filter(user=user):
            seen.update(d.product_ids)
        taste = learned_taste(user)
        pool = [p for p in candidates(user) if p.id not in seen]
        pool.sort(key=lambda p: -score_product(p, user, taste))
        picks, kinds = [], Counter()
        for p in pool:  # no more than two of one type in a drop
            if kinds[p.subcategory] < 2:
                picks.append(p)
                kinds[p.subcategory] += 1
            if len(picks) >= (FIRST_DROP if first else DROP_SIZE):
                break
        drop = DiscoveryDrop.objects.create(user=user, key=key, product_ids=[p.id for p in picks])
    acted = set(ProductAction.objects.filter(user=user, product_id__in=drop.product_ids).values_list('product_id', flat=True))
    by_id = Product.objects.in_bulk(drop.product_ids)
    return [by_id[i] for i in drop.product_ids if i in by_id and i not in acted], next_drop()


# ── Looks from the catalogue ──────────────────────────────────────────────

_CLASH = 50


def _harmonious(items, table):
    names = [p.color for p in items]
    return all(table.color(a, b) >= _CLASH for a, b in combinations(names, 2) if a != b)


def build_looks(user, band=(1, 5), n=3, temp_c=None, seed=0):
    """
    `n` distinct outfits from the catalogue: (top + bottom) or a dress, then
    shoes, a layer when it is cold, and a bag; inside the formality band and
    the user's budget, with colours that do not clash.
    """
    taste = learned_taste(user)
    table = pairs()
    lo, hi = band
    pool = [p for p in candidates(user) if lo - 1 <= p.formality <= hi and p.color not in (user.avoid_colors or [])]
    by = {c: sorted([p for p in pool if p.category == c], key=lambda p: -score_product(p, user, taste))
          for c in ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag')}
    cold = temp_c is not None and temp_c < 14
    looks, used = [], set()
    for i in range(n * 3):
        if len(looks) >= n:
            break
        dress_turn = by['dress'] and (i + seed) % 3 == 1
        base = [by['dress'][(i // 3) % len(by['dress'])]] if dress_turn else [
            x for x in (by['top'][(i + seed) % len(by['top'])] if by['top'] else None,
                        by['bottom'][(i * 2 + seed) % len(by['bottom'])] if by['bottom'] else None) if x]
        if not base:
            continue
        look = list(base)
        for cat in (['outerwear'] if cold or i % 2 else []) + ['shoes', 'bag']:
            for p in by[cat]:
                if _harmonious(look + [p], table):
                    look.append(p)
                    break
        key = frozenset(p.id for p in look)
        if key in used or not _harmonious(look, table):
            continue
        used.add(key)
        looks.append(look)
    return looks


def look_payload(look, ctx):
    from .serializers import ProductSerializer
    return {'items': ProductSerializer(look, many=True, context=ctx).data, 'total': float(sum(p.price for p in look)),
            'stores': sorted({p.store for p in look})}


# ── Occasions ─────────────────────────────────────────────────────────────

OCCASION_BAND = {'birthday': (2, 4), 'wedding': (4, 5), 'holiday': (2, 4), 'work': (3, 5), 'trip': (1, 3), 'date': (2, 4),
                 'other': (2, 4)}
OUTFITS_FROM, REMIND_AT = 15, 7


def occasion_payload(o, user, ctx, lang='en'):
    days = (o.date - timezone.localdate()).days
    out = {
        'id': o.id, 'title': o.title, 'date': o.date.isoformat(), 'kind': o.kind, 'for_gift': o.for_gift, 'person': o.person,
        'days': days, 'ready': days <= OUTFITS_FROM, 'remind': days <= REMIND_AT, 'outfit': None,
    }
    if o.outfit_id and ctx.get('request'):
        from .serializers import OutfitSerializer
        from .services import outfit_qs
        mine = outfit_qs().filter(pk=o.outfit_id).first()
        out['outfit'] = OutfitSerializer(mine, context=ctx).data if mine else None
    return out


def occasion_looks(o, user, ctx):
    """Three outfits for the date (or gift ideas: single pieces for the other person)."""
    if o.for_gift:
        taste = learned_taste(user)
        picks = sorted(candidates(user), key=lambda p: (-(p.rating or 0), -score_product(p, user, taste)))
        gifts = [p for p in picks if p.category in ('bag', 'accessory', 'top')][:6]
        return [look_payload([g], ctx) for g in gifts[:3]]
    return [look_payload(l, ctx) for l in build_looks(user, OCCASION_BAND.get(o.kind, (2, 4)), 3, seed=o.id)]


# ── Wishlist ──────────────────────────────────────────────────────────────

def price_drop(saved):
    """[was, now] when the price fell since it was saved, else None."""
    now = saved.product.price
    if now < saved.price_when_saved:
        return [float(saved.price_when_saved), float(now)]
    return None


def cheaper_similar(product, user, n=3):
    """Same type, cheaper, in a colour the user does not avoid."""
    from .models import Product
    qs = Product.objects.filter(active=True, subcategory=product.subcategory, price__lt=product.price).exclude(id=product.id)
    return [p for p in qs.order_by('price') if p.color not in (user.avoid_colors or [])][:n]


# ── "Does this suit me?" ──────────────────────────────────────────────────

FREE_CHECKS = 5

# Words in a product link that name a type ("…/mustard-ribbed-jumper-123").
LINK_TYPES = {
    'jumper': 'sweater', 'sweater': 'sweater', 'knit': 'sweater', 'cardigan': 'cardigan', 'hoodie': 'hoodie',
    'shirt': 'shirt', 'blouse': 'blouse', 'tee': 't_shirt', 't-shirt': 't_shirt', 'tshirt': 't_shirt', 'top': 't_shirt',
    'polo': 'polo', 'jeans': 'jeans', 'denim': 'jeans', 'trousers': 'trousers', 'pants': 'trousers', 'chinos': 'chinos',
    'shorts': 'shorts', 'skirt': 'skirt', 'leggings': 'leggings', 'dress': 'day_dress', 'jumpsuit': 'jumpsuit',
    'blazer': 'blazer', 'jacket': 'jacket', 'coat': 'coat', 'trench': 'trench', 'puffer': 'puffer', 'parka': 'puffer',
    'sneakers': 'sneakers', 'trainers': 'sneakers', 'loafers': 'loafers', 'boots': 'boots', 'heels': 'heels',
    'pumps': 'heels', 'sandals': 'sandals', 'flats': 'flats', 'bag': 'tote', 'tote': 'tote', 'backpack': 'backpack',
    'scarf': 'scarf', 'belt': 'belt',
    # Turkish store slugs (Trendyol).
    'kazak': 'sweater', 'hirka': 'cardigan', 'gomlek': 'shirt', 'pantolon': 'trousers', 'etek': 'skirt', 'elbise': 'day_dress',
    'ceket': 'jacket', 'kaban': 'coat', 'mont': 'puffer', 'bot': 'boots', 'canta': 'tote',
}
LINK_COLORS = {**{c.replace('_', '-'): c for c in tx.COLORS}, 'mustard': 'mustard', 'ivory': 'cream', 'tan': 'camel',
               'lacivert': 'navy', 'siyah': 'black', 'beyaz': 'white', 'kirmizi': 'red', 'bej': 'beige', 'gri': 'grey',
               'kahverengi': 'brown', 'yesil': 'green', 'mavi': 'blue', 'pembe': 'pink', 'bordo': 'burgundy'}


def read_link(url):
    """(subcategory, colour) guessed from the words of a product link; either may be None."""
    import re
    words = re.split(r'[^a-z0-9-]+', url.lower().translate(str.maketrans('ıüşöçğ', 'iusocg')))
    words += [w for part in words for w in part.split('-')]
    sub = next((LINK_TYPES[w] for w in words if w in LINK_TYPES), None)
    color = next((LINK_COLORS[w] for w in words if w in LINK_COLORS), None)
    return sub, color


def checks_left(user):
    from .models import StyleCheck
    if user.plan == 'premium':
        return None
    start = timezone.localdate().replace(day=1)
    return max(0, FREE_CHECKS - StyleCheck.objects.filter(user=user, created_at__date__gte=start).count())


def suits_me(user, sub, color, ctx, lang='en'):
    """
    The verdict on a piece the user is thinking of buying: style fit (does this
    type come in their styles), colour fit (love / avoid), how many saved
    pieces it pairs with, and up to three alternatives. Without a colour
    analysis it can judge style and palette, not "it suits your skin" (MVP §3).
    """
    from .models import SavedProduct
    category = next((c for c, subs in tx.CATEGORIES.items() if sub in subs), None) if sub else None
    styles = set(user.preferred_styles or [])
    pool = candidates(user)
    style_ok = bool(sub) and any(p.subcategory == sub and styles & set(p.styles) for p in pool)
    love = color in (user.favorite_colors or [])
    avoid = color in (user.avoid_colors or [])
    table = pairs()
    saved = [sp.product for sp in SavedProduct.objects.filter(user=user).select_related('product')]
    pairs_with = sum(1 for p in saved if color and p.category != category and table.color(color, p.color) >= _CLASH)
    score = 60 + (15 if style_ok else -5) + (15 if love else 0) - (25 if avoid else 0) + min(10, 2 * pairs_with)
    score = max(20, min(98, score))
    if avoid and style_ok:
        verdict = 'risky'
    elif score >= 85:
        verdict = 'great'
    elif score >= 68:
        verdict = 'good'
    else:
        verdict = 'skip'
    taste = learned_taste(user)
    same = [p for p in pool if (p.subcategory == sub if sub else True) and p.color != color and p.color not in (user.avoid_colors or [])]
    same.sort(key=lambda p: (-(p.color in (user.favorite_colors or [])), -score_product(p, user, taste)))
    from .serializers import ProductSerializer
    return {
        'score': score, 'verdict': verdict, 'subcategory': sub, 'category': category, 'color': color,
        'rgb': list(tx.COLORS[color]) if color in tx.COLORS else None,
        'style_ok': style_ok, 'color_fit': 'love' if love else 'avoid' if avoid else ('ok' if color else 'unknown'),
        'pairs_with': pairs_with, 'better_color': avoid,
        'alternatives': ProductSerializer(same[:3], many=True, context=ctx).data,
    }
