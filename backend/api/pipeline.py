"""
Smart search over the product catalogue (build prompt §2.3, §4.2).

1. `parse_intent` reads the person's words ("white sneakers under $90", "qara
   palto 150 AZN-dən ucuz") into a structured intent; `merge_profile` adds what
   their profile already says (size, budget, never-list). Each part keeps where
   it came from, so the app can show the person's words and the profile's
   additions in different colours.
2. `run` passes the candidates through the filter stages, counting how many each
   one removes and keeping every removed product with its reason, then ranks
   what is left.

Ranking rule (non-negotiable): commission never affects ranking. `rank_score`
uses style match, quality and price fit only; `Product.affiliate_rate` is never
read here, and the suite checks that.
"""
import re
from decimal import Decimal

from . import taxonomy as tx

# ── Words → attributes, in the app's five languages ──────────────────────

COLOR_WORDS = {
    'black': ['black', 'qara', 'черн', 'siyah', 'negr'],
    'white': ['white', 'ağ', 'бел', 'beyaz', 'blanc'],
    'cream': ['cream', 'ivory', 'krem', 'кремов', 'crema'],
    'grey': ['grey', 'gray', 'boz', 'сер', 'gri', 'gris'],
    'navy': ['navy', 'tünd göy', 'lacivert', 'темно-син', 'marino'],
    'blue': ['blue', 'mavi', 'göy', 'син', 'azul'],
    'green': ['green', 'yaşıl', 'зелен', 'yeşil', 'verde'],
    'olive': ['olive', 'zeytun', 'оливк', 'haki yeşil', 'oliva'],
    'khaki': ['khaki', 'xaki', 'хаки', 'haki', 'caqui'],
    'beige': ['beige', 'bej', 'беж', 'beis'],
    'camel': ['camel', 'дэвэ', 'deve tüyü', 'camello'],
    'brown': ['brown', 'qəhvəyi', 'коричнев', 'kahverengi', 'marrón', 'marron'],
    'burgundy': ['burgundy', 'bordo', 'бордов', 'burdeos'],
    'red': ['red', 'qırmızı', 'красн', 'kırmızı', 'rojo'],
    'pink': ['pink', 'çəhrayı', 'розов', 'pembe', 'rosa'],
    'purple': ['purple', 'bənövşəyi', 'фиолет', 'mor', 'morado'],
    'yellow': ['yellow', 'sarı', 'желт', 'amarill'],
    'orange': ['orange', 'narıncı', 'оранж', 'turuncu', 'naranja'],
}

