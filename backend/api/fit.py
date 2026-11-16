"""
Size by brand (build prompt §2.2, §2.7, §2.8).

After a purchase the user says how it fit; that teaches the size that fits them
in that brand (`learn`). The fit check (Premium) answers "which size should I
order in this brand?" from what was learned, then the profile's usual size, then
what reviews say about the brand running small or large.
"""
from django.utils import timezone

TOP_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
KIND_OF = {'top': 'top', 'outerwear': 'top', 'dress': 'top', 'bottom': 'bottom', 'shoes': 'shoes'}


def step(size, by, kind='top', gender=''):
    """`size` moved `by` steps (+1 = one size up); unchanged when the scale is unknown.
    Letters for tops; shoes go in 1s; bottoms in EU 2s, except men's waist sizes in 1s."""
    s = str(size).upper()
    if s in TOP_SIZES:
        i = max(0, min(len(TOP_SIZES) - 1, TOP_SIZES.index(s) + by))
        return TOP_SIZES[i]
    try:
        n = float(size)
    except (TypeError, ValueError):
        return size
    gap = 2 if (kind == 'bottom' and gender != 'male') else 1
    out = n + by * gap
    return str(int(out)) if out.is_integer() else str(out)


def brand_of(product):
    """The label sizes are learned under: the brand, or the store for its own-label pieces."""
    return (product.brand or product.store or '').strip()


def learn(purchase):
    """Record the purchase's fit and update the brand size it teaches."""
    from .models import BrandSize
    kind = KIND_OF.get(purchase.category)
    if not (purchase.brand and kind and purchase.fit):
        return None
    if purchase.fit == 'perfect':
        size = purchase.size
    elif purchase.fit == 'too_small':
        size = step(purchase.size, +1, kind, purchase.user.gender)
    elif purchase.fit == 'too_big':
        size = step(purchase.size, -1, kind, purchase.user.gender)
    else:  # returned: no size lesson
        return None
    bs, _ = BrandSize.objects.update_or_create(user=purchase.user, brand=purchase.brand, kind=kind, defaults={'size': size})
    return bs


def record_fit(purchase, fit):
    purchase.fit = fit
    purchase.fit_at = timezone.now()
    purchase.save(update_fields=['fit', 'fit_at'])
    return learn(purchase)


# Review phrases that mean a brand runs small or large, in the app's languages.
RUNS_SMALL = ('runs small', 'size up', 'too small', 'tight', 'kiçik gəlir', 'dar gəlir', 'маломер', 'маленьк', 'küçük geliyor', 'dar kalıp', 'talla pequeña')
RUNS_LARGE = ('runs large', 'runs big', 'size down', 'too big', 'oversized fit', 'böyük gəlir', 'большемер', 'büyük geliyor', 'bol kalıp', 'talla grande')


def review_lean(texts):
    """+1 when reviews say the cut runs small, -1 large, 0 unclear."""
    small = sum(any(w in t.lower() for w in RUNS_SMALL) for t in texts)
    large = sum(any(w in t.lower() for w in RUNS_LARGE) for t in texts)
    if small >= 3 and small > 2 * large:
        return 1
    if large >= 3 and large > 2 * small:
        return -1
    return 0


def advise(user, product, review_texts=()):
    """{size, source: brand|profile, lean, note} for this product, or None when nothing is known."""
    from .models import BrandSize
    kind = KIND_OF.get(product.category)
    if not kind:
        return None
    lean = review_lean(review_texts)
    brand = brand_of(product)
    learned = BrandSize.objects.filter(user=user, brand=brand, kind=kind).first() if brand else None
    if learned:
        # Their own experience with the brand already includes how it runs.
        return {'size': learned.size, 'source': 'brand', 'lean': 0}
    usual = (user.sizes or {}).get(kind)
    if not usual:
        return None
    return {'size': step(usual, lean, kind, user.gender) if lean else usual, 'source': 'profile', 'lean': lean}
