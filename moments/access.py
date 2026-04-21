from .models import Moment, MomentAccess


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
