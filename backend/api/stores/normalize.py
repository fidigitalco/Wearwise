"""
One product shape for every source.

Connectors return raw dicts with these keys (any may be missing):
  external_id, name, url, image_url, price, previous_price, currency, brand, store,
  color (free text), category (free text: "Women > Coats > Trench"), gender (free text),
  sizes (list), rating (0-5), review_count, in_stock (bool), sponsored (bool)
`normalize` turns one into Product fields, or None when it is not clothing we can place.
The type and colour come from the same words smart search understands (api/pipeline.py).
"""
import re
from decimal import Decimal, InvalidOperation

from .. import taxonomy as tx
from ..pipeline import parse_intent

SUB_TO_CAT = {sub: cat for cat, subs in tx.CATEGORIES.items() for sub in subs}
# Rough warmth (0-5) and formality (1-5) by type, for weather and occasions.
WARMTH = {'t_shirt': 0, 'tank_top': 0, 'shorts': 0, 'sandals': 0, 'polo': 1, 'blouse': 1, 'shirt': 1, 'day_dress': 1, 'skirt': 1,
          'jeans': 2, 'trousers': 2, 'chinos': 2, 'hoodie': 2, 'cardigan': 2, 'blazer': 2, 'denim_jacket': 2, 'sweater': 3,
          'jacket': 3, 'trench': 3, 'rain_jacket': 2, 'boots': 3, 'coat': 4, 'puffer': 5}
FORMALITY = {'blazer': 4, 'evening_dress': 5, 'oxfords': 4, 'heels': 4, 'loafers': 3, 'shirt': 3, 'blouse': 3, 'trousers': 3,
             'coat': 3, 'trench': 3, 'hoodie': 1, 'joggers': 1, 'leggings': 1, 'sneakers': 2, 't_shirt': 2}
WOMEN = ('women', 'woman', 'female', 'ladies', 'kadın', 'qadın', 'жен', 'mujer', 'girls')
MEN = ('men', 'man', 'male', 'erkek', 'kişi', 'муж', 'hombre', 'boys')


def money(v):
    """'29.99 USD', '29,99', 29.99 → Decimal('29.99'); None when it is not a price."""
    if v is None or v == '':
        return None
    s = re.sub(r'[^\d.,]', '', str(v))
    if s.count(',') and s.count('.'):
        s = s.replace(',', '') if s.rfind('.') > s.rfind(',') else s.replace('.', '').replace(',', '.')
    elif s.count(','):
        s = s.replace(',', '.')
    try:
        d = Decimal(s)
    except InvalidOperation:
        return None
    return d if d > 0 else None


def currency_of(v, default='USD'):
    m = re.search(r'\b([A-Z]{3})\b', str(v or ''))
    return m.group(1) if m else default


def _gender(text, default):
    t = f' {(text or "").lower()} '
    if any(w in t for w in WOMEN):
        return 'women'
    if any(f' {w}' in t for w in MEN):
        return 'men'
    if 'unisex' in t:
        return 'unisex'
    return default or 'unisex'


def normalize(r, source):
    name = (r.get('name') or '').strip()
    url = (r.get('url') or '').strip()
    price = money(r.get('price'))
    if not (name and url.startswith('http') and price) or r.get('in_stock') is False:
        return None
    words = parse_intent(f'{name} {r.get("category") or ""}')
    if not words['subcategories']:
        return None
    sub = words['subcategories'][0]
    colors = parse_intent(f'{r.get("color") or ""} {name}')['colors']
    prev = money(r.get('previous_price'))
    rating = r.get('rating')
    try:
        rating = round(float(rating), 2) if rating not in (None, '') and 0 < float(rating) <= 5 else None
    except (TypeError, ValueError):
        rating = None
    try:
        reviews = int(r['review_count']) if r.get('review_count') not in (None, '') else None
    except (TypeError, ValueError):
        reviews = None
    sizes = r.get('sizes') or []
    if isinstance(sizes, str):
        sizes = [x.strip() for x in re.split(r'[,|/;]', sizes) if x.strip()]
    return {
        'external_id': str(r.get('external_id') or url)[:80],
        'name': name[:160],
        'store': (r.get('store') or source.store or source.name)[:40],
        'brand': (r.get('brand') or '')[:60],
        'price': price,
        'previous_price': prev if prev and prev > price else None,
        'currency': currency_of(r.get('currency') or r.get('price')),
        'category': SUB_TO_CAT[sub],
        'subcategory': sub,
        'color': colors[0] if colors else '',
        'gender': _gender(f'{r.get("gender") or ""} {r.get("category") or ""}', source.gender),
        'sizes': [str(x)[:10] for x in sizes][:30],
        'image_url': (r.get('image_url') or '')[:200] if str(r.get('image_url') or '').startswith('https://') else '',
        'url': url[:500],
        'rating': rating,
        'review_count': reviews,
        'sponsored': bool(r.get('sponsored')),
        'warmth': WARMTH.get(sub, 1),
        'formality': FORMALITY.get(sub, 2),
    }
