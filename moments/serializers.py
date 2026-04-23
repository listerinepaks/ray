from django.core.files.storage import default_storage
from django.db import transaction
from rest_framework import serializers

from .access import get_moment_access_level, sync_moment_access
from .models import Comment, Friendship, Moment, MomentAccess, MomentPerson, MomentPhoto, Person, Reaction


class PersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = [
            "id",
            "name",
            "linked_user",
            "profile_photo",
            "note",
            "created_at",
        ]
        read_only_fields = ["id", "linked_user", "profile_photo", "created_at"]


class ProfileSerializer(serializers.ModelSerializer):
    person_id = serializers.IntegerField(source="id", read_only=True)
    username = serializers.CharField(source="linked_user.username", read_only=True)
    email = serializers.EmailField(source="linked_user.email", read_only=True)
    display_name = serializers.CharField(source="name")
    bio = serializers.CharField(source="note", required=False, allow_blank=True)
    avatar = serializers.ImageField(source="profile_photo", required=False, allow_null=True)
    moments_authored = serializers.SerializerMethodField()
    moments_shared_with_me = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            "person_id",
            "username",
            "email",
            "display_name",
            "bio",
            "avatar",
            "moments_authored",
            "moments_shared_with_me",
            "created_at",
        ]
        read_only_fields = [
            "username",
            "email",
            "moments_authored",
            "moments_shared_with_me",
            "created_at",
        ]

    def get_moments_authored(self, obj):
        if obj.linked_user_id is None:
            return 0
        return obj.linked_user.moments_authored.count()

    def get_moments_shared_with_me(self, obj):
        if obj.linked_user_id is None:
            return 0
        return obj.linked_user.moment_access.exclude(moment__author=obj.linked_user).count()


class PersonProfileSerializer(serializers.ModelSerializer):
    person_id = serializers.IntegerField(source="id", read_only=True)
    username = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    display_name = serializers.CharField(source="name", read_only=True)
    bio = serializers.CharField(source="note", read_only=True)
    avatar = serializers.ImageField(source="profile_photo", read_only=True)
    moments_authored = serializers.SerializerMethodField()
    moments_shared_with_me = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            "person_id",
            "username",
            "email",
            "display_name",
            "bio",
            "avatar",
            "moments_authored",
            "moments_shared_with_me",
            "created_at",
        ]
        read_only_fields = fields

    def get_username(self, obj):
        return obj.linked_user.username if obj.linked_user_id else None

    def get_email(self, obj):
        return obj.linked_user.email if obj.linked_user_id else None

    def get_moments_authored(self, obj):
        if obj.linked_user_id is None:
            return 0
        return obj.linked_user.moments_authored.count()

    def get_moments_shared_with_me(self, obj):
        if obj.linked_user_id is None:
            return 0
        return obj.linked_user.moment_access.exclude(moment__author=obj.linked_user).count()


class MomentPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MomentPhoto
        fields = ["id", "image", "caption", "sort_order", "created_at"]
        read_only_fields = ["id", "created_at"]


class MomentPersonWriteSerializer(serializers.Serializer):
    person_id = serializers.IntegerField()
    role = serializers.ChoiceField(
        choices=MomentPerson.ROLE_CHOICES,
        required=False,
        default=MomentPerson.ROLE_PRESENT,
    )


class MomentAccessWriteSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    access_level = serializers.ChoiceField(
        choices=MomentAccess.ACCESS_CHOICES,
        default=MomentAccess.ACCESS_VIEW,
    )


