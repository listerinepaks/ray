from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("moments", "0005_alter_moment_visibility_mode_friendship"),
    ]

    operations = [
        migrations.AddField(
            model_name="moment",
            name="moment_type",
            field=models.CharField(
                choices=[("past", "Past"), ("looking_ahead", "Looking ahead")],
                db_index=True,
                default="past",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="moment",
            name="calculated_light_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Approximate local sunrise or sunset for this date and coordinates, when computable.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="moment",
            name="original_looking_ahead_note",
            field=models.TextField(
                blank=True,
                help_text="Preserved note from before this entry became a past moment.",
            ),
        ),
    ]
