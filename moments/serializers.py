from django.db import transaction
from rest_framework import serializers

from .access import get_moment_access_level
from .models import Comment, Moment, MomentAccess, MomentPerson, MomentPhoto, Person, Reaction


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

    people = MomentPersonWriteSerializer(many=True, write_only=True, required=False)
    access = MomentAccessWriteSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Moment
        fields = [
            "id",
            "author",
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
            "people",
            "access",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "author", "created_at", "updated_at"]

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
        self._sync_access(moment, access_data)
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
            self._sync_access(instance, access_data or [])

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

    def _sync_access(self, moment, explicit_access_data):
        author = moment.author
        desired = {author.id: MomentAccess.ACCESS_EDIT}

        if moment.visibility_mode == Moment.VISIBILITY_TAGGED:
            tagged_user_ids = (
                Person.objects.filter(moments__moment=moment, linked_user__isnull=False)
                .values_list("linked_user_id", flat=True)
                .distinct()
            )
            for user_id in tagged_user_ids:
                if user_id != author.id:
                    desired[user_id] = MomentAccess.ACCESS_COMMENT

        elif moment.visibility_mode == Moment.VISIBILITY_CUSTOM:
            for item in explicit_access_data:
                user_id = item["user_id"]
                if user_id != author.id:
                    desired[user_id] = item["access_level"]

        MomentAccess.objects.filter(moment=moment).exclude(user_id__in=desired.keys()).delete()

        existing = {
            row.user_id: row
            for row in MomentAccess.objects.filter(moment=moment, user_id__in=desired.keys())
        }
        to_create = []
        to_update = []

        for user_id, access_level in desired.items():
            row = existing.get(user_id)
            if row is None:
                to_create.append(
                    MomentAccess(
                        moment=moment,
                        user_id=user_id,
                        access_level=access_level,
                        granted_by=author,
                    )
                )
            elif row.access_level != access_level:
                row.access_level = access_level
                to_update.append(row)

        if to_create:
            MomentAccess.objects.bulk_create(to_create)
        if to_update:
            MomentAccess.objects.bulk_update(to_update, ["access_level"])


class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ["id", "moment", "author", "text", "created_at", "updated_at"]
        read_only_fields = ["id", "moment", "author", "created_at", "updated_at"]


class ReactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reaction
        fields = ["id", "moment", "user", "type", "created_at"]
        read_only_fields = ["id", "moment", "user", "created_at"]
