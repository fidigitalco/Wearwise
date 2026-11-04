"""
A demo wardrobe for trying the app before photographing a real closet.

Sixteen everyday pieces that combine into work, casual and rainy-day looks,
each with a real product photo (Unsplash; sources in sample_images/CREDITS.md).
Names and colours describe what is in each photo.
"""
from pathlib import Path

from django.core.files.base import ContentFile
from django.db import transaction

from . import taxonomy as tx
from .locale import say
from .models import Garment, Outfit

IMAGES = Path(__file__).resolve().parent / 'sample_images'
ALL_YEAR = ['spring', 'summer', 'autumn', 'winter']
COOL = ['spring', 'autumn', 'winter']

# (photo, en name, az name, category, subcategory, colour, extra fields)
SAMPLE_WARDROBE = [
    ('white_shirt', 'White shirt', 'Ağ köynək', 'top', 'shirt', 'white',
     dict(formality=3, warmth=1, season=ALL_YEAR, fit='regular', material='cotton')),
    ('light_blue_tee', 'Light-blue T-shirt', 'Açıq göy futbolka', 'top', 't_shirt', 'light_blue',
     dict(formality=1, warmth=1, season=['spring', 'summer', 'autumn'], material='cotton')),
    ('navy_sweater', 'Navy knit sweater', 'Tünd göy toxunma sviter', 'top', 'sweater', 'navy',
     dict(formality=3, warmth=3, season=COOL, surface='knit', material='wool')),
    ('black_hoodie', 'Black graphic hoodie', 'Yazılı qara hudi', 'top', 'hoodie', 'black',
     dict(formality=1, warmth=3, season=COOL, fit='relaxed', pattern='graphic', material='cotton')),
    ('dark_jeans', 'Dark jeans', 'Tünd cins', 'bottom', 'jeans', 'navy',
     dict(formality=2, warmth=2, season=ALL_YEAR, fit='slim', material='denim')),
    ('black_jeans', 'Black jeans', 'Qara cins', 'bottom', 'jeans', 'black',
     dict(formality=2, warmth=2, season=ALL_YEAR, fit='slim', material='denim')),
    ('light_jeans', 'Light-wash jeans', 'Açıq rəng cins', 'bottom', 'jeans', 'blue',
     dict(formality=2, warmth=2, season=['spring', 'summer', 'autumn'], fit='regular', material='denim')),
    ('beige_chinos', 'Beige chinos', 'Bej çinos', 'bottom', 'chinos', 'beige',
     dict(formality=3, warmth=2, season=ALL_YEAR, fit='regular', material='cotton')),
    ('black_blazer', 'Black blazer', 'Qara pencək', 'outerwear', 'blazer', 'black',
     dict(formality=4, warmth=2, season=ALL_YEAR, material='wool')),
    ('brown_leather_jacket', 'Brown leather jacket', 'Qəhvəyi dəri gödəkçə', 'outerwear', 'jacket', 'brown',
     dict(formality=2, warmth=3, season=COOL, sheen='medium', material='leather')),
    ('blue_windbreaker', 'Light-blue windbreaker', 'Açıq göy külək gödəkçəsi', 'outerwear', 'rain_jacket', 'light_blue',
     dict(formality=1, warmth=1, rain_ok=True, season=['spring', 'summer', 'autumn'], material='nylon')),
    ('yellow_rain_jacket', 'Yellow rain jacket', 'Sarı yağış gödəkçəsi', 'outerwear', 'rain_jacket', 'yellow',
     dict(formality=2, warmth=2, rain_ok=True, season=['spring', 'autumn'], material='nylon')),
    ('white_sneakers', 'White sneakers', 'Ağ krossovka', 'shoes', 'sneakers', 'white',
     dict(formality=2, warmth=0, season=ALL_YEAR, material='leather')),
    ('brown_loafers', 'Brown loafers', 'Qəhvəyi lofer', 'shoes', 'loafers', 'brown',
     dict(formality=3, warmth=0, season=['spring', 'summer', 'autumn'], material='leather')),
    ('black_boots', 'Black boots', 'Qara çəkmə', 'shoes', 'boots', 'black',
     dict(formality=3, warmth=1, rain_ok=True, season=['autumn', 'winter'], material='leather')),
    ('brown_belt', 'Brown belt', 'Qəhvəyi kəmər', 'accessory', 'belt', 'brown',
     dict(formality=3, warmth=0, season=ALL_YEAR, material='leather')),
]


def load_sample_wardrobe(user, lang='en'):
    """Create the demo pieces for `user`, named in `lang`, with their photos. Returns the new garments."""
    garments = []
    with transaction.atomic():
        # Saved one by one so created_at keeps the list order (newest last).
        for row in SAMPLE_WARDROBE:
            garments.append(_create(user, lang, *row))
    return garments


def _create(user, lang, photo, en, az, category, sub, color, extra):
    extra = dict(extra)
    material = extra.pop('material', None)
    g = Garment(
        user=user,
        name=say(lang, en, az),
        category=category,
        subcategory=sub,
        colors=[{'name': color, 'rgb': list(tx.COLORS[color]), 'share': 1.0}],
        material={'value': material, 'source': 'user', 'confidence': 1.0} if material else {},
        is_sample=True,
        **extra,
    )
    path = IMAGES / f'{photo}.jpg'
    if path.exists():
        g.image.save(f'{g.id}.jpg', ContentFile(path.read_bytes()), save=False)
    _attach_cutout(g, photo)
    g.save()
    return g


def _attach_cutout(g, photo):
    """The piece on a transparent background, made once for the bundle (sample_images/cutouts)."""
    path = IMAGES / 'cutouts' / f'{photo}.png'
    if path.is_file():
        g.cutout.save(f'{g.id}_cutout.png', ContentFile(path.read_bytes()), save=False)
        return True
    return False



def restore_sample_photos(user, lang='en'):
    """
    Keep the demo wardrobe photographed: put the photo (and its cutout) back on
    any demo piece that lost it (empty field or missing file), matching by subcategory and
    colour, which are unique in the list. Demo pieces from an older sample list
    that has no photo for them are swapped for the current pieces the user is
    missing. Returns how many pieces were repaired or added.
    """
    photos = {(sub, color): photo for photo, _, _, _, sub, color, _ in SAMPLE_WARDROBE}
    samples = list(Garment.objects.filter(user=user, is_sample=True))
    if not samples:
        return 0
    changed, have, outdated = 0, set(), []
    for g in samples:
        key = (g.subcategory, g.colors[0]['name'] if g.colors else None)
        if key not in photos:
            outdated.append(g)
            continue
        have.add(key)
        fixed = False
        if not (g.image and g.image.storage.exists(g.image.name)):
            path = IMAGES / f'{photos[key]}.jpg'
            if path.is_file():
                g.image.save(f'{g.id}.jpg', ContentFile(path.read_bytes()), save=False)
                fixed = True
        if not (g.cutout and g.cutout.storage.exists(g.cutout.name)):
            fixed = _attach_cutout(g, photos[key]) or fixed
        if fixed:
            g.save()
            changed += 1
    if outdated:
        with transaction.atomic():
            # Outfits built from those pieces would be left half-empty; drop them too.
            Outfit.objects.filter(items__garment__in=outdated).delete()
            for g in outdated:
                if g.image:
                    g.image.delete(save=False)
                g.delete()
            for photo, en, az, category, sub, color, extra in SAMPLE_WARDROBE:
                if (sub, color) not in have:
                    _create(user, lang, photo, en, az, category, sub, color, extra)
                    changed += 1
    return changed
