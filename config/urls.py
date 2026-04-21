from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from moments.views import MomentViewSet, PersonViewSet


router = DefaultRouter()
router.register("moments", MomentViewSet, basename="moment")
router.register("people", PersonViewSet, basename="person")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
