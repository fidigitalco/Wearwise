"""
The WearWise vocabulary: garment categories, the 22 named colours, occasions
and the other enumerations every layer agrees on.

The app reads these from GET /api/meta so the pickers can never drift from what
the server accepts.
"""

CATEGORIES = {
    'top': ['t_shirt', 'shirt', 'blouse', 'polo', 'sweater', 'hoodie', 'cardigan', 'tank_top'],
    'bottom': ['jeans', 'trousers', 'chinos', 'shorts', 'skirt', 'joggers', 'leggings'],
    'dress': ['day_dress', 'evening_dress', 'jumpsuit'],
    'outerwear': ['blazer', 'jacket', 'rain_jacket', 'coat', 'puffer', 'trench', 'denim_jacket'],
    'shoes': ['sneakers', 'loafers', 'boots', 'heels', 'sandals', 'oxfords', 'flats'],
    'accessory': ['belt', 'scarf', 'hat', 'watch', 'jewellery', 'tie', 'sunglasses'],
    'bag': ['tote', 'backpack', 'crossbody', 'clutch', 'briefcase'],
}

# 22 named colours → 231 unordered pairs, the size of the colour-pair matrix the
# stylists rate (KB section 5.2). RGB is the swatch; k-means centres are mapped
# to the nearest of these in CIELAB.
COLORS = {
    'black': (20, 20, 20),
    'white': (245, 245, 245),
    'cream': (240, 228, 200),
    'grey': (140, 140, 140),
    'charcoal': (60, 62, 66),
    'navy': (30, 40, 80),
    'blue': (40, 90, 180),
    'light_blue': (150, 190, 230),
    'teal': (0, 120, 120),
    'green': (40, 130, 60),
    'olive': (110, 110, 50),
    'khaki': (190, 175, 130),
    'beige': (215, 195, 160),
    'camel': (190, 140, 80),
    'brown': (110, 70, 40),
    'burgundy': (110, 25, 45),
    'red': (200, 30, 40),
    'pink': (235, 160, 180),
    'purple': (110, 60, 140),
    'yellow': (217, 169, 51),
    'orange': (230, 120, 40),
    'mustard': (200, 160, 40),
}

NEUTRALS = {'black', 'white', 'cream', 'grey', 'charcoal', 'navy', 'beige', 'camel', 'khaki', 'brown'}

PATTERNS = ['solid', 'stripe', 'check', 'floral', 'print', 'dots', 'graphic', 'animal']
SURFACES = ['smooth', 'textured', 'knit', 'ribbed', 'fuzzy']
SHEENS = ['matte', 'low', 'medium', 'high']
FITS = ['slim', 'regular', 'relaxed', 'oversized']
SEASONS = ['spring', 'summer', 'autumn', 'winter']
STATUSES = ['available', 'laundry', 'stored', 'archived']
MATERIAL_SOURCES = ['care_label', 'user', 'visual_estimate']
STYLE_DIRECTIONS = ['casual', 'smart_casual', 'business', 'formal', 'sporty', 'streetwear', 'minimal']

# Occasion → acceptable formality band (1 = loungewear … 5 = black tie).
OCCASIONS = {
    'casual': (1, 3),
    'work': (2, 4),
    'client_meeting': (3, 5),
    'date': (2, 4),
    'party': (2, 5),
    'formal': (4, 5),
    'sport': (1, 2),
    'travel': (1, 3),
}

LABEL_SOURCES = ['expert', 'sourced', 'synthetic', 'user_feedback', 'illustrative']


def choices(values):
    return [(v, v.replace('_', ' ').capitalize()) for v in values]