class MomentSerializer(serializers.ModelSerializer):
    photos = MomentPhotoSerializer(many=True, read_only=True)
    tagged_people = serializers.SerializerMethodField()
    access_list = serializers.SerializerMethodField()
    my_access = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    reactions_count = serializers.SerializerMethodField()
    author_username = serializers.CharField(source="author.username", read_only=True)
    author_avatar = serializers.SerializerMethodField()

    people = MomentPersonWriteSerializer(many=True, write_only=True, required=False)
    access = MomentAccessWriteSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Moment
        fields = [
            "id",
            "author",
            "author_username",
            "author_avatar",
            "kind",
            "date",
            "observed_at",
            "title",
            "bible_verse",
            "reflection",
            "location_name",
            "latitude",
            "longitude",
            "visibility_mode",
            "photos",
            "access_list",
            "my_access",
            "tagged_people",
            "comments_count",
            "reactions_count",
            "people",
            "access",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "author", "created_at", "updated_at"]

    def get_author_avatar(self, obj):
        """Return a fetchable URL; DB/annotate only stores the storage key (same as ImageField.name)."""
        key = getattr(obj, "author_avatar", None)
        if not key:
            p = (
                Person.objects.filter(linked_user_id=obj.author_id)
                .exclude(profile_photo="")
                .order_by("id")
                .first()
            )
            if not p or not p.profile_photo:
                return None
            key = p.profile_photo.name
        if not key:
            return None
        s = str(key).strip()
        if s.startswith(("http://", "https://")):
            return s
        try:
            url = default_storage.url(s)
        except Exception:
            return None
        if url.startswith(("http://", "https://")):
            return url
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_comments_count(self, obj):
        c = getattr(obj, "comments_count", None)
        if c is not None:
            return c
        return obj.comments.count()

    def get_reactions_count(self, obj):
        c = getattr(obj, "reactions_count", None)
        if c is not None:
            return c
        return obj.reactions.count()

    def get_my_access(self, obj):
        return get_moment_access_level(self.context["request"].user, obj)

    def get_tagged_people(self, obj):
        links = obj.people.select_related("person", "person__linked_user")
        return [
            {
                "id": link.person.id,
                "name": link.person.name,
                "linked_user": link.person.linked_user_id,
                "role": link.role,
            }
            for link in links
        ]

    def get_access_list(self, obj):
        rows = obj.access_list.select_related("user")
        return [
            {
                "user_id": row.user_id,
                "access_level": row.access_level,
            }
            for row in rows
        ]

    def validate(self, attrs):
        visibility_mode = attrs.get(
            "visibility_mode",
            getattr(self.instance, "visibility_mode", Moment.VISIBILITY_TAGGED),
        )
        people = attrs.get("people")
        access = attrs.get("access")

        if visibility_mode == Moment.VISIBILITY_TAGGED and people is not None and not people:
            raise serializers.ValidationError("Tagged visibility requires at least one tagged person.")

        if visibility_mode == Moment.VISIBILITY_CUSTOM and access is not None and not access:
            raise serializers.ValidationError("Custom visibility requires at least one access entry.")

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        people_data = validated_data.pop("people", [])
        access_data = validated_data.pop("access", [])
        validated_data["author"] = self.context["request"].user

        moment = Moment.objects.create(**validated_data)
        self._replace_people(moment, people_data)
        sync_moment_access(moment, access_data)
        return moment

    @transaction.atomic
    def update(self, instance, validated_data):
        people_data = validated_data.pop("people", None)
        access_data = validated_data.pop("access", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if people_data is not None:
            self._replace_people(instance, people_data)

        if people_data is not None or access_data is not None or "visibility_mode" in validated_data:
            sync_moment_access(instance, access_data or [])

        return instance

    def _replace_people(self, moment, people_data):
        person_ids = [item["person_id"] for item in people_data]
        people = {
            person.id: person
            for person in Person.objects.filter(
                id__in=person_ids,
            )
        }

        missing_ids = sorted(set(person_ids) - set(people.keys()))
        if missing_ids:
            raise serializers.ValidationError(
                {"people": f"Unknown people for this author: {', '.join(str(pk) for pk in missing_ids)}"}
            )

        moment.people.all().delete()
        MomentPerson.objects.bulk_create(
            [
                MomentPerson(
                    moment=moment,
                    person=people[item["person_id"]],
                    role=item.get("role", MomentPerson.ROLE_PRESENT),
                )
                for item in people_data
            ]
        )

class FriendshipSerializer(serializers.ModelSerializer):
    requester_id = serializers.IntegerField(source="requester.id", read_only=True)
    requester_username = serializers.CharField(source="requester.username", read_only=True)
    requester_avatar = serializers.SerializerMethodField()
    addressee_id = serializers.IntegerField(source="addressee.id", read_only=True)
    addressee_username = serializers.CharField(source="addressee.username", read_only=True)
    addressee_avatar = serializers.SerializerMethodField()
    direction = serializers.SerializerMethodField()

    class Meta:
        model = Friendship
        fields = [
            "id",
            "requester_id",
            "requester_username",
            "requester_avatar",
            "addressee_id",
            "addressee_username",
            "addressee_avatar",
            "status",
            "direction",
            "created_at",
            "accepted_at",
        ]
        read_only_fields = fields

    def _avatar_for_user(self, user_id: int):
        mapping = self.context.get("avatar_by_user_id") or {}
        return mapping.get(user_id)

    def get_requester_avatar(self, obj):
        return self._avatar_for_user(obj.requester_id)

    def get_addressee_avatar(self, obj):
        return self._avatar_for_user(obj.addressee_id)

    def get_direction(self, obj):
        user = self.context["request"].user
        if obj.requester_id == user.id:
            return "outgoing"
        return "incoming"


class FriendshipRequestSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()

    def validate_user_id(self, value):
        request_user = self.context["request"].user
        if value == request_user.id:
            raise serializers.ValidationError("You cannot friend yourself.")
        return value


class CommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "moment", "author", "author_username", "text", "created_at", "updated_at"]
        read_only_fields = ["id", "moment", "author", "created_at", "updated_at"]


class ReactionSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Reaction
        fields = ["id", "moment", "user", "user_username", "type", "created_at"]
        read_only_fields = ["id", "moment", "user", "created_at"]
