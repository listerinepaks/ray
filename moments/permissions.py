from rest_framework.permissions import SAFE_METHODS, BasePermission

from .access import can_comment_moment, can_edit_moment, can_view_moment, get_moment_for_nested_view


class MomentEditPermission(BasePermission):
    """List/retrieve with any access; create for authenticated; change/delete requires edit access."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return can_edit_moment(request.user, obj)


class CommentPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        if request.method == "POST":
            moment = get_moment_for_nested_view(view)
            return moment is not None and can_comment_moment(request.user, moment)
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return can_view_moment(request.user, obj.moment)
        if request.method in ("PUT", "PATCH", "DELETE"):
            return obj.author_id == request.user.id or can_edit_moment(request.user, obj.moment)
        return False


class MomentPhotoPermission(BasePermission):
    """View photos with moment access; add/change/delete photos only with edit access."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        moment = get_moment_for_nested_view(view)
        if moment is None:
            return False
        if request.method in SAFE_METHODS:
            return can_view_moment(request.user, moment)
        if request.method == "POST":
            return can_edit_moment(request.user, moment)
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return can_view_moment(request.user, obj.moment)
        return can_edit_moment(request.user, obj.moment)


class ReactionPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        if request.method == "POST":
            moment = get_moment_for_nested_view(view)
            return moment is not None and can_comment_moment(request.user, moment)
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return can_view_moment(request.user, obj.moment)
        if request.method == "DELETE":
            return obj.user_id == request.user.id or can_edit_moment(request.user, obj.moment)
        return False
