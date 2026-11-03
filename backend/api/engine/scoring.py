"""
Per-dimension outfit scores (0–100) and the weighted total (KB section 4,
stage 10–11). Every function takes an outfit as {slot: Garment}.
"""
import math
from itertools import combinations

from ..taxonomy import NEUTRALS, OCCASIONS

WEIGHTS = {
    'color': 0.22,
    'occasion': 0.18,
    'weather': 0.18,
    'silhouette': 0.10,
    'material': 0.08,
    'accessories': 0.04,
    'taste': 0.12,
    'rotation': 0.08,
}

# Body pieces count towards warmth; shoes and accessories barely do.
WARMTH_SLOTS = ('top', 'bottom', 'dress', 'outerwear')


def season_for(month, southern=False):
    s = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer',
         'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][month - 1]
    if southern:
        s = {'winter': 'summer', 'summer': 'winter', 'spring': 'autumn', 'autumn': 'spring'}[s]
    return s


def target_warmth(temp_c):
    """Total warmth points the body pieces should add up to at this temperature."""
    if temp_c is None:
        return None
    return max(1.0, min(10.0, (26 - temp_c) / 2.6 + 1))


def colors_of(outfit):
    return [g.primary_color for g in outfit.values() if g.primary_color]


# Colours the user picked as favourites in Settings: a small nudge, capped so
# a palette never wins on favourites alone.
FAVORITE_BONUS, FAVORITE_CAP = 3, 6


def score_color(outfit, pairs, taste, favorites=()):
    names = colors_of(outfit)
    if len(names) < 2:
        return 75.0
    pair_scores = [pairs.color(a, b) for a, b in combinations(names, 2)]
    s = sum(pair_scores) / len(pair_scores)
    chromatic = {n for n in names if n not in NEUTRALS}
    if len(chromatic) > 2:  # more than one accent plus a base reads busy
        s -= 12 * (len(chromatic) - 2)
    patterned = [g for g in outfit.values() if g.pattern != 'solid']
    if len(patterned) > 1:
        s -= 10 * (len(patterned) - 1)
    s += 4 * len(set(names) & set(taste.liked_colors)) - 8 * len(set(names) & set(taste.disliked_colors))
    fav = (set(names) & set(favorites)) - set(taste.liked_colors)  # liked colours already counted
    s += min(FAVORITE_CAP, FAVORITE_BONUS * len(fav))
    return _clamp(s)


def score_occasion(outfit, occasion):
    lo, hi = OCCASIONS.get(occasion, (1, 5))
    s = 100.0
    forms = []
    for slot, g in outfit.items():
        forms.append(g.formality)
        if g.formality < lo:
            s -= 22 * (lo - g.formality) * (0.5 if slot in ('accessory', 'bag') else 1)
        elif g.formality > hi:
            s -= 14 * (g.formality - hi) * (0.5 if slot in ('accessory', 'bag') else 1)
    if forms and max(forms) - min(forms) > 2:
        s -= 10 * (max(forms) - min(forms) - 2)
    if occasion in {t for g in outfit.values() for t in g.occasion_tags}:
        s += 5
    return _clamp(s)


def score_weather(outfit, temp_c, precip_prob, season):
    s = 100.0
    target = target_warmth(temp_c)
    if target is not None:
        warmth = sum(g.warmth for slot, g in outfit.items() if slot in WARMTH_SLOTS)
        s -= 11 * abs(warmth - target)
    if precip_prob is not None and precip_prob >= 0.5:
        outer = outfit.get('outerwear')
        if not (outer and outer.rain_ok):
            s -= 30
        shoes = outfit.get('shoes')
        if shoes and (shoes.subcategory in ('sandals', 'heels') or 'suede' in str(shoes.material.get('value', ''))):
            s -= 12
    off_season = sum(1 for g in outfit.values() if g.season and season not in g.season)
    s -= 6 * off_season
    return _clamp(s)


_FIT_PAIRS = {
    ('oversized', 'oversized'): 60, ('oversized', 'relaxed'): 70, ('oversized', 'regular'): 84,
    ('oversized', 'slim'): 90, ('relaxed', 'relaxed'): 74, ('relaxed', 'regular'): 84,
    ('relaxed', 'slim'): 86, ('regular', 'regular'): 82, ('regular', 'slim'): 84, ('slim', 'slim'): 76,
}


