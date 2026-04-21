from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("moments", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="moment",
            name="bible_verse",
            field=models.CharField(
                blank=True,
                help_text="Optional Bible verse line (e.g. reference and text).",
                max_length=300,
            ),
        ),
    ]
