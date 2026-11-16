"""
Any product feed file at a URL: Google Shopping XML (RSS or Atom with g: fields), CSV or TSV.
This is what most stores and networks hand partners (Trendyol on request, CJ, Rakuten, Impact,
Admitad, Google Merchant exports). Config: {"url": "...", "format": "auto|xml|csv|tsv"}.
Column names are matched loosely ("title"/"product_name", "link"/"deep_link" …).
"""
import csv
import gzip
import io
import xml.etree.ElementTree as ET

import requests

from . import SourceError

ALIASES = {
    'external_id': ('id', 'g:id', 'product_id', 'aw_product_id', 'sku', 'item_id'),
    'name': ('title', 'g:title', 'product_name', 'name'),
    'url': ('link', 'g:link', 'deep_link', 'aw_deep_link', 'product_url', 'url', 'buy_url'),
    'image_url': ('image_link', 'g:image_link', 'image_url', 'merchant_image_url', 'aw_image_url', 'image', 'large_image'),
    'price': ('sale_price', 'g:sale_price', 'search_price', 'price', 'g:price', 'current_price'),
    'previous_price': ('price', 'g:price', 'rrp_price', 'old_price', 'original_price', 'retail_price'),
    'currency': ('currency', 'g:currency'),
    'brand': ('brand', 'g:brand', 'brand_name', 'manufacturer'),
    'color': ('color', 'g:color', 'colour', 'Fashion:colour'),
    'category': ('product_type', 'g:product_type', 'google_product_category', 'g:google_product_category', 'category', 'merchant_category', 'category_name'),
    'gender': ('gender', 'g:gender', 'Fashion:suitable_for'),
    'sizes': ('size', 'g:size', 'sizes', 'Fashion:size'),
    'rating': ('average_rating', 'rating', 'product_rating'),
    'review_count': ('reviews', 'review_count', 'number_of_reviews'),
    'store': ('merchant_name', 'store', 'shop_name'),
    'availability': ('availability', 'g:availability', 'in_stock', 'stock_status'),
}


def download(url, timeout=120):
    try:
        r = requests.get(url, timeout=timeout, headers={'User-Agent': 'WearWiseFeed/1.0'})
    except requests.RequestException as e:
        raise SourceError(f'Could not download the feed: {e}') from e
    if r.status_code in (401, 403):
        raise SourceError('The feed refused access: check the key or link.')
    if not r.ok:
        raise SourceError(f'The feed answered {r.status_code}.')
    data = r.content
    if data[:2] == b'\x1f\x8b':
        data = gzip.decompress(data)
    return data.decode('utf-8-sig', errors='replace')


def _pick(row, field):
    for key in ALIASES[field]:
        v = row.get(key)
        if v not in (None, ''):
            return v
    return None


def _to_raw(row):
    out = {f: _pick(row, f) for f in ALIASES if f != 'availability'}
    # When both a sale price and the regular one exist, the regular one is the "before" price.
    if out['previous_price'] == out['price']:
        out['previous_price'] = None
    avail = str(_pick(row, 'availability') or '').strip().lower()
    out['in_stock'] = not (avail in ('0', 'no', 'false', 'n') or 'out' in avail or 'discontinued' in avail)
    return out


def parse_xml(text):
    try:
        root = ET.fromstring(text)
    except ET.ParseError as e:
        raise SourceError(f'The feed is not valid XML: {e}') from e
    rows = []
    for item in root.iter():
        tag = item.tag.split('}')[-1]
        if tag not in ('item', 'entry', 'product', 'offer'):
            continue
        row = {}
        for child in item:
            ns, _, local = child.tag.rpartition('}')
            key = f'g:{local}' if 'base.google.com' in ns else local
            text_v = (child.text or '').strip()
            if key in row and text_v:  # repeated tags such as several sizes
                row[key] = f'{row[key]},{text_v}'
            else:
                row[key] = text_v
        rows.append(row)
    return rows


def parse_csv(text, delimiter=None):
    sample = text[:4096]
    if delimiter is None:
        delimiter = '\t' if sample.count('\t') > sample.count(',') else (';' if sample.count(';') > sample.count(',') else ',')
    return list(csv.DictReader(io.StringIO(text), delimiter=delimiter))


def rows_from_text(text, fmt='auto'):
    fmt = (fmt or 'auto').lower()
    if fmt == 'xml' or (fmt == 'auto' and text.lstrip().startswith('<')):
        return parse_xml(text)
    return parse_csv(text, '\t' if fmt == 'tsv' else None)


def fetch(source, limit=5000):
    url = (source.config or {}).get('url', '').strip()
    if not url.startswith('http'):
        raise SourceError('Add the feed URL in the store settings.')
    rows = rows_from_text(download(url), (source.config or {}).get('format', 'auto'))
    return [_to_raw(r) for r in rows[:limit]]
