"""
AliExpress Affiliate API (aliexpress.affiliate.product.query).

Get access at portals.aliexpress.com (affiliate account) and open.aliexpress.com (create an app,
"Affiliates API"): that gives an App Key and App Secret; the tracking id is in Portals.
Config: {"app_key": "...", "app_secret": "...", "tracking_id": "...",
         "keywords": ["women coat", "men jeans", ...], "ship_to": "AZ", "currency": "USD"}
Each keyword is searched and the results merged. The promotion link it returns is already the
affiliate link, so this source needs no link template.
"""
import hashlib
import hmac
import time

import requests

from . import SourceError

GATEWAY = 'https://api-sg.aliexpress.com/sync'
METHOD = 'aliexpress.affiliate.product.query'
DEFAULT_KEYWORDS = ['women coat', 'women jacket', 'women dress', 'women jeans', 'women sweater', 'women sneakers', 'women boots',
                    'men jacket', 'men coat', 'men jeans', 'men sweater', 'men shirt', 'men sneakers', 'men boots']


def sign(params, secret):
    """AliExpress (IOP) signature: HMAC-SHA256 over the sorted key+value pairs, uppercase hex."""
    base = ''.join(f'{k}{params[k]}' for k in sorted(params))
    return hmac.new(secret.encode(), base.encode(), hashlib.sha256).hexdigest().upper()


def _call(c, keyword, page):
    params = {
        'app_key': c['app_key'], 'method': METHOD, 'sign_method': 'sha256', 'timestamp': str(int(time.time() * 1000)),
        'keywords': keyword, 'page_no': str(page), 'page_size': '50', 'tracking_id': c.get('tracking_id', ''),
        'target_currency': c.get('currency', 'USD'), 'target_language': c.get('language', 'EN'),
        'ship_to_country': c.get('ship_to', 'AZ'), 'sort': 'LAST_VOLUME_DESC',
    }
    params['sign'] = sign(params, c['app_secret'])
    try:
        r = requests.post(GATEWAY, data=params, timeout=30)
        data = r.json()
    except (requests.RequestException, ValueError) as e:
        raise SourceError(f'AliExpress could not be reached: {e}') from e
    if 'error_response' in data:
        err = data['error_response']
        raise SourceError(f'AliExpress: {err.get("msg") or err.get("code")}')
    result = (data.get('aliexpress_affiliate_product_query_response') or {}).get('resp_result') or {}
    if str(result.get('resp_code')) not in ('200', ''):
        raise SourceError(f'AliExpress: {result.get("resp_msg") or result.get("resp_code")}')
    return ((result.get('result') or {}).get('products') or {}).get('product') or []


def _to_raw(p):
    rate = str(p.get('evaluate_rate') or '').rstrip('%')
    try:
        rating = round(float(rate) / 20, 2) if rate else None  # "96.4%" positive feedback → 4.82 on a 5 scale
    except ValueError:
        rating = None
    return {
        'external_id': f'ae-{p.get("product_id")}',
        'name': p.get('product_title'),
        'url': p.get('promotion_link') or p.get('product_detail_url'),
        'image_url': p.get('product_main_image_url'),
        'price': p.get('target_sale_price') or p.get('sale_price'),
        'previous_price': p.get('target_original_price') or p.get('original_price'),
        'currency': p.get('target_sale_price_currency') or 'USD',
        'brand': '', 'store': 'AliExpress',
        'category': f'{p.get("first_level_category_name") or ""} {p.get("second_level_category_name") or ""}',
        'rating': rating, 'review_count': None, 'in_stock': True,
    }


def fetch(source, limit=5000):
    c = source.config or {}
    if not (c.get('app_key') and c.get('app_secret')):
        raise SourceError('Add the AliExpress App Key and App Secret.')
    keywords = c.get('keywords') or DEFAULT_KEYWORDS
    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(',') if k.strip()]
    pages = int(c.get('pages', 2))
    out = []
    for kw in keywords:
        for page in range(1, pages + 1):
            products = _call(c, kw, page)
            out += [_to_raw(p) for p in products]
            if len(out) >= limit or len(products) < 50:
                break
        if len(out) >= limit:
            break
    return out[:limit]

