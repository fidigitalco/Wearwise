"""
Real product data from stores and affiliate networks (build prompt §4.1).

Every connector turns its source into plain dicts in one shape (see normalize.RAW_FIELDS);
`sync(source)` normalises them into Product rows, updates what changed and switches off
products that disappeared from the source. Connectors:

  aliexpress.py  AliExpress Affiliate API
  awin.py        Awin product feeds (ASOS, Zalando, H&M, … once their programmes accept you)
  feed.py        any product feed file: Google Shopping XML, CSV or TSV (Trendyol, CJ, Rakuten …)
  links          no connector: products are added by hand, their links wrapped with the template

The owner fills a StoreSource in the admin panel (Stores) with what each store or network gave
them; `manage.py sync_stores` runs every connector daily.
"""
import logging

from django.utils import timezone

logger = logging.getLogger(__name__)

MAX_PER_SOURCE = 5000


class SourceError(Exception):
    """A connector could not fetch: wrong key, feed not found, network down. The message is shown in the panel."""


def connector(kind):
    from . import aliexpress, awin, feed
    return {'aliexpress': aliexpress.fetch, 'awin': awin.fetch, 'feed': feed.fetch}.get(kind)


def test(source):
    """Fetch a few products without saving: {ok, count, sample, error}."""
    fetch = connector(source.kind)
    if fetch is None:
        return {'ok': True, 'count': 0, 'sample': [], 'error': '', 'note': 'links'}
    try:
        raw = fetch(source, limit=5)
    except SourceError as e:
        return {'ok': False, 'count': 0, 'sample': [], 'error': str(e)}
    from .normalize import normalize
    items = [n for n in (normalize(r, source) for r in raw) if n]
    return {'ok': True, 'count': len(items), 'sample': [{k: str(v) for k, v in n.items() if k in ('name', 'price', 'currency', 'subcategory', 'color', 'url')} for n in items[:5]], 'error': ''}


def sync(source):
    """Import the source's products; returns {created, updated, deactivated, skipped} and records the outcome."""
    from ..models import Product
    from .normalize import normalize
    fetch = connector(source.kind)
    if fetch is None:
        source.last_status = 'Links only: add products by hand in Products.'
        source.last_sync_at = timezone.now()
        source.save(update_fields=['last_status', 'last_sync_at'])
        return {'created': 0, 'updated': 0, 'deactivated': 0, 'skipped': 0}
    try:
        raw = fetch(source, limit=MAX_PER_SOURCE)
    except SourceError as e:
        source.last_status = f'Error: {e}'[:300]
        source.last_sync_at = timezone.now()
        source.save(update_fields=['last_status', 'last_sync_at'])
        raise
    created = updated = skipped = 0
    seen = set()
    for r in raw:
        fields = normalize(r, source)
        if not fields:
            skipped += 1  # not clothing we can place (a phone case in a fashion feed, no price…)
            continue
        ext = fields.pop('external_id')
        if ext in seen:
            continue
        seen.add(ext)
        obj, made = Product.objects.update_or_create(source=source, external_id=ext, defaults={**fields, 'active': True, 'is_demo': False})
        created += made
        updated += not made
    deactivated = Product.objects.filter(source=source, active=True).exclude(external_id__in=seen).update(active=False)
    source.product_count = Product.objects.filter(source=source, active=True).count()
    source.last_status = f'OK: {created} new, {updated} updated, {deactivated} gone, {skipped} skipped'
    source.last_sync_at = timezone.now()
    source.save(update_fields=['product_count', 'last_status', 'last_sync_at'])
    return {'created': created, 'updated': updated, 'deactivated': deactivated, 'skipped': skipped}


def sync_all():
    from ..models import StoreSource
    out = {}
    for source in StoreSource.objects.filter(active=True).exclude(kind='links'):
        try:
            out[source.name] = sync(source)
        except SourceError as e:
            out[source.name] = {'error': str(e)}
        except Exception as e:  # noqa: BLE001 - one broken source must not stop the others
            logger.exception('Sync of %s failed', source.name)
            source.last_status = f'Error: {e}'[:300]
            source.save(update_fields=['last_status'])
            out[source.name] = {'error': str(e)}
    return out
