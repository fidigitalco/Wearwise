from django.contrib.auth import password_validation
from rest_framework import serializers

from . import taxonomy as tx
from .models import Feedback, Garment, Occasion, Outfit, OutfitSet, Product, User, VideoScan


def _choice_list(values, allowed, field):
    """A list of known keys, de-duplicated in the order given."""
    if not isinstance(values, list) or not all(isinstance(v, str) for v in values):
        raise serializers.ValidationError('Must be a list of strings.')
    bad = sorted(set(values) - set(allowed))
    if bad:
        raise serializers.ValidationError(f'Unknown {field}: {", ".join(bad)}')
    return list(dict.fromkeys(values))


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'email', 'display_name', 'wardrobe_style', 'style_direction', 'main_occasion', 'onboarded',
            'latitude', 'longitude', 'preferred_styles', 'favorite_colors', 'sizes', 'typical_occasions',
            'units', 'notifications_enabled', 'plan', 'is_guest', 'date_joined',
            'gender', 'birth_year', 'height_cm', 'weight_kg', 'body_shape', 'fit_preference', 'budget', 'avoid_colors',
            'age_range', 'country', 'budget_ranges', 'stores',
        ]
        read_only_fields = ['id', 'email', 'plan', 'is_guest', 'date_joined']

    def validate_preferred_styles(self, v):
        return _choice_list(v, tx.STYLE_DIRECTIONS, 'style')

    def validate_favorite_colors(self, v):
        return _choice_list(v, tx.COLORS, 'colour')

    def validate_budget_ranges(self, v):
        return _choice_list(v, tx.BUDGET_RANGES, 'budget')

    def validate_stores(self, v):
        return _choice_list(v, tx.STORES, 'store')

    def validate_avoid_colors(self, v):
        return _choice_list(v, tx.COLORS, 'colour')

    def validate_birth_year(self, v):
        from django.utils import timezone
        year = timezone.localdate().year
        if v is not None and not year - 100 <= v <= year - 10:
            raise serializers.ValidationError('Enter a birth year that makes you 10 to 100.')
        return v

    def validate_height_cm(self, v):
        if v is not None and not 100 <= v <= 230:
            raise serializers.ValidationError('Height must be 100–230 cm.')
        return v

    def validate_weight_kg(self, v):
        if v is not None and not 30 <= v <= 250:
            raise serializers.ValidationError('Weight must be 30–250 kg.')
        return v

    def validate_typical_occasions(self, v):
        return _choice_list(v, tx.OCCASIONS, 'occasion')

    def validate_sizes(self, v):
        if not isinstance(v, dict):
            raise serializers.ValidationError('Must be an object.')
        bad = sorted(set(v) - set(tx.SIZE_KEYS))
        if bad:
            raise serializers.ValidationError(f'Unknown size: {", ".join(bad)}')
        for k, size in v.items():
            if not isinstance(size, str) or len(size) > 12:
                raise serializers.ValidationError({k: 'Must be text of at most 12 characters.'})
        return {k: size.strip() for k, size in v.items()}

    def validate(self, data):
        # The scorer reads style_direction; keep it in step with the first preferred style.
        if data.get('preferred_styles'):
            data['style_direction'] = data['preferred_styles'][0]
        # A favourite colour cannot also be one to avoid; the newer choice wins.
        if 'avoid_colors' in data:
            fav = data.get('favorite_colors', getattr(self.instance, 'favorite_colors', []) or [])
            data['favorite_colors'] = [c for c in fav if c not in data['avoid_colors']]
        return data


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    display_name = serializers.CharField(max_length=80, error_messages={
        'required': 'Enter your name.', 'blank': 'Enter your name.',
    })

    def validate_email(self, v):
        v = v.lower()
        if User.objects.filter(email=v).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return v

    def validate_password(self, v):
        password_validation.validate_password(v)
        return v

    def create(self, data):
        return User.objects.create_user(**data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


# Comfortable day temperatures for a body piece by its warmth (0–5), the
# Knowledge Base's `weather_fit` (§6). Material shifts it a little.
WEATHER_FIT = {0: (22, 40), 1: (16, 32), 2: (10, 24), 3: (4, 18), 4: (-5, 12), 5: (-25, 5)}


def weather_fit(g):
    """{min_temp_c, max_temp_c, rain_suitable}; no range for shoes, bags and accessories."""
    from .engine.scoring import WARMTH_SLOTS, warmth_of
    out = {'min_temp_c': None, 'max_temp_c': None, 'rain_suitable': bool(g.rain_ok)}
    if g.category in WARMTH_SLOTS:
        w = warmth_of(g)
        lo, hi = WEATHER_FIT[max(0, min(5, round(w)))]
        shift = round((w - round(w)) * 6)  # half a warmth point ≈ 3 °C
        out.update(min_temp_c=lo - shift, max_temp_c=hi - shift)
    return out


class GarmentSerializer(serializers.ModelSerializer):
    primary_color = serializers.CharField(read_only=True)
    weather_fit = serializers.SerializerMethodField()

    def get_weather_fit(self, g):
        return weather_fit(g)

    class Meta:
        model = Garment
        fields = [
            'id', 'image', 'cutout', 'name', 'category', 'subcategory', 'colors', 'primary_color',
            'pattern', 'material', 'surface', 'sheen', 'fit', 'length', 'season', 'warmth', 'rain_ok',
            'formality', 'occasion_tags', 'style_tags', 'attribute_confidence', 'times_worn',
            'last_worn_at', 'status', 'favorite', 'is_sample', 'created_at', 'updated_at', 'weather_fit',
        ]
        read_only_fields = [
            'id', 'cutout', 'times_worn', 'last_worn_at', 'created_at', 'updated_at', 'attribute_confidence',
            'is_sample',
        ]
        # With a photo the type can come from the AI tagger (see GarmentViewSet.perform_create).
        extra_kwargs = {'category': {'required': False}}

    def validate(self, data):
        if self.instance is None and not data.get('category') and not data.get('image'):
            raise serializers.ValidationError({'category': 'Pick what kind of piece this is, or add a photo.'})
        cat = data.get('category', getattr(self.instance, 'category', None))
        sub = data.get('subcategory')
        if sub and cat and sub not in tx.CATEGORIES.get(cat, []):
            raise serializers.ValidationError({'subcategory': f'"{sub}" is not a kind of {cat}.'})
        for f in ('warmth',):
            if f in data and not 0 <= data[f] <= 5:
                raise serializers.ValidationError({f: 'Must be 0–5.'})
        if 'formality' in data and not 1 <= data['formality'] <= 5:
            raise serializers.ValidationError({'formality': 'Must be 1–5.'})
        for f in ('season',):
            bad = set(data.get(f) or []) - set(tx.SEASONS)
            if bad:
                raise serializers.ValidationError({f: f'Unknown: {", ".join(sorted(bad))}'})
        colors = data.get('colors')
        if colors is not None:
            for c in colors:
                if not isinstance(c, dict) or c.get('name') not in tx.COLORS:
                    raise serializers.ValidationError({'colors': 'Each colour needs a known "name".'})
        material = data.get('material')
        if material:
            if material.get('source') and material['source'] not in tx.MATERIAL_SOURCES:
                raise serializers.ValidationError({'material': 'Unknown source.'})
        return data


class OutfitItemGarmentSerializer(serializers.Serializer):
    slot = serializers.CharField()
    garment = GarmentSerializer()


class OutfitSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = Outfit
        fields = [
            'id', 'outfit_set', 'items', 'palette', 'materials', 'context', 'style_direction',
            'scores', 'total_score', 'position', 'title', 'explanation', 'reasons', 'saved', 'created_at',
        ]
        read_only_fields = fields

    def get_items(self, obj):
        items = sorted(obj.items.all(), key=lambda i: SLOT_ORDER.get(i.slot, 9))
        return OutfitItemGarmentSerializer(items, many=True, context=self.context).data


SLOT_ORDER = {'outerwear': 0, 'top': 1, 'dress': 1, 'bottom': 2, 'shoes': 3, 'accessory': 4, 'bag': 5}


class OutfitSetSerializer(serializers.ModelSerializer):
    outfits = serializers.SerializerMethodField()

    class Meta:
        model = OutfitSet
        fields = ['id', 'date', 'occasion', 'context', 'outfits', 'created_at']

    def get_outfits(self, obj):
        outfits = sorted(obj.outfits.all(), key=lambda o: o.position)
        return OutfitSerializer(outfits, many=True, context=self.context).data


class RecommendRequestSerializer(serializers.Serializer):
    occasion = serializers.ChoiceField(choices=list(tx.OCCASIONS))
    date = serializers.DateField(required=False)
    temp_c = serializers.FloatField(required=False, allow_null=True, min_value=-50, max_value=60)
    precip_prob = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=1)
    latitude = serializers.FloatField(required=False, min_value=-90, max_value=90)
    longitude = serializers.FloatField(required=False, min_value=-180, max_value=180)
    style = serializers.ChoiceField(choices=list(tx.STYLE_DIRECTIONS), required=False)


