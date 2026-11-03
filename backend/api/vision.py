"""
Garment tagging from a photo with a vision LLM (KB section 4, stage 5).

One Claude call per upload returns every attribute the closet needs, each
with its own confidence, as schema-constrained JSON. The app shows anything
under 0.75 as "check this". Material is only ever an estimate here; a care
label or the user is the source of truth (stage 7).

Returns None when no API key is configured or the call fails, so uploads keep
working on the deterministic colour extraction alone.
"""
import base64
import io
import json
import logging
import os

from PIL import Image, ImageOps

from . import taxonomy as tx

log = logging.getLogger(__name__)

MODEL = os.environ.get('WEARWISE_VISION_MODEL', 'claude-opus-5-5')
MAX_SIDE = 1024  # plenty for attributes; keeps image tokens down

ALL_SUBCATEGORIES = sorted({s for subs in tx.CATEGORIES.values() for s in subs})

SCHEMA = {
    'type': 'object',
    'properties': {
        'is_garment': {'type': 'boolean'},
        'category': {'type': 'string', 'enum': list(tx.CATEGORIES)},
        'subcategory': {'type': 'string', 'enum': ALL_SUBCATEGORIES},
        'name': {'type': 'string'},
        'colors': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string', 'enum': list(tx.COLORS)},
                    'share': {'type': 'number'},
                },
                'required': ['name', 'share'],
                'additionalProperties': False,
            },
        },
        'pattern': {'type': 'string', 'enum': tx.PATTERNS},
        'material': {'type': 'string'},
        'surface': {'type': 'string', 'enum': tx.SURFACES},
        'sheen': {'type': 'string', 'enum': tx.SHEENS},
        'fit': {'type': 'string', 'enum': tx.FITS},
        'formality': {'type': 'integer'},
        'warmth': {'type': 'integer'},
        'rain_ok': {'type': 'boolean'},
        'season': {'type': 'array', 'items': {'type': 'string', 'enum': tx.SEASONS}},
        'confidence': {
            'type': 'object',
            'properties': {k: {'type': 'number'} for k in ('category', 'color', 'pattern', 'material')},
            'required': ['category', 'color', 'pattern', 'material'],
            'additionalProperties': False,
        },
    },
    'required': [
        'is_garment', 'category', 'subcategory', 'name', 'colors', 'pattern', 'material',
        'surface', 'sheen', 'fit', 'formality', 'warmth', 'rain_ok', 'season', 'confidence',
    ],
    'additionalProperties': False,
}

PROMPT = """You are cataloguing one piece of clothing for a wardrobe app from the user's photo.

Describe the single main garment, shoe or accessory in the photo. Ignore the background, hangers, the person wearing it, and anything else in frame.

- name: {name_rule}
- colors: 1–3 named colours of the item itself, most dominant first; shares add up to about 1.
- material: your best guess from texture ("cotton", "denim", "wool", "leather", "nylon"…), or "" if you cannot tell. It is shown to the user as an estimate.
- formality: 1 lounge/sport, 2 casual, 3 smart casual, 4 business, 5 black tie.
- warmth: 0 very light (tank top, sandals) to 5 arctic (heavy parka). Shoes and accessories are usually 0–1.
- rain_ok: true only for clearly water-resistant items (rain jacket, trench, rubber or leather boots).
- season: the seasons it suits; [] if it works all year.
- confidence: 0–1 for how sure you are of each of category, colour, pattern and material.
- is_garment: false if there is no clothing item in the photo; fill the rest with your best guess anyway."""


def _jpeg_b64(image_file):
    image_file.seek(0)
    img = ImageOps.exif_transpose(Image.open(image_file)).convert('RGB')
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=85)
    return base64.standard_b64encode(buf.getvalue()).decode('ascii')


