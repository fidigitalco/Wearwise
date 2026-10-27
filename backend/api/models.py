import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

from . import taxonomy as tx


def make_id(prefix):
    """Prefixed, sortable-enough ids ("g_…", "o_…") as in the KB schemas."""
    return f'{prefix}_{uuid.uuid4().hex[:20]}'


# Named functions so migrations can serialize them.
def garment_id():
    return make_id('g')


def outfit_id():
    return make_id('o')


def outfit_set_id():
    return make_id('set')


def feedback_id():
    return make_id('f')


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    """Signs in with email; `username` is dropped."""

    username = None
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=80, blank=True)
    wardrobe_style = models.CharField(
        max_length=16, default='neutral',
        choices=tx.choices(['menswear', 'womenswear', 'neutral']),
    )
    style_direction = models.CharField(max_length=24, default='smart_casual', choices=tx.choices(tx.STYLE_DIRECTIONS))
    # Last known location, only to look up the day's weather.
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


def garment_upload_to(instance, filename):
    ext = (filename.rsplit('.', 1)[-1] if '.' in filename else 'jpg').lower()
    return f'garments/{instance.user_id}/{instance.id}.{ext}'


def cutout_upload_to(instance, filename):
    return f'garments/{instance.user_id}/{instance.id}_cutout.png'


class Garment(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=garment_id, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='garments')
    image = models.ImageField(upload_to=garment_upload_to, null=True, blank=True)
    cutout = models.ImageField(upload_to=cutout_upload_to, null=True, blank=True)
    name = models.CharField(max_length=120, blank=True)

    category = models.CharField(max_length=16, choices=tx.choices(tx.CATEGORIES))
    subcategory = models.CharField(max_length=32, blank=True)
    # [{"name": "yellow", "rgb": [217,169,51], "lab": [72.1, 8.4, 61.0], "share": 0.86}]
    colors = models.JSONField(default=list, blank=True)
    pattern = models.CharField(max_length=16, default='solid', choices=tx.choices(tx.PATTERNS))
    # {"value": "nylon", "source": "visual_estimate", "confidence": 0.55}
    material = models.JSONField(default=dict, blank=True)
    surface = models.CharField(max_length=16, default='smooth', choices=tx.choices(tx.SURFACES))
    sheen = models.CharField(max_length=8, default='low', choices=tx.choices(tx.SHEENS))
    fit = models.CharField(max_length=16, default='regular', choices=tx.choices(tx.FITS))
    length = models.CharField(max_length=16, blank=True)

    season = models.JSONField(default=list, blank=True)
    warmth = models.PositiveSmallIntegerField(default=2)  # 0 (vest) … 5 (parka)
    rain_ok = models.BooleanField(default=False)
    formality = models.PositiveSmallIntegerField(default=2)  # 1 … 5
    occasion_tags = models.JSONField(default=list, blank=True)
    style_tags = models.JSONField(default=list, blank=True)

    embedding_model = models.CharField(max_length=40, blank=True)
    embedding = models.JSONField(null=True, blank=True)
    attribute_confidence = models.JSONField(default=dict, blank=True)

    times_worn = models.PositiveIntegerField(default=0)
    last_worn_at = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, default='available', choices=tx.choices(tx.STATUSES))

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'category', 'status'])]

    def __str__(self):
        return self.name or f'{self.category}/{self.subcategory} {self.id}'

    @property
    def primary_color(self):
        return self.colors[0]['name'] if self.colors else None


class OutfitSet(models.Model):
    """One request for suggestions: the context and the three outfits it returned."""

    id = models.CharField(primary_key=True, max_length=40, default=outfit_set_id, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='outfit_sets')
    date = models.DateField()
    occasion = models.CharField(max_length=24, choices=tx.choices(tx.OCCASIONS))
    context = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Outfit(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=outfit_id, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='outfits')
    outfit_set = models.ForeignKey(OutfitSet, null=True, blank=True, on_delete=models.CASCADE, related_name='outfits')
    garments = models.ManyToManyField(Garment, through='OutfitItem', related_name='outfits')
    palette = models.JSONField(default=list, blank=True)
    materials = models.JSONField(default=list, blank=True)
    context = models.JSONField(default=dict, blank=True)
    style_direction = models.CharField(max_length=24, blank=True)
    scores = models.JSONField(default=dict, blank=True)
    total_score = models.FloatField(default=0)
    position = models.PositiveSmallIntegerField(default=0)  # order shown in its set
    expert_rating = models.FloatField(null=True, blank=True)
    explanation = models.TextField(blank=True)
    label_source = models.CharField(max_length=16, default='user_feedback', choices=tx.choices(tx.LABEL_SOURCES))
    provenance = models.JSONField(default=dict, blank=True)
    saved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', 'position']


