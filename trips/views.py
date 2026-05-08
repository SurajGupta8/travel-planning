# pyrefly: ignore [missing-import]
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import UserProfile, Trip, Destination, Activity, Expense, Document
from .serializers import UserProfileSerializer, TripSerializer, DestinationSerializer, ActivitySerializer, ExpenseSerializer, DocumentSerializer
from . import ai_service
from . import optimization_engine
from datetime import datetime, time

class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer

class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.all()
    serializer_class = TripSerializer
    
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
        
        # Get all activities for a specific day or all activities if no date filter
        # For MVP, we just take all activities for this trip and assume they are on start_date
        activities = list(trip.activities.all())
        if not activities:
            return Response({"status": "no activities to optimize"})
            
        start_date = trip.start_date or datetime.today().date()
        # Default start time 09:00 AM
        day_start_time = datetime.combine(start_date, time(9, 0))
        
        optimized = optimization_engine.optimize_schedule(activities, day_start_time)
        
        # Save updated times
        for act in optimized:
            act.save()
            
        return Response({"status": "optimization complete", "optimized_count": len(optimized)})

    @action(detail=True, methods=['post'])
    def reroute_itinerary(self, request, pk=None):
        trip = self.get_object()
        delay_minutes = int(request.data.get('delay_minutes', 0))
        
        activities = list(trip.activities.all().order_class_by_start_time() if hasattr(trip.activities, 'order_class_by_start_time') else trip.activities.all().order_by('start_time'))
        
        if not activities:
            return Response({"status": "no activities to reroute"})
            
        # Push the start time back by the delay amount
        start_date = trip.start_date or datetime.today().date()
        first_act_start = activities[0].start_time.time() if activities[0].start_time else time(9,0)
        day_start_time = datetime.combine(start_date, first_act_start) + timedelta(minutes=delay_minutes)
        
        optimized = optimization_engine.optimize_schedule(activities, day_start_time)
        
        for act in optimized:
            act.save()
            
        return Response({"status": "rerouting complete", "delay_applied": delay_minutes})

class DestinationViewSet(viewsets.ModelViewSet):
    queryset = Destination.objects.all()
    serializer_class = DestinationSerializer

class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer

class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
