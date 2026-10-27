"""
Personal preference learning from feedback (KB section 4, stage 11).

A light online update of additive affinities — enough for cold start and the
first weeks. The global ranker trained on aggregated feedback replaces this
later.
"""
from itertools import combinations

LR = 0.4
CLIP = 6.0


def _bump(w, key, delta):
    w[key] = max(-CLIP, min(CLIP, w.get(key, 0.0) + delta))


def _apply(w, garments, delta):
    colors = sorted({g.primary_color for g in garments if g.primary_color})
    for g in garments:
        _bump(w, f'g:{g.id}', delta)
        if g.primary_color:
            _bump(w, f'c:{g.primary_color}', delta * 0.5)
        _bump(w, f'p:{g.pattern}', delta * 0.3)
    for a, b in combinations(colors, 2):
        _bump(w, f'cp:{a}|{b}', delta * 0.5)


def signal(feedback):
    """How strongly this feedback says "more like this" (+) or "less" (−)."""
    s = 0.0
    if feedback.liked is True:
        s += 1.0
    elif feedback.liked is False:
        s -= 1.0
    if feedback.rank == 1:
        s += 0.6
    elif feedback.rank and feedback.rank >= 3:
        s -= 0.3
    if feedback.worn:
        s += 1.2
    if feedback.rejection_reason:
        s -= 0.6
    return s


def update_taste(taste, feedback, garments_by_id):
    w = dict(taste.weights or {})
    outfit_garments = list(feedback.outfit.garments.all())
    s = signal(feedback)
    if s:
        _apply(w, outfit_garments, LR * s)
    for gid in feedback.removed_garment_ids or []:
        if gid in garments_by_id:
            _bump(w, f'g:{gid}', -LR)
    for swap in feedback.replaced or []:
        if swap.get('from') in garments_by_id:
            _bump(w, f"g:{swap['from']}", -LR)
        if swap.get('to') in garments_by_id:
            _bump(w, f"g:{swap['to']}", LR)
    taste.weights = w
    taste.save(update_fields=['weights', 'updated_at'])
