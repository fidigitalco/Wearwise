"""
The stylist assistant behind POST /api/assistant/.

Rule-based for now: keyword intents in English and Azerbaijani (typed with or
without the Azerbaijani letters), answered with the recommendation engine and
the user's own closet. `answer()` is the whole interface, so an LLM provider
can replace this module without touching the view.

It only ever talks about pieces the user has added, and only mentions weather
when a real forecast came back.
"""
import re
from datetime import timedelta

from django.utils import timezone

from . import taxonomy as tx
from .colors import extract_colors
from .engine.describe import _cap, color_name, kind_name, occasion_name
from .engine.recommend import NotEnoughGarments, _label
from .models import Garment
from .services import build_context, pairs, recommend_set
from .shopping import suggestions as shopping_suggestions
from .vision import analyse_garment

# ə→e, ı→i … so "ne geyinim" matches "nə geyinim".
_FOLD = str.maketrans('əıöüğşç', 'eiougsc')


def _norm(text):
    raw = (text or '').replace('İ', 'i').lower()
    return raw, raw.translate(_FOLD)


def _kw_re(kw):
    """A keyword as a word-prefix regex; a trailing '$' means the whole word only."""
    whole = kw.endswith('$')
    kw = kw.rstrip('$')
    return re.compile(r'\b' + re.escape(kw) + (r'\b' if whole else ''))


def _has(raw, folded, keywords):
    for kw in keywords:
        if _kw_re(kw).search(raw) or _kw_re(kw.translate(_FOLD)).search(folded):
            return True
    return False


# Checked in order: the first hit wins ("dinner after work" is a date).
OCCASION_WORDS = [
    ('formal', ['formal', 'wedding', 'gala', 'black tie', 'ceremony', 'rəsmi', 'mərasim', 'toy$', 'toya$', 'toyda$']),
    ('client_meeting', ['client', 'business meeting', 'meeting', 'interview', 'presentation', 'müştəri', 'iclas',
                        'müsahibə', 'təqdimat']),
    ('date', ['dinner', 'date$', 'dates$', 'romantic', 'restaurant', 'theatre', 'theater', 'şam yemə', 'görüş',
              'randevu', 'restoran', 'teatr']),
    ('party', ['party', 'parties', 'birthday', 'qonaqlıq', 'ad günü']),
    ('sport', ['sport', 'gym', 'workout', 'training', 'run$', 'running', 'hike', 'hiking', 'idman', 'məşq', 'qaçış']),
    ('travel', ['travel', 'trip', 'flight', 'airport', 'səyahət', 'səfər', 'aeroport']),
    # "iş" folded is the English "is", so it only counts when typed with ş.
    ('work', ['work$', 'working', 'office', 'ofis', 'ise$', 'isde$', 'iş üçün']),
    ('casual', ['casual', 'everyday', 'weekend', 'park', 'beach', 'walk', 'gündəlik', 'gəzinti', 'həftəsonu',
                'həftə sonu', 'çimərlik']),
]
_RAW_ONLY_WORK = re.compile(r'\b(iş|işə|işdə|işim)\b')

COLOR_WORDS = ['color', 'colour', 'rəng']
MATCH_WORDS = ['go with', 'goes with', 'match', 'pair', 'yaraş', 'uyğun', 'gedir', 'uyuş']
STYLE_WORDS = [
    'ways', 'style th', 'style my', 'how to wear', 'how do i wear', 'how can i wear', 'outfits with',
    'looks with', 'cür$', 'kombin', 'necə geyin',
]
TOMORROW_WORDS = ['tomorrow', 'sabah']
SHOP_WORDS = [
    'buy', 'shop', 'shopping', 'store', 'missing', 'what should i get', 'nə alım', 'ne alim', 'almalı', 'alım$',
    'alış-veriş', 'alışveriş', 'mağaza', 'çatışmır', 'əskik',
]
TODAY_WORDS = ['what should i wear', 'what to wear', 'what do i wear', 'today', 'nə geyin', 'bu gün']


def detect_occasion(raw, folded):
    for occ, words in OCCASION_WORDS:
        if _has(raw, folded, words) or (occ == 'work' and _RAW_ONLY_WORK.search(raw)):
            return occ
    return None


# How dressed-up each occasion reads, for "WearWise read your plan as …" (spec §3.5).
OCCASION_LEVEL = {
    'formal': 'formal', 'client_meeting': 'formal', 'work': 'formal',
    'date': 'smart', 'party': 'smart',
    'casual': 'casual', 'sport': 'casual', 'travel': 'casual',
}


