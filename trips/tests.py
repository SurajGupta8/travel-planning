from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from decimal import Decimal
from datetime import datetime, time, date, timedelta

from .models import Trip, Activity, Destination, Expense, Document, UserProfile
from .models import ALLOWED_DOC_TYPES, MAX_UPLOAD_SIZE_MB
from .serializers import (
    TripSerializer, ActivitySerializer, ExpenseSerializer,
    DocumentSerializer, DestinationSerializer
)
from .optimization_engine import optimize_schedule, haversine_distance, estimate_travel_time_minutes
from . import ai_service


# ============================================================
# UNIT TESTS — Model: Trip
# ============================================================

class TripModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tripuser', password='pass123')

    def test_trip_str(self):
        trip = Trip.objects.create(title='Weekend Escape', owner=self.user)
        self.assertEqual(str(trip), 'Weekend Escape')

    def test_trip_default_fields(self):
        trip = Trip.objects.create(title='Defaults', owner=self.user)
        self.assertIsNone(trip.budget)
        self.assertIsNone(trip.predicted_total_cost)
        self.assertIsNone(trip.start_date)
        self.assertIsNone(trip.end_date)
        self.assertIsNotNone(trip.created_at)

    def test_trip_with_budget(self):
        trip = Trip.objects.create(title='Budgeted', owner=self.user, budget=Decimal('2500.50'))
        self.assertEqual(trip.budget, Decimal('2500.50'))

    def test_trip_collaborators(self):
        collab = User.objects.create_user(username='collab', password='pass')
        trip = Trip.objects.create(title='Shared Trip', owner=self.user)
        trip.collaborators.add(collab)
        self.assertIn(collab, trip.collaborators.all())
        self.assertEqual(trip.collaborators.count(), 1)

    def test_trip_dates(self):
        trip = Trip.objects.create(
            title='Dated Trip', owner=self.user,
            start_date=date(2026, 7, 1), end_date=date(2026, 7, 15)
        )
        self.assertEqual((trip.end_date - trip.start_date).days, 14)

    def test_trip_cascade_delete_owner(self):
        trip = Trip.objects.create(title='Delete Me', owner=self.user)
        trip_id = trip.id
        self.user.delete()
        self.assertFalse(Trip.objects.filter(id=trip_id).exists())

    def test_trip_latitude_longitude(self):
        trip = Trip.objects.create(
            title='Coord Trip', owner=self.user,
            latitude=34.0522, longitude=-118.2437
        )
        self.assertEqual(trip.latitude, 34.0522)
        self.assertEqual(trip.longitude, -118.2437)


# ============================================================
# UNIT TESTS — Model: UserProfile
# ============================================================

class UserProfileModelTestCase(TestCase):
    def test_profile_str(self):
        user = User.objects.create_user(username='profuser', password='pass')
        profile = UserProfile.objects.create(user=user)
        self.assertEqual(str(profile), "profuser's profile")

    def test_profile_default_preferences(self):
        user = User.objects.create_user(username='prefuser', password='pass')
        profile = UserProfile.objects.create(user=user)
        self.assertEqual(profile.preferences, {})

    def test_profile_with_preferences(self):
        user = User.objects.create_user(username='custuser', password='pass')
        prefs = {'theme': 'dark', 'language': 'en'}
        profile = UserProfile.objects.create(user=user, preferences=prefs)
        self.assertEqual(profile.preferences['theme'], 'dark')


# ============================================================
# UNIT TESTS — Model: Destination
# ============================================================

class DestinationModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='destuser', password='pass')
        self.trip = Trip.objects.create(title='Asia Trip', owner=self.user)

    def test_destination_str(self):
        dest = Destination.objects.create(trip=self.trip, name='Kyoto')
        self.assertEqual(str(dest), 'Kyoto (Asia Trip)')

    def test_destination_cascade_delete(self):
        dest = Destination.objects.create(trip=self.trip, name='Tokyo')
        dest_id = dest.id
        self.trip.delete()
        self.assertFalse(Destination.objects.filter(id=dest_id).exists())

    def test_destination_dates(self):
        dest = Destination.objects.create(
            trip=self.trip, name='Osaka',
            arrival_date=date(2026, 7, 5), departure_date=date(2026, 7, 8)
        )
        self.assertEqual((dest.departure_date - dest.arrival_date).days, 3)


# ============================================================
# UNIT TESTS — Model: Activity
# ============================================================

class ActivityModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='actuser', password='pass')
        self.trip = Trip.objects.create(title='Act Trip', owner=self.user)

    def test_activity_str(self):
        act = Activity.objects.create(trip=self.trip, title='Visit Temple', duration_minutes=90)
        self.assertEqual(str(act), 'Visit Temple')

    def test_activity_default_duration(self):
        act = Activity.objects.create(trip=self.trip, title='Walk')
        self.assertEqual(act.duration_minutes, 60)

    def test_activity_with_coords(self):
        act = Activity.objects.create(
            trip=self.trip, title='Shrine',
            latitude=35.0116, longitude=135.7681
        )
        self.assertAlmostEqual(act.latitude, 35.0116)
        self.assertAlmostEqual(act.longitude, 135.7681)

    def test_activity_with_opening_closing(self):
        act = Activity.objects.create(
            trip=self.trip, title='Museum',
            opening_time=time(9, 0), closing_time=time(17, 0),
            duration_minutes=120
        )
        self.assertEqual(act.opening_time, time(9, 0))
        self.assertEqual(act.closing_time, time(17, 0))

    def test_activity_null_destination(self):
        act = Activity.objects.create(trip=self.trip, title='Free roam')
        self.assertIsNone(act.destination)


# ============================================================
# UNIT TESTS — Model: Expense
# ============================================================

class ExpenseModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='expuser', password='pass')
        self.trip = Trip.objects.create(title='Exp Trip', owner=self.user)

    def test_expense_str(self):
        exp = Expense.objects.create(trip=self.trip, title='Dinner', amount=Decimal('75.50'))
        self.assertEqual(str(exp), 'Dinner - $75.50')

    def test_expense_auto_date(self):
        exp = Expense.objects.create(trip=self.trip, title='Taxi', amount=Decimal('20'))
        self.assertIsNotNone(exp.date)

    def test_expense_with_category(self):
        exp = Expense.objects.create(
            trip=self.trip, title='Sushi', amount=Decimal('45'),
            category='Food'
        )
        self.assertEqual(exp.category, 'Food')


# ============================================================
# UNIT TESTS — Model: Document (Encryption + Validation)
# ============================================================

@override_settings(FERNET_KEY='btBys_n8Wokk75P-U3y5a33ePukN9MuaCBX-D3Dz5MU=')
class DocumentModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='docuser', password='pass')
        self.trip = Trip.objects.create(title='Doc Trip', owner=self.user)

    def test_document_str(self):
        doc = Document.objects.create(
            trip=self.trip, title='My Passport', document_type='Passport', file='p.pdf'
        )
        self.assertEqual(str(doc), 'My Passport (Passport)')

    def test_fernet_roundtrip(self):
        doc = Document.objects.create(
            trip=self.trip, title='Passport', document_type='Passport', file='test.pdf'
        )
        doc.set_passport_data('AB1234567')
        self.assertIsNotNone(doc.encrypted_passport_data)
        self.assertEqual(doc.get_passport_data(), 'AB1234567')

    def test_fernet_special_characters(self):
        doc = Document.objects.create(
            trip=self.trip, title='ID', document_type='ID', file='id.pdf'
        )
        doc.set_passport_data('Süraj Güpta / P@ss#123')
        self.assertEqual(doc.get_passport_data(), 'Süraj Güpta / P@ss#123')

    def test_get_passport_no_data(self):
        doc = Document.objects.create(
            trip=self.trip, title='Visa', document_type='Visa', file='test.pdf'
        )
        self.assertIsNone(doc.get_passport_data())

    @override_settings(FERNET_KEY=None)
    def test_fernet_missing_key_raises(self):
        doc = Document.objects.create(
            trip=self.trip, title='Key Test', document_type='Test', file='t.pdf'
        )
        with self.assertRaises(ValueError):
            doc.set_passport_data('data')


# ============================================================
# UNIT TESTS — Serializer Validations
# ============================================================

class SerializerValidationTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='seruser', password='pass')
        self.trip = Trip.objects.create(title='Ser Trip', owner=self.user)

    def test_trip_negative_budget_rejected(self):
        data = {'title': 'Bad', 'budget': -100, 'owner': self.user.id}
        ser = TripSerializer(data=data)
        self.assertFalse(ser.is_valid())
        self.assertIn('budget', ser.errors)

    def test_trip_extreme_budget_rejected(self):
        data = {'title': 'Rich', 'budget': 2000000, 'owner': self.user.id}
        ser = TripSerializer(data=data)
        self.assertFalse(ser.is_valid())
        self.assertIn('budget', ser.errors)

    def test_trip_valid_budget_accepted(self):
        data = {'title': 'Good Trip', 'budget': 5000, 'owner': self.user.id}
        ser = TripSerializer(data=data)
        self.assertTrue(ser.is_valid(), ser.errors)

    def test_expense_negative_amount_rejected(self):
        data = {'trip': self.trip.id, 'title': 'Refund', 'amount': -50}
        ser = ExpenseSerializer(data=data)
        self.assertFalse(ser.is_valid())
        self.assertIn('amount', ser.errors)

    def test_expense_extreme_amount_rejected(self):
        data = {'trip': self.trip.id, 'title': 'Yacht', 'amount': 5000000}
        ser = ExpenseSerializer(data=data)
        self.assertFalse(ser.is_valid())
        self.assertIn('amount', ser.errors)

    def test_activity_invalid_duration_rejected(self):
        data = {'trip': self.trip.id, 'title': 'Quick', 'duration_minutes': 0}
        ser = ActivitySerializer(data=data)
        self.assertFalse(ser.is_valid())
        self.assertIn('duration_minutes', ser.errors)

    def test_activity_extreme_duration_rejected(self):
        data = {'trip': self.trip.id, 'title': 'Long', 'duration_minutes': 2000}
        ser = ActivitySerializer(data=data)
        self.assertFalse(ser.is_valid())
        self.assertIn('duration_minutes', ser.errors)

    def test_activity_invalid_latitude_rejected(self):
        data = {'trip': self.trip.id, 'title': 'Bad Coord', 'duration_minutes': 60, 'latitude': 100}
        ser = ActivitySerializer(data=data)
        self.assertFalse(ser.is_valid())
        self.assertIn('latitude', ser.errors)

    def test_activity_invalid_longitude_rejected(self):
        data = {'trip': self.trip.id, 'title': 'Bad Lng', 'duration_minutes': 60, 'longitude': -200}
        ser = ActivitySerializer(data=data)
        self.assertFalse(ser.is_valid())
        self.assertIn('longitude', ser.errors)

    def test_activity_valid_coords_accepted(self):
        data = {'trip': self.trip.id, 'title': 'Good', 'duration_minutes': 60, 'latitude': 35.0, 'longitude': 135.0}
        ser = ActivitySerializer(data=data)
        self.assertTrue(ser.is_valid(), ser.errors)

    def test_bleach_strips_script_from_title(self):
        data = {'trip': self.trip.id, 'title': '<script>alert(1)</script>Visit', 'duration_minutes': 60}
        ser = ActivitySerializer(data=data)
        if ser.is_valid():
            self.assertNotIn('<script>', ser.validated_data['title'])

    def test_destination_name_sanitized(self):
        data = {'trip': self.trip.id, 'name': '<b>Tokyo</b><script>x</script>'}
        ser = DestinationSerializer(data=data)
        if ser.is_valid():
            self.assertNotIn('<script>', ser.validated_data['name'])


# ============================================================
# UNIT TESTS — AI Service
# ============================================================

class AIServiceTestCase(TestCase):
    def test_packing_list_default(self):
        items = ai_service.generate_packing_list('Kyoto', 5)
        self.assertIn('Passport', items)
        self.assertIn('Phone Charger', items)
        self.assertGreater(len(items), 5)

    def test_packing_list_beach(self):
        items = ai_service.generate_packing_list('Hawaii Beach', 7)
        self.assertIn('Swimsuit', items)
        self.assertIn('Sunscreen', items)

    def test_packing_list_ski(self):
        items = ai_service.generate_packing_list('Swiss Alps', 4)
        self.assertIn('Winter Coat', items)
        self.assertIn('Ski goggles', items)

    def test_budget_default(self):
        cost = ai_service.predict_budget('Kyoto', 5)
        self.assertEqual(cost, 150 * 5)

    def test_budget_tokyo(self):
        cost = ai_service.predict_budget('Tokyo', 3)
        self.assertEqual(cost, 250 * 3)

    def test_budget_bali(self):
        cost = ai_service.predict_budget('Bali', 10)
        self.assertEqual(cost, 60 * 10)

    def test_budget_zero_days_clamps_to_one(self):
        cost = ai_service.predict_budget('London', 0)
        self.assertEqual(cost, 250 * 1)

    def test_budget_negative_days_clamps(self):
        cost = ai_service.predict_budget('Vietnam', -3)
        self.assertEqual(cost, 60 * 1)


