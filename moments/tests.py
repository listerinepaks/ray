from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .access import sync_moment_access
from .models import Friendship, Moment, MomentPerson, Person


class FriendshipAndAccessTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.author = User.objects.create_user(username="author", password="pw12345")
        self.wife = User.objects.create_user(username="wife", password="pw12345")
        self.daughter = User.objects.create_user(username="daughter", password="pw12345")

    def test_claiming_person_backfills_tagged_access(self):
        wife_person = Person.objects.create(created_by=self.author, name="Wife")
        daughter_person = Person.objects.create(
            created_by=self.author,
            name="Daughter",
            linked_user=self.daughter,
        )
        moment = Moment.objects.create(
            author=self.author,
            kind=Moment.KIND_SUNRISE,
            date="2026-04-22",
            visibility_mode=Moment.VISIBILITY_TAGGED,
            title="Family sunrise",
        )
        MomentPerson.objects.create(moment=moment, person=wife_person)
        MomentPerson.objects.create(moment=moment, person=daughter_person)
        sync_moment_access(moment)

        self.client.force_authenticate(self.wife)
        pre = self.client.get("/api/moments/")
        self.assertEqual(pre.status_code, status.HTTP_200_OK)
        self.assertEqual(len(pre.data), 0)

        claim = self.client.patch("/api/profile/me/", {"person_id": wife_person.id}, format="json")
        self.assertEqual(claim.status_code, status.HTTP_200_OK)

        post = self.client.get("/api/moments/")
        self.assertEqual(post.status_code, status.HTTP_200_OK)
        self.assertEqual(len(post.data), 1)
        self.assertEqual(post.data[0]["id"], moment.id)

    def test_friend_request_accept_and_friends_visibility(self):
        self.client.force_authenticate(self.author)
        req = self.client.post("/api/friends/requests/", {"user_id": self.wife.id}, format="json")
        self.assertEqual(req.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.wife)
        listing = self.client.get("/api/friends/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listing.data["pending_incoming"]), 1)

        friendship_id = listing.data["pending_incoming"][0]["id"]
        accept = self.client.post(f"/api/friends/requests/{friendship_id}/accept/", format="json")
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        self.assertEqual(accept.data["status"], Friendship.STATUS_ACCEPTED)

        self.client.force_authenticate(self.author)
        friends_moment = Moment.objects.create(
            author=self.author,
            kind=Moment.KIND_SUNSET,
            date="2026-04-22",
            visibility_mode=Moment.VISIBILITY_FRIENDS,
            title="Friends-only sunset",
        )
        sync_moment_access(friends_moment)

        self.client.force_authenticate(self.wife)
        before_remove = self.client.get("/api/moments/")
        self.assertEqual(before_remove.status_code, status.HTTP_200_OK)
        self.assertEqual([m["id"] for m in before_remove.data], [friends_moment.id])

        remove = self.client.delete(f"/api/friends/{self.author.id}/")
        self.assertEqual(remove.status_code, status.HTTP_204_NO_CONTENT)

        after_remove = self.client.get("/api/moments/")
        self.assertEqual(after_remove.status_code, status.HTTP_200_OK)
        self.assertEqual(len(after_remove.data), 0)

    def test_friend_accept_backfills_friends_moments_created_before_friendship(self):
        """Friends visibility is enforced via MomentAccess; accepting friendship must resync."""
        self.client.force_authenticate(self.author)
        friends_moment = Moment.objects.create(
            author=self.author,
            kind=Moment.KIND_SUNRISE,
            date="2026-04-22",
            visibility_mode=Moment.VISIBILITY_FRIENDS,
            title="Already friends-only",
        )
        sync_moment_access(friends_moment)

        self.client.force_authenticate(self.wife)
        self.assertEqual(len(self.client.get("/api/moments/").data), 0)

        self.client.force_authenticate(self.author)
        self.client.post("/api/friends/requests/", {"user_id": self.wife.id}, format="json")
        self.client.force_authenticate(self.wife)
        listing = self.client.get("/api/friends/")
        friendship_id = listing.data["pending_incoming"][0]["id"]
        accept = self.client.post(f"/api/friends/requests/{friendship_id}/accept/", format="json")
        self.assertEqual(accept.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.wife)
        after = self.client.get("/api/moments/")
        self.assertEqual(after.status_code, status.HTTP_200_OK)
        self.assertEqual([m["id"] for m in after.data], [friends_moment.id])