def read_plan(text):
    """The day's plan in the user's words → {occasion, level}; both None when nothing matched."""
    raw, folded = _norm(text)
    occ = detect_occasion(raw, folded)
    return {'occasion': occ, 'level': OCCASION_LEVEL.get(occ)}


def detect_intent(raw, folded):
    if _has(raw, folded, SHOP_WORDS):
        return 'shop'
    if _has(raw, folded, COLOR_WORDS) and _has(raw, folded, MATCH_WORDS):
        return 'colors'
    if _has(raw, folded, STYLE_WORDS):
        return 'style_piece'
    if _has(raw, folded, TOMORROW_WORDS):
        return 'tomorrow'
    if detect_occasion(raw, folded):
        return 'occasion'
    if _has(raw, folded, TODAY_WORDS):
        return 'today'
    return 'unknown'


# --- Finding the piece the user means -------------------------------------

EN_ALIASES = {
    't_shirt': ['t-shirt', 'tshirt', 'tee'], 'tank_top': ['tank top'], 'trousers': ['trousers', 'pants', 'slacks'],
    'rain_jacket': ['rain jacket', 'raincoat'], 'denim_jacket': ['denim jacket', 'jean jacket'],
    'sneakers': ['sneakers', 'trainers'], 'evening_dress': ['evening dress', 'gown'],
    'outerwear': ['jacket', 'coat', 'outerwear'], 'bottom': ['bottoms'],
}


def _stem(word):
    """Enough of a word to survive plurals and Azerbaijani suffixes (şalvar → şalvarı)."""
    return word if len(word) <= 4 else word[:max(4, len(word) - 2)]


def _phrase_re(phrase):
    words = phrase.translate(_FOLD).split()
    return re.compile(r'\b' + r'\w*\s+'.join(re.escape(_stem(w)) for w in words))


def _kind_phrases(key):
    return EN_ALIASES.get(key, [key.replace('_', ' ')]) + ([tx.KIND_AZ[key]] if key in tx.KIND_AZ else [])


def mentioned_colors(raw, folded):
    """Colour names in the message, longest first so "tünd göy" is not also "göy"."""
    names = []
    for c in tx.COLORS:
        names.append((c.replace('_', ' '), c))
        names.append((tx.COLOR_AZ[c], c))
    names.sort(key=lambda x: -len(x[0]))
    found = []
    for phrase, c in names:
        # Short Azerbaijani names ("ağ") only match as typed, never folded.
        use_raw = len(phrase) < 4
        pattern = re.compile(r'\b' + re.escape(phrase if use_raw else phrase.translate(_FOLD)) + r'\w{0,3}\b')
        m = pattern.search(raw if use_raw else folded)
        if m:
            # Folding keeps positions, so blank the match in both copies.
            blank = ' ' * (m.end() - m.start())
            raw = raw[:m.start()] + blank + raw[m.end():]
            folded = folded[:m.start()] + blank + folded[m.end():]
            if c not in found:
                found.append(c)
    return found


def find_garment(garments, raw, folded):
    """The user's piece the message names by kind or name (colour only breaks ties), or None."""
    colors = set(mentioned_colors(raw, folded))
    best, best_key = None, None
    for g in garments:
        kind = 0
        for p in _kind_phrases(g.subcategory) if g.subcategory else []:
            if _phrase_re(p).search(folded):
                kind = max(kind, 10 + len(p))
        if not kind and any(_phrase_re(p).search(folded) for p in _kind_phrases(g.category)):
            kind = 5
        name_hits = sum(1 for w in (g.name or '').split() if len(w) >= 4 and _phrase_re(w.lower()).search(folded))
        if not kind and not name_hits:
            continue
        key = (kind + 3 * name_hits + (4 if g.primary_color in colors else 0), g.favorite, g.times_worn)
        if best_key is None or key > best_key:
            best, best_key = g, key
    return best


# --- Replies ---------------------------------------------------------------

def _join(items, lang):
    items = list(items)
    if len(items) <= 1:
        return ''.join(items)
    return f"{', '.join(items[:-1])} {'və' if lang == 'az' else 'and'} {items[-1]}"


def _can_dress(garments):
    cats = {g.category for g in garments}
    return 'dress' in cats or {'top', 'bottom'} <= cats


