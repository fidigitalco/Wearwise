"""
"Find me this" hunts (build prompt §2.5) and the pushes they send.

A hunt is a saved smart search with a max price. `run_hunt` passes the catalogue
through the same funnel as smart search (api/pipeline.py); products that pass
and were not matched before become HuntMatch rows and one push goes to the
user's phones. `manage.py run_hunts` runs every active hunt; the server's timer
calls it every 6 hours.

Pushes go through Expo's push service (free, no key): the app registers its
Expo push token with POST /api/push-token/.
"""
import logging

import requests
from django.utils import timezone

from . import pipeline

logger = logging.getLogger(__name__)

FREE_ACTIVE_HUNTS = 1
EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'


def active_limit(user):
    """How many hunts may be searching at once: one on Free, no limit on Premium (None)."""
    return None if user.plan == 'premium' else FREE_ACTIVE_HUNTS


def can_activate(user, exclude_id=None):
    limit = active_limit(user)
    if limit is None:
        return True
    active = user.hunts.exclude(status='paused')
    if exclude_id:
        active = active.exclude(pk=exclude_id)
    return active.count() < limit


def run_hunt(hunt, notify=True):
    """Search once; returns the new matches (Product list)."""
    from .catalog import _wanted_gender
    from .models import HuntMatch, Product
    user = hunt.user
    intent = pipeline.parse_intent(hunt.query)
    if hunt.max_price is not None:
        intent['max_price'] = hunt.max_price
    intent = pipeline.merge_profile(intent, user)
    pool = Product.objects.filter(active=True, gender__in=_wanted_gender(user))
    out = pipeline.run(pool, user, intent, limit=20)
    known = set(hunt.matches.values_list('product_id', flat=True))
    new = [p for p in out['results'] if p.id not in known]
    for p in new:
        HuntMatch.objects.get_or_create(hunt=hunt, product=p)
    hunt.checked += out['matching']
    hunt.last_run_at = timezone.now()
    if hunt.matches.exists() and hunt.status == 'searching':
        hunt.status = 'found'
    hunt.save(update_fields=['checked', 'last_run_at', 'status'])
    if new and notify:
        push(user, title=hunt.query[:60], body=f'{len(new)} new match{"es" if len(new) > 1 else ""} for your hunt',
             data={'type': 'hunt', 'hunt': hunt.id})
        HuntMatch.objects.filter(hunt=hunt, product__in=new).update(notified=True)
    return new


def run_all():
    """Every hunt that is not paused; returns how many new matches were found."""
    from .models import Hunt
    total = 0
    for hunt in Hunt.objects.exclude(status='paused').select_related('user'):
        try:
            total += len(run_hunt(hunt))
        except Exception:  # noqa: BLE001 - one bad hunt must not stop the rest
            logger.exception('Hunt %s failed', hunt.pk)
    return total


def push(user, title, body, data=None):
    """Send one notification to each of the user's phones. Best effort; never raises."""
    from .models import PushToken
    tokens = list(PushToken.objects.filter(user=user).values_list('token', flat=True))
    if not tokens:
        return 0
    messages = [{'to': t, 'title': title, 'body': body, 'data': data or {}, 'sound': 'default'} for t in tokens]
    try:
        r = requests.post(EXPO_PUSH_URL, json=messages, timeout=10)
        tickets = r.json().get('data', []) if r.ok else []
    except (requests.RequestException, ValueError):
        logger.exception('Push to user %s failed', user.pk)
        return 0
    # A phone that uninstalled the app: forget its token.
    for token, ticket in zip(tokens, tickets):
        if ticket.get('status') == 'error' and (ticket.get('details') or {}).get('error') == 'DeviceNotRegistered':
            PushToken.objects.filter(token=token).delete()
    return len(tokens)
