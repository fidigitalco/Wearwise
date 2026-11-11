"""
The admin panel's API (the Next.js app in /admin): sign-in for staff, the
dashboard numbers, analytics, and looking after accounts (plan, block, delete).
Every view but login is staff only.

Privacy: admins see counts and anonymous totals, never a user's closet, photos,
outfits or wear history.
"""
from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Q
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response

from .models import (
    AffiliateClick, AppFeedback, CrashReport, Feedback, Garment, Outfit, OutfitPlan, OutfitSet, Product, ServerError,
    SocialAccount, User, VideoScan, WearLog,
)
from .views import AuthThrottle

PAGE_SIZE = 25
ACTIVE_DAYS = 30


def staff(view):
    return permission_classes([permissions.IsAdminUser])(view)


def provider_of(user, providers):
    """How the account signs in: guest, apple, google or email."""
    if user.is_guest:
        return 'guest'
    return providers.get(user.id, 'email')


def providers_for(ids):
    return dict(SocialAccount.objects.filter(user_id__in=ids).values_list('user_id', 'provider'))


def active_ids(since):
    """Users who did anything since then: added a piece, asked for looks or logged a wear."""
    return (set(Garment.objects.filter(created_at__gte=since, is_sample=False).values_list('user_id', flat=True))
            | set(OutfitSet.objects.filter(created_at__gte=since).values_list('user_id', flat=True))
            | set(WearLog.objects.filter(created_at__gte=since).values_list('user_id', flat=True)))


def daily(qs, field, days):
    """Counts per day over the last `days`, zero-filled: {"labels": [...], "data": [...]}."""
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    rows = dict(qs.filter(**{f'{field}__date__gte': start}).annotate(d=TruncDate(field))
                .values('d').annotate(n=Count('pk')).values_list('d', 'n'))
    labels = [start + timedelta(days=i) for i in range(days)]
    return {'labels': [d.strftime('%d.%m') for d in labels], 'data': [rows.get(d, 0) for d in labels]}


def points(rows):
    return [{'name': name or '—', 'value': n} for name, n in rows]


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def admin_login(request):
    email = (request.data.get('email') or '').strip().lower()
    user = User.objects.filter(email__iexact=email).first()
    if not user or not user.check_password(request.data.get('password') or ''):
        return Response({'error': 'Invalid email or password.', 'code': 'invalid'}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.is_staff:
        return Response({'error': 'Admin access required.', 'code': 'not_staff'}, status=status.HTTP_403_FORBIDDEN)
    if not user.is_active:
        return Response({'error': 'Account disabled.', 'code': 'disabled'}, status=status.HTTP_403_FORBIDDEN)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'name': user.display_name or user.email.split('@')[0], 'email': user.email})


@api_view(['GET'])
@staff
def admin_stats(request):
    now = timezone.now()
    today = timezone.localdate()
    members = User.objects.filter(is_staff=False)
    real = members.filter(is_guest=False)
    return Response({
        'total_users': real.count(),
        'guests': members.filter(is_guest=True).count(),
        'new_today': real.filter(date_joined__date=today).count(),
        'new_this_week': real.filter(date_joined__gte=now - timedelta(days=7)).count(),
        'active_users': len(active_ids(now - timedelta(days=ACTIVE_DAYS)) & set(real.values_list('id', flat=True))),
        'premium_users': real.filter(plan='premium').count(),
        'blocked_users': real.filter(is_active=False).count(),
        'garments': Garment.objects.filter(is_sample=False).count(),
        'sample_garments': Garment.objects.filter(is_sample=True).count(),
        'outfits': Outfit.objects.count(),
        'saved_outfits': Outfit.objects.filter(saved=True).count(),
        'wears': WearLog.objects.count(),
        'plans': OutfitPlan.objects.filter(date__gte=today).count(),
        'open_feedback': AppFeedback.objects.filter(resolved=False).count(),
        'affiliate_clicks': AffiliateClick.objects.count(),
        'open_errors': CrashReport.objects.filter(resolved=False).count() + ServerError.objects.filter(resolved=False).count(),
        'seen_today': real.filter(last_seen_at__date=today).count(),
    })


