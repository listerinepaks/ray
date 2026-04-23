import os
from pathlib import Path
import importlib


BASE_DIR = Path(__file__).resolve().parent.parent

# Dev default True; production: set DJANGO_DEBUG=0
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    sentry_sdk = importlib.import_module("sentry_sdk")
    django_integration_mod = importlib.import_module("sentry_sdk.integrations.django")
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[django_integration_mod.DjangoIntegration()],
        environment=os.environ.get("SENTRY_ENVIRONMENT", "development" if DEBUG else "production"),
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0")),
        profiles_sample_rate=float(os.environ.get("SENTRY_PROFILES_SAMPLE_RATE", "0")),
        send_default_pii=False,
    )

SENTRY_TRIGGER_ENABLED = os.environ.get("SENTRY_TRIGGER_ENABLED", "1" if DEBUG else "0") == "1"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-secret-key")
if not DEBUG:
    if not SECRET_KEY or SECRET_KEY == "dev-only-secret-key":
        raise ValueError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=0")

# Local dev: allow LAN IPs (Expo on device) when DEBUG is on.
if DEBUG and os.environ.get("RAY_ALLOW_ALL_HOSTS", "1") == "1":
    ALLOWED_HOSTS: list[str] = ["*"]
else:
    _raw_hosts = os.environ.get(
        "DJANGO_ALLOWED_HOSTS",
        "localhost,127.0.0.1,ray.wright5.us",
    )
    ALLOWED_HOSTS = [h.strip() for h in _raw_hosts.split(",") if h.strip()]


def _csv(name: str, default: list[str]) -> list[str]:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return list(default)
    return [x.strip() for x in raw.split(",") if x.strip()]


# Django 4+ CSRF: include the site origin for HTTPS SPA + API on same host.
CSRF_TRUSTED_ORIGINS = _csv(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ray.wright5.us",
    ],
)

CORS_ALLOWED_ORIGINS = _csv(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ray.wright5.us",
    ],
)
CORS_ALLOW_CREDENTIALS = True

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "moments",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Chicago"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "static"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

_storage_backend = os.environ.get("DJANGO_STORAGE_BACKEND", "").strip().lower()
if _storage_backend == "s3":
    _bucket_name = os.environ.get("AWS_STORAGE_BUCKET_NAME", "").strip()
    if not _bucket_name:
        raise ValueError("AWS_STORAGE_BUCKET_NAME must be set when DJANGO_STORAGE_BACKEND=s3")

    STORAGES["default"] = {
        "BACKEND": "config.storage_backends.PrivateMediaStorage",
    }

    AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
    AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
    AWS_STORAGE_BUCKET_NAME = _bucket_name
    AWS_S3_REGION_NAME = os.environ.get("AWS_S3_REGION_NAME", "").strip() or None
    AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL", "").strip() or None
    AWS_S3_CUSTOM_DOMAIN = os.environ.get("AWS_S3_CUSTOM_DOMAIN", "").strip() or None
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = int(os.environ.get("AWS_QUERYSTRING_EXPIRE", "3600"))
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_VERIFY = os.environ.get("AWS_S3_VERIFY", "1") == "1"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}
