"""
Editorial copy for an outfit card: a short title and the "Why this outfit
works" sentences, in the app's language.

Everything here is derived from the outfit, its scores and the context it was
scored in — weather is only mentioned when the context actually has it.
"""
from ..taxonomy import COLOR_AZ, KIND_AZ, NEUTRALS, OCCASION_AZ, STYLE_AZ
from .harmony import relationship
from .recommend import _label, needs_outerwear
from .scoring import WARMTH_SLOTS, style_bonus, target_warmth

# (full title, core used when a colour prefix is needed to tell titles apart)
_TITLES = {
    'rain': {'en': ('Rainy Day Layers', 'Rain Layers'), 'az': ('Yağışlı gün qatları', 'yağış qatları')},
    'sport': {'en': ('Active Day', 'Active Look'), 'az': ('Aktiv gün', 'aktiv obraz')},
    'travel': {'en': ('Easy Travel', 'Travel Look'), 'az': ('Rahat səyahət', 'səyahət obrazı')},
    'evening_classic': {'en': ('Evening Classic', 'Evening Classic'), 'az': ('Axşam klassikası', 'axşam klassikası')},
    'evening_out': {'en': ('Evening Out', 'Evening Look'), 'az': ('Axşam çıxışı', 'axşam obrazı')},
    'meeting': {'en': ('Polished Meeting Look', 'Meeting Look'), 'az': ('Səliqəli görüş obrazı', 'görüş obrazı')},
    'office': {'en': ('Modern Office Look', 'Office Look'), 'az': ('Müasir ofis obrazı', 'ofis obrazı')},
    'smart_casual': {'en': ('Effortless Smart Casual', 'Smart Casual'), 'az': ('Rahat smart casual', 'smart casual')},
    'minimal': {'en': ('Minimal Weekend', 'Minimal Look'), 'az': ('Minimal həftəsonu', 'minimal obraz')},
    'everyday': {'en': ('Relaxed Everyday', 'Everyday Look'), 'az': ('Rahat gündəlik', 'gündəlik obraz')},
}


def _lang(ctx):
    return 'az' if ctx.get('lang') == 'az' else 'en'


def _cap(text):
    """Capitalise the first letter, with the Azerbaijani dotted İ."""
    if not text:
        return text
    first = 'İ' if text[0] == 'i' else text[0].upper()
    return first + text[1:]


def color_name(name, lang):
    return COLOR_AZ.get(name, name) if lang == 'az' else name.replace('_', ' ')


def kind_name(key, lang):
    return KIND_AZ.get(key, key) if lang == 'az' else key.replace('_', ' ')


def style_name(key, lang):
    return STYLE_AZ.get(key, key) if lang == 'az' else key.replace('_', ' ').title()


# How an occasion reads mid-sentence in English ("right for a date").
OCCASION_EN = {
    'casual': 'everyday wear', 'work': 'work', 'client_meeting': 'a client meeting', 'date': 'a date',
    'party': 'a party', 'formal': 'a formal event', 'sport': 'sport', 'travel': 'travel',
}


def occasion_name(key, lang):
    return OCCASION_AZ.get(key, key) if lang == 'az' else OCCASION_EN.get(key, key.replace('_', ' '))


def _mean_formality(outfit):
    body = [g for slot, g in outfit.items() if slot in WARMTH_SLOTS] or list(outfit.values())
    return sum(g.formality for g in body) / len(body)


def _quiet_palette(outfit):
    return all(g.pattern == 'solid' for g in outfit.values()) and all(
        (g.primary_color or 'black') in NEUTRALS for g in outfit.values())


def title_key(outfit, ctx):
    occ = ctx.get('occasion')
    p = ctx.get('precip_prob')
    outer = outfit.get('outerwear')
    if p is not None and p >= 0.5 and outer and outer.rain_ok:
        return 'rain'
    if occ == 'sport':
        return 'sport'
    if occ == 'travel':
        return 'travel'
    mean = _mean_formality(outfit)
    if occ == 'formal' or (occ in ('date', 'party') and mean >= 3.5):
        return 'evening_classic'
    if occ in ('date', 'party'):
        return 'evening_out'
    if occ == 'client_meeting':
        return 'meeting'
    if occ == 'work':
        return 'office' if mean >= 3.5 else 'smart_casual'
    if _quiet_palette(outfit):
        return 'minimal'
    return 'smart_casual' if mean >= 2.5 else 'everyday'


def _lead_colors(outfit):
    order = ('top', 'dress', 'outerwear', 'bottom', 'shoes')
    seen = []
    for slot in order:
        g = outfit.get(slot)
        if g and g.primary_color and g.primary_color not in seen:
            seen.append(g.primary_color)
    return seen


def title_for(outfit, ctx, taken=()):
    """A title not already in `taken`: the plain one, else colour-prefixed, else numbered."""
    lang = _lang(ctx)
    full, core = _TITLES[title_key(outfit, ctx)][lang]
    if full not in taken:
        return full
    for c in _lead_colors(outfit):
        name = color_name(c, lang)
        t = f'{name.title()} {core}' if lang == 'en' else _cap(f'{name} {core}')
        if t not in taken:
            return t
    n = 2
    while f'{full} {n}' in taken:
        n += 1
    return f'{full} {n}'


