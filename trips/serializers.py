# pyrefly: ignore [missing-import]
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, Trip, Destination, Activity, Expense, Document, ALLOWED_DOC_TYPES, MAX_UPLOAD_SIZE_MB
import bleach

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

    def validate_title(self, value):
        return bleach.clean(value)

    def validate_address(self, value):
        if value:
            return bleach.clean(value)
        return value

    def validate_duration_minutes(self, value):
        if value < 1 or value > 1440:
            raise serializers.ValidationError("Duration must be between 1 and 1440 minutes.")
        return value

    def validate_latitude(self, value):
        if value is not None and (value < -90 or value > 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_longitude(self, value):
        if value is not None and (value < -180 or value > 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value

class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = '__all__'

    def validate_name(self, value):
        return bleach.clean(value)

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'

    def validate_title(self, value):
        return bleach.clean(value)

    def validate_category(self, value):
        if value:
            return bleach.clean(value)
        return value

    def validate_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Amount cannot be negative.")
        if value > 1000000:
            raise serializers.ValidationError("Amount exceeds maximum limit of $1,000,000.")
        return value

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = '__all__'

    def validate_title(self, value):
        return bleach.clean(value)

    def validate_file(self, value):
        # Validate file size
        if value.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            raise serializers.ValidationError(f"File size exceeds {MAX_UPLOAD_SIZE_MB}MB limit.")
        # Validate content type
        if hasattr(value, 'content_type') and value.content_type not in ALLOWED_DOC_TYPES:
            raise serializers.ValidationError(
                f"File type '{value.content_type}' not allowed. Allowed: {', '.join(ALLOWED_DOC_TYPES)}"
            )
        return value

class TripSerializer(serializers.ModelSerializer):
    destinations = DestinationSerializer(many=True, read_only=True)
    activities = ActivitySerializer(many=True, read_only=True)
    expenses = ExpenseSerializer(many=True, read_only=True)
    documents = DocumentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Trip
        fields = '__all__'
        read_only_fields = ['owner']

    def validate_title(self, value):
        return bleach.clean(value)

    def validate_budget(self, value):
        if value is not None:
            if value < 0:
                raise serializers.ValidationError("Budget cannot be negative.")
            if value > 1000000:
                raise serializers.ValidationError("Budget exceeds maximum limit of $1,000,000.")
        return value