SUB_WORDS = {
    't_shirt': ['t-shirt', 'tshirt', 'tee', 'futbolka', 'футболк', 'tişört', 'camiseta'],
    'shirt': ['shirt', 'köynək', 'рубашк', 'gömlek', 'camisa'],
    'blouse': ['blouse', 'bluz', 'блузк', 'blusa'],
    'polo': ['polo'],
    'sweater': ['sweater', 'jumper', 'sviter', 'свитер', 'kazak', 'jersey'],
    'hoodie': ['hoodie', 'hudi', 'худи', 'kapüşonlu', 'sudadera'],
    'cardigan': ['cardigan', 'kardiqan', 'кардиган', 'hırka', 'chaqueta de punto'],
    'jeans': ['jeans', 'cins', 'джинс', 'kot', 'vaquero', 'jean'],
    'trousers': ['trousers', 'pants', 'şalvar', 'брюк', 'pantolon', 'pantalón', 'pantalon'],
    'shorts': ['shorts', 'şort', 'шорт', 'pantalón corto'],
    'skirt': ['skirt', 'ətək', 'юбк', 'etek', 'falda'],
    'joggers': ['joggers', 'sweatpants', 'idman şalvar', 'джоггер', 'eşofman'],
    'day_dress': ['dress', 'don', 'плать', 'elbise', 'vestido'],
    'evening_dress': ['evening dress', 'axşam don', 'вечернее плать', 'abiye', 'vestido de noche'],
    'blazer': ['blazer', 'pencək', 'пиджак', 'blezer', 'americana'],
    'jacket': ['jacket', 'gödəkçə', 'kurtka', 'куртк', 'ceket', 'mont', 'chaqueta'],
    'denim_jacket': ['denim jacket', 'cins gödəkçə', 'джинсовая куртк', 'kot ceket', 'chaqueta vaquera'],
    'coat': ['coat', 'palto', 'пальто', 'kaban', 'abrigo'],
    'puffer': ['puffer', 'down jacket', 'puxovik', 'пуховик', 'şişme mont', 'plumífero'],
    'trench': ['trench', 'trençkot', 'тренч', 'gabardina'],
    'sneakers': ['sneakers', 'trainers', 'krossovka', 'кроссовк', 'spor ayakkabı', 'zapatillas'],
    'loafers': ['loafers', 'lofer', 'лофер', 'mokasen', 'mocasines'],
    'boots': ['boots', 'çəkmə', 'ботин', 'сапог', 'bot', 'botas'],
    'heels': ['heels', 'dabanlı', 'каблук', 'topuklu', 'tacones'],
    'sandals': ['sandals', 'sandal', 'сандал', 'sandalias'],
    'scarf': ['scarf', 'şərf', 'шарф', 'atkı', 'bufanda'],
    'hat': ['hat', 'papaq', 'шапк', 'şapka', 'sombrero', 'gorro'],
    'backpack': ['backpack', 'bel çantası', 'рюкзак', 'sırt çantası', 'mochila'],
    'tote': ['tote', 'çanta', 'сумк', 'bolso'],
    'belt': ['belt', 'kəmər', 'ремень', 'kemer', 'cinturón'],
    # Accessories and bags, so feeds from watch, eyewear and jewellery brands are understood too.
    'watch': ['watch', 'wristwatch', 'saat', 'часы', 'kol saati', 'reloj'],
    'sunglasses': ['sunglasses', 'eyewear', 'gün eynəyi', 'eynək', 'солнцезащитные очки', 'очки', 'güneş gözlüğü', 'gözlük', 'gafas de sol'],
    'jewellery': ['jewellery', 'jewelry', 'necklace', 'bracelet', 'earring', 'ring', 'pendant', 'charm', 'zinət', 'boyunbağı', 'qolbaq',
                  'sırğa', 'üzük', 'украшени', 'колье', 'браслет', 'серьг', 'кольц', 'kolye', 'bileklik', 'küpe', 'yüzük',
                  'collar', 'pulsera', 'pendientes', 'anillo'],
    'tie': ['necktie', 'qalstuk', 'галстук', 'kravat', 'corbata'],
    'clutch': ['clutch', 'evening bag', 'клатч', 'portföy', 'cartera de mano'],
    'crossbody': ['crossbody', 'shoulder bag', 'çiyin çantası', 'сумка через плечо', 'omuz çantası', 'bandolera'],
    'briefcase': ['briefcase', 'laptop bag', 'portfel', 'портфель', 'evrak çantası', 'maletín'],
    'oxfords': ['oxfords', 'oxford shoes', 'derby', 'klassik ayaqqabı', 'оксфорды', 'klasik ayakkabı'],
    'flats': ['ballet flats', 'flats', 'balerina', 'балетки', 'babet', 'bailarinas'],
    'tank_top': ['tank top', 'vest top', 'mayka', 'майка', 'atlet', 'camiseta de tirantes'],
}

STYLE_WORDS = {
    'minimal': ['minimal', 'minimalist', 'sadə', 'минимал', 'sade'],
    'smart_casual': ['smart casual'],
    'business': ['office', 'business', 'iş üçün', 'офис', 'ofis', 'oficina'],
    'formal': ['formal', 'rəsmi', 'официальн', 'resmi'],
    'sporty': ['sporty', 'sport', 'idman', 'спорт', 'spor', 'deportiv'],
    'streetwear': ['streetwear', 'street', 'стрит', 'sokak'],
    'classic': ['classic', 'klassik', 'классик', 'klasik', 'clásico'],
    'vintage': ['vintage', 'винтаж', 'retro'],
}

_PRICE_AFTER = re.compile(r'(?:under|below|less than|max|up to|до|не дороже|menos de|hasta|en fazla)\s*[$€£₺₼]?\s*(\d{1,6})', re.I)
_PRICE_BEFORE = re.compile(r'(\d{1,6})\s*(?:\$|usd|azn|₼|manat|€|eur|tl|₺|£|руб)?\s*(?:-?(?:dan|dən|ten|tan|den)\s+(?:ucuz|aşağı|az|ucuza|altı)|altı|altında|qədər|ye kadar|a kadar)', re.I)
_PRICE_SYMBOL = re.compile(r'[$€£₺₼]\s*(\d{1,6})')

