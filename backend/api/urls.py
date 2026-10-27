from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('garments', views.GarmentViewSet, basename='garment')
router.register('outfits', views.OutfitViewSet, basename='outfit')
router.register('feedback', views.FeedbackViewSet, basename='feedback')

urlpatterns = [
    path('auth/register/', views.register),
    path('auth/login/', views.login),
    path('auth/logout/', views.logout),
    path('auth/me/', views.me),
    path('meta/', views.meta),
    path('recommendations/', views.recommendations),
    path('check-outfit/', views.check_outfit),
    path('weather/', views.weather),
    path('stats/', views.stats),
    path('', include(router.urls)),
]
