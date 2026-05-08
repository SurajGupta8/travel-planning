"""
Google OAuth token exchange endpoint.
Receives a Google credential (ID token) from the frontend,
verifies it, creates/gets the Django user, and returns JWT tokens.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

GOOGLE_CLIENT_ID = "972375338739-qe872mbdl7nmbc7bf7q3dtdot7loadip.apps.googleusercontent.com"


@api_view(['POST'])
@permission_classes([AllowAny])
def google_login(request):
    """Exchange a Google OAuth credential for JWT access/refresh tokens."""
    credential = request.data.get('credential')
    if not credential:
        return Response({'error': 'credential is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )

        email = idinfo.get('email')
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')

        if not email:
            return Response({'error': 'Email not found in token'}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create Django user
        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                'email': email,
                'first_name': name.split(' ')[0] if name else '',
                'last_name': ' '.join(name.split(' ')[1:]) if name else '',
            }
        )

        if not created:
            # Update name if changed
            user.first_name = name.split(' ')[0] if name else user.first_name
            user.last_name = ' '.join(name.split(' ')[1:]) if name else user.last_name
            user.save()

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}".strip(),
                'picture': picture,
            }
        })

    except ValueError as e:
        return Response({'error': f'Invalid token: {str(e)}'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    """Exchange a refresh token for a new access token."""
    refresh = request.data.get('refresh')
    if not refresh:
        return Response({'error': 'refresh token required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        token = RefreshToken(refresh)
        return Response({
            'access': str(token.access_token),
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)