def _closet_gap(garments, lang):
    cats = {g.category for g in garments}
    if not garments:
        return ('Your closet is empty so far. Add a top and a bottom (or a dress) plus a pair of shoes, '
                'or load the sample wardrobe to try me out.' if lang == 'en' else
                'Qarderobun hələ boşdur. Üst və alt geyim (və ya don), bir də ayaqqabı əlavə et, '
                'ya da sınamaq üçün nümunə qarderobu yüklə.')
    missing = []
    if 'dress' not in cats:
        if 'top' not in cats:
            missing.append('a top' if lang == 'en' else 'üst geyim')
        if 'bottom' not in cats:
            missing.append('a bottom (or a dress)' if lang == 'en' else 'alt geyim (və ya don)')
    if 'shoes' not in cats:
        missing.append('a pair of shoes' if lang == 'en' else 'ayaqqabı')
    if lang == 'az':
        return (f'Qarderobunda hələ tam obraz üçün kifayət qədər geyim yoxdur. {_cap(_join(missing, lang))} '
                f'əlavə et, sonra obrazlar hazırlaya bilərəm.')
    return (f"Your closet doesn't have enough pieces for a full outfit yet. Add {_join(missing, lang)} "
            f'and I can start styling looks.')


def _weather_sentence(ctx, lang):
    wx = ctx.get('weather')
    if not wx:
        return ''
    t, p = round(wx['temp_c']), wx.get('precip_prob') or 0
    if lang == 'az':
        rain = f', yağış ehtimalı {round(p * 100)}%' if p >= 0.3 else ''
        return f' Hava təxminən {t}°C olacaq{rain}.'
    rain = f' with a {round(p * 100)}% chance of rain' if p >= 0.3 else ''
    return f' It should be around {t}°C{rain}.'


def _outfits_of(oset):
    return sorted(oset.outfits.all(), key=lambda o: o.position)


def _looks(user, garments, lang, occasion, when):
    if not _can_dress(garments):
        return _closet_gap(garments, lang), []
    day = timezone.localdate() + timedelta(days=1 if when == 'tomorrow' else 0)
    ctx = build_context(user, {'occasion': occasion, 'date': day}, lang)
    try:
        outfits = _outfits_of(recommend_set(user, ctx, source='assistant'))
    except NotEnoughGarments:
        return _closet_gap(garments, lang), []
    n, occ = len(outfits), occasion_name(occasion, lang)
    if lang == 'az':
        lead = {'tomorrow': 'Sabah ', 'today': 'Bu gün '}.get(when, '')
        text = _cap(f'{lead}{occ} üçün {n} obraz hazırladım.')
        pick = f' Ən yaxşı seçimim: «{outfits[0].title}».'
    else:
        lead = {'tomorrow': ' tomorrow', 'today': ' today'}.get(when, '')
        text = f"Here {'is' if n == 1 else 'are'} {n} look{'' if n == 1 else 's'} for {occ}{lead}."
        pick = f' My top pick is "{outfits[0].title}".'
    return text + _weather_sentence(ctx, lang) + pick, outfits


def _occasion_for_piece(g, user, mentioned):
    """The asked-for occasion, else the user's usual one if the piece fits it, else the first that does."""
    if mentioned:
        return mentioned
    for occ in [user.main_occasion, 'casual', 'work', 'date', 'formal']:
        lo, hi = tx.OCCASIONS[occ]
        if lo <= g.formality <= hi:
            return occ
    return user.main_occasion


def _style_piece(user, garments, lang, raw, folded):
    g = find_garment(garments, raw, folded)
    if not g:
        if not garments:
            return _closet_gap(garments, lang), []
        return ("I couldn't find that piece in your closet. Add it with a photo and I'll style it for you."
                if lang == 'en' else
                'Bu geyimi qarderobunda tapa bilmədim. Şəklini çəkib əlavə et, sonra onu sənin üçün kombinləyərəm.'), []
    occasion = _occasion_for_piece(g, user, detect_occasion(raw, folded))
    ctx = build_context(user, {'occasion': occasion}, lang)
    try:
        outfits = _outfits_of(recommend_set(user, ctx, source='assistant', fixed_garment_id=g.id))
    except NotEnoughGarments:
        return _closet_gap(garments, lang), []
    label, n = _label(g, lang), len(outfits)
    if lang == 'az':
        text = f'{_cap(label)} üçün {n} fərqli kombin hazırladım.'
        if n < 3:
            text += ' Hazırkı qarderobunla bu qədər fərqli obraz alınır.'
    else:
        text = f"Here {'is' if n == 1 else 'are'} {n} way{'' if n == 1 else 's'} to wear your {label.lower()}."
        if n < 3:
            text += " That's every distinct look your closet allows right now."
    return text, outfits