class CheckOutfitSerializer(serializers.Serializer):
    """"Will it work?" — score an outfit the user put together."""
    garment_ids = serializers.ListField(child=serializers.CharField(), min_length=1, max_length=8)
    occasion = serializers.ChoiceField(choices=list(tx.OCCASIONS))
    temp_c = serializers.FloatField(required=False, allow_null=True)
    precip_prob = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=1)
    save = serializers.BooleanField(default=False)


class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = [
            'id', 'outfit_set', 'outfit', 'rank', 'liked', 'removed_garment_ids', 'replaced',
            'rejection_reason', 'worn', 'context', 'created_at',
        ]
        read_only_fields = ['id', 'outfit_set', 'context', 'created_at']

    def validate_outfit(self, outfit):
        if outfit.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Not found.')
        return outfit


class VideoScanSerializer(serializers.ModelSerializer):
    garments = GarmentSerializer(many=True, read_only=True)

    class Meta:
        model = VideoScan
        fields = ['id', 'status', 'error', 'frames_used', 'garments', 'created_at', 'finished_at']
        read_only_fields = fields


class ProductSerializer(serializers.ModelSerializer):
    """A catalogue piece as the app shows it; `why` and `saved` need the request's user."""

    price = serializers.FloatField()
    previous_price = serializers.FloatField(allow_null=True)
    rgb = serializers.SerializerMethodField()
    why = serializers.SerializerMethodField()
    saved = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'store', 'brand', 'price', 'previous_price', 'currency', 'category', 'subcategory', 'color',
            'rgb', 'material', 'styles', 'image_url', 'rating', 'small_brand', 'sponsored', 'is_demo', 'why', 'saved',
        ]

    def get_rgb(self, p):
        return list(tx.COLORS.get(p.color, (140, 140, 140)))

    def get_why(self, p):
        from .catalog import why
        req = self.context.get('request')
        return why(p, req.user, self.context.get('lang', 'en')) if req else ''

    def get_saved(self, p):
        saved = self.context.get('saved_ids')
        return p.id in saved if saved is not None else False


class OccasionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Occasion
        fields = ['id', 'title', 'date', 'kind', 'for_gift', 'person']

    def validate_title(self, v):
        if not v.strip():
            raise serializers.ValidationError('Give the date a name.')
        return v.strip()
