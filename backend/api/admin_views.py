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
    AffiliateClick, AppFeedback, Feedback, Garment, Outfit, OutfitPlan, OutfitSet, SocialAccount, User, VideoScan, WearLog,
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
        'avg_garments': round(real_garments.count() / len(ids), 1) if ids else 0,
        'onboarded': members.filter(onboarded=True).count(),
        'total': len(ids),
    })


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
    sorts = {'-date_joined', 'date_joined', '-n_garments', '-n_wears', 'email'}
    qs = qs.order_by(p.get('sort') if p.get('sort') in sorts else '-date_joined', '-pk')
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
        'counts': {
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
