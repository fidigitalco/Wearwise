from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import admin_views, views

router = DefaultRouter()
router.register('garments', views.GarmentViewSet, basename='garment')
router.register('outfits', views.OutfitViewSet, basename='outfit')
router.register('feedback', views.FeedbackViewSet, basename='feedback')
router.register('scans', views.VideoScanViewSet, basename='scan')

urlpatterns = [
    # The admin panel (/admin Next.js app); staff only.
    path('admin/login/', admin_views.admin_login),
    path('admin/stats/', admin_views.admin_stats),
    path('admin/analytics/', admin_views.admin_analytics),
    path('admin/users/', admin_views.admin_users),
    path('admin/users/<int:pk>/', admin_views.admin_user),
    path('admin/premium/', admin_views.admin_premium),
    path('admin/feedback/', admin_views.admin_feedback),
    path('admin/feedback/<int:pk>/', admin_views.admin_feedback_item),
    path('admin/errors/', admin_views.admin_errors),
    path('admin/errors/<str:kind>/<int:pk>/', admin_views.admin_error),
    path('admin/products/', admin_views.admin_products),
    path('admin/products/meta/', admin_views.admin_product_meta),
    path('admin/products/guess/', admin_views.admin_product_guess),
    path('admin/products/<str:pk>/', admin_views.admin_product),
    path('auth/register/', views.register),
    path('auth/login/', views.login),
    path('auth/social/', views.social_login),
    path('auth/guest/', views.guest),
    path('auth/claim/', views.claim),
    path('auth/apple/start/', views.apple_start),
    path('auth/apple/callback/', views.apple_callback),
    path('auth/forgot-password/', views.forgot_password),
    path('auth/reset-password/', views.reset_password),
    path('auth/change-password/', views.change_password),
    path('auth/logout/', views.logout),
    path('auth/me/', views.me),
    path('meta/', views.meta),
    path('recommendations/', views.recommendations),
    path('recommendations/latest/', views.latest_recommendations),
    path('assistant/', views.assistant),
    path('plan/read/', views.plan_read),
    path('shopping/', views.shopping),
    path('shopping/check/', views.shopping_check),
    path('shopping/click/', views.shopping_click),
    path('calendar/', views.calendar_month),
    path('calendar/day/', views.calendar_day),
    path('calendar/plan/', views.calendar_plan),
    path('check-outfit/', views.check_outfit),
    path('weather/', views.weather),
    path('stats/', views.stats),
    path('app-feedback/', views.app_feedback),
    path('crash/', views.crash_report),
    path('me/install/', views.install_source),
    path('home/', views.home),
    path('discover/', views.discover),
    path('products/<str:pk>/action/', views.product_action),
    path('saved/', views.saved_products),
    path('saved/<str:pk>/', views.saved_product),
    path('occasions/', views.occasions),
    path('occasions/<int:pk>/', views.occasion_detail),
    path('suits-me/', views.suits_me),
    path('inspirations/', views.inspirations),
    path('inspirations/<int:pk>/', views.inspiration_detail),
    path('', include(router.urls)),
]
