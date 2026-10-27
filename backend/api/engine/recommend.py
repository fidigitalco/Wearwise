"""
Outfit suggestions (KB section 4, stages 9–13).

  candidates  slot templates filtered by hard constraints, never empty
  scoring     rule priors + personal taste (scoring.py)
  diversity   MMR so the three suggestions do not share a key piece
  explanation one grounded sentence from the top factors
"""
import random
from itertools import product

from ..taxonomy import OCCASIONS
from .harmony import relationship
from .scoring import score_outfit

MAX_CANDIDATES = 2000
PER_SLOT = 12  # pre-filter each slot to its best pieces before the product
KEY_SLOTS = ('top', 'bottom', 'dress')


class NotEnoughGarments(Exception):
    pass


def _by_category(garments):
    pool = {}
    for g in garments:
        pool.setdefault(g.category, []).append(g)
    return pool


def _occasion_fit(g, occasion):
    lo, hi = OCCASIONS.get(occasion, (1, 5))
    return 0 if lo <= g.formality <= hi else min(abs(g.formality - lo), abs(g.formality - hi))


def _shortlist(items, ctx, n=PER_SLOT):
    """Hard constraint: formality within one step of the band. Relax if that empties the slot."""
    ok = [g for g in items if _occasion_fit(g, ctx['occasion']) <= 1] or list(items)
    today = ctx['today']

    def pre(g):
        stale = 14 if not g.last_worn_at else min((today - g.last_worn_at).days, 14)
        return -_occasion_fit(g, ctx['occasion']) * 10 + stale

    ok.sort(key=pre, reverse=True)
    return ok[:n]


def needs_outerwear(ctx):
    t, p = ctx.get('temp_c'), ctx.get('precip_prob')
    return (t is not None and t < 14) or (p is not None and p >= 0.5)


def build_candidates(garments, ctx, rng):
    pool = _by_category(garments)
    sl = {cat: _shortlist(items, ctx) for cat, items in pool.items()}
    shoes = sl.get('shoes') or [None]

    outer_opts = sl.get('outerwear', [])
    t = ctx.get('temp_c')
    if t is not None and t > 25:
        # Hard constraint: no heavy layer in the heat.
        outer_opts = [g for g in outer_opts if g.warmth <= 1]
    outer = outer_opts if needs_outerwear(ctx) and outer_opts else [None] + outer_opts

    acc = [None] + sl.get('accessory', [])[:4]

    templates = []
    if sl.get('top') and sl.get('bottom'):
        templates.append((('top', sl['top']), ('bottom', sl['bottom'])))
    if sl.get('dress'):
        templates.append((('dress', sl['dress']),))
    if not templates:
        raise NotEnoughGarments('Add at least a top and a bottom, or a dress.')

    combos = []
    for tpl in templates:
        slots = [s for s, _ in tpl] + ['shoes', 'outerwear', 'accessory']
        lists = [items for _, items in tpl] + [shoes, outer, acc]
        for picks in product(*lists):
            combos.append({s: g for s, g in zip(slots, picks) if g is not None})
    if len(combos) > MAX_CANDIDATES:
        combos = rng.sample(combos, MAX_CANDIDATES)
    return combos


def _similarity(a, b):
    ga, gb = {g.id for g in a.values()}, {g.id for g in b.values()}
    jacc = len(ga & gb) / len(ga | gb)
    ka = {a[s].id for s in KEY_SLOTS if s in a}
    kb = {b[s].id for s in KEY_SLOTS if s in b}
    shared_key = 1.0 if ka & kb else 0.0
    return 0.6 * jacc + 0.4 * shared_key


def mmr(scored, k=3, lam=0.7):
    """Maximal marginal relevance over (outfit, scores) pairs, highest total first."""
    remaining = sorted(scored, key=lambda x: -x[1]['total'])[:300]
    chosen = []
    while remaining and len(chosen) < k:
        def gain(item):
            rel = item[1]['total'] / 100
            sim = max((_similarity(item[0], c[0]) for c in chosen), default=0)
            return lam * rel - (1 - lam) * sim
        best = max(remaining, key=gain)
        chosen.append(best)
        remaining.remove(best)
    return chosen


def _label(g):
    color = (g.primary_color or '').replace('_', ' ')
    kind = (g.subcategory or g.category).replace('_', ' ')
    return g.name or f'{color} {kind}'.strip()


def explain(outfit, scores, ctx):
    """One sentence, grounded only on the top-scoring factors."""
    parts = []
    body = [outfit[s] for s in ('top', 'dress', 'bottom') if s in outfit]
    if len(body) >= 2 and body[0].primary_color and body[1].primary_color:
        a, b = body[0].primary_color, body[1].primary_color
        rel = relationship(a, b)
        phrase = {
            'tonal': 'a tonal look that reads calm and long',
            'neutral': 'an easy neutral pairing',
            'neutral_base': f'lets the {a if a != b else b} do the talking over a neutral base',
            'analogous': 'neighbouring colours that blend smoothly',
            'complementary': 'a confident complementary contrast',
            'contrasting': 'a bold colour contrast',
        }[rel]
        parts.append((scores['color'], f"{_label(body[0]).capitalize()} with {_label(body[1])}: {phrase}"))

    outer = outfit.get('outerwear')
    p, t = ctx.get('precip_prob'), ctx.get('temp_c')
    if outer and outer.rain_ok and p is not None and p >= 0.5:
        parts.append((scores['weather'] + 5, f'the {_label(outer)} covers the {round(p * 100)}% rain chance'))
    elif t is not None:
        parts.append((scores['weather'], f'warm enough for {round(t)}°C' if t < 18 else f'light enough for {round(t)}°C'))

    occ = ctx['occasion'].replace('_', ' ')
    parts.append((scores['occasion'], f'right on the formality for {occ}'))
    if scores['rotation'] >= 90:
        parts.append((scores['rotation'] - 5, 'it brings back pieces you have not worn lately'))

    parts.sort(key=lambda x: -x[0])
    lead, *rest = [text for _, text in parts[:2]]
    sentence = lead + (f'; {rest[0]}' if rest else '')
    return sentence[0].upper() + sentence[1:] + '.'


def recommend(garments, ctx, pairs, taste, k=3, seed=None):
    rng = random.Random(seed)
    candidates = build_candidates(garments, ctx, rng)
    scored = [(o, score_outfit(o, ctx, pairs, taste)) for o in candidates]
    top = mmr(scored, k=k)
    return [
        {'outfit': o, 'scores': s, 'explanation': explain(o, s, ctx)}
        for o, s in top
    ]
