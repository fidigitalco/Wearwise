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


def scan_id():
    return make_id('scan')


def plan_id():
    return make_id('plan')


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
    # The occasion they dress for most; Today opens on it.
    main_occasion = models.CharField(max_length=24, default='casual', choices=tx.choices(tx.OCCASIONS))
    # Set once the first-run questions (wardrobe, style, main occasion) are answered.
    onboarded = models.BooleanField(default=False)
    # A look-around account made without sign-up; claiming it keeps everything added meanwhile.
    is_guest = models.BooleanField(default=False)
    # Last known location, only to look up the day's weather.
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    # Settings preferences. The first preferred style is mirrored into
    # style_direction, which is what the scorer reads.
    preferred_styles = models.JSONField(default=list, blank=True)
    favorite_colors = models.JSONField(default=list, blank=True)
    sizes = models.JSONField(default=dict, blank=True)  # {"top": "M", "bottom": "32", "shoes": "43"}
    # About you, the questions a stylist asks. Optional, shown only to the user, never in the admin panel.
    gender = models.CharField(max_length=8, blank=True, choices=tx.choices(tx.GENDERS))
    birth_year = models.PositiveSmallIntegerField(null=True, blank=True)
    height_cm = models.PositiveSmallIntegerField(null=True, blank=True)
    weight_kg = models.PositiveSmallIntegerField(null=True, blank=True)
    body_shape = models.CharField(max_length=20, blank=True, choices=tx.choices(tx.BODY_SHAPES))
    # How they like clothes to sit; nudges the silhouette score.
    fit_preference = models.CharField(max_length=10, blank=True, choices=tx.choices(tx.FIT_PREFERENCES))
    budget = models.CharField(max_length=4, blank=True, choices=tx.choices(tx.BUDGETS))
    # Colours they never want suggested; outfits wearing them are pushed down.
    avoid_colors = models.JSONField(default=list, blank=True)
    # MVP v2 profile: the age band, where they shop, what they pay per piece and the stores they like.
    age_range = models.CharField(max_length=6, blank=True, choices=tx.choices(tx.AGE_RANGES))
    country = models.CharField(max_length=6, blank=True, choices=tx.choices(tx.COUNTRIES))
    budget_ranges = models.JSONField(default=list, blank=True)
    stores = models.JSONField(default=list, blank=True)
    typical_occasions = models.JSONField(default=list, blank=True)
    units = models.CharField(max_length=8, default='metric', choices=tx.choices(tx.UNITS))
    notifications_enabled = models.BooleanField(default=True)

    # Set by store billing once it is connected; everyone is on the free plan until then.
    plan = models.CharField(max_length=16, default='free', choices=[('free', 'Free'), ('premium', 'Premium')])

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class SocialAccount(models.Model):
    """A Sign in with Apple / Google identity linked to a user (`sub` is the provider's stable user id)."""

    PROVIDERS = [('apple', 'Apple'), ('google', 'Google')]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_accounts')
    provider = models.CharField(max_length=16, choices=PROVIDERS)
    sub = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['provider', 'sub'], name='unique_social_identity')]


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
    favorite = models.BooleanField(default=False)
    # Part of the demo wardrobe from POST /garments/sample/; removable in one go.
    is_sample = models.BooleanField(default=False)

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
    # Who asked: the Today screen or the stylist assistant.
    source = models.CharField(max_length=12, default='recommend', choices=tx.choices(['recommend', 'assistant']))
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
    title = models.CharField(max_length=60, blank=True)  # short editorial name, e.g. "Rainy Day Layers"
    reasons = models.JSONField(default=list, blank=True)  # "Why this outfit works" sentences
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


class OutfitPlan(models.Model):
    """An outfit picked ahead for one day, so the morning needs no deciding. One per user per day."""

    id = models.CharField(primary_key=True, max_length=40, default=plan_id, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='plans')
    outfit = models.ForeignKey(Outfit, on_delete=models.CASCADE, related_name='plans')
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']
        constraints = [models.UniqueConstraint(fields=['user', 'date'], name='one_plan_per_day')]


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


def scan_upload_to(instance, filename):
    ext = (filename.rsplit('.', 1)[-1] if '.' in filename else 'mp4').lower()
    return f'scans/{instance.user_id}/{instance.id}.{ext}'


