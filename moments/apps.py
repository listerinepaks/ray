import logging

from django.apps import AppConfig


class MomentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "moments"

    def ready(self) -> None:
        # One line per worker when Django loads; confirms gunicorn.err.log path + deploy.
        logging.getLogger("gunicorn.error").warning(
            "[RayPush] moments app ready (if you see this, worker loaded push logging)."
        )