def titles_for(outfits, ctx):
    """Distinct titles for one recommendation set, in order."""
    out = []
    for o in outfits:
        out.append(title_for(o, ctx, taken=out))
    return out


_COLOR_REASONS = {
    'en': {
        'tonal': 'Tonal {a} pieces keep the look calm and cohesive.',
        'neutral': '{A} and {b} create a balanced, versatile palette.',
        'neutral_base': 'The {base} base lets the {accent} stand out without clashing.',
        'analogous': '{A} and {b} sit close on the colour wheel, so they blend smoothly.',
        'complementary': '{A} and {b} are complementary colours, a confident contrast.',
        'contrasting': '{A} and {b} make a bold, deliberate contrast.',
    },
    'az': {
        'tonal': 'Eyni {a} çalarları obrazı sakit və bütöv göstərir.',
        'neutral': '{A} və {b} balanslı, universal palitra yaradır.',
        'neutral_base': '{Base} fon {accent} rəngi uyğunsuzluq yaratmadan önə çıxarır.',
        'analogous': '{A} və {b} rəng çarxında yaxındır, ona görə yumşaq birləşir.',
        'complementary': '{A} və {b} bir-birini tamamlayan rənglərdir, cəsarətli kontrast yaradır.',
        'contrasting': '{A} və {b} cəsarətli, düşünülmüş kontrast yaradır.',
    },
}

_TEXT = {
    'en': {
        'rain': 'The {outer} covers the {pct}% chance of rain.',
        'outer_temp': 'The {outer} is the right layer for {deg}°C.',
        'light_temp': 'Light, breathable pieces suit {deg}°C.',
        'warm_temp': 'The layers add up to the right warmth for {deg}°C.',
        'style': 'These pieces match your {style} preference.',
        'occasion': 'The formality is right for {occasion}.',
        'rotation': 'It brings back pieces you have not worn lately.',
        'silhouette': 'The fits balance each other for a clean silhouette.',
    },
    'az': {
        'rain': '{outer} {pct}% yağış ehtimalına qarşı qoruyur.',
        'outer_temp': '{outer} {deg}°C üçün düzgün üst qatdır.',
        'light_temp': 'Yüngül, nəfəs alan geyimlər {deg}°C üçün uyğundur.',
        'warm_temp': 'Qatlar birlikdə {deg}°C üçün lazım olan istiliyi verir.',
        'style': 'Bu geyimlər sənin {style} üslubuna uyğundur.',
        'occasion': 'Rəsmilik səviyyəsi {occasion} üçün tam uyğundur.',
        'rotation': 'Çoxdan geyinmədiyin paltarları yenidən ortaya çıxarır.',
        'silhouette': 'Kəsimlər bir-birini tamamlayır, siluet səliqəli görünür.',
    },
}


def _color_reason(outfit, lang):
    body = [outfit[s] for s in ('top', 'dress', 'bottom', 'outerwear') if s in outfit and outfit[s].primary_color]
    if len(body) < 2:
        return None
    a, b = body[0].primary_color, body[1].primary_color
    rel = relationship(a, b)
    base, accent = (a, b) if a in NEUTRALS else (b, a)
    an, bn = color_name(a, lang), color_name(b, lang)
    return _COLOR_REASONS[lang][rel].format(
        a=an, A=_cap(an), b=bn, base=color_name(base, lang), Base=_cap(color_name(base, lang)),
        accent=color_name(accent, lang),
    )


def _weather_reason(outfit, ctx, scores, lang):
    t, p = ctx.get('temp_c'), ctx.get('precip_prob')
    text = _TEXT[lang]
    outer = outfit.get('outerwear')

    def outer_label():
        label = _label(outer, lang)
        return label.lower() if lang == 'en' else _cap(label)

    if p is not None and p >= 0.5:
        if outer and outer.rain_ok:
            return text['rain'].format(outer=outer_label(), pct=round(p * 100))
        return None  # wet day without a rain layer: nothing honest to praise
    if t is None:
        return None
    warmth = sum(g.warmth for slot, g in outfit.items() if slot in WARMTH_SLOTS)
    if abs(warmth - target_warmth(t)) > 2:
        return None
    deg = round(t)
    if outer and needs_outerwear(ctx):
        return text['outer_temp'].format(outer=outer_label(), deg=deg)
    return text['light_temp' if t >= 18 else 'warm_temp'].format(deg=deg)


def reasons_for(outfit, scores, ctx):
    """2–4 grounded sentences for "Why this outfit works"."""
    lang = _lang(ctx)
    text = _TEXT[lang]
    out = [_color_reason(outfit, lang), _weather_reason(outfit, ctx, scores, lang)]
    style = ctx.get('style')
    if style and style_bonus(outfit, style) > 0:
        out.append(text['style'].format(style=style_name(style, lang)))
    if scores.get('occasion', 0) >= 85:
        out.append(text['occasion'].format(occasion=occasion_name(ctx['occasion'], lang)))
    if scores.get('rotation', 0) >= 90:
        out.append(text['rotation'])
    out = [r for r in out if r]
    if len(out) < 2 and scores.get('silhouette', 0) >= 80:
        out.append(text['silhouette'])
    return out[:4]
