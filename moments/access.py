from django.db import transaction
from django.utils import timezone

from .models import Friendship, Moment, MomentAccess, Person


def get_moment_access_level(user, moment) -> str | None:
    if moment.author_id == user.id:
        return MomentAccess.ACCESS_EDIT
    row = MomentAccess.objects.filter(moment=moment, user=user).first()
    if row is None:
        return None
    return row.access_level


def can_view_moment(user, moment) -> bool:
    return get_moment_access_level(user, moment) is not None


def can_comment_moment(user, moment) -> bool:
    level = get_moment_access_level(user, moment)
    return level in (MomentAccess.ACCESS_COMMENT, MomentAccess.ACCESS_EDIT)


def can_edit_moment(user, moment) -> bool:
    return get_moment_access_level(user, moment) == MomentAccess.ACCESS_EDIT


def get_moment_for_nested_view(view):
    pk = view.kwargs.get("moment_pk")
    if pk is None:
        return None
    return (
        Moment.objects.filter(pk=pk, access_list__user=view.request.user)
        .select_related("author")
        .first()
    )


def get_accepted_friend_user_ids(user_id: int) -> set[int]:
    rows = Friendship.objects.filter(status=Friendship.STATUS_ACCEPTED).filter(
        requester_id=user_id
    ) | Friendship.objects.filter(status=Friendship.STATUS_ACCEPTED, addressee_id=user_id)
    ids: set[int] = set()
    for row in rows:
        ids.add(row.addressee_id if row.requester_id == user_id else row.requester_id)
    return ids


def sync_moment_access(moment: Moment, explicit_access_data: list[dict] | None = None) -> None:
    explicit_access_data = explicit_access_data or []
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

    elif moment.visibility_mode == Moment.VISIBILITY_FRIENDS:
        for user_id in get_accepted_friend_user_ids(author.id):
            desired[user_id] = MomentAccess.ACCESS_COMMENT

    MomentAccess.objects.filter(moment=moment).exclude(user_id__in=desired.keys()).delete()
    existing = {row.user_id: row for row in MomentAccess.objects.filter(moment=moment, user_id__in=desired.keys())}
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


def resync_tagged_moment_access_for_person(person: Person) -> int:
    if person.linked_user_id is None:
        return 0
    count = 0
    for moment in Moment.objects.filter(people__person=person, visibility_mode=Moment.VISIBILITY_TAGGED).distinct():
        sync_moment_access(moment)
        count += 1
    return count


@transaction.atomic
def accept_friendship(friendship: Friendship) -> Friendship:
    if friendship.status != Friendship.STATUS_ACCEPTED:
        friendship.status = Friendship.STATUS_ACCEPTED
        friendship.accepted_at = timezone.now()
        friendship.save(update_fields=["status", "accepted_at"])
    resync_friends_moments_for_user(friendship.requester_id)
    resync_friends_moments_for_user(friendship.addressee_id)
    return friendship


def resync_friends_moments_for_user(user_id: int) -> int:
    count = 0
    for moment in Moment.objects.filter(author_id=user_id, visibility_mode=Moment.VISIBILITY_FRIENDS):
        sync_moment_access(moment)
        count += 1
    return count