def _clean(d):
    """Clamp and normalise the model's answer into Garment fields."""
    cat = d['category']
    sub = d['subcategory'] if d['subcategory'] in tx.CATEGORIES[cat] else ''
    colors = []
    for c in d['colors'][:3]:
        if c['name'] in tx.COLORS and c['name'] not in {x['name'] for x in colors}:
            colors.append({'name': c['name'], 'rgb': list(tx.COLORS[c['name']]), 'share': round(max(0.0, min(1.0, c['share'])), 2)})
    conf = {k: round(max(0.0, min(1.0, float(v))), 2) for k, v in d['confidence'].items()}
    if not sub:
        conf['category'] = min(conf.get('category', 0.5), 0.6)
    material = d['material'].strip().lower()[:32]
    return {
        'is_garment': d['is_garment'],
        'category': cat,
        'subcategory': sub,
        'name': d['name'].strip()[:120],
        'colors': colors,
        'pattern': d['pattern'],
        'material': {'value': material, 'source': 'visual_estimate', 'confidence': conf['material']} if material else {},
        'surface': d['surface'],
        'sheen': d['sheen'],
        'fit': d['fit'],
        'formality': max(1, min(5, int(d['formality']))),
        'warmth': max(0, min(5, int(d['warmth']))),
        'rain_ok': bool(d['rain_ok']),
        'season': [s for s in tx.SEASONS if s in d['season']],
        'attribute_confidence': conf,
    }


NAME_RULES = {
    'en': '2–4 words a person would use, colour first, e.g. "Navy wool sweater", "White leather sneakers".',
    'az': '2–4 words in Azerbaijani, colour first, e.g. "Tünd göy yun sviter", "Ağ dəri krossovka". '
          'Write material in English regardless.',
}


def analyse_garment(image_file, lang='en'):
    """Attributes for the garment in `image_file`, or None if tagging is unavailable.

    `lang` ('az' or 'en') sets the language of the name; every other field is a fixed English value.
    """
    if not os.environ.get('ANTHROPIC_API_KEY'):
        return None
    import anthropic

    client = anthropic.Anthropic(timeout=60.0, max_retries=2)
    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            # A short extraction: low effort keeps it quick and cheap.
            output_config={'effort': 'low', 'format': {'type': 'json_schema', 'schema': SCHEMA}},
            # On a safety decline, retry server-side on Anthropic's recommended fallback model.
            betas=['server-side-fallback-2026-07-01'],
            fallbacks='default',
            messages=[{
                'role': 'user',
                'content': [
                    {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': _jpeg_b64(image_file)}},
                    {'type': 'text', 'text': PROMPT.format(name_rule=NAME_RULES.get(lang, NAME_RULES['en']))},
                ],
            }],
        )
    except anthropic.APIConnectionError:
        log.warning('garment tagging: cannot reach the API')
        return None
    except anthropic.RateLimitError:
        log.warning('garment tagging: rate limited')
        return None
    except anthropic.APIStatusError as e:
        log.warning('garment tagging failed: %s %s', e.status_code, e.message)
        return None
    finally:
        image_file.seek(0)

    if response.stop_reason in ('refusal', 'max_tokens'):
        log.warning('garment tagging stopped: %s', response.stop_reason)
        return None
    text = next((b.text for b in response.content if b.type == 'text'), None)
    if not text:
        return None
    try:
        return _clean(json.loads(text))
    except (ValueError, KeyError, TypeError) as e:
        log.warning('garment tagging returned unusable JSON: %s', e)
        return None


# ── Video: many frames, many garments ──────────────────────────────────────

_ITEM_PROPS = {k: v for k, v in SCHEMA['properties'].items() if k != 'is_garment'}
FRAMES_SCHEMA = {
    'type': 'object',
    'properties': {
        'items': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    **_ITEM_PROPS,
                    'frame': {'type': 'integer'},
                    'box': {
                        'type': 'object',
                        'properties': {k: {'type': 'number'} for k in ('x', 'y', 'w', 'h')},
                        'required': ['x', 'y', 'w', 'h'],
                        'additionalProperties': False,
                    },
                },
                'required': [*[k for k in SCHEMA['required'] if k != 'is_garment'], 'frame', 'box'],
                'additionalProperties': False,
            },
        },
    },
    'required': ['items'],
    'additionalProperties': False,
}

