"""
Awin product feeds (ASOS, Zalando, H&M and other fashion stores on Awin).

After a store's programme accepts you, its feed id appears in Awin under Toolbox → Create-a-Feed.
Config: {"api_key": "...", "feed_ids": "12345,67890", "language": "en"}
The publisher API key is under Account → API credentials ("Product Feed API key").
"""
from . import SourceError
from .feed import _to_raw, download, parse_csv

COLUMNS = ','.join([
    'aw_product_id', 'product_name', 'aw_deep_link', 'merchant_image_url', 'aw_image_url', 'search_price', 'rrp_price',
    'currency', 'brand_name', 'colour', 'merchant_category', 'category_name', 'Fashion:size', 'Fashion:suitable_for',
    'average_rating', 'reviews', 'merchant_name', 'in_stock',
])
URL = ('https://productdata.awin.com/datafeed/download/apikey/{key}/language/{lang}/fid/{fids}'
       '/columns/{cols}/format/csv/delimiter/%2C/compression/gzip/adultcontent/1/')


def fetch(source, limit=5000):
    c = source.config or {}
    key, fids = c.get('api_key', '').strip(), str(c.get('feed_ids', '')).replace(' ', '')
    if not key or not fids:
        raise SourceError('Add the Awin product feed API key and at least one feed id.')
    text = download(URL.format(key=key, lang=c.get('language', 'en'), fids=fids, cols=COLUMNS))
    rows = parse_csv(text, ',')
    out = []
    for row in rows[:limit]:
        raw = _to_raw(row)
        raw['in_stock'] = str(row.get('in_stock', '1')).strip() not in ('0', 'false', 'no')
        out.append(raw)
    return out
