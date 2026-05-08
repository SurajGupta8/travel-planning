from django.db import models
from django.contrib.auth.models import User
from cryptography.fernet import Fernet
from django.conf import settings
import base64

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    preferences = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.user.username}'s profile"

class Trip(models.Model):
    title = models.CharField(max_length=200)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_trips')
    collaborators = models.ManyToManyField(User, related_name='collaborating_trips', blank=True)
    budget = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    predicted_total_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Destination(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='destinations')
    name = models.CharField(max_length=200)
    arrival_date = models.DateField(null=True, blank=True)
    departure_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.trip.title})"

class Activity(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='activities')
    destination = models.ForeignKey(Destination, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=200)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    predicted_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    address = models.CharField(max_length=500, blank=True, null=True)
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    opening_time = models.TimeField(blank=True, null=True)
    closing_time = models.TimeField(blank=True, null=True)
    duration_minutes = models.IntegerField(default=60)

    def __str__(self):
        return self.title

class Expense(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='expenses')
    title = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=100, blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - ${self.amount}"

# Allowed document upload types and max size
ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
MAX_UPLOAD_SIZE_MB = 10

class Document(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=200)
    document_type = models.CharField(max_length=100) # e.g. Passport, Visa, Ticket
    file = models.FileField(upload_to='trip_documents/')
    encrypted_passport_data = models.BinaryField(null=True, blank=True)
    expiration_date = models.DateField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def _get_fernet(self):
        """Get Fernet instance using key from settings (env variable)."""
        key = getattr(settings, 'FERNET_KEY', None)
        if not key:
            raise ValueError("FERNET_KEY not configured in settings. Set the FERNET_ENCRYPTION_KEY environment variable.")
        return Fernet(key.encode() if isinstance(key, str) else key)

    def set_passport_data(self, raw_data):
        f = self._get_fernet()
        self.encrypted_passport_data = f.encrypt(raw_data.encode())

    def get_passport_data(self):
        if not self.encrypted_passport_data:
            return None
        f = self._get_fernet()
        return f.decrypt(self.encrypted_passport_data).decode()

    def clean(self):
        """Validate file type and size on upload."""
        from django.core.exceptions import ValidationError
        if self.file:
            # Validate size
            if self.file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                raise ValidationError(f"File size exceeds {MAX_UPLOAD_SIZE_MB}MB limit.")
            # Validate content type
            if hasattr(self.file, 'content_type') and self.file.content_type not in ALLOWED_DOC_TYPES:
                raise ValidationError(f"File type '{self.file.content_type}' not allowed. Allowed: {', '.join(ALLOWED_DOC_TYPES)}")

    def __str__(self):
        return f"{self.title} ({self.document_type})"
