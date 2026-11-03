from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    ColorPair, Feedback, Garment, Label, MaterialPair, Outfit, OutfitItem, OutfitPlan, OutfitSet, TasteProfile, User,
    VideoScan, WearLog,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ['-date_joined']
    list_display = ['email', 'display_name', 'wardrobe_style', 'date_joined', 'is_staff']
    search_fields = ['email', 'display_name']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Profile', {'fields': ('display_name', 'wardrobe_style', 'style_direction', 'latitude', 'longitude')}),
        ('Preferences', {'fields': (
            'preferred_styles', 'favorite_colors', 'sizes', 'typical_occasions', 'units', 'notifications_enabled',
        )}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = ((None, {'classes': ('wide',), 'fields': ('email', 'password1', 'password2')}),)


@admin.register(Garment)
class GarmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'category', 'subcategory', 'pattern', 'formality', 'warmth', 'times_worn', 'status']
    list_filter = ['category', 'status', 'pattern', 'favorite', 'is_sample']
    search_fields = ['id', 'name', 'user__email']


class OutfitItemInline(admin.TabularInline):
    model = OutfitItem
    extra = 0
    raw_id_fields = ['garment']


@admin.register(Outfit)
class OutfitAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'total_score', 'saved', 'label_source', 'created_at']
    list_filter = ['saved', 'label_source']
    inlines = [OutfitItemInline]


admin.site.register(OutfitSet)
admin.site.register(Feedback)
admin.site.register(WearLog)
admin.site.register(OutfitPlan)
admin.site.register(TasteProfile)
admin.site.register(ColorPair)
admin.site.register(MaterialPair)
admin.site.register(Label)


@admin.register(VideoScan)
class VideoScanAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'error', 'frames_used', 'created_at']
    list_filter = ['status']