@api_view(['GET'])
@staff
def admin_analytics(request):
    days = min(max(int(request.query_params.get('days', 30) or 30), 7), 365)
    now = timezone.now()
    members = User.objects.filter(is_staff=False, is_guest=False)
    ids = list(members.values_list('id', flat=True))
    active = len(active_ids(now - timedelta(days=ACTIVE_DAYS)) & set(ids))
    social = dict(SocialAccount.objects.filter(user_id__in=ids).values('provider').annotate(n=Count('user', distinct=True))
                  .values_list('provider', 'n'))
    with_social = SocialAccount.objects.filter(user_id__in=ids).values('user').distinct().count()
    feedback = Feedback.objects.exclude(liked=None).values('liked').annotate(n=Count('pk'))
    liked = {row['liked']: row['n'] for row in feedback}
    real_garments = Garment.objects.filter(is_sample=False)
    colors = {}
    for cs in real_garments.values_list('colors', flat=True):
        if cs:
            name = (cs[0] or {}).get('name')
            if name:
                colors[name] = colors.get(name, 0) + 1
    return Response({
        'signups': daily(members, 'date_joined', days),
        'guests': daily(User.objects.filter(is_guest=True), 'date_joined', days),
        'looks': daily(OutfitSet.objects.filter(source='recommend'), 'created_at', days),
        'assistant': daily(OutfitSet.objects.filter(source='assistant'), 'created_at', days),
        'wears': daily(WearLog.objects.all(), 'created_at', days),
        'uploads': daily(real_garments, 'created_at', days),
        'clicks': daily(AffiliateClick.objects.all(), 'created_at', days),
        'active_inactive': [{'name': 'active', 'value': active}, {'name': 'inactive', 'value': len(ids) - active}],
        'providers': [{'name': 'email', 'value': len(ids) - with_social}]
        + [{'name': p, 'value': social.get(p, 0)} for p in ('apple', 'google')],
        'plans': points(members.values('plan').annotate(n=Count('pk')).values_list('plan', 'n')),
        'styles': points(members.filter(onboarded=True).values('style_direction').annotate(n=Count('pk'))
                         .order_by('-n').values_list('style_direction', 'n')),
        'occasions': points(members.filter(onboarded=True).values('main_occasion').annotate(n=Count('pk'))
                            .order_by('-n').values_list('main_occasion', 'n')),
        'categories': points(real_garments.values('category').annotate(n=Count('pk')).order_by('-n')
                             .values_list('category', 'n')),
        'colors': [{'name': k, 'value': v} for k, v in sorted(colors.items(), key=lambda kv: -kv[1])[:10]],
        'feedback': [{'name': 'liked', 'value': liked.get(True, 0)}, {'name': 'disliked', 'value': liked.get(False, 0)}],
        'stores': [{'name': r['store'], 'value': r['n']} for r in
                   AffiliateClick.objects.filter(created_at__gte=timezone.now() - timedelta(days=days))
                   .values('store').annotate(n=Count('id')).order_by('-n')],
        'platforms': breakdown(members, 'platform'),
        'versions': breakdown(members, 'app_version', top=8),
        'device_countries': breakdown(members, 'device_country', top=10),
        'ip_countries': breakdown(members, 'ip_country', top=10),
        'install_sources': breakdown(members.filter(platform='android'), 'install_source', top=10),
        'avg_garments': round(real_garments.count() / len(ids), 1) if ids else 0,
        'onboarded': members.filter(onboarded=True).count(),
        'total': len(ids),
    })


def breakdown(qs, field, top=None):
    """[{name, value}] per value of `field`, most first; '' (never reported) is named 'unknown' and comes last."""
    rows = list(qs.values(field).annotate(n=Count('pk')).order_by('-n').values_list(field, 'n'))
    known = [(k, n) for k, n in rows if k]
    unknown = sum(n for k, n in rows if not k)
    if top and len(known) > top:
        known = known[:top] + [('other', sum(n for _, n in known[top:]))]
    return points(known + ([('unknown', unknown)] if unknown else []))


def client_info(u):
    """What the app reported about itself: platform, version, the phone's region, the network's country, last seen."""
    return {
        'platform': u.platform or 'unknown',
        'app_version': u.app_version,
        'device_country': u.device_country,
        'ip_country': u.ip_country,
        'last_seen_at': u.last_seen_at.isoformat() if u.last_seen_at else None,
        'install_source': u.install_source,
    }


