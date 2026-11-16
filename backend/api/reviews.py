"""
Review authenticity (build prompt §4.3): a verified rating next to the store's.

`analyse(reviews)` takes the reviews a feed or API returns
([{rating, text, date}]) and looks for four signs of fake reviews:
  - bursts: many 5★ reviews on the same few days,
  - near-duplicate texts,
  - stars that disagree with the words (5★ with complaints, 1★ with praise),
  - an unusually high share of very short 5★ reviews.
Suspicious reviews are down-weighted in the verified rating; a product with
enough signs is flagged, and the smart search funnel removes flagged products.

None of today's sources give review texts (the demo catalogue has none), so this
runs when a store feed that includes reviews is connected.
"""
import re
from collections import Counter
from datetime import date, datetime
from difflib import SequenceMatcher

POSITIVE = ('great', 'love', 'perfect', 'excellent', 'amazing', 'good quality', 'əla', 'gözəl', 'super', 'отлич', 'прекрасн', 'harika', 'mükemmel', 'excelente', 'genial')
NEGATIVE = ('bad', 'poor', 'broke', 'cheap material', 'terrible', 'returned', 'disappoint', 'pis', 'keyfiyyətsiz', 'плох', 'ужас', 'kötü', 'berbat', 'malo', 'horrible')

MIN_REVIEWS = 8


def _day(d):
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    try:
        return datetime.fromisoformat(str(d)[:10]).date()
    except ValueError:
        return None


def _sentiment(text):
    t = (text or '').lower()
    return sum(w in t for w in POSITIVE) - sum(w in t for w in NEGATIVE)


def _norm(text):
    return re.sub(r'\W+', ' ', (text or '').lower()).strip()


def analyse(reviews):
    """→ {verified_rating, suspicious, signals: [..], weights} or None when there are too few reviews to judge."""
    reviews = [r for r in reviews if r.get('rating') is not None]
    n = len(reviews)
    if n < MIN_REVIEWS:
        return None
    weight = [1.0] * n
    signals = []

    # 1. Bursts: a single day holding a big share of all 5★ reviews.
    fives = [i for i, r in enumerate(reviews) if r['rating'] >= 5]
    days = Counter(_day(reviews[i].get('date')) for i in fives if _day(reviews[i].get('date')))
    burst_days = {d for d, c in days.items() if c >= max(5, 0.3 * len(fives))}
    if burst_days:
        signals.append('burst')
        for i in fives:
            if _day(reviews[i].get('date')) in burst_days:
                weight[i] *= 0.4

    # 2. Near-duplicate texts (copy-paste or templated reviews).
    texts = [_norm(r.get('text')) for r in reviews]
    dupes = set()
    for i in range(n):
        if len(texts[i]) < 15:
            continue
        for j in range(i + 1, n):
            if len(texts[j]) >= 15 and SequenceMatcher(None, texts[i], texts[j]).ratio() > 0.9:
                dupes.update((i, j))
    if len(dupes) >= max(3, 0.15 * n):
        signals.append('duplicates')
    for i in dupes:
        weight[i] *= 0.3

    # 3. Stars that disagree with the words.
    mismatch = [i for i, r in enumerate(reviews)
                if (r['rating'] >= 4 and _sentiment(r.get('text')) <= -1) or (r['rating'] <= 2 and _sentiment(r.get('text')) >= 1)]
    if len(mismatch) >= max(3, 0.15 * n):
        signals.append('rating_text_gap')
    for i in mismatch:
        if reviews[i]['rating'] >= 4:
            weight[i] *= 0.5

    # 4. Many very short 5★ reviews ("Good", "👍").
    short = [i for i in fives if len(texts[i].split()) <= 3]
    if fives and len(short) / n > 0.5:
        signals.append('short_five_stars')
        for i in short:
            weight[i] *= 0.6

    total = sum(weight)
    verified = round(sum(w * r['rating'] for w, r in zip(weight, reviews)) / total, 2) if total else None
    return {'verified_rating': verified, 'suspicious': len(signals) >= 2, 'signals': signals}


def apply(product, reviews):
    """Store the verified rating and the flag on the product."""
    out = analyse(reviews)
    if out is None:
        return None
    product.verified_rating = out['verified_rating']
    product.suspicious_reviews = out['suspicious']
    product.save(update_fields=['verified_rating', 'suspicious_reviews'])
    return out
