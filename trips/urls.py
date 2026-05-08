from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserProfileViewSet, TripViewSet, DestinationViewSet, ActivityViewSet, ExpenseViewSet, DocumentViewSet
from .auth_views import google_login, refresh_token

router = DefaultRouter()
router.register(r'profiles', UserProfileViewSet, basename='userprofile')
router.register(r'trips', TripViewSet, basename='trip')
router.register(r'destinations', DestinationViewSet, basename='destination')
router.register(r'activities', ActivityViewSet, basename='activity')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'documents', DocumentViewSet, basename='document')

urlpatterns = [
    path('auth/google/', google_login, name='google-login'),
    path('auth/refresh/', refresh_token, name='token-refresh'),
    path('', include(router.urls)),
]