def best_colors(color, n=5):
    """The colours that pair best with `color`, by the harmony table."""
    table = pairs()
    order = list(tx.COLORS)
    ranked = sorted((c for c in tx.COLORS if c != color), key=lambda c: (-table.color(color, c), order.index(c)))
    return ranked[:n]


def _colors(user, garments, lang, raw, folded):
    g = find_garment(garments, raw, folded)
    if g is None:
        named = mentioned_colors(raw, folded)
        if not named:
            if not garments:
                return _closet_gap(garments, lang)
            return ("Tell me which piece you mean, for example \"which colours go with my navy blazer?\""
                    if lang == 'en' else
                    'Hansı geyimi nəzərdə tutduğunu yaz, məsələn: "tünd göy pencəyə hansı rənglər yaraşır?"')
        base, subject = named[0], color_name(named[0], lang)
        owned_from = garments
    else:
        if not g.primary_color:
            return (f"I don't know the colour of your {_label(g, lang).lower()} yet. Add a photo or pick its colour, "
                    f'then ask again.' if lang == 'en' else
                    f'{_cap(_label(g, lang))} rəngini hələ bilmirəm. Şəklini əlavə et və ya rəngini seç, sonra yenə soruş.')
        base = g.primary_color
        subject = (f'your {_label(g, lang).lower()} ({color_name(base, lang)})' if lang == 'en'
                   else f'{_label(g, lang)} ({color_name(base, lang)})')
        owned_from = [x for x in garments if x.id != g.id]
    top = best_colors(base)
    owned = {x.primary_color for x in owned_from}
    have = [color_name(c, lang) for c in top if c in owned]
    names = _join([color_name(c, lang) for c in top], lang)
    if lang == 'az':
        text = f'{_cap(subject)} ilə bu rənglər yaxşı gedir: {names}.'
        text += (f' Bunlardan səndə artıq {_join(have, lang)} geyimlər var.' if have
                 else ' Bunlardan hələ heç biri qarderobunda yoxdur.')
    else:
        text = f'These colours go well with {subject}: {names}.'
        text += (f' You already own {_join(have, lang)} pieces.' if have
                 else " You don't own any of these yet.")
    return text


def _help(garments, lang):
    text = ('I can pick what to wear tomorrow, put together looks for an occasion like work or a dinner, '
            'show you several ways to wear one piece, or tell you which colours go with something you own.'
            if lang == 'en' else
            'Sabah nə geyinəcəyini seçə, iş və ya şam yeməyi kimi bir məqsəd üçün obrazlar yığa, bir geyimi '
            'bir neçə cür kombinləyə, ya da qarderobundakı bir əşyaya hansı rənglərin yaraşdığını deyə bilərəm.')
    if not _can_dress(garments):
        text += ' ' + _closet_gap(garments, lang)
    return text


def _piece_of(garments, categories):
    """The most-worn piece of the first category the user has, in priority order."""
    for cat in categories:
        mine = [g for g in garments if g.category == cat]
        if mine:
            return min(mine, key=lambda g: (-g.times_worn, -g.favorite, g.created_at))
    return None


def suggestions(garments, lang, intent):
    """3–4 follow-up prompts that the intents above understand, skipping the one just answered."""
    az = lang == 'az'
    out = [('tomorrow', 'Sabah nə geyinim?' if az else 'What should I wear tomorrow?'),
           ('occasion', 'Şam yeməyi üçün obrazlar' if az else 'Outfits for a dinner date')]
    bottom = _piece_of(garments, ('bottom', 'dress'))
    if bottom:
        kind = kind_name(bottom.subcategory or bottom.category, lang)
        out.append(('style_piece', f'{_cap(kind)} ilə 3 kombin' if az else f'Style my {kind} in three ways'))
    outer = _piece_of(garments, ('outerwear', 'top'))
    if outer:
        kind = kind_name(outer.subcategory or outer.category, lang)
        out.append(('colors', f'{_cap(kind)} ilə hansı rənglər yaxşı gedir?' if az
                    else f'Which colours go with my {kind}?'))
    out.append(('shop', 'Qarderobuma nə almalıyam?' if az else 'What should I buy next?'))
    out.append(('work', 'İş üçün obrazlar' if az else 'Looks for the office'))
    out.append(('casual', 'Həftəsonu üçün obrazlar' if az else 'Looks for the weekend'))
    picked = [text for key, text in out if key != intent]
    return picked[:4]


def _identify(image, lang):
    """(category, subcategory, colour, is_garment) for a shared photo: AI tagging when available, else its colours."""
    ai = analyse_garment(image, lang)
    if ai:
        color = ai['colors'][0]['name'] if ai['colors'] else None
        return ai['category'], ai['subcategory'], color, ai['is_garment']
    image.seek(0)
    colors, _ = extract_colors(image)
    image.seek(0)
    return None, '', (colors[0]['name'] if colors else None), True


