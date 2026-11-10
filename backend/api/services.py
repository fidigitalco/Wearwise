"""
Request-independent steps shared by the views and the stylist assistant:
building the scoring context, saving outfits and sets, and logging wears.
"""
from datetime import date

from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone

from .engine.describe import reasons_for, title_for, titles_for
from .engine.harmony import PairTable
from .engine.recommend import explain, recommend
from .engine.scoring import season_for
from .engine.taste import update_taste
from .models import ColorPair, Feedback, Garment, MaterialPair, Outfit, OutfitItem, OutfitSet, TasteProfile, WearLog
from .weather import forecast


def build_context(user, data, lang='en'):
    """The scoring context for a request: occasion, day, season, weather and the user's style."""
    day = data.get('date') or timezone.localdate()
    lat = data.get('latitude', user.latitude)
    lon = data.get('longitude', user.longitude)
    ctx = {
        'occasion': data['occasion'],
        'today': day,
        'season': season_for(day.month, southern=bool(lat is not None and lat < 0)),
        'temp_c': data.get('temp_c'),
        'precip_prob': data.get('precip_prob'),
        # A one-off style filter from the Outfits screen wins over the saved preference.
        'style': data.get('style') or user.style_direction,
        'favorite_colors': list(user.favorite_colors or []),
        'avoid_colors': list(user.avoid_colors or []),
        'fit_preference': user.fit_preferences or ([user.fit_preference] if user.fit_preference else []),
        'lang': lang,
    }
    if (ctx['temp_c'] is None or ctx['precip_prob'] is None) and lat is not None and lon is not None:
        wx = forecast(lat, lon, day)
        if wx:
            ctx['temp_c'] = ctx['temp_c'] if ctx['temp_c'] is not None else wx['temp_c']
            ctx['precip_prob'] = ctx['precip_prob'] if ctx['precip_prob'] is not None else wx['precip_prob']
            ctx['weather'] = wx
            ctx['wind_kmh'] = wx.get('wind_kmh', 0)
            ctx['snow_cm'] = wx.get('snow_cm', 0)
    return ctx


def stored_context(outfit, user, lang):
    """The scoring context an outfit was suggested in, rebuilt from what was saved with it."""
    c = outfit.context or {}
    day = date.fromisoformat(c['date']) if c.get('date') else timezone.localdate()
    return {
        'occasion': c.get('occasion', 'casual'),
        'today': day,
        'season': c.get('season') or season_for(day.month),
        'temp_c': c.get('temp_c'),
        'precip_prob': c.get('precip_prob'),
        'style': c.get('style') or user.style_direction,
        'favorite_colors': list(user.favorite_colors or []),
        'avoid_colors': list(user.avoid_colors or []),
        'fit_preference': user.fit_preferences or ([user.fit_preference] if user.fit_preference else []),
        'lang': lang,
    }


def public_context(ctx):
    out = {k: v for k, v in ctx.items() if k not in ('today', 'lang', 'favorite_colors', 'avoid_colors', 'fit_preference')}
    out['date'] = ctx['today'].isoformat()
    return out


def pairs():
    return PairTable(ColorPair.objects.all(), MaterialPair.objects.all())


def taste_for(user):
    taste, _ = TasteProfile.objects.get_or_create(user=user)
    return taste


def outfit_qs():
    return Outfit.objects.prefetch_related(Prefetch('items', queryset=OutfitItem.objects.select_related('garment')))


def outfit_set_qs():
    return OutfitSet.objects.prefetch_related(Prefetch('outfits', queryset=outfit_qs()))


def palette_of(outfit):
    return list(dict.fromkeys(g.primary_color for g in outfit.values() if g.primary_color))


def materials_of(outfit):
    return [g.material.get('value') for g in outfit.values() if g.material.get('value')]


def describe(outfit, scores, ctx, title=None, taken=()):
    """Explanation, title and reasons for a scored outfit, in the context's language."""
    return {
        'explanation': explain(outfit, scores, ctx),
        'title': title or title_for(outfit, ctx, taken),
        'reasons': reasons_for(outfit, scores, ctx),
    }


def save_outfit(user, outfit, scores, ctx, outfit_set=None, position=0, saved=False, title=None):
    o = Outfit.objects.create(
        user=user,
        outfit_set=outfit_set,
        palette=palette_of(outfit),
        materials=materials_of(outfit),
        context=public_context(ctx),
        style_direction=user.style_direction,
        scores=scores,
        total_score=scores['total'],
        position=position,
        saved=saved,
        **describe(outfit, scores, ctx, title=title),
    )
    OutfitItem.objects.bulk_create([OutfitItem(outfit=o, garment=g, slot=slot) for slot, g in outfit.items()])
    return o


def seen_combos(user, day, occasion):
    """Garment-id sets already suggested to the user for this day and occasion."""
    seen = set()
    outfits = outfit_qs().filter(user=user, outfit_set__date=day, outfit_set__occasion=occasion)
    for o in outfits:
        seen.add(frozenset(i.garment_id for i in o.items.all()))
    return seen


def recommend_set(user, ctx, source='recommend', fixed_garment_id=None, k=3):
    """
    Score the user's closet, save the top looks as one OutfitSet and return it.
    Looks already suggested for the same day and occasion are skipped while new
    ones remain. Raises NotEnoughGarments.
    """
    garments = list(Garment.objects.filter(user=user, status='available'))
    exclude = seen_combos(user, ctx['today'], ctx['occasion'])
    results = recommend(
        garments, ctx, pairs(), taste_for(user), k=k, exclude=exclude, fixed_garment_id=fixed_garment_id,
    )
    titles = titles_for([r['outfit'] for r in results], ctx)
    with transaction.atomic():
        oset = OutfitSet.objects.create(
            user=user, date=ctx['today'], occasion=ctx['occasion'], context=public_context(ctx), source=source,
        )
        for i, (r, title) in enumerate(zip(results, titles)):
            save_outfit(user, r['outfit'], r['scores'], ctx, outfit_set=oset, position=i, title=title)
    return outfit_set_qs().get(pk=oset.pk)


def log_wear(user, outfit, worn_on):
    """Rotation counters, wear log and a "wore it" feedback signal for one outfit."""
    garments = list(outfit.garments.all())
    with transaction.atomic():
        log = WearLog.objects.create(user=user, outfit=outfit, worn_on=worn_on)
        log.garments.set(garments)
        for g in garments:
            g.times_worn += 1
            if not g.last_worn_at or worn_on > g.last_worn_at:
                g.last_worn_at = worn_on
        Garment.objects.bulk_update(garments, ['times_worn', 'last_worn_at'])
        fb = Feedback.objects.create(
            user=user, outfit=outfit, outfit_set=outfit.outfit_set, worn=True,
            rank=outfit.position + 1 if outfit.outfit_set_id else None, context=outfit.context,
        )
        update_taste(taste_for(user), fb, {g.id: g for g in garments})
    return log
