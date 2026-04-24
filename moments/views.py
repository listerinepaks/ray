from django.db import IntegrityError
from django.db.models import Count, OuterRef, Subquery
from django.http import Http404
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .access import (
    can_edit_moment,
    accept_friendship,
    get_moment_for_nested_view,
    resync_friends_moments_for_user,
    resync_tagged_moment_access_for_person,
)
from .models import Comment, Friendship, Moment, MomentPhoto, Person, Reaction
from .permissions import (
    CommentPermission,
    MomentEditPermission,
    MomentPhotoPermission,
    PersonPermission,
    ReactionPermission,
)
from .serializers import (
    CommentSerializer,
    FriendshipRequestSerializer,
    FriendshipSerializer,
    MomentPhotoSerializer,
    MomentSerializer,
    PersonSerializer,
    PersonProfileSerializer,
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
        linked_just_now = False

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
                linked_just_now = True
            else:
                person = Person.objects.create(
                    created_by=request.user,
                    linked_user=request.user,
                    name=self._default_name(),
                )
                linked_just_now = True
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
        if linked_just_now:
            resync_tagged_moment_access_for_person(person)
        return Response(serializer.data)


class ProfilePersonView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, person_id: int):
        person = (
            Person.objects.filter(
                id=person_id,
                moments__moment__access_list__user=request.user,
            )
            .select_related("linked_user")
            .distinct()
            .first()
        )
        if person is None:
            raise Http404
        serializer = PersonProfileSerializer(person, context={"request": request})
        return Response(serializer.data)


class MomentViewSet(ModelViewSet):
    serializer_class = MomentSerializer
    permission_classes = [MomentEditPermission]

    def get_queryset(self):
        user = self.request.user
        author_avatar_sq = (
            Person.objects.filter(linked_user_id=OuterRef("author_id"))
            .exclude(profile_photo="")
            .order_by("id")
            .values("profile_photo")[:1]
        )
        return (
            Moment.objects.filter(access_list__user=user)
            .select_related("author")
            .prefetch_related("photos", "people__person", "access_list")
            .annotate(
                comments_count=Count("comments", distinct=True),
                reactions_count=Count("reactions", distinct=True),
                author_avatar=Subquery(author_avatar_sq),
            )
            .distinct()
            # distinct()+joins can drop Meta.ordering; keep feed newest-first (matches Moment.Meta).
            .order_by("-date", "-observed_at", "-created_at", "-id")
        )

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"], url_path="convert")
    def convert(self, request, pk=None):
        """Mark a Looking Ahead moment as past; preserves the note in `original_looking_ahead_note`."""
        moment = self.get_object()
        if not can_edit_moment(request.user, moment):
            return Response(
                {"detail": "You do not have permission to convert this moment."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if moment.moment_type != Moment.MOMENT_TYPE_LOOKING_AHEAD:
            return Response(
                {"detail": "Only Looking Ahead entries can be converted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reflection = request.data.get("reflection", "")
        if not isinstance(reflection, str):
            reflection = ""
        moment.original_looking_ahead_note = moment.reflection
        moment.moment_type = Moment.MOMENT_TYPE_PAST
        moment.reflection = reflection
        moment.save()
        serializer = MomentSerializer(moment, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


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


class FriendshipListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = (
            Friendship.objects.filter(requester=request.user)
            | Friendship.objects.filter(addressee=request.user)
        ).select_related("requester", "addressee")
        user_ids = set()
        for row in rows:
            user_ids.add(row.requester_id)
            user_ids.add(row.addressee_id)
        avatar_by_user_id = {
            p.linked_user_id: p.profile_photo.name
            for p in Person.objects.filter(linked_user_id__in=user_ids).only("linked_user_id", "profile_photo")
            if p.profile_photo
        }
        serializer = FriendshipSerializer(
            rows,
            many=True,
            context={"request": request, "avatar_by_user_id": avatar_by_user_id},
        )
        accepted = []
        pending_incoming = []
        pending_outgoing = []
        for item in serializer.data:
            if item["status"] == Friendship.STATUS_ACCEPTED:
                accepted.append(item)
            elif item["direction"] == "incoming":
                pending_incoming.append(item)
            else:
                pending_outgoing.append(item)
        return Response(
            {
                "accepted": accepted,
                "pending_incoming": pending_incoming,
                "pending_outgoing": pending_outgoing,
            }
        )


class FriendshipRequestCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FriendshipRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        target_user_id = serializer.validated_data["user_id"]
        User = get_user_model()
        if not User.objects.filter(id=target_user_id).exists():
            return Response({"user_id": ["That user does not exist."]}, status=400)

        existing = Friendship.objects.filter(
            requester_id__in=[request.user.id, target_user_id],
            addressee_id__in=[request.user.id, target_user_id],
        ).first()
        if existing is not None:
            if existing.status == Friendship.STATUS_ACCEPTED:
                return Response({"detail": "You are already friends."}, status=400)
            if existing.requester_id == request.user.id:
                return Response({"detail": "A request is already pending."}, status=400)
            accepted = accept_friendship(existing)
            return Response(
                FriendshipSerializer(accepted, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )

        friendship = Friendship.objects.create(
            requester=request.user,
            addressee_id=target_user_id,
            status=Friendship.STATUS_PENDING,
        )
        return Response(
            FriendshipSerializer(friendship, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class FriendshipAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, friendship_id: int):
        friendship = Friendship.objects.filter(id=friendship_id, addressee=request.user).first()
        if friendship is None:
            raise Http404
        if friendship.status == Friendship.STATUS_ACCEPTED:
            return Response({"detail": "Friend request already accepted."}, status=400)
        accepted = accept_friendship(friendship)
        return Response(FriendshipSerializer(accepted, context={"request": request}).data)


class FriendshipDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id: int):
        row = Friendship.objects.filter(
            requester_id__in=[request.user.id, user_id],
            addressee_id__in=[request.user.id, user_id],
        ).first()
        if row is None:
            raise Http404
        ids = [row.requester_id, row.addressee_id]
        row.delete()
        for uid in ids:
            # Friendship visibility is derived from accepted connections.
            # Rebuild both sides to remove friend-based access.
            resync_friends_moments_for_user(uid)
        return Response(status=status.HTTP_204_NO_CONTENT)