def user_row(u, providers):
    return {
        'id': u.id,
        'email': '' if u.is_guest else u.email,
        'name': u.display_name,
        'provider': provider_of(u, providers),
        'plan': u.plan,
        'is_guest': u.is_guest,
        'is_active': u.is_active,
        'onboarded': u.onboarded,
        'date_joined': u.date_joined.isoformat(),
        'garments': u.n_garments,
        'outfits': u.n_outfits,
        'wears': u.n_wears,
        **client_info(u),
    }


@api_view(['GET'])
@staff
def admin_users(request):
    """?q, ?plan=free|premium, ?kind=member|guest|blocked, ?sort, ?page → {results, count, page, pages}."""
    p = request.query_params
    qs = User.objects.filter(is_staff=False).annotate(
        n_garments=Count('garments', filter=Q(garments__is_sample=False), distinct=True),
        n_outfits=Count('outfits', filter=Q(outfits__saved=True), distinct=True),
        n_wears=Count('wear_log', distinct=True),
    )
    if q := p.get('q', '').strip():
        qs = qs.filter(Q(email__icontains=q) | Q(display_name__icontains=q))
    if p.get('plan') in ('free', 'premium'):
        qs = qs.filter(plan=p['plan'])
    kind = p.get('kind')
    if kind == 'member':
        qs = qs.filter(is_guest=False)
    elif kind == 'guest':
        qs = qs.filter(is_guest=True)
    elif kind == 'blocked':
        qs = qs.filter(is_active=False)
    if provider := p.get('provider'):
        if provider in ('apple', 'google'):
            qs = qs.filter(Exists(SocialAccount.objects.filter(user=OuterRef('pk'), provider=provider)))
        elif provider == 'email':
            qs = qs.filter(is_guest=False).exclude(Exists(SocialAccount.objects.filter(user=OuterRef('pk'))))
    if platform := p.get('platform'):
        qs = qs.filter(platform='' if platform == 'unknown' else platform)
    if country := p.get('country'):
        qs = qs.filter(device_country='' if country == 'unknown' else country.upper()[:2])
    if ip_country := p.get('ip_country'):
        qs = qs.filter(ip_country='' if ip_country == 'unknown' else ip_country.upper()[:2])
    if source := p.get('source'):
        qs = qs.filter(install_source='' if source == 'unknown' else source)
    if version := p.get('version'):
        qs = qs.filter(app_version=version)
    sorts = {'-date_joined', 'date_joined', '-n_garments', '-n_wears', 'email', '-last_seen_at'}
    sort = p.get('sort') if p.get('sort') in sorts else '-date_joined'
    if sort == '-last_seen_at':
        from django.db.models import F
        qs = qs.order_by(F('last_seen_at').desc(nulls_last=True), '-pk')
    else:
        qs = qs.order_by(sort, '-pk')
    count = qs.count()
    pages = max(1, -(-count // PAGE_SIZE))
    page = min(max(int(p.get('page', 1) or 1), 1), pages)
    rows = list(qs[(page - 1) * PAGE_SIZE: page * PAGE_SIZE])
    providers = providers_for([u.id for u in rows])
    return Response({'results': [user_row(u, providers) for u in rows], 'count': count, 'page': page, 'pages': pages})


@api_view(['GET', 'PATCH', 'DELETE'])
@staff
def admin_user(request, pk):
    """
    One user: profile and how much they use the app, as counts only. What is in
    their closet, their outfits and what they wore stay private: an admin never
    sees them. PATCH {plan, is_active}; DELETE removes the account.
    """
    user = get_object_or_404(User, pk=pk, is_staff=False)
    if request.method == 'DELETE':
        for g in Garment.objects.filter(user=user):
            for f in (g.image, g.cutout):
                if f:
                    f.delete(save=False)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == 'PATCH':
        fields = []
        if request.data.get('plan') in ('free', 'premium'):
            user.plan = request.data['plan']
            fields.append('plan')
        if isinstance(request.data.get('is_active'), bool):
            user.is_active = request.data['is_active']
            fields.append('is_active')
            if not user.is_active:
                Token.objects.filter(user=user).delete()
        if fields:
            user.save(update_fields=fields)
    providers = providers_for([user.id])
    garments = Garment.objects.filter(user=user)
    outfits = Outfit.objects.filter(user=user)
    today = timezone.localdate()
    last = max(filter(None, [
        garments.order_by('-created_at').values_list('created_at', flat=True).first(),
        OutfitSet.objects.filter(user=user).order_by('-created_at').values_list('created_at', flat=True).first(),
        WearLog.objects.filter(user=user).order_by('-created_at').values_list('created_at', flat=True).first(),
    ]), default=None)
    return Response({
        'id': user.id,
        'email': '' if user.is_guest else user.email,
        'name': user.display_name,
        'provider': provider_of(user, providers),
        'plan': user.plan,
        'is_guest': user.is_guest,
        'is_active': user.is_active,
        'onboarded': user.onboarded,
        'date_joined': user.date_joined.isoformat(),
        'last_active': last.isoformat() if last else None,
        'style_direction': user.style_direction,
        'main_occasion': user.main_occasion,
        'favorite_colors': user.favorite_colors,
        'location': [user.latitude, user.longitude] if user.latitude is not None else None,
        **client_info(user),
        'install_medium': user.install_medium,
        'install_campaign': user.install_campaign,
        'shop_country': user.country,
        'counts': {
            'crashes': CrashReport.objects.filter(user=user).count(),
            'garments': garments.filter(is_sample=False).count(),
            'samples': garments.filter(is_sample=True).count(),
            'outfits': outfits.count(),
            'saved': outfits.filter(saved=True).count(),
            'wears': WearLog.objects.filter(user=user).count(),
            'plans': OutfitPlan.objects.filter(user=user, date__gte=today).count(),
            'looks_asked': OutfitSet.objects.filter(user=user, source='recommend').count(),
            'assistant': OutfitSet.objects.filter(user=user, source='assistant').count(),
            'scans': VideoScan.objects.filter(user=user).count(),
        },
    })


@api_view(['GET'])
@staff
def admin_premium(request):
    members = User.objects.filter(is_staff=False, is_guest=False)
    premium = members.filter(plan='premium').order_by('-date_joined')
    providers = providers_for(list(premium.values_list('id', flat=True)))
    rows = premium.annotate(
        n_garments=Count('garments', filter=Q(garments__is_sample=False), distinct=True),
        n_outfits=Count('outfits', filter=Q(outfits__saved=True), distinct=True),
        n_wears=Count('wear_log', distinct=True),
    )
    total = members.count()
    return Response({
        'premium': premium.count(),
        'free': total - premium.count(),
        'conversion': round(premium.count() / total * 100, 1) if total else 0,
        'users': [user_row(u, providers) for u in rows],
    })


def feedback_row(f):
    u = f.user
    return {
        'id': f.id, 'kind': f.kind, 'message': f.message, 'platform': f.platform, 'app_version': f.app_version,
        'resolved': f.resolved, 'created_at': f.created_at,
        # Who wrote it, so an admin can reply: the user sent this to us themselves.
        'user': {'id': u.id, 'email': u.email, 'name': u.display_name, 'is_guest': u.is_guest} if u else None,
    }


@api_view(['GET'])
@staff
def admin_feedback(request):
    """?status=open|resolved, ?kind, ?page → {results, count, page, pages, open}."""
    p = request.query_params
    qs = AppFeedback.objects.select_related('user')
    if p.get('status') == 'open':
        qs = qs.filter(resolved=False)
    elif p.get('status') == 'resolved':
        qs = qs.filter(resolved=True)
    if p.get('kind') in AppFeedback.KINDS:
        qs = qs.filter(kind=p['kind'])
    count = qs.count()
    pages = max(1, -(-count // PAGE_SIZE))
    page = min(max(int(p.get('page', 1) or 1), 1), pages)
    return Response({
        'results': [feedback_row(f) for f in qs[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]],
        'count': count, 'page': page, 'pages': pages,
        'open': AppFeedback.objects.filter(resolved=False).count(),
    })


@api_view(['PATCH', 'DELETE'])
@staff
def admin_feedback_item(request, pk):
    f = get_object_or_404(AppFeedback.objects.select_related('user'), pk=pk)
    if request.method == 'DELETE':
        f.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if 'resolved' in request.data:
        f.resolved = bool(request.data['resolved'])
        f.save(update_fields=['resolved'])
    return Response(feedback_row(f))


# ── Products: real pieces with the link to their own page ─────────────────
#
# The app shows these as the one or two concrete pieces under a "complete your
# wardrobe" pick and in Discovery. Demo rows (load_catalog) only link to a store
# search; they can be switched off here, not edited, because every deploy
# reloads them.

STORE_HOSTS = {
    'trendyol.com': 'Trendyol', 'zara.com': 'Zara', 'hm.com': 'H&M', 'mango.com': 'Mango', 'asos.com': 'ASOS',
    'amazon.': 'Amazon', 'cos.com': 'COS', 'massimodutti.com': 'Massimo Dutti', 'uniqlo.com': 'Uniqlo',
    'nike.com': 'Nike', 'aliexpress.': 'AliExpress', 'bershka.com': 'Bershka', 'pullandbear.com': 'Pull&Bear',
    'stradivarius.com': 'Stradivarius', 'lcwaikiki.com': 'LC Waikiki', 'defacto.com': 'DeFacto', 'koton.com': 'Koton',
    'boyner.com': 'Boyner', 'hepsiburada.com': 'Hepsiburada', 'adidas.': 'Adidas', 'ozon.': 'Ozon',
    'wildberries.': 'Wildberries', 'umico.az': 'Umico',
}
CURRENCIES = ['AZN', 'TRY', 'USD', 'EUR', 'GBP', 'RUB']
GENDERS = ['women', 'men', 'unisex']
SEARCH_KEYS = {'q', 'k', 'searchterm', 'term', 'query', 'search', 'text', 'keyword'}


def store_of(url):
    from urllib.parse import urlparse
    host = (urlparse(url).hostname or '').lower().removeprefix('www.').removeprefix('m.')
    for key, name in STORE_HOSTS.items():
        if key in host:
            return name
    return host.split('.')[0].capitalize() if host else ''


def is_search_url(url):
    """True for a store's search page (…/sr?q=, /search?q=, /s?k=), which lists many pieces instead of one."""
    from urllib.parse import parse_qs, urlparse
    u = urlparse(url)
    path = u.path.lower().rstrip('/')
    keys = {k.lower() for k in parse_qs(u.query)}
    return bool(keys & SEARCH_KEYS) or path in ('/sr', '/s', '/search') or '/search' in path or '/wholesale' in path


def product_row(p):
    return {
        'id': p.id, 'name': p.name, 'store': p.store, 'brand': p.brand, 'price': float(p.price), 'currency': p.currency,
        'category': p.category, 'subcategory': p.subcategory, 'color': p.color, 'gender': p.gender,
        'image_url': p.image_url, 'url': p.url, 'active': p.active, 'is_demo': p.is_demo,
        'created_at': p.created_at.isoformat(),
    }


def clean_product(data, partial=False):
    """(fields, errors) for a product from the admin form; only the fields sent when partial."""
    from decimal import Decimal, InvalidOperation
    from django.core.validators import URLValidator
    from django.core.exceptions import ValidationError as DjangoValidationError
    from . import taxonomy as tx
    from .shopping import TYPE_DEFAULTS
    out, err = {}, {}
    url_ok = URLValidator(schemes=['http', 'https'])

    def given(key):
        return key in data or not partial

    if given('url'):
        url = (data.get('url') or '').strip()
        try:
            url_ok(url)
            if is_search_url(url):
                err['url'] = 'search'
            else:
                out['url'] = url
        except DjangoValidationError:
            err['url'] = 'invalid'
    if given('name'):
        name = (data.get('name') or '').strip()[:160]
        if name:
            out['name'] = name
        else:
            err['name'] = 'required'
    if given('price'):
        try:
            price = Decimal(str(data.get('price')))
            if price < 0 or price > Decimal('999999'):
                raise InvalidOperation
            out['price'] = price.quantize(Decimal('0.01'))
        except (InvalidOperation, ValueError, TypeError):
            err['price'] = 'invalid'
    if given('currency'):
        cur = (data.get('currency') or 'AZN').upper()
        if cur in CURRENCIES:
            out['currency'] = cur
        else:
            err['currency'] = 'invalid'
    if given('subcategory'):
        sub = data.get('subcategory') or ''
        if sub in tx.ALL_SUBCATEGORIES:
            out['subcategory'] = sub
            out['category'] = next(c for c, subs in tx.CATEGORIES.items() if sub in subs)
            if not partial:
                out['formality'], out['warmth'] = TYPE_DEFAULTS.get(sub, (2, 1))
                cat = out['category']
                out['sizes'] = [str(n) for n in range(36, 46)] if cat == 'shoes' else (
                    [] if cat in ('bag', 'accessory') else ['XS', 'S', 'M', 'L', 'XL'])
        else:
            err['subcategory'] = 'invalid'
    if given('color'):
        if data.get('color') in tx.COLORS:
            out['color'] = data['color']
        else:
            err['color'] = 'invalid'
    if given('gender'):
        if (data.get('gender') or 'women') in GENDERS:
            out['gender'] = data.get('gender') or 'women'
        else:
            err['gender'] = 'invalid'
    if given('image_url'):
        img = (data.get('image_url') or '').strip()
        if img:
            try:
                url_ok(img)
                out['image_url'] = img
            except DjangoValidationError:
                err['image_url'] = 'invalid'
        else:
            out['image_url'] = ''
    if given('brand'):
        out['brand'] = (data.get('brand') or '').strip()[:60]
    if 'store' in data or 'url' in out:
        store = (data.get('store') or '').strip()[:40] or (store_of(out['url']) if 'url' in out else '')
        if store:
            out['store'] = store
        elif not partial:
            err['store'] = 'required'
    if 'active' in data:
        if isinstance(data['active'], bool):
            out['active'] = data['active']
        else:
            err['active'] = 'invalid'
    return out, err


@api_view(['GET'])
@staff
def admin_product_meta(request):
    """The form's choices with their Azerbaijani and English names: types by category, colours, genders, currencies."""
    from . import taxonomy as tx
    from .engine.describe import color_name, kind_name
    return Response({
        'categories': [{'id': c, 'subs': [{'id': s, 'az': kind_name(s, 'az'), 'en': kind_name(s, 'en')} for s in subs]}
                       for c, subs in tx.CATEGORIES.items()],
        'colors': [{'id': c, 'az': color_name(c, 'az'), 'en': color_name(c, 'en'), 'rgb': list(rgb)}
                   for c, rgb in tx.COLORS.items()],
        'genders': GENDERS,
        'currencies': CURRENCIES,
    })


@api_view(['POST'])
@staff
def admin_product_guess(request):
    """{url} → {store, subcategory, color, search}: what can be read from the link itself, to prefill the form."""
    from .catalog import read_link
    url = (request.data.get('url') or '').strip()
    sub, color = read_link(url) if url else (None, None)
    return Response({'store': store_of(url) if url else '', 'subcategory': sub, 'color': color,
                     'search': bool(url) and is_search_url(url)})


@api_view(['GET', 'POST'])
@staff
def admin_products(request):
    """GET ?q, ?kind=real|demo, ?page → {results, count, page, pages, real, demo}; POST adds a real piece."""
    if request.method == 'POST':
        fields, err = clean_product(request.data)
        if err:
            return Response({'error': 'invalid', 'fields': err}, status=status.HTTP_400_BAD_REQUEST)
        p = Product.objects.create(is_demo=False, **fields)
        return Response(product_row(p), status=status.HTTP_201_CREATED)
    p = request.query_params
    qs = Product.objects.all()
    if p.get('kind') == 'real':
        qs = qs.filter(is_demo=False)
    elif p.get('kind') == 'demo':
        qs = qs.filter(is_demo=True)
    q = (p.get('q') or '').strip()
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(store__icontains=q) | Q(brand__icontains=q) | Q(url__icontains=q))
    qs = qs.order_by('is_demo', '-created_at')
    count = qs.count()
    pages = max(1, -(-count // PAGE_SIZE))
    try:
        page = min(max(1, int(p.get('page', 1))), pages)
    except ValueError:
        page = 1
    rows = qs[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
    return Response({
        'results': [product_row(x) for x in rows], 'count': count, 'page': page, 'pages': pages,
        'real': Product.objects.filter(is_demo=False).count(), 'demo': Product.objects.filter(is_demo=True).count(),
    })


@api_view(['PATCH', 'DELETE'])
@staff
def admin_product(request, pk):
    """PATCH any form field (a demo row only takes `active`); DELETE removes a real piece."""
    p = get_object_or_404(Product, pk=pk)
    if request.method == 'DELETE':
        if p.is_demo:
            return Response({'error': 'Demo products are switched off, not deleted.', 'code': 'demo'},
                            status=status.HTTP_400_BAD_REQUEST)
        p.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    data = request.data
    if p.is_demo:
        data = {k: v for k, v in data.items() if k == 'active'}
    fields, err = clean_product(data, partial=True)
    if err:
        return Response({'error': 'invalid', 'fields': err}, status=status.HTTP_400_BAD_REQUEST)
    for k, v in fields.items():
        setattr(p, k, v)
    if fields:
        p.save()
    return Response(product_row(p))


# ── Errors: app crashes and server errors ─────────────────────────────────

def crash_row(c):
    return {
        'id': c.id, 'kind': 'crash', 'message': c.message, 'detail': c.stack, 'platform': c.platform,
        'app_version': c.app_version, 'device': c.device, 'fatal': c.fatal, 'resolved': c.resolved,
        'count': 1, 'created_at': c.created_at.isoformat(), 'last_seen_at': c.created_at.isoformat(),
        'user': {'id': c.user_id, 'email': '' if c.user.is_guest else c.user.email} if c.user_id else None,
    }


def server_row(e):
    return {
        'id': e.id, 'kind': 'server', 'message': e.message, 'detail': e.traceback, 'endpoint': e.endpoint,
        'method': e.method, 'level': e.level, 'resolved': e.resolved, 'count': e.count,
        'created_at': e.created_at.isoformat(), 'last_seen_at': e.last_seen_at.isoformat(),
        'user': {'id': e.user_id, 'email': '' if e.user.is_guest else e.user.email} if e.user_id else None,
    }


ERROR_KINDS = {'crash': (CrashReport, crash_row, '-created_at'), 'server': (ServerError, server_row, '-last_seen_at')}


@api_view(['GET'])
@staff
def admin_errors(request):
    """?kind=crash|server, ?status=open|resolved|'', ?page → {results, count, page, pages, open: {crash, server}, by_version}."""
    p = request.query_params
    model, row, order = ERROR_KINDS.get(p.get('kind'), ERROR_KINDS['crash'])
    qs = model.objects.select_related('user')
    if p.get('status', 'open') == 'open':
        qs = qs.filter(resolved=False)
    elif p.get('status') == 'resolved':
        qs = qs.filter(resolved=True)
    qs = qs.order_by(order, '-pk')
    count = qs.count()
    pages = max(1, -(-count // PAGE_SIZE))
    try:
        page = min(max(1, int(p.get('page', 1))), pages)
    except ValueError:
        page = 1
    week = timezone.now() - timedelta(days=7)
    return Response({
        'results': [row(x) for x in qs[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]],
        'count': count, 'page': page, 'pages': pages,
        'open': {'crash': CrashReport.objects.filter(resolved=False).count(),
                 'server': ServerError.objects.filter(resolved=False).count()},
        'crashes_by_version': points(CrashReport.objects.filter(created_at__gte=week).values('app_version')
                                     .annotate(n=Count('pk')).order_by('-n').values_list('app_version', 'n')[:8]),
        'daily': {'crash': daily(CrashReport.objects.all(), 'created_at', 14),
                  'server': daily(ServerError.objects.all(), 'last_seen_at', 14)},
    })


@api_view(['PATCH', 'DELETE'])
@staff
def admin_error(request, kind, pk):
    """PATCH {resolved}; DELETE removes the row."""
    if kind not in ERROR_KINDS:
        return Response(status=status.HTTP_404_NOT_FOUND)
    model, row, _ = ERROR_KINDS[kind]
    obj = get_object_or_404(model, pk=pk)
    if request.method == 'DELETE':
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if isinstance(request.data.get('resolved'), bool):
        obj.resolved = request.data['resolved']
        obj.save(update_fields=['resolved'])
    return Response(row(obj))