# Size of the clothes a category takes, from the profile's sizes.
_SIZE_KEY = {'top': 'top', 'outerwear': 'top', 'dress': 'top', 'bottom': 'bottom', 'shoes': 'shoes'}


def _has(text, word):
    """Word-start match, so "tee" does not hit "steel" and stems like "черн" still match "черные".
    Words of three letters or fewer must be whole words: "mor" (purple) is not "more", "don" (dress) is not "don't"."""
    end = r"(?![\w'’])" if len(word) <= 3 else ''
    return re.search(r'(?<![\w])' + re.escape(word) + end, text) is not None


def parse_intent(query):
    """The person's words as {subcategories, colors, styles, max_price}; anything not recognised stays free text."""
    q = ' '.join((query or '').lower().split())
    subs = [sub for sub, words in SUB_WORDS.items() if any(_has(q, w) for w in words)]
    # "evening dress" also matches "dress": keep the more specific one.
    if 'evening_dress' in subs and 'day_dress' in subs:
        subs.remove('day_dress')
    if 'puffer' in subs and 'jacket' in subs:
        subs.remove('jacket')
    # A denim jacket is not jeans plus a jacket; "cins şalvar" is jeans, not trousers too.
    if 'denim_jacket' in subs:
        subs = [x for x in subs if x not in ('jeans', 'jacket')]
    if 'jeans' in subs and 'trousers' in subs and re.search(r'(cins|джинс)\w*\s+(şalvar|брюк)', q):
        subs.remove('trousers')
    # "t-shirt" contains "shirt": only a shirt when "shirt" also stands on its own.
    if 't_shirt' in subs and 'shirt' in subs and not _has(re.sub(r't-?shirt', ' ', q), 'shirt'):
        subs.remove('shirt')
    colors = [c for c, words in COLOR_WORDS.items() if any(_has(q, w) for w in words)]
    if 'navy' in colors and 'blue' in colors:
        colors.remove('blue')
    styles = [st for st, words in STYLE_WORDS.items() if any(_has(q, w) for w in words)]
    m = _PRICE_AFTER.search(q) or _PRICE_BEFORE.search(q) or _PRICE_SYMBOL.search(q)
    return {
        'query': q, 'subcategories': subs, 'colors': colors, 'styles': styles,
        'max_price': Decimal(m.group(1)) if m else None,
    }


def merge_profile(intent, user):
    """
    The intent with the profile filled in, and the chips the app shows:
    [{key, label, source: 'you' | 'profile'}]. The person's own words always win.
    """
    chips = [{'key': f'sub:{s}', 'label': s, 'source': 'you'} for s in intent['subcategories']]
    chips += [{'key': f'color:{c}', 'label': c, 'source': 'you'} for c in intent['colors']]
    chips += [{'key': f'style:{s}', 'label': s, 'source': 'you'} for s in intent['styles']]
    if intent['max_price'] is not None:
        chips.append({'key': 'max_price', 'label': f'≤ {intent["max_price"]}', 'source': 'you'})
    merged = dict(intent)
    if merged['max_price'] is None and user.budget_ranges:
        rng = [tx.BUDGET_RANGES[b] for b in user.budget_ranges if b in tx.BUDGET_RANGES]
        hi = max((r[1] for r in rng), default=None)
        if hi and hi < 100000:
            merged['budget_max'] = Decimal(hi)
            chips.append({'key': 'budget', 'label': f'≤ {hi} USD', 'source': 'profile'})
    sizes = {k: v for k, v in (user.sizes or {}).items() if v}
    for k, v in sizes.items():
        chips.append({'key': f'size:{k}', 'label': f'{k} {v}', 'source': 'profile'})
    if not intent['styles']:
        for st in (user.preferred_styles or [])[:2]:
            chips.append({'key': f'style:{st}', 'label': st, 'source': 'profile'})
    for token in (user.never_list or [])[:4]:
        chips.append({'key': f'never:{token}', 'label': token.split(':', 1)[-1], 'source': 'never'})
    merged['sizes'] = sizes
    merged['chips'] = chips
    return merged


# ── Filters ───────────────────────────────────────────────────────────────

def never_hit(p, never):
    """The never-list entry this product trips, or None."""
    for token in never or []:
        kind, _, value = token.partition(':')
        if (kind == 'color' and p.color == value) or (kind == 'sub' and p.subcategory == value) \
                or (kind == 'material' and p.material == value) or (kind == 'style' and value in (p.styles or [])) \
                or (kind == 'store' and p.store == value) or (kind == 'brand' and p.brand == value):
            return token
    return None


