import hmac
import logging
import os
import secrets
import threading
from datetime import date, timedelta

from django.conf import settings
from django.contrib.auth import authenticate, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Count, Sum
from django.http import HttpResponseBadRequest, HttpResponseRedirect
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from PIL import Image
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, parser_classes, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from . import emails, social, taxonomy as tx
from .assistant import answer, read_plan
from .locale import lang_from_header
from .colors import extract_colors, remove_background
from .samples import load_sample_wardrobe, restore_sample_photos
from .scans import start_scan
from .shopping import check_fit, suggestions as shopping_suggestions
from .speech import transcribe
from .services import (
    build_context, describe, log_wear, materials_of, outfit_qs, outfit_set_qs, pairs, palette_of, public_context,
    recommend_set, save_outfit, stored_context, taste_for,
)
from .vision import analyse_garment
from .engine.describe import title_for
from .engine.recommend import NotEnoughGarments
from .engine.scoring import score_outfit
from .engine.taste import update_taste
from .models import AffiliateClick, AppFeedback, AppFeedbackShot, PasswordResetCode, DiscoveryDrop, Inspiration, StyleCheck, Feedback, Occasion, Product, ProductAction, SavedProduct, Garment, Outfit, OutfitItem, OutfitPlan, TasteProfile, User, VideoScan, WearLog
from .serializers import (
    CheckOutfitSerializer, FeedbackSerializer, GarmentSerializer, LoginSerializer, OccasionSerializer, ProductSerializer,
    OutfitSerializer, OutfitSetSerializer, RecommendRequestSerializer, RegisterSerializer, UserSerializer,
    VideoScanSerializer,
)
from .weather import forecast


