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

ALL_SUBCATEGORIES = {sub for subs in CATEGORIES.values() for sub in subs}

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
STYLE_DIRECTIONS = [
    'casual', 'smart_casual', 'business', 'formal', 'sporty', 'streetwear', 'minimal', 'classic', 'bohemian',
    'old_money', 'preppy', 'romantic',
    # MVP v2 style list (wearwise-mvp.md, onboarding step 2).
    'quiet_luxury', 'athleisure', 'scandi', 'parisian_chic', 'vintage', 'y2k', 'grunge', 'edgy', 'coastal',
    'cottagecore', 'korean', 'gorpcore', 'glam', 'modest', 'techwear', 'western',
]
UNITS = ['metric', 'imperial']
SIZE_KEYS = ['top', 'bottom', 'shoes']

# "About you": what a stylist asks before dressing someone. All optional.
GENDERS = ['female', 'male', 'other', 'unsaid']
BODY_SHAPES = ['rectangle', 'triangle', 'inverted_triangle', 'hourglass', 'oval']
FIT_PREFERENCES = ['slim', 'regular', 'relaxed', 'oversized']
BUDGETS = ['low', 'mid', 'high']

# MVP v2 onboarding (wearwise-mvp.md §1).
AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+']
COUNTRIES = ['GB', 'TR', 'AZ', 'DE', 'FR', 'US', 'AE', 'other']
# Price per piece in USD, lower bound inclusive, upper exclusive; the last is open-ended.
BUDGET_RANGES = {'u30': (0, 30), '30-60': (30, 60), '60-120': (60, 120), '120-250': (120, 250), '250+': (250, 100000)}
STORES = ['Trendyol', 'ASOS', 'Zara', 'H&M', 'Mango', 'Amazon', 'Shein', 'COS', 'Massimo Dutti', 'Uniqlo', 'Nike', 'Farfetch']
TOP_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
EU_BOTTOM_SIZES = ['32', '34', '36', '38', '40', '42', '44', '46', '48']
WAIST_SIZES = ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40']
SHOE_SIZES = [str(n) for n in range(35, 48)]
OCCASION_KINDS = ['birthday', 'wedding', 'holiday', 'work', 'trip', 'date', 'other']
PRODUCT_ACTIONS = ['like', 'not_me', 'save', 'shop']

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
    'wedding': (3, 5),
    'interview': (3, 5),
    'school': (1, 3),
    'brunch': (2, 3),
    'beach': (1, 2),
    'home': (1, 2),
    'outdoor': (1, 2),
}

LABEL_SOURCES = ['expert', 'sourced', 'synthetic', 'user_feedback', 'illustrative']


def choices(values):
    return [(v, v.replace('_', ' ').capitalize()) for v in values]


# Azerbaijani names for the server-written explanation sentence (the app has
# its own copy for display).
COLOR_AZ = {
    'black': 'qara', 'white': 'ağ', 'cream': 'krem', 'grey': 'boz', 'charcoal': 'tünd boz', 'navy': 'tünd göy',
    'blue': 'göy', 'light_blue': 'açıq göy', 'teal': 'firuzəyi', 'green': 'yaşıl', 'olive': 'zeytuni', 'khaki': 'xaki',
    'beige': 'bej', 'camel': 'dəvəyunu', 'brown': 'qəhvəyi', 'burgundy': 'bordo', 'red': 'qırmızı', 'pink': 'çəhrayı',
    'purple': 'bənövşəyi', 'yellow': 'sarı', 'orange': 'narıncı', 'mustard': 'xardal',
}
KIND_AZ = {
    'top': 'üst', 'bottom': 'alt', 'dress': 'don', 'outerwear': 'gödəkçə', 'shoes': 'ayaqqabı', 'accessory': 'aksesuar',
    'bag': 'çanta',
    't_shirt': 'futbolka', 'shirt': 'köynək', 'blouse': 'bluzka', 'polo': 'polo', 'sweater': 'sviter', 'hoodie': 'hudi',
    'cardigan': 'kardiqan', 'tank_top': 'mayka', 'jeans': 'cins', 'trousers': 'şalvar', 'chinos': 'çinos',
    'shorts': 'şort', 'skirt': 'ətək', 'joggers': 'idman şalvarı', 'leggings': 'losin', 'day_dress': 'gündəlik don',
    'evening_dress': 'axşam donu', 'jumpsuit': 'kombinezon', 'blazer': 'pencək', 'jacket': 'gödəkçə',
    'rain_jacket': 'yağış gödəkçəsi', 'coat': 'palto', 'puffer': 'puxovik', 'trench': 'trençkot',
    'denim_jacket': 'cins gödəkçə', 'sneakers': 'krossovka', 'loafers': 'lofer', 'boots': 'çəkmə',
    'heels': 'dabanlı ayaqqabı', 'sandals': 'sandal', 'oxfords': 'klassik ayaqqabı', 'flats': 'balerina',
    'belt': 'kəmər', 'scarf': 'şərf', 'hat': 'papaq', 'watch': 'saat', 'jewellery': 'zinət əşyası', 'tie': 'qalstuk',
    'sunglasses': 'gün eynəyi', 'tote': 'böyük çanta', 'backpack': 'bel çantası', 'crossbody': 'çiyin çantası',
    'clutch': 'klatç', 'briefcase': 'portfel',
}
OCCASION_AZ = {
    'casual': 'gündəlik gəzinti', 'work': 'iş', 'client_meeting': 'müştəri görüşü', 'date': 'görüş',
    'party': 'qonaqlıq', 'formal': 'rəsmi tədbir', 'sport': 'idman', 'travel': 'səyahət',
    'wedding': 'toy', 'interview': 'iş müsahibəsi', 'school': 'dərs', 'brunch': 'kafe görüşü', 'beach': 'çimərlik',
    'home': 'evdə qalmaq', 'outdoor': 'təbiət gəzintisi',
}
STYLE_AZ = {
    'casual': 'gündəlik', 'smart_casual': 'smart casual', 'business': 'biznes', 'formal': 'rəsmi',
    'sporty': 'idman', 'streetwear': 'küçə', 'minimal': 'minimal', 'classic': 'klassik', 'bohemian': 'bohem',
    'old_money': 'old money', 'preppy': 'preppy', 'romantic': 'romantik',
    'quiet_luxury': 'sakit lüks', 'athleisure': 'athleisure', 'scandi': 'skandinav', 'parisian_chic': 'Paris şıkı',
    'vintage': 'vintaj', 'y2k': 'Y2K', 'grunge': 'qranj', 'edgy': 'rok', 'coastal': 'sahil', 'cottagecore': 'kottecor',
    'korean': 'Koreya üslubu', 'gorpcore': 'qorpkor', 'glam': 'qlamur', 'modest': 'qapalı geyim', 'techwear': 'texvear',
    'western': 'vestern',
}
