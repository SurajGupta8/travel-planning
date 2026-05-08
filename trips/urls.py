from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserProfileViewSet, TripViewSet, DestinationViewSet, ActivityViewSet, ExpenseViewSet, DocumentViewSet

router = DefaultRouter()
router.register(r'profiles', UserProfileViewSet)
router.register(r'trips', TripViewSet)
router.register(r'destinations', DestinationViewSet)
router.register(r'activities', ActivityViewSet)
router.register(r'expenses', ExpenseViewSet)
router.register(r'documents', DocumentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
