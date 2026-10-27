"""
Colour and material compatibility priors.

Heuristic scores (0–100) until stylist ratings land in ColorPair /
MaterialPair; a rated pair always wins over the heuristic.
"""
import math
from functools import lru_cache

from ..colors import rgb_to_lab
from ..taxonomy import COLORS, NEUTRALS

# Pairs the heuristic would get wrong either way.
_COLOR_OVERRIDES = {
    frozenset(['black', 'navy']): 60,
    frozenset(['black', 'brown']): 62,
    frozenset(['navy', 'charcoal']): 70,
    frozenset(['white', 'cream']): 58,  # near-white clash
    frozenset(['red', 'pink']): 42,
    frozenset(['red', 'orange']): 45,
    frozenset(['red', 'green']): 40,
    frozenset(['purple', 'orange']): 45,
    frozenset(['pink', 'orange']): 48,
    frozenset(['navy', 'beige']): 92,
    frozenset(['navy', 'white']): 92,
    frozenset(['navy', 'camel']): 90,
    frozenset(['olive', 'camel']): 86,
    frozenset(['burgundy', 'grey']): 86,
    frozenset(['light_blue', 'navy']): 88,
    frozenset(['yellow', 'navy']): 84,
}


@lru_cache(maxsize=None)
def _hue(name):
    L, a, b = rgb_to_lab(COLORS[name])
    return math.degrees(math.atan2(b, a)) % 360


def relationship(a, b):
    if a == b:
        return 'tonal'
    if a in NEUTRALS and b in NEUTRALS:
        return 'neutral'
    if a in NEUTRALS or b in NEUTRALS:
        return 'neutral_base'
    d = abs(_hue(a) - _hue(b))
    d = min(d, 360 - d)
    if d < 35:
        return 'analogous'
    if d > 145:
        return 'complementary'
    return 'contrasting'


def heuristic_color_score(a, b):
    key = frozenset([a, b])
    if key in _COLOR_OVERRIDES:
        return _COLOR_OVERRIDES[key]
    return {
        'tonal': 74 if a in NEUTRALS else 62,
        'neutral': 84,
        'neutral_base': 82,
        'analogous': 74,
        'complementary': 66,
        'contrasting': 54,
    }[relationship(a, b)]


class PairTable:
    """Rated pairs loaded once per request, falling back to the heuristic."""

    def __init__(self, color_rows=(), material_rows=()):
        self.colors = {frozenset([r.color_a, r.color_b]): r.score for r in color_rows}
        self.materials = {frozenset([r.material_a, r.material_b]): r.score for r in material_rows}

    def color(self, a, b):
        return self.colors.get(frozenset([a, b]), heuristic_color_score(a, b))

    def material(self, a, b):
        return self.materials.get(frozenset([a, b]))
