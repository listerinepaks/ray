from django.db import IntegrityError
from django.http import Http404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .access import get_moment_for_nested_view
from .models import Comment, Moment, MomentPhoto, Person, Reaction
from .permissions import (
    CommentPermission,
    MomentEditPermission,
    MomentPhotoPermission,
    PersonPermission,
    ReactionPermission,
)
from .serializers import (
    CommentSerializer,
    MomentPhotoSerializer,
    MomentSerializer,
    PersonSerializer,
    ProfileSerializer,
    ReactionSerializer,
)


class PersonViewSet(ModelViewSet):
    serializer_class = PersonSerializer
    permission_classes = [PersonPermission]

    def get_queryset(self):
        return Person.objects.select_related("linked_user", "created_by").all().order_by("name", "id")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProfileMeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return (
            Person.objects.filter(linked_user=self.request.user)
            .order_by("id")
            .first()
        )

    def _default_name(self):
        return (
            self.request.user.get_full_name().strip()
            or self.request.user.first_name.strip()
            or self.request.user.username
        )

    def _serialize_unlinked(self):
        user = self.request.user
        return {
            "person_id": None,
            "username": user.username,
            "email": user.email,
            "display_name": self._default_name(),
            "bio": "",
            "avatar": None,
            "moments_authored": user.moments_authored.count(),
            "moments_shared_with_me": user.moment_access.exclude(moment__author=user).count(),
            "created_at": None,
        }

    def get(self, request):
        person = self.get_object()
        if person is None:
            return Response(self._serialize_unlinked())
        serializer = ProfileSerializer(person, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        person = self.get_object()
        person_id = request.data.get("person_id")

        if person_id not in (None, "", "null"):
            try:
                person_id = int(person_id)
            except (TypeError, ValueError):
                return Response({"person_id": ["Enter a valid person id."]}, status=400)
        else:
            person_id = None

        if person is None:
            if person_id is not None:
                try:
                    person = Person.objects.get(pk=person_id)
                except Person.DoesNotExist:
                    return Response({"person_id": ["That person does not exist."]}, status=400)
                if person.linked_user_id is not None and person.linked_user_id != request.user.id:
                    return Response({"person_id": ["That person has already been claimed."]}, status=400)
                person.linked_user = request.user
                if not person.created_by_id:
                    person.created_by = request.user
                person.save(update_fields=["linked_user", "created_by"])
            else:
                person = Person.objects.create(
                    created_by=request.user,
                    linked_user=request.user,
                    name=self._default_name(),
                )
        elif person_id is not None and person_id != person.id:
            return Response({"person_id": ["Your account is already linked to a different person."]}, status=400)

        serializer = ProfileSerializer(
            person,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MomentViewSet(ModelViewSet):
    serializer_class = MomentSerializer
    permission_classes = [MomentEditPermission]

    def get_queryset(self):
        user = self.request.user
        return (
            Moment.objects.filter(access_list__user=user)
            .select_related("author")
            .prefetch_related("photos", "people__person", "access_list")
            .distinct()
        )

    def perform_create(self, serializer):
        serializer.save()


class MomentPhotoViewSet(ModelViewSet):
    serializer_class = MomentPhotoSerializer
    permission_classes = [MomentPhotoPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        moment_pk = self.kwargs["moment_pk"]
        user = self.request.user
        return (
            MomentPhoto.objects.filter(moment_id=moment_pk)
            .filter(moment__access_list__user=user)
            .select_related("moment")
            .distinct()
        )

    def perform_create(self, serializer):
        moment = get_moment_for_nested_view(self)
        if moment is None:
            raise Http404
        serializer.save(moment=moment)


class CommentViewSet(ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [CommentPermission]

    def get_queryset(self):
        moment_pk = self.kwargs["moment_pk"]
        user = self.request.user
        return (
            Comment.objects.filter(moment_id=moment_pk)
            .filter(moment__access_list__user=user)
            .select_related("author", "moment")
            .distinct()
        )

    def perform_create(self, serializer):
        moment = get_moment_for_nested_view(self)
        if moment is None:
            raise Http404
        serializer.save(moment=moment, author=self.request.user)


class ReactionViewSet(ModelViewSet):
    serializer_class = ReactionSerializer
    permission_classes = [ReactionPermission]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        moment_pk = self.kwargs["moment_pk"]
        user = self.request.user
        return (
            Reaction.objects.filter(moment_id=moment_pk)
            .filter(moment__access_list__user=user)
            .select_related("user", "moment")
            .distinct()
        )

    def perform_create(self, serializer):
        moment = get_moment_for_nested_view(self)
        if moment is None:
            raise Http404
        serializer.save(moment=moment, user=self.request.user)

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"type": ["You already have a reaction of this type on this moment."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
