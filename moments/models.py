from django.conf import settings
from django.db import models
from django.db.models.functions import Greatest, Least


class Person(models.Model):
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="people_created",
    )
    name = models.CharField(max_length=120)
    linked_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="person_links",
    )
    profile_photo = models.ImageField(upload_to="people/", blank=True)
    note = models.CharField(max_length=140, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["created_by", "name"],
                name="unique_person_name_per_creator",
            )
        ]

    def __str__(self):
        return self.name


class Moment(models.Model):
    KIND_SUNRISE = "sunrise"
    KIND_SUNSET = "sunset"
    KIND_OTHER = "other"
    KIND_CHOICES = [
        (KIND_SUNRISE, "Sunrise"),
        (KIND_SUNSET, "Sunset"),
        (KIND_OTHER, "Other"),
    ]

    MOMENT_TYPE_PAST = "past"
    MOMENT_TYPE_LOOKING_AHEAD = "looking_ahead"
    MOMENT_TYPE_CHOICES = [
        (MOMENT_TYPE_PAST, "Past"),
        (MOMENT_TYPE_LOOKING_AHEAD, "Looking ahead"),
    ]

    VISIBILITY_PRIVATE = "private"
    VISIBILITY_TAGGED = "tagged"
    VISIBILITY_CUSTOM = "custom"
    VISIBILITY_FRIENDS = "friends"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PRIVATE, "Private"),
        (VISIBILITY_TAGGED, "Tagged People"),
        (VISIBILITY_CUSTOM, "Custom"),
        (VISIBILITY_FRIENDS, "Friends"),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="moments_authored",
    )
    moment_type = models.CharField(
        max_length=20,
        choices=MOMENT_TYPE_CHOICES,
        default=MOMENT_TYPE_PAST,
        db_index=True,
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    date = models.DateField()
    observed_at = models.DateTimeField(null=True, blank=True)
    calculated_light_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Approximate local sunrise or sunset for this date and coordinates, when computable.",
    )
    title = models.CharField(max_length=140, blank=True)
    bible_verse = models.CharField(
        max_length=300,
        blank=True,
        help_text="Optional Bible verse line (e.g. reference and text).",
    )
    reflection = models.TextField(blank=True)
    original_looking_ahead_note = models.TextField(
        blank=True,
        help_text="Preserved note from before this entry became a past moment.",
    )
    location_name = models.CharField(max_length=200, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    visibility_mode = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default=VISIBILITY_TAGGED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-observed_at", "-created_at"]

    def __str__(self):
        return f"{self.get_kind_display()} on {self.date}"

    def save(self, *args, **kwargs):
        from .solar import compute_calculated_light_at

        self.calculated_light_at = compute_calculated_light_at(
            kind=self.kind,
            moment_date=self.date,
            latitude=self.latitude,
            longitude=self.longitude,
        )
        super().save(*args, **kwargs)


class MomentPhoto(models.Model):
    moment = models.ForeignKey(
        Moment,
        on_delete=models.CASCADE,
        related_name="photos",
    )
    image = models.ImageField(upload_to="moments/")
    caption = models.CharField(max_length=240, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]


class MomentPerson(models.Model):
    ROLE_PRESENT = "present"
    ROLE_CHOICES = [
        (ROLE_PRESENT, "Present"),
    ]

    moment = models.ForeignKey(
        Moment,
        on_delete=models.CASCADE,
        related_name="people",
    )
    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="moments",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_PRESENT)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["moment", "person"],
                name="unique_person_per_moment",
            )
        ]


class MomentAccess(models.Model):
    ACCESS_VIEW = "view"
    ACCESS_COMMENT = "comment"
    ACCESS_EDIT = "edit"
    ACCESS_CHOICES = [
        (ACCESS_VIEW, "View"),
        (ACCESS_COMMENT, "Comment"),
        (ACCESS_EDIT, "Edit"),
    ]

    moment = models.ForeignKey(
        Moment,
        on_delete=models.CASCADE,
        related_name="access_list",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="moment_access",
    )
    access_level = models.CharField(max_length=20, choices=ACCESS_CHOICES, default=ACCESS_VIEW)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_moment_access",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["moment", "user"],
                name="unique_access_per_user_per_moment",
            )
        ]


class Friendship(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
    ]

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="friendships_requested",
    )
    addressee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="friendships_received",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=~models.Q(requester=models.F("addressee")),
                name="friendship_requester_not_addressee",
            ),
            models.UniqueConstraint(
                Least("requester", "addressee"),
                Greatest("requester", "addressee"),
                name="friendship_unique_unordered_pair",
            ),
        ]


class Comment(models.Model):
    moment = models.ForeignKey(
        Moment,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="moment_comments",
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]


class Reaction(models.Model):
    TYPE_HEART = "heart"
    TYPE_GLOW = "glow"
    TYPE_WOW = "wow"
    TYPE_CHOICES = [
        (TYPE_HEART, "Heart"),
        (TYPE_GLOW, "Glow"),
        (TYPE_WOW, "Wow"),
    ]

    moment = models.ForeignKey(
        Moment,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="moment_reactions",
    )
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["moment", "user", "type"],
                name="unique_reaction_type_per_user_per_moment",
            )
        ]


class Notification(models.Model):
    TYPE_FRIEND_POSTED = "friend_posted"
    TYPE_FRIEND_REQUEST_RECEIVED = "friend_request_received"
    TYPE_FRIEND_REQUEST_ACCEPTED = "friend_request_accepted"
    TYPE_MOMENT_COMMENTED = "moment_commented"
    TYPE_MOMENT_REACTED = "moment_reacted"
    TYPE_MENTIONED = "mentioned"
    TYPE_CHOICES = [
        (TYPE_FRIEND_POSTED, "Friend posted"),
        (TYPE_FRIEND_REQUEST_RECEIVED, "Friend request received"),
        (TYPE_FRIEND_REQUEST_ACCEPTED, "Friend request accepted"),
        (TYPE_MOMENT_COMMENTED, "Moment commented"),
        (TYPE_MOMENT_REACTED, "Moment reacted"),
        (TYPE_MENTIONED, "Mentioned"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications_sent",
    )
    moment = models.ForeignKey(
        Moment,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    friendship = models.ForeignKey(
        Friendship,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=40, choices=TYPE_CHOICES)
    dedupe_key = models.CharField(max_length=180, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(user=models.F("actor")),
                name="notification_user_not_actor",
            ),
            models.UniqueConstraint(
                fields=["user", "type", "dedupe_key"],
                condition=~models.Q(dedupe_key=""),
                name="notification_unique_dedupe_per_type",
            ),
        ]


class PushDevice(models.Model):
    PLATFORM_IOS = "ios"
    PLATFORM_ANDROID = "android"
    PLATFORM_CHOICES = [
        (PLATFORM_IOS, "iOS"),
        (PLATFORM_ANDROID, "Android"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="push_devices",
    )
    expo_push_token = models.CharField(max_length=200, unique=True)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    enabled = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_seen_at", "-id"]
