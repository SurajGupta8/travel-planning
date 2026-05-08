# pyrefly: ignore [missing-import]
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models as db_models
from .models import UserProfile, Trip, Destination, Activity, Expense, Document
from .serializers import UserProfileSerializer, TripSerializer, DestinationSerializer, ActivitySerializer, ExpenseSerializer, DocumentSerializer
from . import ai_service
from . import optimization_engine
from datetime import datetime, time


class IsOwnerOrCollaborator(permissions.BasePermission):
    """Object-level permission: only trip owner or collaborators can access."""
    def has_object_permission(self, request, view, obj):
        trip = obj if isinstance(obj, Trip) else getattr(obj, 'trip', None)
        if not trip:
            return False
        return (
            trip.owner == request.user or
            request.user in trip.collaborators.all()
        )


class UserProfileViewSet(viewsets.ModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserProfile.objects.filter(user=self.request.user)


class TripViewSet(viewsets.ModelViewSet):
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrCollaborator]

    def get_queryset(self):
        """Users can only see trips they own or collaborate on."""
        user = self.request.user
        return Trip.objects.filter(
            db_models.Q(owner=user) | db_models.Q(collaborators=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
    
    @action(detail=True, methods=['get'])
    def generate_packing_list(self, request, pk=None):
        trip = self.get_object()
        dest_name = trip.destinations.first().name if trip.destinations.exists() else "Unknown"
        
        duration = 3
        if trip.start_date and trip.end_date:
            duration = (trip.end_date - trip.start_date).days
            
        packing_list = ai_service.generate_packing_list(dest_name, duration)
        return Response({"packing_list": packing_list})
        
    @action(detail=True, methods=['get'])
    def budget_forecast(self, request, pk=None):
        trip = self.get_object()
        dest_name = trip.destinations.first().name if trip.destinations.exists() else "Unknown"
        
        duration = 3
        if trip.start_date and trip.end_date:
            duration = (trip.end_date - trip.start_date).days
            
        forecast = ai_service.predict_budget(dest_name, duration)
        
        trip.predicted_total_cost = forecast
        trip.save()
        
        return Response({
            "predicted_total_cost": forecast,
            "budget": trip.budget
        })

    @action(detail=True, methods=['post'])
    def optimize_itinerary(self, request, pk=None):
        trip = self.get_object()
        
        activities = list(trip.activities.all())
        if not activities:
            return Response({"status": "no activities to optimize"})
            
        start_date = trip.start_date or datetime.today().date()
        day_start_time = datetime.combine(start_date, time(9, 0))
        
        optimized = optimization_engine.optimize_schedule(activities, day_start_time)
        
        for act in optimized:
            act.save()
            
        return Response({"status": "optimization complete", "optimized_count": len(optimized)})

    @action(detail=True, methods=['post'])
    def reroute_itinerary(self, request, pk=None):
        trip = self.get_object()

        # Validate delay_minutes input
        try:
            delay_minutes = int(request.data.get('delay_minutes', 0))
        except (ValueError, TypeError):
            return Response(
                {"error": "delay_minutes must be a valid integer"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if delay_minutes < 0 or delay_minutes > 1440:
            return Response(
                {"error": "delay_minutes must be between 0 and 1440 (24 hours)"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        activities = list(trip.activities.all().order_by('start_time'))
        
        if not activities:
            return Response({"status": "no activities to reroute"})
            
        from datetime import timedelta
        start_date = trip.start_date or datetime.today().date()
        first_act_start = activities[0].start_time.time() if activities[0].start_time else time(9,0)
        day_start_time = datetime.combine(start_date, first_act_start) + timedelta(minutes=delay_minutes)
        
        optimized = optimization_engine.optimize_schedule(activities, day_start_time)
        
        for act in optimized:
            act.save()
            
        return Response({"status": "rerouting complete", "delay_applied": delay_minutes})


class DestinationViewSet(viewsets.ModelViewSet):
    serializer_class = DestinationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Destination.objects.filter(trip__owner=self.request.user)


class ActivityViewSet(viewsets.ModelViewSet):
    serializer_class = ActivitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Activity.objects.filter(trip__owner=self.request.user)


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Expense.objects.filter(trip__owner=self.request.user)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Document.objects.filter(trip__owner=self.request.user)
