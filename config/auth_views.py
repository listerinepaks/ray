import json

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout as django_logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
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

from moments.models import Person
from moments.user_profiles import ensure_linked_person_for_user


def _user_group_names(user) -> list[str]:
    """Django auth `Group.name` values (e.g. ``love``) for client UX flags."""
    return list(user.groups.order_by("name").values_list("name", flat=True))


def _serialize_user(user) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "groups": _user_group_names(user),
    }


def _stripped_value(data, key: str) -> str:
    value = data.get(key, "")
    if isinstance(value, list):
        value = value[0] if value else ""
    return str(value).strip()


def _raw_string_value(data, key: str) -> str:
    value = data.get(key, "")
    if isinstance(value, list):
        value = value[0] if value else ""
    return "" if value is None else str(value)


def _field_max_length(model, field_name: str) -> int | None:
    return getattr(model._meta.get_field(field_name), "max_length", None)


def _registration_errors(data) -> dict[str, list[str]]:
    User = get_user_model()
    username_field_name = User.USERNAME_FIELD
    username_field = User._meta.get_field(username_field_name)
    person_name_max = _field_max_length(Person, "name") or 120

    username = _stripped_value(data, "username")
    password = _raw_string_value(data, "password")
    email = _stripped_value(data, "email")
    display_name = _stripped_value(data, "display_name")
    invite_code = _stripped_value(data, "invite_code")
    errors: dict[str, list[str]] = {}

    if not settings.RAY_REGISTRATION_ENABLED:
        errors["detail"] = ["Account creation is not enabled."]

    expected_invite_code = settings.RAY_REGISTRATION_INVITE_CODE
    if expected_invite_code and invite_code != expected_invite_code:
        errors["invite_code"] = ["Enter a valid invite code."]

    if not username:
        errors["username"] = ["Username is required."]
    else:
        max_length = getattr(username_field, "max_length", None)
        if max_length and len(username) > max_length:
            errors["username"] = [f"Username must be {max_length} characters or fewer."]
        for validator in username_field.validators:
            try:
                validator(username)
            except ValidationError as exc:
                errors.setdefault("username", []).extend(exc.messages)
        if User.objects.filter(**{f"{username_field_name}__iexact": username}).exists():
            errors["username"] = ["That username is already taken."]

    if not password:
        errors["password"] = ["Password is required."]

    if display_name and len(display_name) > person_name_max:
        errors["display_name"] = [f"Display name must be {person_name_max} characters or fewer."]

    if email:
        try:
            validate_email(email)
        except ValidationError as exc:
            errors["email"] = exc.messages

    if password:
        candidate = User(**{username_field_name: username})
        if email and hasattr(candidate, "email"):
            candidate.email = email
        if display_name and hasattr(candidate, "first_name"):
            first_name_max = _field_max_length(User, "first_name")
            candidate.first_name = display_name[:first_name_max] if first_name_max else display_name
        try:
            validate_password(password, candidate)
        except ValidationError as exc:
            errors["password"] = exc.messages

    return errors


def _create_registered_user(data):
    errors = _registration_errors(data)
    if errors:
        return None, errors

    User = get_user_model()
    username = _stripped_value(data, "username")
    password = _raw_string_value(data, "password")
    email = _stripped_value(data, "email")
    display_name = _stripped_value(data, "display_name")

    extra_fields = {}
    if display_name and any(field.name == "first_name" for field in User._meta.fields):
        first_name_max = _field_max_length(User, "first_name")
        extra_fields["first_name"] = display_name[:first_name_max] if first_name_max else display_name

    with transaction.atomic():
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            **extra_fields,
        )
        ensure_linked_person_for_user(user)
    return user, {}


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
    return JsonResponse(_serialize_user(user))


@require_POST
def auth_register(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON."}, status=400)
    user, errors = _create_registered_user(data)
    if errors:
        return JsonResponse(errors, status=400)
    login(request, user)
    return JsonResponse(_serialize_user(user), status=201)


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
        return Response(_serialize_user(u))


class AuthUsersView(APIView):
    """Active users for custom sharing (family-sized deployments)."""

    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        User = get_user_model()
        active_users = list(User.objects.filter(is_active=True).order_by("username")[:500])
        user_ids = [u.id for u in active_users]
        people_by_user_id = {
            row.linked_user_id: row
            for row in Person.objects.filter(linked_user_id__in=user_ids).only("id", "linked_user_id", "profile_photo")
        }
        avatar_by_user_id = {
            uid: person.profile_photo.name
            for uid, person in people_by_user_id.items()
            if person.profile_photo
        }
        users = [
            {
                "id": u.id,
                "username": u.username,
                "avatar": avatar_by_user_id.get(u.id),
                "person_id": people_by_user_id.get(u.id).id if people_by_user_id.get(u.id) else None,
            }
            for u in active_users
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
    return Response({"token": token.key, **_serialize_user(user)})


@api_view(["POST"])
@permission_classes([AllowAny])
def auth_token_register(request):
    """Create an account and issue an API token for native clients."""
    user, errors = _create_registered_user(request.data)
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, **_serialize_user(user)}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def auth_token_revoke(request):
    """Delete the caller's token (native sign-out)."""
    Token.objects.filter(user_id=request.user.id).delete()
    return Response({"detail": "ok"})
