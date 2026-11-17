"""
The partner stores WearWise targets (docs/partner-targets.md), created as switched-off
connections by `manage.py seed_stores` so each has its place in the admin panel before the
affiliate approval arrives. When it does, the owner fills in the key or feed link, presses Test,
switches it on and syncs; nothing else needs building.

Networks are the likely route and differ by country: check inside the network before applying.
`kind` can be changed in the panel if a store ends up offering something else.
"""

HOW = {
    'Awin': 'Awin-də publisher hesabı aç → bu brendin proqramına qoşul → Account → API credentials-dan "Product Feed API key"i, '
            'Toolbox → Create-a-Feed-dən brendin feed ID-sini bura yaz.',
    'CJ': 'CJ Affiliate-də publisher hesabı aç → brendə müraciət et → Products → feed yarat → feed linkini "Feed URL"-ə yaz. '
          'Affiliate link şablonu CJ-nin deep link formatıdır (CJ-də "Deep Link Generator").',
    'Impact': 'Impact-da partner hesabı aç → brendə müraciət et → Catalogs → məhsul kataloqunun (CSV/XML) linkini "Feed URL"-ə yaz.',
    'Rakuten': 'Rakuten Advertising-də publisher hesabı aç → brendə müraciət et → Product Catalog feed linkini "Feed URL"-ə yaz.',
    'Admitad': 'Admitad-da publisher hesabı aç → brendə qoşul → Product feeds → XML/CSV linkini "Feed URL"-ə yaz.',
    'Birbaşa': 'Brendin partnyorluq/affiliate bölməsinə məktub göndər (şablon docs-da): product feed (XML/CSV) və affiliate link '
               'formatı istə. Feed versələr "Feed URL"-ə yaz; yalnız link versələr növü "Yalnız affiliate link"-ə dəyiş və şablonu yaz.',
    'AliExpress': 'portals.aliexpress.com-da affiliate hesabı, open.aliexpress.com-da "Affiliates API" tətbiqi aç: App Key, App Secret, '
                  'Tracking ID-ni yaz.',
    'Amazon': 'Amazon Associates-ə qoşul və adi linklərlə satış et; 30 gündə 10 satışdan sonra Creators API açılır. O vaxta qədər '
              'növ "Yalnız affiliate link": şablon {url}?tag=SƏNİN-TAG.',
}
INDITEX = ' ⚠️ Inditex-in açıq affiliate proqramı bilinmir: birbaşa soruş.'