FRAMES_PROMPT = """These {n} images are frames, in order, from a video the user filmed of their own clothes (a wardrobe, rail, shelves or pieces laid out).

List every distinct clothing item, shoe, bag or accessory that is clearly visible. One physical item seen in several frames is ONE entry: pick the frame where it is most complete and least obstructed. Skip items that are mostly hidden, folded so they cannot be identified, or worn by a person. At most 20 items.

For each item:
- frame: the 0-based index of that best frame.
- box: the item's bounding box in that frame as fractions of the image (x, y = top-left corner; w, h = width and height; all 0–1). Fit it tightly around the item.
- name: {name_rule}
- colors: 1–3 named colours of the item itself, most dominant first; shares add up to about 1.
- material: your best guess from texture, or "" if you cannot tell. It is shown to the user as an estimate.
- formality: 1 lounge/sport, 2 casual, 3 smart casual, 4 business, 5 black tie.
- warmth: 0 very light to 5 arctic. Shoes and accessories are usually 0–1.
- rain_ok: true only for clearly water-resistant items.
- season: the seasons it suits; [] if it works all year.
- confidence: 0–1 for category, colour, pattern and material. Lower them for items seen small, blurred or partly hidden."""


def analyse_frames(frames_jpeg, lang='en'):
    """
    Distinct garments across video frames: [{frame, box, **garment fields}], or
    None if tagging is unavailable. `frames_jpeg` is a list of JPEG bytes.
    """
    if not os.environ.get('ANTHROPIC_API_KEY') or not frames_jpeg:
        return None
    import anthropic

    content = []
    for i, jpg in enumerate(frames_jpeg):
        content.append({'type': 'text', 'text': f'Frame {i}'})
        content.append({'type': 'image', 'source': {
            'type': 'base64', 'media_type': 'image/jpeg', 'data': base64.standard_b64encode(jpg).decode('ascii'),
        }})
    content.append({'type': 'text', 'text': FRAMES_PROMPT.format(
        n=len(frames_jpeg), name_rule=NAME_RULES.get(lang, NAME_RULES['en']),
    )})

    client = anthropic.Anthropic(timeout=180.0, max_retries=2)
    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            # Matching one item across frames takes more care than tagging one photo.
            output_config={'effort': 'medium', 'format': {'type': 'json_schema', 'schema': FRAMES_SCHEMA}},
            betas=['server-side-fallback-2026-07-01'],
            fallbacks='default',
            messages=[{'role': 'user', 'content': content}],
        )
    except anthropic.APIConnectionError:
        log.warning('video tagging: cannot reach the API')
        return None
    except anthropic.RateLimitError:
        log.warning('video tagging: rate limited')
        return None
    except anthropic.APIStatusError as e:
        log.warning('video tagging failed: %s %s', e.status_code, e.message)
        return None

    if response.stop_reason in ('refusal', 'max_tokens'):
        log.warning('video tagging stopped: %s', response.stop_reason)
        return None
    text = next((b.text for b in response.content if b.type == 'text'), None)
    if not text:
        return None
    try:
        raw = json.loads(text)['items']
    except (ValueError, KeyError, TypeError) as e:
        log.warning('video tagging returned unusable JSON: %s', e)
        return None

    items = []
    for it in raw[:20]:
        try:
            frame = int(it['frame'])
            if not 0 <= frame < len(frames_jpeg):
                continue
            box = {k: max(0.0, min(1.0, float(it['box'][k]))) for k in ('x', 'y', 'w', 'h')}
            items.append({**_clean({**it, 'is_garment': True}), 'frame': frame, 'box': box})
        except (ValueError, KeyError, TypeError):
            continue
    return items