# ============================================================
# UNIT TESTS — Optimization Engine
# ============================================================

class OptimizationEngineTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password123')
        self.trip = Trip.objects.create(title='Japan Trip', owner=self.user)

    def test_optimize_empty_list(self):
        result = optimize_schedule([], datetime(2026, 6, 1, 9, 0))
        self.assertEqual(result, [])

    def test_optimize_single_activity(self):
        act = Activity.objects.create(
            trip=self.trip, title='Temple', latitude=35.0, longitude=135.0, duration_minutes=60
        )
        result = optimize_schedule([act], datetime(2026, 6, 1, 9, 0))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].start_time, datetime(2026, 6, 1, 9, 0))

    def test_optimize_respects_opening_hours(self):
        act = Activity.objects.create(
            trip=self.trip, title='Museum', latitude=35.0, longitude=135.0,
            duration_minutes=60, opening_time=time(10, 0), closing_time=time(17, 0)
        )
        result = optimize_schedule([act], datetime(2026, 6, 1, 8, 0))
        self.assertEqual(result[0].start_time, datetime(2026, 6, 1, 10, 0))

    def test_optimize_multiple_activities_all_scheduled(self):
        for i in range(5):
            Activity.objects.create(
                trip=self.trip, title=f'Act {i}', duration_minutes=30,
                latitude=35.0 + i * 0.01, longitude=135.0 + i * 0.01
            )
        acts = list(Activity.objects.filter(trip=self.trip))
        result = optimize_schedule(acts, datetime(2026, 6, 1, 9, 0))
        self.assertEqual(len(result), 5)
        for act in result:
            self.assertIsNotNone(act.start_time)
            self.assertIsNotNone(act.end_time)

    def test_optimize_end_after_start(self):
        act = Activity.objects.create(
            trip=self.trip, title='Long', duration_minutes=120, latitude=35.0, longitude=135.0
        )
        result = optimize_schedule([act], datetime(2026, 6, 1, 9, 0))
        self.assertGreater(result[0].end_time, result[0].start_time)
        expected_duration = timedelta(minutes=120)
        self.assertEqual(result[0].end_time - result[0].start_time, expected_duration)

    def test_optimize_no_coords(self):
        act = Activity.objects.create(trip=self.trip, title='NoCoords', duration_minutes=60)
        result = optimize_schedule([act], datetime(2026, 6, 1, 9, 0))
        self.assertEqual(len(result), 1)

    def test_haversine_distance_known_value(self):
        dist = haversine_distance(35.6762, 139.6503, 34.6937, 135.5023)
        self.assertAlmostEqual(dist, 395, delta=15)

    def test_haversine_with_none_coords(self):
        self.assertEqual(haversine_distance(None, 135.0, 35.0, 135.0), 0.0)
        self.assertEqual(haversine_distance(35.0, None, 35.0, 135.0), 0.0)

    def test_haversine_same_point(self):
        dist = haversine_distance(35.0, 135.0, 35.0, 135.0)
        self.assertAlmostEqual(dist, 0.0, places=5)

    def test_estimate_travel_time(self):
        self.assertAlmostEqual(estimate_travel_time_minutes(30.0), 60.0, places=1)

    def test_estimate_travel_time_zero(self):
        self.assertAlmostEqual(estimate_travel_time_minutes(0), 0.0, places=1)


# ============================================================
# INTEGRATION TESTS — API Security
# ============================================================

class APISecurityTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='apiuser', password='password123')
        self.other_user = User.objects.create_user(username='otheruser', password='password456')
        self.trip = Trip.objects.create(title='My Private Trip', owner=self.user, budget=1500)
        self.client = APIClient()

    def test_unauthenticated_get_denied(self):
        response = self.client.get('/api/trips/')
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_post_denied(self):
        response = self.client.post('/api/trips/', {'title': 'Hack'}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_activities_denied(self):
        response = self.client.get('/api/activities/')
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_expenses_denied(self):
        response = self.client.get('/api/expenses/')
        self.assertEqual(response.status_code, 401)

    def test_authenticated_can_list_own_trips(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/trips/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_user_cannot_see_other_trips(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.get('/api/trips/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 0)

    def test_create_trip_sanitizes_xss(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/trips/', {
            'title': '<script>alert("xss")</script>My Trip',
            'budget': 500
        }, format='json')
        if response.status_code == 201:
            self.assertNotIn('<script>', response.json()['title'])

    def test_invalid_delay_minutes_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/trips/{self.trip.id}/reroute_itinerary/',
            {'delay_minutes': -30}, format='json'
        )
        self.assertEqual(response.status_code, 400)

    def test_extreme_delay_minutes_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/trips/{self.trip.id}/reroute_itinerary/',
            {'delay_minutes': 9999}, format='json'
        )
        self.assertEqual(response.status_code, 400)

    def test_non_numeric_delay_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/trips/{self.trip.id}/reroute_itinerary/',
            {'delay_minutes': 'abc'}, format='json'
        )
        self.assertEqual(response.status_code, 400)

    def test_expense_negative_amount_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/expenses/', {
            'trip': self.trip.id, 'title': 'Refund', 'amount': -100
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_create_expense_success(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/expenses/', {
            'trip': self.trip.id, 'title': 'Dinner', 'amount': 50
        }, format='json')
        self.assertEqual(response.status_code, 201)

    def test_create_activity_success(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/activities/', {
            'trip': self.trip.id, 'title': 'Hiking', 'duration_minutes': 120
        }, format='json')
        self.assertEqual(response.status_code, 201)


# ============================================================
# INTEGRATION TESTS — Bleach Sanitization
# ============================================================

class SanitizationTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='sanitizeuser', password='password123')
        self.trip = Trip.objects.create(title='Clean Trip', owner=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_activity_title_sanitized(self):
        response = self.client.post('/api/activities/', {
            'trip': self.trip.id,
            'title': '<b>Bold</b><script>alert(1)</script>',
            'duration_minutes': 60
        }, format='json')
        if response.status_code == 201:
            self.assertNotIn('<script>', response.json()['title'])

    def test_expense_category_sanitized(self):
        response = self.client.post('/api/expenses/', {
            'trip': self.trip.id, 'title': 'Dinner', 'amount': 50,
            'category': '<img src=x onerror=alert(1)>'
        }, format='json')
        if response.status_code == 201:
            self.assertNotIn('<img', response.json()['category'])

    def test_destination_name_sanitized(self):
        response = self.client.post('/api/destinations/', {
            'trip': self.trip.id,
            'name': '<script>steal()</script>Tokyo'
        }, format='json')
        if response.status_code == 201:
            self.assertNotIn('<script>', response.json()['name'])

    def test_clean_title_passes_through(self):
        response = self.client.post('/api/activities/', {
            'trip': self.trip.id,
            'title': 'Visit Fushimi Inari Shrine',
            'duration_minutes': 90
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['title'], 'Visit Fushimi Inari Shrine')


# ============================================================
# INTEGRATION TESTS — Authentication (Google OAuth + JWT)
# ============================================================

from unittest.mock import patch

class AuthViewsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_google_login_success(self, mock_verify):
        mock_verify.return_value = {
            'email': 'newuser@example.com',
            'name': 'New User',
            'picture': 'https://example.com/pic.jpg',
            'sub': '123456789'
        }
        
        response = self.client.post('/api/auth/google/', {'credential': 'fake-token'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.json())
        self.assertIn('refresh', response.json())
        self.assertEqual(response.json()['user']['email'], 'newuser@example.com')
        
        # Verify user was created
        self.assertTrue(User.objects.filter(email='newuser@example.com').exists())

    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_google_login_existing_user(self, mock_verify):
        User.objects.create_user(username='existing@example.com', email='existing@example.com')
        mock_verify.return_value = {
            'email': 'existing@example.com',
            'name': 'Existing User',
            'sub': '123456789'
        }
        
        response = self.client.post('/api/auth/google/', {'credential': 'fake-token'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.filter(email='existing@example.com').count(), 1)

    def test_token_refresh(self):
        user = User.objects.create_user(username='refreshuser', password='password123')
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = str(RefreshToken.for_user(user))
        
        response = self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.json())

    def test_google_login_missing_credential(self):
        response = self.client.post('/api/auth/google/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_google_login_invalid_token(self, mock_verify):
        mock_verify.side_effect = ValueError('Invalid token')
        response = self.client.post('/api/auth/google/', {'credential': 'invalid-token'}, format='json')
        self.assertEqual(response.status_code, 401)