def matching_pieces(garments, color, category=None, n=6):
    """The user's pieces that pair best with `color`, other categories first, best match first."""
    table = pairs()
    scored = [(table.color(color, g.primary_color), g) for g in garments
              if g.primary_color and (category is None or g.category != category)]
    scored = [x for x in scored if x[0] >= 0.6]
    scored.sort(key=lambda x: (-x[0], -x[1].favorite, -x[1].times_worn))
    return [g for _, g in scored[:n]]


def _photo(garments, lang, image):
    """Reply to a shared photo: what it is, the colours that suit it and the user's pieces that go with it."""
    category, sub, color, is_garment = _identify(image, lang)
    if not is_garment:
        return ("I couldn't spot a piece of clothing in this photo. Try one item on a plain background."
                if lang == 'en' else
                'Bu şəkildə geyim tapa bilmədim. Bir geyimi sadə fonda çəkib yenə göndər.'), [], None
    if not color:
        return ("I couldn't make out the colours in this photo. Try again in better light."
                if lang == 'en' else
                'Bu şəkildəki rəngləri ayırd edə bilmədim. Daha yaxşı işıqda yenə cəhd et.'), [], None
    kind = kind_name(sub or category, lang) if (sub or category) else None
    cname = color_name(color, lang)
    names = _join([color_name(c, lang) for c in best_colors(color)], lang)
    matches = matching_pieces(garments, color, category)
    if lang == 'az':
        text = f'Bu, {cname} {kind} kimi görünür.' if kind else f'Şəkildəki əsas rəng: {cname}.'
        text += f' Onunla bu rənglər yaxşı gedir: {names}.'
        text += (' Qarderobundan bunlar ona yaraşır:' if matches else
                 ' Qarderobunda hələ ona uyğun rəngdə geyim yoxdur.')
    else:
        text = f'This looks like a {cname} {kind}.' if kind else f'The main colour in this photo is {cname}.'
        text += f' These colours go well with it: {names}.'
        text += (' From your closet, these pair well with it:' if matches else
                 " You don't have pieces in matching colours yet.")
    piece = None
    if category:
        piece = {'category': category, 'subcategory': sub, 'colors': [{'name': color}]}
        if kind:
            piece['name'] = _cap(f'{cname} {kind}')
    return text, matches, piece


def answer(user, message, lang='en', image=None):
    """
    {"reply": str, "outfits": [Outfit], "garments": [Garment], "suggestions": [str],
    "piece": dict | None} for one chat message, optionally with a photo the user shared.
    "piece" holds the garment fields of a recognised photo, ready to add to the closet.
    """
    lang = 'az' if lang == 'az' else 'en'
    raw, folded = _norm(message)
    garments = list(Garment.objects.filter(user=user, status='available'))
    if image is not None:
        reply, matches, piece = _photo(garments, lang, image)
        return {'reply': reply, 'outfits': [], 'garments': matches, 'piece': piece, 'shopping': [],
                'suggestions': suggestions(garments, lang, 'photo')}
    intent = detect_intent(raw, folded) if raw.strip() else 'unknown'
    outfits, shopping = [], []
    if intent == 'colors':
        reply = _colors(user, garments, lang, raw, folded)
    elif intent == 'style_piece':
        reply, outfits = _style_piece(user, garments, lang, raw, folded)
    elif intent in ('tomorrow', 'today'):
        occasion = detect_occasion(raw, folded) or user.main_occasion
        reply, outfits = _looks(user, garments, lang, occasion, intent)
    elif intent == 'shop':
        shopping = shopping_suggestions(user, lang)
        if shopping:
            reply = ('Qarderobunu tamamlamaq üçün bunlara bax. Hər birini mağazada axtarmaq üçün linklər var:'
                     if lang == 'az' else
                     'These would round out your wardrobe. Each has links to look for it in stores:')
        else:
            reply = ('Qarderobun yaxşı tamamlanıb, hələlik əlavə bir şey lazım deyil.' if lang == 'az'
                     else 'Your wardrobe is well rounded; nothing to add right now.')
    elif intent == 'occasion':
        reply, outfits = _looks(user, garments, lang, detect_occasion(raw, folded), None)
    else:
        reply = _help(garments, lang)
    return {'reply': reply, 'outfits': outfits, 'garments': [], 'piece': None, 'shopping': shopping,
            'suggestions': suggestions(garments, lang, intent)}