logger = logging.getLogger(__name__)


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
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def social_login(request):
    """
    Sign in with Apple or Google: {"provider", "id_token", "name"?} → {"token", "user", "created"}.
    Verification and account linking live in social.py.
    """
    provider = request.data.get('provider')
    id_token = request.data.get('id_token')
    if provider not in social.VERIFY or not isinstance(id_token, str) or not id_token:
        return Response({'detail': 'Send a provider (apple or google) and its id_token.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        claims = social.VERIFY[provider](id_token)
        guest = request.user if request.user.is_authenticated and request.user.is_guest else None
        user, created = social.user_for(provider, claims, str(request.data.get('name') or ''), guest)
    except social.NotConfigured:
        return Response({'detail': f'{provider.title()} sign-in is not set up on this server.', 'code': 'not_configured'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except social.InvalidToken:
        return Response({'detail': 'That sign-in could not be verified. Try again.', 'code': 'invalid_token'},
                        status=status.HTTP_400_BAD_REQUEST)
    return Response({**_auth_payload(user), 'created': created},
                    status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def apple_start(request):
    """Apple's web sign-in page for Android: ?return=<app deep link> → {"url"}."""
    try:
        return Response({'url': social.apple_authorize_url(request.query_params.get('return', ''))})
    except social.NotConfigured:
        return Response({'detail': 'Apple sign-in on Android is not set up on this server.', 'code': 'not_configured'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except social.InvalidToken:
        return Response({'detail': 'Send the app link to return to.'}, status=status.HTTP_400_BAD_REQUEST)


class _AppRedirect(HttpResponseRedirect):
    allowed_schemes = sorted(social.APP_SCHEMES)


@csrf_exempt
@require_POST
def apple_callback(request):
    """Where Apple posts the web sign-in result; sends the browser back into the app with the token."""
    try:
        return _AppRedirect(social.apple_callback_target(request.POST))
    except social.InvalidToken:
        return HttpResponseBadRequest('Sign-in could not be completed. Go back to the app and try again.')


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def guest(request):
    """Look around without signing up: a guest account with the sample wardrobe, already onboarded."""
    user = User.objects.create_user(
        email=f'guest-{secrets.token_hex(8)}@guest.wearwise.invalid', password=None, is_guest=True, onboarded=True,
    )
    TasteProfile.objects.create(user=user)
    load_sample_wardrobe(user, request_lang(request))
    return Response(_auth_payload(user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
def claim(request):
    """Sign up from a guest account: {"email", "password", "display_name"}; everything added as a guest is kept."""
    if not request.user.is_guest:
        return Response({'detail': 'This account is already signed up.'}, status=status.HTTP_400_BAD_REQUEST)
    s = RegisterSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    user = social.claim_guest(request.user, d['email'], d['display_name'], d['password'])
    return Response(_auth_payload(user))


MAX_RESET_ATTEMPTS = 5


def _validated_password(password, user):
    """None when the password passes every rule, else a Response with the reason."""
    try:
        password_validation.validate_password(password, user=user)
    except DjangoValidationError as e:
        return Response({'password': list(e.messages), 'detail': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
    return None


def _set_password_and_rotate(user, password):
    """Save the new password and replace the auth token, so a session on a lost or shared device stops working."""
    user.set_password(password)
    user.save(update_fields=['password'])
    Token.objects.filter(user=user).delete()
    return _auth_payload(user)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def forgot_password(request):
    """{"email"} → emails a 6-digit code. Same answer whether or not the account exists."""
    email = str(request.data.get('email', '')).strip().lower()
    if not email:
        return Response({'detail': 'Enter your email.'}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.filter(email=email, is_guest=False).first()
    if user:
        # One live code at a time, or every request would add another code to guess.
        PasswordResetCode.objects.filter(user=user, used=False).update(used=True)
        code = f'{secrets.randbelow(1_000_000):06d}'
        PasswordResetCode.objects.create(user=user, code=code)
        ttl = settings.PASSWORD_RESET_CODE_TTL_MINUTES
        sent = emails.send_email(
            email, 'Your WearWise password reset code',
            f'Hi {user.display_name or "there"},\n\n'
            f'Your WearWise password reset code is: {code}\n\n'
            f'It expires in {ttl} minutes. If you did not ask to reset your password, you can ignore this email.',
        )
        if not sent:
            # Saying "code sent" when nothing went out would leave the person waiting for nothing.
            return Response({'code': 'mail_failed', 'detail': 'The reset email could not be sent. Try again later.'},
                            status=status.HTTP_502_BAD_GATEWAY)
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def reset_password(request):
    """{"email", "code", "password"} → {"token", "user"}: signs the person straight in."""
    email = str(request.data.get('email', '')).strip().lower()
    code = str(request.data.get('code', '')).strip()
    password = str(request.data.get('password', ''))
    if not email or not code or not password:
        return Response({'detail': 'Email, code and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)
    invalid = Response({'code': 'invalid_code', 'detail': 'The code is wrong or has expired.'}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.filter(email=email, is_guest=False).first()
    cutoff = timezone.now() - timedelta(minutes=settings.PASSWORD_RESET_CODE_TTL_MINUTES)
    entry = PasswordResetCode.objects.filter(user=user, used=False, created_at__gte=cutoff).first() if user else None
    if entry is None or entry.attempts >= MAX_RESET_ATTEMPTS:
        return invalid
    if not hmac.compare_digest(entry.code, code):
        entry.attempts += 1
        entry.used = entry.attempts >= MAX_RESET_ATTEMPTS
        entry.save(update_fields=['attempts', 'used'])
        return invalid
    refused = _validated_password(password, user)
    if refused:
        return refused
    entry.used = True
    entry.save(update_fields=['used'])
    return Response(_set_password_and_rotate(user, password))


@api_view(['POST'])
@throttle_classes([AuthThrottle])
def change_password(request):
    """
    {"current_password"?, "new_password"} → {"token", "user"}.
    The current password is required when the account has one; a Google/Apple-only
    account sets its first password with just the new one.
    """
    user = request.user
    if user.is_guest:
        return Response({'detail': 'Create an account first.'}, status=status.HTTP_400_BAD_REQUEST)
    new = str(request.data.get('new_password', ''))
    if not new:
        return Response({'detail': 'Enter a new password.'}, status=status.HTTP_400_BAD_REQUEST)
    if user.has_usable_password() and not user.check_password(str(request.data.get('current_password', ''))):
        return Response({'code': 'wrong_password', 'detail': 'Your current password is incorrect.'},
                        status=status.HTTP_400_BAD_REQUEST)
    refused = _validated_password(new, user)
    if refused:
        return refused
    return Response(_set_password_and_rotate(user, new))


@api_view(['POST'])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'PATCH', 'DELETE'])
def me(request):
    if request.method == 'DELETE':
        # Rows go with the user; their photo files have to be removed by hand.
        for g in Garment.objects.filter(user=request.user):
            for f in (g.image, g.cutout):
                if f:
                    f.delete(save=False)
        for i in Inspiration.objects.filter(user=request.user):
            if i.image:
                i.image.delete(save=False)
        # Feedback text is kept without a name; screenshots of their screen are not.
        for shot in AppFeedbackShot.objects.filter(feedback__user=request.user):
            shot.image.delete(save=False)
            shot.delete()
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


def set_colors(g, src):
    colors, low_light = extract_colors(src)
    g.colors = colors
    conf = dict(g.attribute_confidence or {})
    conf['color'] = 0.5 if low_light else 0.8
    g.attribute_confidence = conf


def make_cutout(garment_id, keep_user_colors):
    """
    Background job after an upload: the piece on a transparent background, and
    its colours read again from the cutout, which leaves out the floor or the
    hanger. Quietly does nothing when rembg is missing or the piece is gone.
    """
    from django.db import connection
    try:
        g = Garment.objects.filter(pk=garment_id).first()
        if not g or not g.image:
            return
        g.image.open('rb')
        cut = remove_background(g.image)
        if not cut:
            return
        g.cutout.save(f'{g.id}_cutout.png', ContentFile(cut), save=False)
        fields = ['cutout']
        if not keep_user_colors:
            g.cutout.open('rb')
            set_colors(g, g.cutout)
            fields += ['colors', 'attribute_confidence']
        g.save(update_fields=fields)
    except Exception:
        logger.exception('Cutout failed for %s', garment_id)
    finally:
        connection.close()


class GarmentViewSet(viewsets.ModelViewSet):
    serializer_class = GarmentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ['category', 'status', 'favorite']

    def get_queryset(self):
        return Garment.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        # Demo pieces should never show up as blank cards, even if media was wiped.
        restore_sample_photos(request.user, request_lang(request))
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        data = serializer.validated_data
        # What the user actually typed; multipart fills missing booleans with False,
        # so validated_data alone cannot tell "unchecked" from "not sent".
        sent = set(self.request.data.keys())
        fill = {}
        ai = analyse_garment(data['image'], request_lang(self.request)) if data.get('image') else None
        if ai:
            if not ai['is_garment'] and 'category' not in sent:
                raise ValidationError({
                    'image': "We couldn't find a piece of clothing in this photo. Try again on a plain background.",
                })
            fill = {k: v for k, v in ai.items() if k != 'is_garment' and k not in sent and v not in ('', [], {})}
        if 'category' not in data and 'category' not in fill:
            raise ValidationError({'category': 'Pick what kind of piece this is.'}, code='category_required')
        g = serializer.save(user=self.request.user, **fill)
        if g.image:
            self._analyse(g, keep_user_colors=bool(g.colors))

    def perform_update(self, serializer):
        new_image = 'image' in serializer.validated_data
        g = serializer.save()
        if new_image and g.image:
            self._analyse(g, keep_user_colors=bool(serializer.validated_data.get('colors')))

    def _analyse(self, g, keep_user_colors):
        """
        Colours now, from the photo, so the piece is saved and answered at once.
        With settings.CUTOUTS on, a cutout follows in the background (see
        make_cutout), because removing the background takes seconds.
        """
        if not keep_user_colors:
            g.image.open('rb')
            set_colors(g, g.image)
        g.save()
        # The suite would download a model and race a thread against its own teardown.
        if settings.CUTOUTS and not settings.TESTING:
            threading.Thread(target=make_cutout, args=(g.pk, keep_user_colors), daemon=True).start()

    @action(detail=True, methods=['post'], url_path='detect-colors')
    def detect_colors(self, request, pk=None):
        g = self.get_object()
        if not g.image:
            return Response({'detail': 'This garment has no photo.'}, status=status.HTTP_400_BAD_REQUEST)
        self._analyse(g, keep_user_colors=False)
        return Response(GarmentSerializer(g, context={'request': request}).data)

    @action(detail=False, methods=['post', 'delete'])
    def sample(self, request):
        """POST loads the demo wardrobe (409 if it is already there); DELETE removes it."""
        mine = Garment.objects.filter(user=request.user, is_sample=True)
        if request.method == 'DELETE':
            # Deleting rows leaves their files behind; the sample photos are ours to clean up.
            for g in mine:
                if g.image:
                    g.image.delete(save=False)
            mine.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        if mine.exists():
            return Response(
                {'detail': 'The sample wardrobe is already loaded.', 'code': 'already_loaded'},
                status=status.HTTP_409_CONFLICT,
            )
        garments = load_sample_wardrobe(request.user, request_lang(request))
        return Response(GarmentSerializer(garments, many=True, context={'request': request}).data,
                        status=status.HTTP_201_CREATED)


def request_lang(request):
    """One of locale.LANGS from the app's Accept-Language header, English otherwise."""
    return lang_from_header(request.headers.get('Accept-Language', ''))


def _items_by_slot(outfit):
    return {i.slot: i.garment for i in outfit.items.select_related('garment')}


@api_view(['POST'])
def recommendations(request):
    """Three looks for an occasion; asking again the same day skips looks already shown."""
    s = RecommendRequestSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    ctx = build_context(request.user, s.validated_data, request_lang(request))
    try:
        oset = recommend_set(request.user, ctx)
    except NotEnoughGarments as e:
        return Response({'detail': str(e), 'code': 'not_enough_garments'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
    return Response(OutfitSetSerializer(oset, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def latest_recommendations(request):
    """The user's most recent set for today (optionally for one occasion), or 404."""
    occasion = request.query_params.get('occasion')
    if occasion and occasion not in tx.OCCASIONS:
        return Response({'occasion': ['Unknown occasion.']}, status=status.HTTP_400_BAD_REQUEST)
    sets = outfit_set_qs().filter(user=request.user, date=timezone.localdate(), source='recommend')
    if occasion:
        sets = sets.filter(occasion=occasion)
    oset = sets.order_by('-created_at').first()
    if not oset:
        return Response({'detail': 'No suggestions yet today.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(OutfitSetSerializer(oset, context={'request': request}).data)


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
    ctx = build_context(request.user, d, request_lang(request))
    scores = score_outfit(outfit, ctx, pairs(), taste_for(request.user))
    payload = {'scores': scores, **describe(outfit, scores, ctx), 'context': public_context(ctx)}
    if d['save']:
        o = save_outfit(request.user, outfit, scores, ctx, saved=True, title=payload['title'])
        payload['outfit'] = OutfitSerializer(outfit_qs().get(pk=o.pk), context={'request': request}).data
    return Response(payload)


class OutfitViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = OutfitSerializer
    filterset_fields = ['saved', 'outfit_set']

    def get_queryset(self):
        return outfit_qs().filter(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='save')
    def set_saved(self, request, pk=None):
        o = self.get_object()
        o.saved = request.data.get('saved', True) in (True, 'true', '1', 1)
        o.save(update_fields=['saved'])
        return Response(OutfitSerializer(o, context={'request': request}).data)

    @action(detail=True, methods=['get'])
    def alternatives(self, request, pk=None):
        """Pieces that could take `slot`'s place, each with the look's total score if swapped in."""
        o = self.get_object()
        outfit = _items_by_slot(o)
        slot = request.query_params.get('slot')
        if slot not in outfit:
            return Response({'detail': 'Unknown slot.'}, status=status.HTTP_400_BAD_REQUEST)
        ctx = stored_context(o, request.user, request_lang(request))
        pair_table, taste = pairs(), taste_for(request.user)
        current = outfit[slot]
        candidates = (
            Garment.objects.filter(user=request.user, status='available', category=current.category)
            .exclude(id__in=[g.id for g in outfit.values()])
        )
        options = []
        for g in candidates:
            scores = score_outfit({**outfit, slot: g}, ctx, pair_table, taste)
            options.append((scores['total'], g))
        options.sort(key=lambda x: -x[0])
        return Response({
            'current_total': o.total_score,
            'options': [
                {'garment': GarmentSerializer(g, context={'request': request}).data, 'total': total}
                for total, g in options[:12]
            ],
        })

    @action(detail=True, methods=['post'])
    def swap(self, request, pk=None):
        """Replace one piece, re-score the look, and learn from the swap."""
        o = self.get_object()
        outfit = _items_by_slot(o)
        slot = request.data.get('slot')
        if slot not in outfit:
            return Response({'detail': 'Unknown slot.'}, status=status.HTTP_400_BAD_REQUEST)
        new = Garment.objects.filter(
            user=request.user, id=request.data.get('garment_id'), status='available', category=outfit[slot].category,
        ).first()
        if not new or new.id in {g.id for g in outfit.values()}:
            return Response({'detail': 'That piece cannot go here.'}, status=status.HTTP_400_BAD_REQUEST)
        old = outfit[slot]
        outfit[slot] = new
        ctx = stored_context(o, request.user, request_lang(request))
        scores = score_outfit(outfit, ctx, pairs(), taste_for(request.user))
        # Keep the title distinct from the other looks in the same set.
        taken = list(Outfit.objects.filter(outfit_set_id=o.outfit_set_id).exclude(pk=o.pk)
                     .values_list('title', flat=True)) if o.outfit_set_id else []
        with transaction.atomic():
            OutfitItem.objects.filter(outfit=o, slot=slot).update(garment=new)
            o.scores, o.total_score = scores, scores['total']
            text = describe(outfit, scores, ctx, title=title_for(outfit, ctx, taken))
            o.explanation, o.title, o.reasons = text['explanation'], text['title'], text['reasons']
            o.palette, o.materials = palette_of(outfit), materials_of(outfit)
            o.save(update_fields=['scores', 'total_score', 'explanation', 'title', 'reasons', 'palette', 'materials'])
            fb = Feedback.objects.create(
                user=request.user, outfit=o, outfit_set=o.outfit_set, context=o.context,
                replaced=[{'from': old.id, 'to': new.id}],
            )
            update_taste(taste_for(request.user), fb, {old.id: old, new.id: new})
        return Response(OutfitSerializer(outfit_qs().get(pk=o.pk), context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def wear(self, request, pk=None):
        """Log the outfit as worn today: rotation counters, wear log and a feedback signal."""
        today = timezone.localdate()
        log_wear(request.user, self.get_object(), today)
        return Response({'worn_on': today.isoformat()})


class FeedbackViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = FeedbackSerializer

    def get_queryset(self):
        return Feedback.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        outfit = serializer.validated_data['outfit']
        fb = serializer.save(user=self.request.user, outfit_set=outfit.outfit_set, context=outfit.context)
        garments = {g.id: g for g in Garment.objects.filter(user=self.request.user)}
        update_taste(taste_for(self.request.user), fb, garments)


MAX_VIDEO_BYTES = 150 * 1024 * 1024


class VideoScanViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Upload a closet video; poll the scan until it is done and holds the new garments."""

    serializer_class = VideoScanSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return VideoScan.objects.filter(user=self.request.user).prefetch_related('garments')

    def create(self, request, *args, **kwargs):
        video = request.FILES.get('video')
        if not video:
            return Response({'video': ['A video file is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if video.size > MAX_VIDEO_BYTES:
            return Response({'video': ['The video is too large.'], 'code': 'too_large'}, status=status.HTTP_400_BAD_REQUEST)
        if (video.content_type or '').split('/')[0] not in ('video', 'application'):
            return Response({'video': ['This is not a video.']}, status=status.HTTP_400_BAD_REQUEST)
        # Video needs the vision model to find the pieces; there is no manual fallback.
        if not os.environ.get('ANTHROPIC_API_KEY'):
            return Response(
                {'detail': 'Adding from video needs AI tagging, which is not set up.', 'code': 'ai_unavailable'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        scan = VideoScan.objects.create(user=request.user, video=video, lang=request_lang(request))
        start_scan(scan)
        return Response(VideoScanSerializer(scan, context={'request': request}).data, status=status.HTTP_202_ACCEPTED)


@api_view(['POST'])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def assistant(request):
    """
    The stylist chat: {"message", optional "image" (multipart)} →
    {"reply", "outfits", "garments", "suggestions", "piece", "heard"}. A multipart
    "audio" recording is transcribed and answered as the message; "heard" echoes the
    text so the app can show it. Logic lives in assistant.py.
    """
    message = request.data.get('message', '')
    if not isinstance(message, str) or len(message) > 1000:
        return Response({'message': ['Send a message of up to 1000 characters.']}, status=status.HTTP_400_BAD_REQUEST)
    audio = request.FILES.get('audio')
    heard_lang = None
    if audio is not None:
        if audio.size > 10 * 1024 * 1024:
            return Response({'audio': ['Send a recording under 10 MB.']}, status=status.HTTP_400_BAD_REQUEST)
        result = transcribe(audio, request_lang(request))
        heard, heard_lang = result if result else (None, None)
        if heard is None:
            return Response({'audio': ['Voice questions are not available right now.'], 'code': 'voice_unavailable'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not heard:
            return Response({'audio': ["We couldn't hear a question. Try again."], 'code': 'voice_empty'},
                            status=status.HTTP_400_BAD_REQUEST)
        message = f'{message} {heard}'.strip()[:1000]
    image = request.FILES.get('image')
    if image is not None:
        if image.size > 15 * 1024 * 1024:
            return Response({'image': ['Send a photo under 15 MB.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            Image.open(image).verify()
        except Exception:
            return Response({'image': ['That file is not a photo we can read.']}, status=status.HTTP_400_BAD_REQUEST)
        image.seek(0)
    result = answer(request.user, message, request_lang(request), image)
    ctx = {'request': request}
    return Response({
        'reply': result['reply'],
        'outfits': OutfitSerializer(result['outfits'], many=True, context=ctx).data,
        'garments': GarmentSerializer(result['garments'], many=True, context=ctx).data,
        'suggestions': result['suggestions'],
        'piece': result['piece'],
        'shopping': result['shopping'],
        'heard': message if audio is not None else None,
        'heard_lang': heard_lang if audio is not None else None,
    })


@api_view(['GET'])
def shopping(request):
    """Pieces that would complete the closet, each with store search links. Rules live in shopping.py."""
    return Response({'suggestions': shopping_suggestions(request.user, request_lang(request))})


@api_view(['POST'])
def shopping_check(request):
    """"Will this fit my wardrobe?": {subcategory, color} → {verdict: great|works|skip, unlocks, matches, better, links}."""
    sub, color = request.data.get('subcategory'), request.data.get('color')
    if sub not in tx.ALL_SUBCATEGORIES or color not in tx.COLORS:
        raise ValidationError({'detail': 'Pick a piece type and a colour.'})
    return Response(check_fit(request.user, sub, color, request_lang(request)))


@api_view(['POST'])
def shopping_click(request):
    """Logs a store tap before the app opens the link: {store, subcategory, color, source}."""
    d = request.data
    AffiliateClick.objects.create(
        user=request.user, store=str(d.get('store', ''))[:24], subcategory=str(d.get('subcategory', ''))[:24],
        color=str(d.get('color', ''))[:16], source=d.get('source') if d.get('source') in ('gap', 'check', 'assistant') else 'gap',
    )
    return Response(status=status.HTTP_201_CREATED)


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


# The free forecast reaches about two weeks ahead; past days have no forecast to give.
FORECAST_DAYS = 15


@api_view(['GET'])
def calendar_month(request):
    """
    Days of ?month=YYYY-MM with something worn or planned:
    {"days": {"YYYY-MM-DD": count worn}, "planned": ["YYYY-MM-DD", …]}.
    """
    try:
        first = date.fromisoformat(request.query_params.get('month', '') + '-01')
    except ValueError:
        return Response({'detail': 'month must be YYYY-MM.'}, status=status.HTTP_400_BAD_REQUEST)
    nxt = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
    logs = (WearLog.objects.filter(user=request.user, worn_on__gte=first, worn_on__lt=nxt)
            .values('worn_on').annotate(n=Count('id')))
    planned = OutfitPlan.objects.filter(user=request.user, date__gte=first, date__lt=nxt).values_list('date', flat=True)
    return Response({
        'days': {row['worn_on'].isoformat(): row['n'] for row in logs},
        'planned': [d.isoformat() for d in planned],
    })


@api_view(['GET'])
def calendar_day(request):
    """
    One day: ?date=YYYY-MM-DD (&lat&lon) → {"date", "worn": [Outfit], "plan": Outfit | null, "weather"}.
    Weather is the forecast for today and the next two weeks, else null.
    """
    try:
        day = date.fromisoformat(request.query_params.get('date', ''))
    except ValueError:
        return Response({'detail': 'date must be YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
    worn = [log.outfit for log in WearLog.objects.filter(user=request.user, worn_on=day, outfit__isnull=False)
            .select_related('outfit')]
    weather = None
    today = timezone.localdate()
    if today <= day <= today + timedelta(days=FORECAST_DAYS):
        try:
            lat = float(request.query_params.get('lat', request.user.latitude))
            lon = float(request.query_params.get('lon', request.user.longitude))
            weather = forecast(lat, lon, day)
        except (TypeError, ValueError):
            pass
    return Response({
        'date': day.isoformat(),
        'worn': OutfitSerializer(worn, many=True, context={'request': request}).data,
        'plan': planned_outfit(request, day),
        'weather': weather,
    })


def planned_outfit(request, day):
    plan = OutfitPlan.objects.filter(user=request.user, date=day).first()
    return OutfitSerializer(outfit_qs().get(pk=plan.outfit_id), context={'request': request}).data if plan else None


@api_view(['POST', 'DELETE'])
def calendar_plan(request):
    """
    POST {"date", "outfit"} keeps that outfit for the day (replacing any earlier pick)
    and saves it to the looks; DELETE ?date= drops the plan. Past days cannot be planned.
    """
    raw = request.data.get('date') if request.method == 'POST' else request.query_params.get('date')
    try:
        day = date.fromisoformat(raw or '')
    except ValueError:
        return Response({'date': ['date must be YYYY-MM-DD.']}, status=status.HTTP_400_BAD_REQUEST)
    if request.method == 'DELETE':
        OutfitPlan.objects.filter(user=request.user, date=day).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if day < timezone.localdate():
        return Response({'date': ['That day has passed.']}, status=status.HTTP_400_BAD_REQUEST)
    outfit = Outfit.objects.filter(user=request.user, pk=request.data.get('outfit')).first()
    if not outfit:
        return Response({'outfit': ['Outfit not found.']}, status=status.HTTP_400_BAD_REQUEST)
    if not outfit.saved:
        outfit.saved = True
        outfit.save(update_fields=['saved'])
    OutfitPlan.objects.update_or_create(user=request.user, date=day, defaults={'outfit': outfit})
    return Response({'date': day.isoformat(), 'plan': planned_outfit(request, day)}, status=status.HTTP_201_CREATED)


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
    today = timezone.localdate()
    week_start = today - timedelta(days=6)
    per_day = dict(
        WearLog.objects.filter(user=user, worn_on__gte=week_start, worn_on__lte=today)
        .values_list('worn_on').annotate(n=Count('id'))
    )
    top_cats = (
        garments.values('category').annotate(count=Sum('times_worn')).filter(count__gt=0).order_by('-count')[:3]
    )
    recent = GarmentSerializer(garments.order_by('-created_at')[:5], many=True, context={'request': request}).data
    return Response({
        'total': total,
        'by_category': by_cat,
        'worn_last_30_days': worn_30,
        'rotation_pct': round(100 * worn_30 / total) if total else 0,
        'never_worn': never,
        'most_worn': most,
        'outfits_saved': Outfit.objects.filter(user=user, saved=True).count(),
        'worn_outfits': WearLog.objects.filter(user=user).count(),
        'most_worn_categories': [{'category': c['category'], 'count': c['count']} for c in top_cats],
        'favorite_style': (user.preferred_styles or [None])[0] or user.style_direction,
        'weekly_activity': [
            {'date': d.isoformat(), 'count': per_day.get(d, 0)}
            for d in (week_start + timedelta(days=i) for i in range(7))
        ],
        'favorites': garments.filter(favorite=True).count(),
        'recently_added': recent,
    })


# Screenshots on feedback: a few, each the size a phone's screenshot is.
FEEDBACK_MAX_SHOTS = 3
FEEDBACK_MAX_SHOT_BYTES = 10 * 1024 * 1024


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def app_feedback(request):
    """Settings → Send feedback: {kind: idea|problem|other, message, platform?, app_version?},
    as JSON, or multipart with up to three images under `screenshots`."""
    d = request.data
    message = str(d.get('message', '')).strip()
    shots = [f for f in request.FILES.getlist('screenshots')
             if (getattr(f, 'content_type', '') or '').startswith('image/')
             and f.size <= FEEDBACK_MAX_SHOT_BYTES][:FEEDBACK_MAX_SHOTS]
    if not message and not shots:
        raise ValidationError({'message': 'required'})
    kind = d.get('kind') if d.get('kind') in AppFeedback.KINDS else 'other'
    fb = AppFeedback.objects.create(
        user=request.user, kind=kind, message=message[:4000],
        platform=str(d.get('platform', ''))[:10], app_version=str(d.get('app_version', ''))[:20],
    )
    for f in shots:
        AppFeedbackShot.objects.create(feedback=fb, image=f)
    if settings.FEEDBACK_EMAIL:
        u = request.user
        who = 'guest' if u.is_guest else (u.display_name or u.email)
        emails.send_email(
            settings.FEEDBACK_EMAIL, f'WearWise feedback ({kind}) from {who}',
            f'From: {who} <{"-" if u.is_guest else u.email}>\n'
            f'Kind: {kind}\nApp: {fb.platform} {fb.app_version}\n'
            f'Screenshots: {len(shots) or "-"} (in the admin panel, Feedback)\n\n{message or "(no message)"}',
            reply_to=None if u.is_guest else u.email,
        )
    return Response(status=status.HTTP_201_CREATED)


class CrashThrottle(AnonRateThrottle):
    """Per-IP cap on crash reports, signed in or not: a crash loop must not flood the table."""
    scope = 'crash'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([CrashThrottle])
def crash_report(request):
    """The app's global error handler: {message, stack?, fatal?, device?}; platform and version come from its headers."""
    from .middleware import normalise_platform, normalise_version
    from .models import CrashReport
    d = request.data
    message = str(d.get('message', '')).strip()
    if not message:
        raise ValidationError({'message': 'required'})
    user = request.user if request.user.is_authenticated else None
    CrashReport.objects.create(
        user=user, message=message[:2000], stack=str(d.get('stack', ''))[:8000], device=str(d.get('device', ''))[:200],
        fatal=d.get('fatal') is not False,
        platform=normalise_platform(request.headers.get('X-Platform')),
        app_version=normalise_version(request.headers.get('X-App-Version')),
    )
    return Response(status=status.HTTP_201_CREATED)


@api_view(['POST'])
def install_source(request):
    """
    Google Play's install referrer, sent once by an Android app: {utm_source, utm_medium?, utm_campaign?}.
    The first answer stays: a reinstall from somewhere else does not rewrite where the account came from.
    """
    import re
    clean = lambda v, n: re.sub(r'[^\w .:/@+-]', '', str(v or '')).strip().lower()[:n]
    source = clean(request.data.get('utm_source'), 64)
    if not source:
        raise ValidationError({'utm_source': 'required'})
    source = {'google-play': 'google_play', '(direct)': 'direct'}.get(source, source)
    u = request.user
    if not u.install_source:
        u.install_source = source
        u.install_medium = clean(request.data.get('utm_medium'), 64)
        u.install_campaign = clean(request.data.get('utm_campaign'), 100)
        u.save(update_fields=['install_source', 'install_medium', 'install_campaign'])
    return Response({'install_source': u.install_source})


@api_view(['POST'])
def plan_read(request):
    """{text: "Client meeting downtown, dinner after"} → {occasion: "client_meeting", level: "formal"}."""
    return Response(read_plan(str(request.data.get('text', ''))[:300]))



# ── Shopping catalogue (MVP v2) ───────────────────────────────────────────

def _product_ctx(request):
    """Serializer context for products: the user, their language and which products they saved."""
    saved = set(SavedProduct.objects.filter(user=request.user).values_list('product_id', flat=True))
    return {'request': request, 'lang': request_lang(request), 'saved_ids': saved}


@api_view(['GET'])
def discover(request):
    """Today's Discovery drop: {products, next_drop, learned}. Actions go to products/<id>/action/."""
    from .catalog import discovery, profile_learned
    products, nxt = discovery(request.user)
    return Response({
        'products': ProductSerializer(products, many=True, context=_product_ctx(request)).data,
        'next_drop': nxt.isoformat(),
        'learned': profile_learned(request.user),
    })


@api_view(['POST'])
def product_action(request, pk):
    """{action: like|not_me|save|shop}. Save adds to the wishlist; Shop logs the click and returns the link."""
    from .catalog import profile_learned
    from .shopping import sub_id
    product = Product.objects.filter(pk=pk, active=True).first()
    if not product:
        return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
    action = request.data.get('action')
    if action not in tx.PRODUCT_ACTIONS:
        raise ValidationError({'action': f'One of {", ".join(tx.PRODUCT_ACTIONS)}.'})
    ProductAction.objects.create(user=request.user, product=product, action=action)
    out = {'learned': profile_learned(request.user)}
    if action == 'save':
        SavedProduct.objects.get_or_create(user=request.user, product=product, defaults={'price_when_saved': product.price})
        out['saved'] = True
    if action == 'shop':
        AffiliateClick.objects.create(user=request.user, store=product.store, subcategory=product.subcategory,
                                      color=product.color, source='gap')
        sep = '&' if '?' in product.url else '?'
        out['url'] = f'{product.url}{sep}utm_source=wearwise&utm_medium=affiliate&sub_id={sub_id(request.user, product.subcategory, product.color)}'
    return Response(out)


@api_view(['GET', 'POST'])
def saved_products(request):
    """GET the wishlist with price drops; POST {product, tracking?} to save one."""
    from .catalog import price_drop
    if request.method == 'POST':
        product = Product.objects.filter(pk=request.data.get('product'), active=True).first()
        if not product:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        sp, _ = SavedProduct.objects.get_or_create(user=request.user, product=product, defaults={'price_when_saved': product.price})
        if 'tracking' in request.data:
            sp.tracking = bool(request.data['tracking'])
            sp.save(update_fields=['tracking'])
        return Response({'saved': True, 'tracking': sp.tracking}, status=status.HTTP_201_CREATED)
    ctx = _product_ctx(request)
    rows = SavedProduct.objects.filter(user=request.user).select_related('product')
    return Response({
        'items': [{'product': ProductSerializer(sp.product, context=ctx).data, 'tracking': sp.tracking,
                   'drop': price_drop(sp), 'saved_at': sp.created_at} for sp in rows],
        'tracking_limit': None if request.user.plan == 'premium' else 5,
    })


@api_view(['PATCH', 'DELETE'])
def saved_product(request, pk):
    """PATCH {tracking} to watch the price (5 on the free plan); DELETE to remove from the wishlist."""
    sp = SavedProduct.objects.filter(user=request.user, product_id=pk).first()
    if not sp:
        return Response({'detail': 'Not in your saved items.'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'DELETE':
        sp.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    want = bool(request.data.get('tracking'))
    if want and not sp.tracking and request.user.plan != 'premium':
        if SavedProduct.objects.filter(user=request.user, tracking=True).count() >= 5:
            return Response({'detail': 'The free plan watches 5 items.', 'code': 'tracking_limit'}, status=status.HTTP_402_PAYMENT_REQUIRED)
    sp.tracking = want
    sp.save(update_fields=['tracking'])
    return Response({'tracking': sp.tracking})


@api_view(['GET'])
def home(request):
    """Home: the day's look from the catalogue, four picks, the next date and price drops on watched items."""
    from .catalog import build_looks, candidates, learned_taste, look_payload, occasion_payload, price_drop, score_product
    user, ctx, lang = request.user, _product_ctx(request), request_lang(request)
    lat, lon = request.query_params.get('lat'), request.query_params.get('lon')
    wx = None
    try:
        if lat and lon:
            wx = forecast(float(lat), float(lon), timezone.localdate())
        elif user.latitude is not None:
            wx = forecast(user.latitude, user.longitude, timezone.localdate())
    except (TypeError, ValueError):
        wx = None
    looks = build_looks(user, (1, 4), 1, temp_c=wx['temp_c'] if wx else None, seed=timezone.localdate().toordinal())
    taste = learned_taste(user)
    picks = sorted(candidates(user), key=lambda p: -score_product(p, user, taste))[:4]
    nxt = Occasion.objects.filter(user=user, date__gte=timezone.localdate()).order_by('date').first()
    drops = [sp for sp in SavedProduct.objects.filter(user=user, tracking=True).select_related('product') if price_drop(sp)]
    return Response({
        'look': look_payload(looks[0], ctx) if looks else None,
        'weather': wx,
        'picks': ProductSerializer(picks, many=True, context=ctx).data,
        'occasion': occasion_payload(nxt, user, ctx, lang) if nxt else None,
        'price_drops': [{'product': ProductSerializer(sp.product, context=ctx).data, 'drop': price_drop(sp)} for sp in drops],
    })


@api_view(['GET', 'POST'])
def occasions(request):
    """Dates to dress for: GET the upcoming ones; POST {title, date, kind, for_gift, person}. Free plan: 2 gift people."""
    from .catalog import occasion_payload
    lang = request_lang(request)
    if request.method == 'POST':
        s = OccasionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if s.validated_data.get('for_gift') and request.user.plan != 'premium':
            people = set(Occasion.objects.filter(user=request.user, for_gift=True).values_list('person', flat=True))
            if s.validated_data.get('person', '') not in people and len(people) >= 2:
                return Response({'detail': 'The free plan has gift ideas for 2 people.', 'code': 'gift_limit'},
                                status=status.HTTP_402_PAYMENT_REQUIRED)
        o = s.save(user=request.user)
        return Response(occasion_payload(o, request.user, {}, lang), status=status.HTTP_201_CREATED)
    rows = Occasion.objects.filter(user=request.user, date__gte=timezone.localdate())
    return Response([occasion_payload(o, request.user, {}, lang) for o in rows])


@api_view(['GET', 'PATCH', 'DELETE'])
def occasion_detail(request, pk):
    """GET a date with its three outfits (or gift ideas); PATCH {outfit: id|null} to wear one of mine; DELETE it."""
    from .catalog import occasion_looks, occasion_payload
    o = Occasion.objects.filter(user=request.user, pk=pk).first()
    if not o:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'DELETE':
        o.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == 'PATCH':
        outfit_id = request.data.get('outfit')
        if outfit_id and not Outfit.objects.filter(pk=outfit_id, user=request.user).exists():
            return Response({'detail': 'Outfit not found.'}, status=status.HTTP_404_NOT_FOUND)
        o.outfit_id = outfit_id or None
        o.save(update_fields=['outfit'])
    ctx = _product_ctx(request)
    return Response({**occasion_payload(o, request.user, ctx, request_lang(request)), 'looks': occasion_looks(o, request.user, ctx)})



@api_view(['GET', 'POST'])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def suits_me(request):
    """
    "Does this suit me?": GET {left}; POST a multipart "image" or {link} →
    {score, verdict, style_ok, color_fit, pairs_with, alternatives, left}.
    Free plan: 5 a month (402 code checks_used).
    """
    from .catalog import checks_left, read_link, suits_me as judge
    user = request.user
    if request.method == 'GET':
        return Response({'left': checks_left(user)})
    left = checks_left(user)
    if left is not None and left <= 0:
        return Response({'detail': 'Free checks used for this month.', 'code': 'checks_used'}, status=status.HTTP_402_PAYMENT_REQUIRED)
    image, link = request.FILES.get('image'), str(request.data.get('link', '')).strip()
    if image is not None:
        if image.size > 15 * 1024 * 1024:
            return Response({'image': ['Send a photo under 15 MB.']}, status=status.HTTP_400_BAD_REQUEST)
        ai = analyse_garment(image, request_lang(request))
        if ai and not ai['is_garment']:
            return Response({'detail': 'No clothing found in the photo.', 'code': 'not_garment'}, status=status.HTTP_400_BAD_REQUEST)
        if ai:
            sub, color = ai['subcategory'] or None, (ai['colors'][0]['name'] if ai['colors'] else None)
        else:
            image.seek(0)
            colors, _ = extract_colors(image)
            sub, color = None, (colors[0]['name'] if colors else None)
        source = 'photo'
    elif link:
        sub, color = read_link(link)
        if not sub and not color:
            return Response({'detail': 'Could not read the piece from that link.', 'code': 'link_unreadable'}, status=status.HTTP_400_BAD_REQUEST)
        source = 'link'
    else:
        raise ValidationError({'detail': 'Send a photo or a link.'})
    StyleCheck.objects.create(user=user, source=source)
    result = judge(user, sub, color, _product_ctx(request), request_lang(request))
    return Response({**result, 'left': checks_left(user)})



def _inspiration_row(i, request):
    return {
        'id': i.id, 'image': request.build_absolute_uri(i.image.url) if i.image else None, 'link': i.link,
        'subcategory': i.subcategory, 'color': i.color, 'rgb': list(tx.COLORS[i.color]) if i.color in tx.COLORS else None,
        'note': i.note, 'created_at': i.created_at,
    }


@api_view(['GET', 'POST'])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def inspirations(request):
    """
    The inspiration board: GET the shared pieces; POST a multipart "image" or
    {link} (and an optional note) for something the user liked. Each is read
    once for type and colour and teaches Discovery like a save.
    """
    from .catalog import profile_learned, read_link
    if request.method == 'GET':
        rows = Inspiration.objects.filter(user=request.user)
        return Response({'items': [_inspiration_row(i, request) for i in rows], 'learned': profile_learned(request.user)})
    image, link = request.FILES.get('image'), str(request.data.get('link', '')).strip()
    note = str(request.data.get('note', ''))[:200]
    sub = color = ''
    if image is not None:
        if image.size > 15 * 1024 * 1024:
            return Response({'image': ['Send a photo under 15 MB.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            Image.open(image).verify()
        except Exception:
            return Response({'image': ['That file is not a photo we can read.']}, status=status.HTTP_400_BAD_REQUEST)
        image.seek(0)
        ai = analyse_garment(image, request_lang(request))
        if ai and ai['is_garment']:
            sub, color = ai['subcategory'] or '', (ai['colors'][0]['name'] if ai['colors'] else '')
        else:
            image.seek(0)
            colors, _ = extract_colors(image)
            color = colors[0]['name'] if colors else ''
        image.seek(0)
    elif link:
        if not link.startswith(('http://', 'https://')):
            raise ValidationError({'link': 'Paste a full link that starts with http.'})
        found_sub, found_color = read_link(link)
        sub, color = found_sub or '', found_color or ''
    else:
        raise ValidationError({'detail': 'Share a photo or a link.'})
    i = Inspiration.objects.create(user=request.user, image=image, link=link[:500], subcategory=sub, color=color, note=note)
    return Response({**_inspiration_row(i, request), 'learned': profile_learned(request.user)}, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
def inspiration_detail(request, pk):
    i = Inspiration.objects.filter(user=request.user, pk=pk).first()
    if not i:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    if i.image:
        i.image.delete(save=False)
    i.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
