import json

from django.contrib.auth import authenticate, get_user_model, login, logout as django_logout
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from rest_framework import status
from rest_framework.authentication import SessionAuthentication, TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


@require_GET
@ensure_csrf_cookie
def auth_csrf(request):
    """Set the csrftoken cookie so the SPA can send X-CSRFToken on POST."""
    return JsonResponse({"detail": "ok"})


@require_POST
def auth_login(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON."}, status=400)
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return JsonResponse({"detail": "Username and password required."}, status=400)
    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_active:
        return JsonResponse({"detail": "Invalid credentials."}, status=400)
    login(request, user)
    return JsonResponse(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        }
    )


@require_POST
def auth_logout(request):
    django_logout(request)
    return JsonResponse({"detail": "ok"})


class AuthMeView(APIView):
    """Session (web) or Token (native) authentication."""

    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response(
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
            }
        )


class AuthUsersView(APIView):
    """Active users for custom sharing (family-sized deployments)."""

    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        User = get_user_model()
        users = [
            {"id": u.id, "username": u.username}
            for u in User.objects.filter(is_active=True).order_by("username")[:500]
        ]
        return Response({"users": users})


@api_view(["POST"])
@permission_classes([AllowAny])
def auth_token_obtain(request):
    """Issue or rotate an API token for native clients (Expo). Web continues to use session cookies."""
    username = request.data.get("username")
    password = request.data.get("password")
    if not username or not password:
        return Response(
            {"detail": "Username and password required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_active:
        return Response(
            {"detail": "Invalid credentials."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            "token": token.key,
            "id": user.id,
            "username": user.username,
            "email": user.email,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def auth_token_revoke(request):
    """Delete the caller's token (native sign-out)."""
    Token.objects.filter(user_id=request.user.id).delete()
    return Response({"detail": "ok"})
