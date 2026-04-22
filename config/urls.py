from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import auth_views, views as config_views
from moments.views import (
    CommentViewSet,
    MomentPhotoViewSet,
    MomentViewSet,
    PersonViewSet,
    ProfileMeView,
    ProfilePersonView,
    ReactionViewSet,
)


router = DefaultRouter()
router.register("moments", MomentViewSet, basename="moment")
router.register("people", PersonViewSet, basename="person")

urlpatterns = [
    path("", config_views.root, name="root"),
    path("admin/", admin.site.urls),
    path("api/auth/csrf/", auth_views.auth_csrf),
    path("api/auth/login/", auth_views.auth_login),
    path("api/auth/logout/", auth_views.auth_logout),
    path("api/auth/me/", auth_views.AuthMeView.as_view()),
    path("api/auth/users/", auth_views.AuthUsersView.as_view()),
    path("api/profile/me/", ProfileMeView.as_view()),
    path("api/profile/people/<int:person_id>/", ProfilePersonView.as_view()),
    path("api/auth/token/", auth_views.auth_token_obtain),
    path("api/auth/token/revoke/", auth_views.auth_token_revoke),
    path("api/", include(router.urls)),
    path(
        "api/moments/<int:moment_pk>/comments/",
        CommentViewSet.as_view({"get": "list", "post": "create"}),
    ),
    path(
        "api/moments/<int:moment_pk>/comments/<int:pk>/",
        CommentViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
    ),
    path(
        "api/moments/<int:moment_pk>/reactions/",
        ReactionViewSet.as_view({"get": "list", "post": "create"}),
    ),
    path(
        "api/moments/<int:moment_pk>/reactions/<int:pk>/",
        ReactionViewSet.as_view({"get": "retrieve", "delete": "destroy"}),
    ),
    path(
        "api/moments/<int:moment_pk>/photos/",
        MomentPhotoViewSet.as_view({"get": "list", "post": "create"}),
    ),
    path(
        "api/moments/<int:moment_pk>/photos/<int:pk>/",
        MomentPhotoViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