class VideoScan(models.Model):
    """
    A closet video turned into garments (KB section 4, stages 1–5).

    The video is deleted once processed; only the garments cut from its frames
    are kept.
    """

    id = models.CharField(primary_key=True, max_length=40, default=scan_id, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scans')
    video = models.FileField(upload_to=scan_upload_to, null=True, blank=True)
    lang = models.CharField(max_length=2, default='en')
    status = models.CharField(max_length=12, default='processing', choices=tx.choices(['processing', 'done', 'failed']))
    # Machine-readable reason when failed: no_frames, ai_unavailable, ai_failed, error.
    error = models.CharField(max_length=24, blank=True)
    frames_used = models.PositiveSmallIntegerField(default=0)
    garments = models.ManyToManyField(Garment, blank=True, related_name='scans')
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']


class AppFeedback(models.Model):
    """What a user wrote from Settings → Send feedback. Admins read these; nothing else uses them."""

    KINDS = ['idea', 'problem', 'other']

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='app_feedback')
    kind = models.CharField(max_length=10, default='other', choices=tx.choices(KINDS))
    message = models.TextField(max_length=4000)
    platform = models.CharField(max_length=10, blank=True)
    app_version = models.CharField(max_length=20, blank=True)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class AffiliateClick(models.Model):
    """A tap on "Find in <store>" (affiliate integration step 4). Counted in the admin panel, never shown per user."""

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='affiliate_clicks')
    store = models.CharField(max_length=24)
    subcategory = models.CharField(max_length=24, blank=True)
    color = models.CharField(max_length=16, blank=True)
    source = models.CharField(max_length=12, default='gap', choices=tx.choices(['gap', 'check', 'assistant']))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


def product_id():
    return make_id('p')


class Product(models.Model):
    """
    One piece in the shopping catalogue (MVP v2). Real rows come from affiliate
    network feeds (Awin, Rakuten, CJ, Impact); until those are approved, a demo
    catalogue is loaded by `manage.py load_catalog`. `url` is where Shop goes,
    wrapped with the affiliate sub-id when the click is logged.
    """

    id = models.CharField(primary_key=True, max_length=32, default=product_id, editable=False)
    name = models.CharField(max_length=160)
    store = models.CharField(max_length=40)
    brand = models.CharField(max_length=60, blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    # The last price seen before this one, for price-drop alerts; feeds refresh it daily.
    previous_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    category = models.CharField(max_length=16, choices=tx.choices(tx.CATEGORIES))
    subcategory = models.CharField(max_length=24)
    color = models.CharField(max_length=16)
    material = models.CharField(max_length=24, blank=True)
    styles = models.JSONField(default=list, blank=True)
    formality = models.PositiveSmallIntegerField(default=2)  # 1 lounge … 5 black tie
    warmth = models.PositiveSmallIntegerField(default=1)  # 0 … 5
    gender = models.CharField(max_length=8, default='women', choices=tx.choices(['women', 'men', 'unisex']))
    sizes = models.JSONField(default=list, blank=True)
    image_url = models.URLField(blank=True)
    url = models.URLField(max_length=500)
    rating = models.FloatField(null=True, blank=True)
    small_brand = models.BooleanField(default=False)
    # Paid placement; always labelled in the app (wearwise-mvp.md, risk 3). None in the demo catalogue.
    sponsored = models.BooleanField(default=False)
    is_demo = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.store})'


class ProductAction(models.Model):
    """Like, Not me, Save or Shop on a product: the taste signal Discovery learns from."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='product_actions')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='actions')
    action = models.CharField(max_length=8, choices=tx.choices(tx.PRODUCT_ACTIONS))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class SavedProduct(models.Model):
    """The wishlist: a saved product, optionally watched for a price drop or a cheaper similar piece."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_products')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='saved_by')
    tracking = models.BooleanField(default=False)
    price_when_saved = models.DecimalField(max_digits=8, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['user', 'product'], name='one_save_per_product')]


class DiscoveryDrop(models.Model):
    """The products shown in one Discovery drop (Mon, Wed, Fri), so a drop stays the same all day."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='discovery_drops')
    key = models.CharField(max_length=16)  # e.g. 2026-W45-1
    product_ids = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'key'], name='one_drop_per_key')]


class Occasion(models.Model):
    """A date to dress for (or buy a gift for): outfits come 15 days before, a reminder at 7 (MVP §4)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='occasions')
    title = models.CharField(max_length=80)
    date = models.DateField()
    kind = models.CharField(max_length=10, default='other', choices=tx.choices(tx.OCCASION_KINDS))
    # Gift mode: the date is someone else's and the picks are gift ideas for them.
    for_gift = models.BooleanField(default=False)
    person = models.CharField(max_length=60, blank=True)
    # What the user will wear: one of their saved outfits, or one built from their closet.
    outfit = models.ForeignKey('Outfit', on_delete=models.SET_NULL, null=True, blank=True, related_name='occasions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']


class StyleCheck(models.Model):
    """One "Does this suit me?" check, counted against the free plan's five a month."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='style_checks')
    source = models.CharField(max_length=6, choices=tx.choices(['photo', 'link']))
    created_at = models.DateTimeField(auto_now_add=True)


def inspiration_upload_to(instance, filename):
    ext = (filename.rsplit('.', 1)[-1] if '.' in filename else 'jpg').lower()
    return f'inspiration/{instance.user_id}/{uuid.uuid4().hex[:16]}.{ext}'


class Inspiration(models.Model):
    """
    Something the user liked and shared: a photo (screenshot, street, store) or
    a product link. What it shows is read once (type and colour) and counts
    towards their taste like a save, so Discovery learns from it.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='inspirations')
    image = models.ImageField(upload_to=inspiration_upload_to, null=True, blank=True)
    link = models.URLField(max_length=500, blank=True)
    subcategory = models.CharField(max_length=24, blank=True)
    color = models.CharField(max_length=16, blank=True)
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
