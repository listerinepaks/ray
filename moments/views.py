from django.db import IntegrityError
from django.http import Http404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .access import get_moment_for_nested_view
from .models import Comment, Moment, MomentPhoto, Person, Reaction
from .permissions import (
    CommentPermission,
    MomentEditPermission,
    MomentPhotoPermission,
    ReactionPermission,
)
from .serializers import (
    CommentSerializer,
    MomentPhotoSerializer,
    MomentSerializer,
    PersonSerializer,
    ReactionSerializer,
)


class PersonViewSet(ModelViewSet):
    serializer_class = PersonSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Person.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


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