def quality_problem(p, user):
    """Why a product misses the person's quality bar, or None. Unknown counts are not held against it."""
    rating = p.verified_rating if p.verified_rating is not None else p.rating
    if rating is not None and rating < user.min_rating:
        return 'low_rating'
    if p.review_count is not None and p.review_count < user.min_reviews:
        return 'few_reviews'
    return None


def size_problem(p, sizes):
    """'size' when none of the person's sizes for this kind (they may pick up to three) is in stock."""
    from .catalog import size_list
    want = set(size_list(sizes.get(_SIZE_KEY.get(p.category, ''))))
    if want and p.sizes and not want & {str(x) for x in p.sizes}:
        return 'size'
    return None


def _dedupe_key(p):
    return (re.sub(r'\W+', ' ', p.name.lower()).strip(), (p.brand or '').lower())


# ── Ranking: style match × quality × price fit. No commission input. ─────

def quality_score(p):
    rating = p.verified_rating if p.verified_rating is not None else p.rating
    q = (rating or 4.0) / 5.0
    if p.review_count:
        q *= min(1.0, 0.85 + p.review_count / 4000)  # more reviews, more trust, capped
    return q


def price_fit(p, limit):
    if not limit:
        return 1.0
    ratio = float(p.price) / float(limit)
    return 1.0 if ratio <= 0.8 else max(0.6, 1.2 - ratio * 0.25)


def rank_score(p, user, taste, intent):
    from .catalog import score_product
    match = max(0.05, 1 + score_product(p, user, taste) / 20)
    if intent['subcategories'] and p.subcategory in intent['subcategories']:
        match += 0.5
    if intent['colors'] and p.color in intent['colors']:
        match += 0.3
    if intent['styles'] and set(intent['styles']) & set(p.styles or []):
        match += 0.3
    return match * quality_score(p) * price_fit(p, intent.get('max_price') or intent.get('budget_max'))


# ── The pipeline ─────────────────────────────────────────────────────────

STAGES = ['sponsored', 'quality', 'suspicious', 'style', 'size_budget', 'duplicates']


def run(products, user, intent, limit=12):
    """
    → {total, stages: [{key, removed, left}], results, removed: [{product, reason}]}.
    `intent` comes from merge_profile. Products are filtered in STAGES order.
    """
    from .catalog import learned_taste
    taste = learned_taste(user)
    pool = list(products)
    total = len(pool)
    stages, removed = [], []

    def stage(key, reason_of):
        nonlocal pool
        keep = []
        for p in pool:
            reason = reason_of(p)
            if reason:
                removed.append({'product': p, 'reason': reason})
            else:
                keep.append(p)
        stages.append({'key': key, 'removed': len(pool) - len(keep), 'left': len(keep)})
        pool = keep

    # What the request is about narrows the field first; that is not a "removal".
    if intent['subcategories']:
        pool = [p for p in pool if p.subcategory in intent['subcategories']]
    if intent['colors']:
        pool = [p for p in pool if p.color in intent['colors']]
    matching = len(pool)

    stage('sponsored', lambda p: 'sponsored' if (p.sponsored and user.hide_sponsored) else None)
    stage('quality', lambda p: quality_problem(p, user))
    stage('suspicious', lambda p: 'suspicious_reviews' if p.suspicious_reviews else None)

    def style_reason(p):
        hit = never_hit(p, user.never_list)
        if hit:
            return f'never:{hit}'
        if user.avoid_colors and p.color in user.avoid_colors and p.color not in intent['colors']:
            return 'avoided_color'
        return None
    stage('style', style_reason)

    limit_price = intent.get('max_price') or intent.get('budget_max')

    def size_budget(p):
        if limit_price is not None and Decimal(p.price) > limit_price:
            return 'over_budget'
        return size_problem(p, intent.get('sizes') or {})
    stage('size_budget', size_budget)

    # Same product in several stores: keep the cheapest.
    cheapest = {}
    for p in sorted(pool, key=lambda p: p.price):
        cheapest.setdefault(_dedupe_key(p), p)
    stage('duplicates', lambda p: None if cheapest[_dedupe_key(p)] is p else 'duplicate')

    pool.sort(key=lambda p: -rank_score(p, user, taste, intent))
    return {'total': total, 'matching': matching, 'stages': stages, 'results': pool[:limit], 'removed': removed}
