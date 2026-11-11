"""
Keep each user's client facts in step with the phone they use, for the admin
panel. The app sends these headers on every request (frontend/src/services/api.ts):

    X-Platform      ios | android
    X-App-Version   the app's version ("1.2.0")
    X-Country       the phone's own region ("AZ"), from its locale

and the network adds the address, placed in a country by api/ip_countries.py
(the registries' own allocation tables: no third party is asked). Plus
`last_seen_at`, so "last active" means last used, not last signed in.

Ported from SaveDo's ClientContextMiddleware. It runs before DRF
authenticates, so the token is matched straight in one UPDATE that touches no
rows when nothing changed and last-seen is fresh, which is the usual case.
Client headers are validated, never trusted: junk is dropped, not stored, and
a header that is missing never blanks what is known.
"""
from datetime import timedelta
from ipaddress import ip_address

from django.db.models import Q
from django.utils import timezone

from .ip_countries import country_for_ip

PLATFORMS = {'ios', 'android', 'web'}
VERSION_CHARS = set('0123456789.+-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
LAST_SEEN_EVERY = timedelta(minutes=5)

COUNTRIES = frozenset('''
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL
BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV
CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD
GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM
IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK
LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW
MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR
PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS
ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY
UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
'''.split())


def normalise_platform(value):
    v = (value or '').strip().lower()
    return v if v in PLATFORMS else ''


def normalise_version(value):
    v = (value or '').strip()[:20]
    return v if v and all(ch in VERSION_CHARS for ch in v) else ''


def normalise_country(value):
    """An ISO-3166 alpha-2 code from "AZ", "az-AZ" or "en_GB", or ''."""
    v = (value or '').strip().replace('_', '-')
    if '-' in v:
        v = v.rsplit('-', 1)[1]
    v = v.upper()
    return v if v in COUNTRIES else ''


def client_ip(request):
    """
    The caller's address: the LAST hop of X-Forwarded-For, which Caddy appends
    from what it saw itself (earlier hops are whatever the caller claimed), else
    the socket. Parsed, so nothing but an address comes out.
    """
    hops = [h.strip() for h in (request.headers.get('X-Forwarded-For') or '').split(',')]
    for candidate in (hops[-1] if hops else '', request.META.get('REMOTE_ADDR')):
        try:
            return str(ip_address((candidate or '').strip()))
        except ValueError:
            continue
    return ''


def client_fields(request):
    """{field: value} for what this request says, leaving out what it does not say."""
    out = {}
    if platform := normalise_platform(request.headers.get('X-Platform')):
        out['platform'] = platform
    if version := normalise_version(request.headers.get('X-App-Version')):
        out['app_version'] = version
    if country := normalise_country(request.headers.get('X-Country')):
        out['device_country'] = country
    ip = client_ip(request)
    if ip and (ip_country := country_for_ip(ip)):
        out['ip_country'] = ip_country
    return out


def stamp_user(user_qs, request):
    """Write the request's client facts and last-seen onto the matched user, unless already current."""
    from .models import User
    now = timezone.now()
    fields = {**client_fields(request), 'last_seen_at': now}
    current = Q(last_seen_at__gte=now - LAST_SEEN_EVERY)
    for k, v in fields.items():
        if k != 'last_seen_at':
            current &= Q(**{k: v})
    return User.objects.filter(pk__in=user_qs.values('pk')).exclude(current).update(**fields)


class ClientContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Token '):
            key = auth.split(' ', 1)[1].strip()
            if key:
                try:
                    from .models import User
                    stamp_user(User.objects.filter(auth_token__key=key, is_staff=False), request)
                except Exception:
                    pass  # bookkeeping never breaks a request
        return self.get_response(request)
