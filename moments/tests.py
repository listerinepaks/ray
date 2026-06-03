from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .access import sync_moment_access
from .models import Friendship, Moment, MomentPerson, Person
from .user_profiles import ensure_linked_person_for_user


class RegistrationTests(APITestCase):
    def test_web_registration_creates_linked_person_and_session(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newbie",
                "password": "pw12345",
                "display_name": "New Person",
                "email": "newbie@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["username"], "newbie")

        User = get_user_model()
        user = User.objects.get(username="newbie")
        person = Person.objects.get(linked_user=user)
        self.assertEqual(person.created_by, user)
        self.assertEqual(person.name, "New Person")

        me = self.client.get("/api/auth/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["username"], "newbie")

    def test_token_registration_creates_token_and_linked_person(self):
        response = self.client.post(
            "/api/auth/token/register/",
            {
                "username": "mobile",
                "password": "pw12345",
                "display_name": "Mobile Person",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)

        User = get_user_model()
        user = User.objects.get(username="mobile")
        self.assertEqual(Person.objects.get(linked_user=user).name, "Mobile Person")

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {response.data['token']}")
        me = self.client.get("/api/auth/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["username"], "mobile")

    @override_settings(RAY_REGISTRATION_INVITE_CODE="join-ray")
    def test_registration_can_require_invite_code(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "blocked", "password": "pw12345", "invite_code": "wrong"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invite_code", response.json())

        allowed = self.client.post(
            "/api/auth/register/",
            {"username": "allowed", "password": "pw12345", "invite_code": "join-ray"},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED)


class LinkedPersonProfileTests(APITestCase):
    def test_ensure_linked_person_creates_profile_for_user(self):
        User = get_user_model()
        user = User.objects.create_user(
            username="alice",
            password="pw12345",
            first_name="Alice",
            last_name="Wright",
        )

        person, created = ensure_linked_person_for_user(user)

        self.assertTrue(created)
        self.assertEqual(person.linked_user, user)
        self.assertEqual(person.created_by, user)
        self.assertEqual(person.name, "Alice Wright")

        same_person, created_again = ensure_linked_person_for_user(user)
        self.assertFalse(created_again)
        self.assertEqual(same_person, person)

    def test_ensure_linked_person_avoids_duplicate_names_for_same_creator(self):
        User = get_user_model()
        user = User.objects.create_user(
            username="alice",
            password="pw12345",
            first_name="Alice",
            last_name="Wright",
        )
        Person.objects.create(created_by=user, name="Alice Wright")

        person, created = ensure_linked_person_for_user(user)

        self.assertTrue(created)
        self.assertEqual(person.linked_user, user)
        self.assertEqual(person.created_by, user)
        self.assertEqual(person.name, "alice")


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
