from django.conf import settings
from django.db import models


class Person(models.Model):
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="people_created",
    )
    name = models.CharField(max_length=120)
    linked_user = models.ForeignKey(
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
    KIND_CHOICES = [
        (KIND_SUNRISE, "Sunrise"),
        (KIND_SUNSET, "Sunset"),
    ]

    VISIBILITY_PRIVATE = "private"
    VISIBILITY_TAGGED = "tagged"
    VISIBILITY_CUSTOM = "custom"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PRIVATE, "Private"),
        (VISIBILITY_TAGGED, "Tagged People"),
        (VISIBILITY_CUSTOM, "Custom"),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="moments_authored",
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    date = models.DateField()
    observed_at = models.DateTimeField(null=True, blank=True)
    title = models.CharField(max_length=140, blank=True)
    bible_verse = models.CharField(
        max_length=300,
        blank=True,
        help_text="Optional Bible verse line (e.g. reference and text).",
    )
    reflection = models.TextField(blank=True)
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
