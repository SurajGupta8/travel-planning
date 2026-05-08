# pyrefly: ignore [missing-import]
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, Trip, Destination, Activity, Expense, Document

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'preferences']

class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = '__all__'

class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = '__all__'

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = '__all__'

class TripSerializer(serializers.ModelSerializer):
    destinations = DestinationSerializer(many=True, read_only=True)
    activities = ActivitySerializer(many=True, read_only=True)
    expenses = ExpenseSerializer(many=True, read_only=True)
    documents = DocumentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Trip
        fields = '__all__'
