"""
The languages WearWise speaks and the server-written text in each.

Azerbaijani and English sit next to each other in the code (`say(lang, en, az)`).
Every other language is looked up by the English template in
`locales/<lang>.json`: {"text": {english template: translation}, "names": {...}}.
A missing translation falls back to English, so a new sentence never breaks a
language, it only shows in English until translated. Placeholders like
{occasion} are filled after the lookup, so translations keep them.
"""
import json
from functools import lru_cache
from pathlib import Path

LANGS = ('az', 'en', 'ru', 'tr', 'es')
DEFAULT = 'en'

_DIR = Path(__file__).parent / 'locales'


def lang_from_header(header):
    """The first language we speak in an Accept-Language header ("ru-RU,ru;q=0.9" → "ru"), else English."""
    for part in (header or '').split(','):
        code = part.split(';')[0].strip().lower().split('-')[0]
        if code in LANGS:
            return code
    return DEFAULT


def norm(lang):
    return lang if lang in LANGS else DEFAULT


@lru_cache(maxsize=None)
def _catalog(lang):
    path = _DIR / f'{lang}.json'
    if not path.exists():
        return {'text': {}, 'names': {}}
    data = json.loads(path.read_text(encoding='utf-8'))
    return {'text': data.get('text', {}), 'names': data.get('names', {})}


def say(lang, en, az=None, **fmt):
    """The sentence in `lang`: `az` for Azerbaijani, `en` for English, the catalog for the rest; then filled in."""
    if lang == 'az' and az is not None:
        text = az
    elif lang in ('en', 'az'):
        text = en
    else:
        text = _catalog(lang)['text'].get(en, en)
    return text.format(**fmt) if fmt else text


def name(lang, kind, key, az_table=None, en_default=None):
    """A vocabulary word (colour, kind, occasion, style) in `lang`; English falls back to the key itself."""
    if lang == 'az' and az_table is not None:
        return az_table.get(key, key)
    if lang not in ('az', 'en'):
        hit = _catalog(lang)['names'].get(kind, {}).get(key)
        if hit:
            return hit
    return en_default if en_default is not None else key.replace('_', ' ')


def join(items, lang):
    """"a, b and c" in the language's own way."""
    items = list(items)
    if len(items) <= 1:
        return ''.join(items)
    return ', '.join(items[:-1]) + ' ' + say(lang, 'and', 'və') + ' ' + items[-1]