# (store, network, kind, priority, extra note)
TARGETS = [
    # First wave: the 15 picked in docs/partner-targets.md.
    ('ASOS', 'Awin', 'awin', 1, ' Ölkəyə görə Partnerize də ola bilər.'),
    ('H&M', 'Awin', 'awin', 1, ' Regional proqramları yoxla.'),
    ('Mango', 'Awin', 'awin', 1, ''),
    ('Zara', 'Birbaşa', 'feed', 1, INDITEX),
    ('Trendyol', 'Birbaşa', 'feed', 1, ' Əvvəlcə product feed istə; verməsələr affiliate link formatını.'),
    ('LC Waikiki', 'Admitad', 'feed', 1, ' Admitad-da yoxdursa birbaşa yaz.'),
    ('Koton', 'Admitad', 'feed', 1, ' Admitad-da yoxdursa birbaşa yaz.'),
    ('Nike', 'Impact', 'feed', 1, ' Ölkəyə görə Awin və ya CJ də ola bilər.'),
    ('Adidas', 'Awin', 'awin', 1, ' Ölkəyə görə CJ və ya Rakuten də ola bilər.'),
    ('New Balance', 'Awin', 'awin', 1, ' CJ / Impact da ola bilər.'),
    ('Puma', 'Awin', 'awin', 1, ' CJ / Impact da ola bilər.'),
    ('Guess', 'Awin', 'awin', 1, ' Çanta, saat və eynək də var.'),
    ('Calvin Klein', 'Awin', 'awin', 1, ' CJ / Rakuten da ola bilər.'),
    ('Farfetch', 'Birbaşa', 'feed', 1, ' Farfetch-in öz affiliate səhifəsindən müraciət et: feed və 30 günlük cookie verirlər.'),
    ('SSENSE', 'Birbaşa', 'feed', 1, ' SSENSE-in öz affiliate proqramı var.'),
    ('AliExpress', 'AliExpress', 'aliexpress', 1, ''),
    # Next wave.
    ('Zalando', 'Awin', 'awin', 2, ' Açıq olanlar adətən Lounge / Privé by Zalando proqramlarıdır.'),
    ('Shein', 'Birbaşa', 'feed', 2, ' Shein-in öz affiliate proqramı və ya Awin.'),
    ('Temu', 'Impact', 'feed', 2, ' API/feed-i aktivləşdirmələrini xahiş et.'),
    ('Hepsiburada', 'Birbaşa', 'feed', 2, ' Əvvəlcə product feed istə; verməsələr affiliate link formatını.'),
    ('DeFacto', 'Admitad', 'feed', 2, ''),
    ('Boyner', 'Birbaşa', 'feed', 2, ''),
    ('Mavi', 'Birbaşa', 'feed', 2, ''),
    ('FLO', 'Birbaşa', 'feed', 2, ''),
    ('Modanisa', 'Birbaşa', 'feed', 2, ''),
    ('Vakko', 'Birbaşa', 'feed', 2, ''),
    ('Derimod', 'Birbaşa', 'feed', 2, ''),
    ('Converse', 'Awin', 'awin', 2, ''),
    ('Vans', 'Awin', 'awin', 2, ''),
    ('Reebok', 'Awin', 'awin', 2, ''),
    ('Skechers', 'Awin', 'awin', 2, ''),
    ('Foot Locker', 'Awin', 'awin', 2, ''),
    ('ASICS', 'Awin', 'awin', 2, ''),
    ('Dr. Martens', 'Awin', 'awin', 2, ''),
    ('Michael Kors', 'Rakuten', 'feed', 2, ''),
    ('Coach', 'Rakuten', 'feed', 2, ''),
    ('Tommy Hilfiger', 'Awin', 'awin', 2, ''),
    ('Fossil', 'CJ', 'feed', 2, ''),
    ('Ray-Ban', 'Awin', 'awin', 2, ''),
    ('Oakley', 'Awin', 'awin', 2, ''),
    ('Swarovski', 'Awin', 'awin', 2, ''),
    ('Pandora', 'Awin', 'awin', 2, ''),
    ('Tissot', 'Awin', 'awin', 2, ''),
    # Later: luxury, more high street, marketplaces.
    ('NET-A-PORTER', 'Rakuten', 'feed', 3, ''),
    ('MR PORTER', 'Rakuten', 'feed', 3, ''),
    ('Mytheresa', 'Rakuten', 'feed', 3, ''),
    ('LuisaViaRoma', 'Birbaşa', 'feed', 3, ''),
    ('END.', 'Awin', 'awin', 3, ''),
    ('REVOLVE', 'Rakuten', 'feed', 3, ''),
    ('Reserved', 'Birbaşa', 'feed', 3, ''),
    ('C&A', 'Awin', 'awin', 3, ''),
    ('Uniqlo', 'Birbaşa', 'feed', 3, ' Ölkəyə görə Rakuten və ya Awin.'),
    ('COS', 'Awin', 'awin', 3, ''),
    ('Lacoste', 'Awin', 'awin', 3, ''),
    ('Boohoo', 'Awin', 'awin', 3, ''),
    ('Bershka', 'Birbaşa', 'feed', 3, INDITEX),
    ('Pull&Bear', 'Birbaşa', 'feed', 3, INDITEX),
    ('Stradivarius', 'Birbaşa', 'feed', 3, INDITEX),
    ('Massimo Dutti', 'Birbaşa', 'feed', 3, INDITEX),
    ('Amazon', 'Amazon', 'links', 3, ''),
    ('eBay', 'Birbaşa', 'links', 3, ' eBay Partner Network-un API-si var; açarı alanda bağlayıcı yazılacaq.'),
]


def seed():
    """Create the missing target connections, switched off; never touches ones that exist. Returns how many were created."""
    from ..models import StoreSource
    made = 0
    for store, network, kind, priority, extra in TARGETS:
        _, created = StoreSource.objects.get_or_create(
            name=store,
            defaults={'store': store, 'kind': kind, 'network': network, 'priority': priority, 'active': False,
                      'notes': (HOW.get(network, '') + extra).strip()},
        )
        made += created
    return made
