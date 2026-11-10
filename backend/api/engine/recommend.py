"""
Outfit suggestions (KB section 4, stages 9–13).

  candidates  slot templates filtered by hard constraints, never empty;
              optionally built around one fixed piece
  scoring     rule priors + personal taste (scoring.py)
  diversity   MMR so the three suggestions do not share a key piece
  explanation one grounded sentence from the top factors
"""
import random
from itertools import product

from ..locale import name, norm, say
from ..taxonomy import COLOR_AZ, KIND_AZ, NEUTRALS, OCCASION_AZ, OCCASIONS
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


def build_candidates(garments, ctx, rng, fixed=None):
    """All outfit combinations worth scoring; with `fixed`, only those that wear that piece."""
    pool = _by_category(garments)
    sl = {cat: _shortlist(items, ctx) for cat, items in pool.items()}
    if fixed is not None:
        # The chosen piece skips the formality and heat filters: the user asked for it.
        sl[fixed.category] = [fixed]
    shoes = sl.get('shoes') or [None]

    outer_opts = sl.get('outerwear', [])
    t = ctx.get('temp_c')
    if t is not None and t > 25 and not (fixed is not None and fixed.category == 'outerwear'):
        # Hard constraint: no heavy layer in the heat.
        outer_opts = [g for g in outer_opts if g.warmth <= 1]
    outer = outer_opts if needs_outerwear(ctx) and outer_opts else [None] + outer_opts
    if fixed is not None and fixed.category == 'outerwear':
        outer = [fixed]

    acc = [fixed] if fixed is not None and fixed.category == 'accessory' else [None] + sl.get('accessory', [])[:4]
    extra = [('bag', [fixed])] if fixed is not None and fixed.category == 'bag' else []

    templates = []
    if sl.get('top') and sl.get('bottom'):
        templates.append((('top', sl['top']), ('bottom', sl['bottom'])))
    if sl.get('dress'):
        templates.append((('dress', sl['dress']),))
    if fixed is not None and fixed.category in KEY_SLOTS:
        templates = [tpl for tpl in templates if fixed.category in [s for s, _ in tpl]]
    if not templates:
        raise NotEnoughGarments('Add at least a top and a bottom, or a dress.')

    combos = []
    for tpl in templates:
        slots = [s for s, _ in tpl] + ['shoes', 'outerwear', 'accessory'] + [s for s, _ in extra]
        lists = [items for _, items in tpl] + [shoes, outer, acc] + [items for _, items in extra]
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


def _label(g, lang):
    if g.name:
        return g.name
    color = name(lang, 'colors', g.primary_color, COLOR_AZ) if g.primary_color else ''
    kind = name(lang, 'kinds', g.subcategory or g.category, KIND_AZ)
    return say(lang, '{color} {kind}', '{color} {kind}', color=color, kind=kind).strip()


def _lower_first(text):
    return text[:1].lower() + text[1:]


_COLOR_PHRASES = {
    'en': {
        'tonal': 'a tonal look that reads calm and long',
        'neutral': 'an easy neutral pairing',
        'neutral_base': 'lets the {accent} do the talking over a neutral base',
        'analogous': 'neighbouring colours that blend smoothly',
        'complementary': 'a confident complementary contrast',
        'contrasting': 'a bold colour contrast',
    },
    'az': {
        'tonal': 'eyni rəngin çalarları sakit və bütöv görünür',
        'neutral': 'sadə neytral uyğunluq',
        'neutral_base': 'neytral fonda {accent} rəng önə çıxır',
        'analogous': 'bir-birinə yaxın rənglər yumşaq keçid yaradır',
        'complementary': 'bir-birini tamamlayan cəsarətli kontrast',
        'contrasting': 'cəsarətli rəng təzadı',
    },
}


def explain(outfit, scores, ctx):
    """One sentence, grounded only on the top-scoring factors, in the app's language."""
    lang = norm(ctx.get('lang'))
    parts = []
    body = [outfit[s] for s in ('top', 'dress', 'bottom') if s in outfit]
    if len(body) >= 2 and body[0].primary_color and body[1].primary_color:
        a, b = body[0].primary_color, body[1].primary_color
        rel = relationship(a, b)
        accent = b if a in NEUTRALS else a
        accent_name = name(lang, 'colors', accent, COLOR_AZ)
        phrase = (_COLOR_PHRASES['az'][rel] if lang == 'az' else say(lang, _COLOR_PHRASES['en'][rel])).format(accent=accent_name)
        first, second = _label(body[0], lang), _lower_first(_label(body[1], lang))
        parts.append((scores['color'], say(lang, '{first} with {second}: {phrase}', '{first} və {second}: {phrase}',
                                           first=first, second=second, phrase=phrase)))

    outer = outfit.get('outerwear')
    p, t = ctx.get('precip_prob'), ctx.get('temp_c')
    if outer and outer.rain_ok and p is not None and p >= 0.5:
        parts.append((scores['weather'] + 5, say(lang, 'the {outer} covers the {pct}% rain chance',
                                                 '{pct}% yağış ehtimalı var, {outer} səni qoruyacaq',
                                                 outer=_lower_first(_label(outer, lang)), pct=round(p * 100))))
    elif t is not None:
        deg = round(t)
        text = (say(lang, 'warm enough for {deg}°C', '{deg}°C üçün kifayət qədər istidir', deg=deg) if t < 18
                else say(lang, 'light enough for {deg}°C', '{deg}°C üçün kifayət qədər yüngüldür', deg=deg))
        parts.append((scores['weather'], text))

    occ = ctx['occasion']
    parts.append((scores['occasion'], say(lang, 'right on the formality for {occasion}', 'rəsmilik səviyyəsi {occasion} üçün tam uyğundur',
                                          occasion=name(lang, 'occasions', occ, OCCASION_AZ))))
    if scores['rotation'] >= 90:
        parts.append((scores['rotation'] - 5, say(lang, 'it brings back pieces you have not worn lately',
                                                  'çoxdan geyinmədiyin paltarlara da yenidən şans verir')))

    parts.sort(key=lambda x: -x[0])
    lead, *rest = [text for _, text in parts[:2]]
    sentence = lead + (f'; {rest[0]}' if rest else '')
    return sentence[0].upper() + sentence[1:] + '.'


def combo_key(outfit):
    """An outfit's identity for "already suggested": the set of its garment ids."""
    return frozenset(g.id for g in outfit.values())


def recommend(garments, ctx, pairs, taste, k=3, seed=None, exclude=(), fixed_garment_id=None):
    """
    Top-k diverse outfits. `exclude` holds combo_keys already shown today; they
    are only used to top up when too few new looks remain. `fixed_garment_id`
    builds every look around that piece.
    """
    rng = random.Random(seed)
    fixed = None
    if fixed_garment_id is not None:
        fixed = next((g for g in garments if g.id == fixed_garment_id), None)
        if fixed is None:
            raise NotEnoughGarments('That piece is not in the closet.')
    candidates = build_candidates(garments, ctx, rng, fixed=fixed)
    scored = [(o, score_outfit(o, ctx, pairs, taste)) for o in candidates]
    seen = set(exclude)
    fresh = [x for x in scored if combo_key(x[0]) not in seen]
    top = mmr(fresh, k=k)
    if len(top) < k:
        # Nothing (or too little) new left: allow repeats rather than come back empty.
        top += mmr([x for x in scored if combo_key(x[0]) in seen], k=k - len(top))
    return [
        {'outfit': o, 'scores': s, 'explanation': explain(o, s, ctx)}
        for o, s in top
    ]
