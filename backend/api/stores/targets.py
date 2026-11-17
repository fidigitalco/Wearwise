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
    'Partnerize': 'Partnerize-də publisher hesabı aç → brendin proqramına müraciət et → product feed linkini "Feed URL"-ə yaz.',
    'FlexOffers': 'FlexOffers-də publisher hesabı aç → proqrama müraciət et → product feed linkini "Feed URL"-ə yaz; '
                  'yalnız link verirlərsə növü "Yalnız affiliate link"-ə dəyiş.',
    'Skimlinks': 'skimlinks.com-da publisher qeydiyyatı (app kimi). Təsdiqdən sonra Publisher ID-ni al və link şablonunu yaz: '
                 'https://go.skimresources.com/?id=SƏNİN-ID&xs=1&url={url_encoded} (formatı Skimlinks panelində yoxla). '
                 'Bu "ümumi bükücü"dür: öz proqramı olmayan BÜTÜN mağazaların linkləri bununla açılır.',
    'Sovrn': 'sovrn.com/commerce-də qeydiyyat. API key-i al və şablonu yaz: https://redirect.viglink.com?key=SƏNİN-KEY&u={url_encoded} '
             '(formatı Sovrn panelində yoxla). Skimlinks-ə alternativ ümumi bükücü: ikisindən yalnız birini aktiv et.',
    'Amazon': 'Amazon Associates-ə qoşul və adi linklərlə satış et; 30 gündə 10 satışdan sonra Creators API açılır. O vaxta qədər '
              'növ "Yalnız affiliate link": şablon {url}?tag=SƏNİN-TAG.',
}
INDITEX = ' ⚠️ Inditex-in açıq affiliate proqramı bilinmir: birbaşa soruş.'

# (store, network, kind, priority, extra note)
TARGETS = [
    # First wave: the 15 picked in docs/partner-targets.md.
    # One sign-up that wraps links for every store without its own programme (store '*').
    ('Skimlinks', 'Skimlinks', 'links', 1, ''),
    ('Sovrn Commerce', 'Sovrn', 'links', 2, ''),
    ('ASOS', 'Awin', 'awin', 1, ' Vahid qlobal proqram yoxdur: Awin (IT), FlexOffers (US/Asiya), Rakuten. Öz bölgən üçün seç.'),
    ('H&M', 'FlexOffers', 'feed', 1, ' Sovrn, Skimlinks və ya FlexOffers üzərindən; Skimlinks aktivdirsə ayrıca lazım olmaya bilər.'),
    ('Mango', 'Awin', 'awin', 1, ''),
    ('Zara', 'Birbaşa', 'feed', 1, INDITEX),
    ('Trendyol', 'Birbaşa', 'feed', 1, ' Yeganə real yol B2B partnyorluqdur (məktub A, docs/affiliate-applications.md): feed + deep link + S2S. '
                                             'TrendFam yalnız 10K+ influencer üçündür, Admitad TR bağlıdır, Trendyol DE FlexOffers-dədir.'),
    ('LC Waikiki', 'Admitad', 'feed', 1, ' Admitad-da yoxdursa birbaşa yaz.'),
    ('Koton', 'Admitad', 'feed', 1, ' Admitad-da yoxdursa birbaşa yaz.'),
    ('Nike', 'Impact', 'feed', 1, ' Ölkəyə görə Awin və ya CJ də ola bilər.'),
    ('Adidas', 'Awin', 'awin', 1, ' Ölkəyə görə CJ və ya Rakuten də ola bilər.'),
    ('New Balance', 'Awin', 'awin', 1, ' CJ / Impact da ola bilər.'),
    ('Puma', 'Awin', 'awin', 1, ' CJ / Impact da ola bilər.'),
    ('Guess', 'Awin', 'awin', 1, ' Çanta, saat və eynək də var.'),
    ('Calvin Klein', 'Awin', 'awin', 1, ' CJ / Rakuten da ola bilər.'),
    ('Farfetch', 'Partnerize', 'feed', 1, ' 10%-ə qədər komissiya, 30 günlük cookie.'),
    ('SSENSE', 'Birbaşa', 'feed', 1, ' SSENSE-in öz affiliate proqramı var.'),
    ('AliExpress', 'AliExpress', 'aliexpress', 1, ''),
    # Next wave.
    ('Zalando', 'Awin', 'awin', 2, ' Əsas Zalando proqramları Awin-də bağlıdır; açıq olanlar Lounge / Privé by Zalando (outlet).'),
    ('Shein', 'Birbaşa', 'feed', 1, ' SHEIN saytında birbaşa müraciət (CJ artıq qəbul etmir). Feed üçün məktub C. 10–20% komissiya.'),
    ('Temu', 'Impact', 'feed', 2, ' API/feed-i aktivləşdirmələrini xahiş et.'),
    ('Hepsiburada', 'Birbaşa', 'feed', 2, ' "Link Gelir" proqramı (məktub B). Feed istə; verməsələr link formatını.'),
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


WRAPPERS = {'Skimlinks', 'Sovrn Commerce'}  # these wrap links for all stores: their store is "*"


def seed():
    """
    Create the missing target connections, switched off. A connection still waiting for its keys
    gets the latest network and instructions; one that has keys is never touched.
    Returns how many were created.
    """
    from ..models import StoreSource
    made = 0
    for store, network, kind, priority, extra in TARGETS:
        fields = {'network': network, 'priority': priority, 'notes': (HOW.get(network, '') + extra).strip()}
        src, created = StoreSource.objects.get_or_create(
            name=store,
            defaults={**fields, 'store': '*' if store in WRAPPERS else store, 'kind': kind, 'active': False},
        )
        made += created
        if not created and not src.active and not any((src.config or {}).values()) and not src.link_template:
            for k, v in fields.items():
                setattr(src, k, v)
            if src.kind != kind:
                src.kind = kind
            src.save()
    return made
