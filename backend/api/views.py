from datetime import timedelta

from django.contrib.auth import authenticate
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from . import taxonomy as tx
from .colors import extract_colors, remove_background
from .engine.harmony import PairTable
from .engine.recommend import NotEnoughGarments, explain, recommend
from .engine.scoring import score_outfit, season_for
from .engine.taste import update_taste
from .models import ColorPair, Feedback, Garment, MaterialPair, Outfit, OutfitItem, OutfitSet, TasteProfile, WearLog
from .serializers import (
    CheckOutfitSerializer, FeedbackSerializer, GarmentSerializer, LoginSerializer, OutfitSerializer,
    OutfitSetSerializer, RecommendRequestSerializer, RegisterSerializer, UserSerializer,
)
from .weather import forecast


class AuthThrottle(AnonRateThrottle):
    """Per-IP cap on sign-in and sign-up, against password guessing."""
    scope = 'auth'


def _auth_payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {'token': token.key, 'user': UserSerializer(user).data}


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def register(request):
    s = RegisterSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    user = s.save()
    TasteProfile.objects.create(user=user)
    return Response(_auth_payload(user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def login(request):
    s = LoginSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    user = authenticate(request, email=s.validated_data['email'].lower(), password=s.validated_data['password'])
    if not user:
        return Response({'detail': 'Email or password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(_auth_payload(user))


@api_view(['POST'])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'PATCH', 'DELETE'])
def me(request):
    if request.method == 'DELETE':
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == 'PATCH':
        s = UserSerializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def meta(request):
    """Every enumeration the app's pickers need, from the one source of truth."""
    return Response({
        'categories': tx.CATEGORIES,
        'colors': {k: list(v) for k, v in tx.COLORS.items()},
        'neutrals': sorted(tx.NEUTRALS),
        'patterns': tx.PATTERNS,
        'surfaces': tx.SURFACES,
        'sheens': tx.SHEENS,
        'fits': tx.FITS,
        'seasons': tx.SEASONS,
        'statuses': tx.STATUSES,
        'occasions': {k: list(v) for k, v in tx.OCCASIONS.items()},
        'style_directions': tx.STYLE_DIRECTIONS,
        'material_sources': tx.MATERIAL_SOURCES,
    })


class GarmentViewSet(viewsets.ModelViewSet):
    serializer_class = GarmentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ['category', 'status']

    def get_queryset(self):
        return Garment.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        g = serializer.save(user=self.request.user)
        if g.image:
            self._analyse(g, keep_user_colors=bool(serializer.validated_data.get('colors')))

    def perform_update(self, serializer):
        new_image = 'image' in serializer.validated_data
        g = serializer.save()
        if new_image and g.image:
            self._analyse(g, keep_user_colors=bool(serializer.validated_data.get('colors')))

    def _analyse(self, g, keep_user_colors):
        """Cutout (when rembg is installed) and colour extraction on upload."""
        g.image.open('rb')
        cut = remove_background(g.image)
        if cut:
            g.cutout.save(f'{g.id}_cutout.png', ContentFile(cut), save=False)
        if not keep_user_colors:
            src = g.cutout if cut else g.image
            src.open('rb')
            colors, low_light = extract_colors(src)
            g.colors = colors
            conf = dict(g.attribute_confidence or {})
            conf['color'] = 0.5 if low_light else 0.8
            g.attribute_confidence = conf
        g.save()

    @action(detail=True, methods=['post'], url_path='detect-colors')
    def detect_colors(self, request, pk=None):
        g = self.get_object()
        if not g.image:
            return Response({'detail': 'This garment has no photo.'}, status=status.HTTP_400_BAD_REQUEST)
        self._analyse(g, keep_user_colors=False)
        return Response(GarmentSerializer(g, context={'request': request}).data)


def _context(user, data):
    day = data.get('date') or timezone.localdate()
    lat = data.get('latitude', user.latitude)
    lon = data.get('longitude', user.longitude)
    ctx = {
        'occasion': data['occasion'],
        'today': day,
        'season': season_for(day.month, southern=bool(lat is not None and lat < 0)),
        'temp_c': data.get('temp_c'),
        'precip_prob': data.get('precip_prob'),
    }
    if (ctx['temp_c'] is None or ctx['precip_prob'] is None) and lat is not None and lon is not None:
        wx = forecast(lat, lon, day)
        if wx:
            ctx['temp_c'] = ctx['temp_c'] if ctx['temp_c'] is not None else wx['temp_c']
            ctx['precip_prob'] = ctx['precip_prob'] if ctx['precip_prob'] is not None else wx['precip_prob']
            ctx['weather'] = wx
    return ctx


def _pairs():
    return PairTable(ColorPair.objects.all(), MaterialPair.objects.all())


def _taste(user):
    taste, _ = TasteProfile.objects.get_or_create(user=user)
    return taste


def _public_context(ctx):
    out = {k: v for k, v in ctx.items() if k != 'today'}
    out['date'] = ctx['today'].isoformat()
    return out


def _outfit_qs():
    return Outfit.objects.prefetch_related(Prefetch('items', queryset=OutfitItem.objects.select_related('garment')))


def _save_outfit(user, outfit, scores, explanation, ctx, outfit_set=None, position=0, saved=False):
    o = Outfit.objects.create(
        user=user,
        outfit_set=outfit_set,
        palette=list(dict.fromkeys(g.primary_color for g in outfit.values() if g.primary_color)),
        materials=[g.material.get('value') for g in outfit.values() if g.material.get('value')],
        context=_public_context(ctx),
        style_direction=user.style_direction,
        scores=scores,
        total_score=scores['total'],
        position=position,
        explanation=explanation,
        saved=saved,
    )
    OutfitItem.objects.bulk_create([OutfitItem(outfit=o, garment=g, slot=slot) for slot, g in outfit.items()])
    return o


@api_view(['POST'])
def recommendations(request):
    s = RecommendRequestSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    user = request.user
    ctx = _context(user, s.validated_data)
    garments = list(Garment.objects.filter(user=user, status='available'))
    try:
        results = recommend(garments, ctx, _pairs(), _taste(user))
    except NotEnoughGarments as e:
        return Response({'detail': str(e), 'code': 'not_enough_garments'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    with transaction.atomic():
        oset = OutfitSet.objects.create(user=user, date=ctx['today'], occasion=ctx['occasion'], context=_public_context(ctx))
        for i, r in enumerate(results):
            _save_outfit(user, r['outfit'], r['scores'], r['explanation'], ctx, outfit_set=oset, position=i)
    oset = OutfitSet.objects.prefetch_related(Prefetch('outfits', queryset=_outfit_qs())).get(pk=oset.pk)
    return Response(OutfitSetSerializer(oset, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def check_outfit(request):
    """Score an outfit the user assembled ("Will it work?")."""
    s = CheckOutfitSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    garments = list(Garment.objects.filter(user=request.user, id__in=d['garment_ids']))
    if len(garments) != len(set(d['garment_ids'])):
        return Response({'detail': 'Some garments were not found.'}, status=status.HTTP_400_BAD_REQUEST)
    outfit = {}
    for g in garments:
        slot = g.category
        if slot in outfit:
            return Response({'detail': f'Pick one {slot}.'}, status=status.HTTP_400_BAD_REQUEST)
        outfit[slot] = g
    ctx = _context(request.user, d)
    scores = score_outfit(outfit, ctx, _pairs(), _taste(request.user))
    text = explain(outfit, scores, ctx)
    payload = {'scores': scores, 'explanation': text, 'context': _public_context(ctx)}
    if d['save']:
        o = _save_outfit(request.user, outfit, scores, text, ctx, saved=True)
        payload['outfit'] = OutfitSerializer(_outfit_qs().get(pk=o.pk), context={'request': request}).data
    return Response(payload)


class OutfitViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = OutfitSerializer
    filterset_fields = ['saved', 'outfit_set']

    def get_queryset(self):
        return _outfit_qs().filter(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='save')
    def set_saved(self, request, pk=None):
        o = self.get_object()
        o.saved = request.data.get('saved', True) in (True, 'true', '1', 1)
        o.save(update_fields=['saved'])
        return Response(OutfitSerializer(o, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def wear(self, request, pk=None):
        """Log the outfit as worn today: rotation counters, wear log and a feedback signal."""
        o = self.get_object()
        today = timezone.localdate()
        garments = list(o.garments.all())
        with transaction.atomic():
            log = WearLog.objects.create(user=request.user, outfit=o, worn_on=today)
            log.garments.set(garments)
            for g in garments:
                g.times_worn += 1
                g.last_worn_at = today
            Garment.objects.bulk_update(garments, ['times_worn', 'last_worn_at'])
            fb = Feedback.objects.create(
                user=request.user, outfit=o, outfit_set=o.outfit_set, worn=True,
                rank=o.position + 1 if o.outfit_set_id else None, context=o.context,
            )
            update_taste(_taste(request.user), fb, {g.id: g for g in garments})
        return Response({'worn_on': today.isoformat()})


class FeedbackViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = FeedbackSerializer

    def get_queryset(self):
        return Feedback.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        outfit = serializer.validated_data['outfit']
        fb = serializer.save(user=self.request.user, outfit_set=outfit.outfit_set, context=outfit.context)
        garments = {g.id: g for g in Garment.objects.filter(user=self.request.user)}
        update_taste(_taste(self.request.user), fb, garments)


@api_view(['GET'])
def weather(request):
    try:
        lat, lon = float(request.query_params['lat']), float(request.query_params['lon'])
    except (KeyError, ValueError):
        return Response({'detail': 'lat and lon are required.'}, status=status.HTTP_400_BAD_REQUEST)
    wx = forecast(lat, lon, timezone.localdate())
    if not wx:
        return Response({'detail': 'Weather is unavailable right now.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response(wx)


@api_view(['GET'])
def stats(request):
    """Closet overview: size, per-category counts, and the 30-day rotation (KB section 6)."""
    user = request.user
    garments = Garment.objects.filter(user=user).exclude(status='archived')
    total = garments.count()
    since = timezone.localdate() - timedelta(days=30)
    worn_30 = garments.filter(last_worn_at__gte=since).count()
    by_cat = {}
    for c in garments.values_list('category', flat=True):
        by_cat[c] = by_cat.get(c, 0) + 1
    never = garments.filter(times_worn=0).count()
    most = GarmentSerializer(garments.order_by('-times_worn')[:5], many=True, context={'request': request}).data
    return Response({
        'total': total,
        'by_category': by_cat,
        'worn_last_30_days': worn_30,
        'rotation_pct': round(100 * worn_30 / total) if total else 0,
        'never_worn': never,
        'most_worn': most,
        'outfits_saved': Outfit.objects.filter(user=user, saved=True).count(),
    })
