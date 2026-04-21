from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from .models import Moment, Person
from .serializers import MomentSerializer, PersonSerializer


class PersonViewSet(ModelViewSet):
    serializer_class = PersonSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Person.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MomentViewSet(ModelViewSet):
    serializer_class = MomentSerializer
    permission_classes = [IsAuthenticated]

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