class OutfitItem(models.Model):
    outfit = models.ForeignKey(Outfit, on_delete=models.CASCADE, related_name='items')
    garment = models.ForeignKey(Garment, on_delete=models.CASCADE, related_name='outfit_items')
    slot = models.CharField(max_length=16)

    class Meta:
        unique_together = [('outfit', 'garment')]


class Feedback(models.Model):
    """Ranks, likes, swaps and "wore it" — the training signal (KB section 5.3)."""

    id = models.CharField(primary_key=True, max_length=32, default=feedback_id, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedback')
    outfit_set = models.ForeignKey(OutfitSet, null=True, blank=True, on_delete=models.SET_NULL, related_name='feedback')
    outfit = models.ForeignKey(Outfit, on_delete=models.CASCADE, related_name='feedback')
    rank = models.PositiveSmallIntegerField(null=True, blank=True)
    liked = models.BooleanField(null=True, blank=True)
    removed_garment_ids = models.JSONField(default=list, blank=True)
    replaced = models.JSONField(default=list, blank=True)  # [{"from": "g_3", "to": "g_9"}]
    rejection_reason = models.CharField(max_length=40, blank=True)
    worn = models.BooleanField(default=False)
    context = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class WearLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wear_log')
    outfit = models.ForeignKey(Outfit, null=True, blank=True, on_delete=models.SET_NULL, related_name='wear_log')
    garments = models.ManyToManyField(Garment, related_name='wear_log')
    worn_on = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-worn_on', '-created_at']


class TasteProfile(models.Model):
    """
    Per-user preference weights learned from feedback.

    `weights` holds additive affinities keyed "g:<garment_id>", "c:<color>",
    "cp:<color_a>|<color_b>" and "p:<pattern>". Starts empty (cold start falls
    back to the rule scores).
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='taste')
    weights = models.JSONField(default=dict, blank=True)
    liked_colors = models.JSONField(default=list, blank=True)
    disliked_colors = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class ColorPair(models.Model):
    """Rated colour-pair compatibility (0–100). Overrides the heuristic when present."""

    color_a = models.CharField(max_length=16)
    color_b = models.CharField(max_length=16)
    score = models.FloatField()
    n_raters = models.PositiveIntegerField(default=0)
    label_source = models.CharField(max_length=16, default='illustrative', choices=tx.choices(tx.LABEL_SOURCES))

    class Meta:
        unique_together = [('color_a', 'color_b')]

    def save(self, *args, **kwargs):
        # Store unordered pairs in one canonical order.
        self.color_a, self.color_b = sorted([self.color_a, self.color_b])
        super().save(*args, **kwargs)


class MaterialPair(models.Model):
    material_a = models.CharField(max_length=32)
    material_b = models.CharField(max_length=32)
    score = models.FloatField()
    n_raters = models.PositiveIntegerField(default=0)
    label_source = models.CharField(max_length=16, default='illustrative', choices=tx.choices(tx.LABEL_SOURCES))

    class Meta:
        unique_together = [('material_a', 'material_b')]

    def save(self, *args, **kwargs):
        self.material_a, self.material_b = sorted([self.material_a, self.material_b])
        super().save(*args, **kwargs)


class Label(models.Model):
    """A rater's judgment on an outfit or pair, for the training sets (KB 5.1–5.2)."""

    target_type = models.CharField(max_length=16, choices=tx.choices(['outfit', 'color_pair', 'material_pair']))
    target_id = models.CharField(max_length=64)
    rater = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='labels')
    verdict = models.CharField(max_length=16, choices=tx.choices(['positive', 'negative', 'hard_negative', 'conditional']))
    score = models.FloatField(null=True, blank=True)
    note = models.TextField(blank=True)
    label_source = models.CharField(max_length=16, choices=tx.choices(tx.LABEL_SOURCES))
    validated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
