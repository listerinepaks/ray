from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Moment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("sunrise", "Sunrise"), ("sunset", "Sunset")], max_length=20)),
                ("date", models.DateField()),
                ("observed_at", models.DateTimeField(blank=True, null=True)),
                ("title", models.CharField(blank=True, max_length=140)),
                ("reflection", models.TextField(blank=True)),
                ("location_name", models.CharField(blank=True, max_length=200)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                (
                    "visibility_mode",
                    models.CharField(
                        choices=[("private", "Private"), ("tagged", "Tagged People"), ("custom", "Custom")],
                        default="tagged",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="moments_authored",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-date", "-observed_at", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="Person",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("profile_photo", models.ImageField(blank=True, upload_to="people/")),
                ("note", models.CharField(blank=True, max_length=140)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="people_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "linked_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="person_links",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["name", "id"],
            },
        ),
        migrations.CreateModel(
            name="MomentPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="moments/")),
                ("caption", models.CharField(blank=True, max_length=240)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "moment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="moments.moment",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="MomentPerson",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("present", "Present")], default="present", max_length=20)),
                (
                    "moment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="people",
                        to="moments.moment",
                    ),
                ),
                (
                    "person",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="moments",
                        to="moments.person",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="MomentAccess",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "access_level",
                    models.CharField(choices=[("view", "View"), ("comment", "Comment"), ("edit", "Edit")], default="view", max_length=20),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "granted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="granted_moment_access",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "moment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_list",
                        to="moments.moment",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="moment_access",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Comment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="moment_comments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "moment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="moments.moment",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.CreateModel(
            name="Reaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(choices=[("heart", "Heart"), ("glow", "Glow"), ("wow", "Wow")], max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "moment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reactions",
                        to="moments.moment",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="moment_reactions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="person",
            constraint=models.UniqueConstraint(fields=("created_by", "name"), name="unique_person_name_per_creator"),
        ),
        migrations.AddConstraint(
            model_name="momentperson",
            constraint=models.UniqueConstraint(fields=("moment", "person"), name="unique_person_per_moment"),
        ),
        migrations.AddConstraint(
            model_name="momentaccess",
            constraint=models.UniqueConstraint(fields=("moment", "user"), name="unique_access_per_user_per_moment"),
        ),
        migrations.AddConstraint(
            model_name="reaction",
            constraint=models.UniqueConstraint(fields=("moment", "user", "type"), name="unique_reaction_type_per_user_per_moment"),
        ),
    ]