def score_silhouette(outfit):
    if 'dress' in outfit:
        s = 84.0
    else:
        top, bottom = outfit.get('top'), outfit.get('bottom')
        if not (top and bottom):
            return 70.0
        s = float(_FIT_PAIRS.get(tuple(sorted([top.fit, bottom.fit])), 78))
    outer = outfit.get('outerwear')
    if outer and outer.fit == 'slim' and outfit.get('top') and outfit['top'].fit == 'oversized':
        s -= 15
    return _clamp(s)


def score_material(outfit, pairs):
    pieces = list(outfit.values())
    s = 80.0
    shiny = sum(1 for g in pieces if g.sheen == 'high')
    if shiny > 1:
        s -= 15 * (shiny - 1)
    surfaces = {g.surface for g in pieces}
    if len(surfaces) >= 2:  # a texture contrast reads intentional
        s += 6
    rated = []
    mats = [g.material.get('value') for g in pieces if g.material.get('value')]
    for a, b in combinations(mats, 2):
        r = pairs.material(a, b)
        if r is not None:
            rated.append(r)
    if rated:
        s = 0.5 * s + 0.5 * (sum(rated) / len(rated))
    return _clamp(s)


def score_accessories(outfit):
    acc = outfit.get('accessory')
    if not acc:
        return 70.0
    others = {g.primary_color for slot, g in outfit.items() if slot != 'accessory'}
    return 88.0 if acc.primary_color in others or acc.primary_color in NEUTRALS else 76.0


def score_taste(outfit, taste):
    w = taste.weights or {}
    if not w:
        return 60.0
    s = 0.0
    for g in outfit.values():
        s += w.get(f'g:{g.id}', 0) + 0.5 * w.get(f'c:{g.primary_color}', 0) + 0.3 * w.get(f'p:{g.pattern}', 0)
    for a, b in combinations(sorted(set(colors_of(outfit))), 2):
        s += 0.5 * w.get(f'cp:{a}|{b}', 0)
    return _clamp(60 + 40 * math.tanh(s / 3))


# Where each everyday style (Settings) sits on the 1–5 formality scale.
STYLE_FORMALITY = {
    'casual': 2.0, 'smart_casual': 3.0, 'business': 4.0, 'formal': 4.5,
    'sporty': 1.5, 'streetwear': 2.0, 'minimal': 3.0, 'classic': 3.5, 'bohemian': 2.5,
}


def style_bonus(outfit, style):
    """A nudge (−10…+10) towards the user's everyday style; the occasion still rules."""
    center = STYLE_FORMALITY.get(style)
    if center is None:
        return 0.0
    body = [g for slot, g in outfit.items() if slot in WARMTH_SLOTS] or list(outfit.values())
    mean = sum(g.formality for g in body) / len(body)
    b = 6 - 5 * abs(mean - center)
    if style == 'minimal':
        plain = all(g.pattern == 'solid' for g in outfit.values())
        neutral = all((g.primary_color or 'black') in NEUTRALS for g in outfit.values())
        b += 4 if plain and neutral else -2
    elif style == 'streetwear':
        b += 4 if any(g.fit in ('oversized', 'relaxed') for s, g in outfit.items() if s in ('top', 'outerwear')) else 0
    elif style == 'sporty':
        shoes = outfit.get('shoes')
        b += 4 if shoes and shoes.subcategory == 'sneakers' else 0
    return max(-10.0, min(10.0, b))


def score_rotation(outfit, today):
    vals = []
    for g in outfit.values():
        if not g.last_worn_at:
            vals.append(100.0)
        else:
            days = (today - g.last_worn_at).days
            vals.append(100.0 * min(max(days, 0), 14) / 14)
    return sum(vals) / len(vals) if vals else 50.0


def score_outfit(outfit, ctx, pairs, taste):
    scores = {
        'color': score_color(outfit, pairs, taste, ctx.get('favorite_colors') or ()),
        'occasion': score_occasion(outfit, ctx['occasion']),
        'weather': score_weather(outfit, ctx.get('temp_c'), ctx.get('precip_prob'), ctx['season']),
        'silhouette': score_silhouette(outfit),
        'material': score_material(outfit, pairs),
        'accessories': score_accessories(outfit),
        'taste': _clamp(score_taste(outfit, taste) + style_bonus(outfit, ctx.get('style'))),
        'rotation': score_rotation(outfit, ctx['today']),
    }
    scores = {k: round(v) for k, v in scores.items()}
    scores['total'] = round(sum(WEIGHTS[k] * scores[k] for k in WEIGHTS), 1)
    return scores


def _clamp(v):
    return max(0.0, min(100.0, v))
