"""Approximate sunrise/sunset times for a date + coordinates (optional `astral`)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings

try:
    from astral import LocationInfo
    from astral.sun import sun
except ImportError:  # pragma: no cover - optional dependency
    LocationInfo = None  # type: ignore[misc, assignment]
    sun = None  # type: ignore[misc, assignment]


def _as_float(v: Decimal | float | int | None) -> float | None:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def compute_calculated_light_at(
    *,
    kind: str,
    moment_date: date,
    latitude: Decimal | float | int | None,
    longitude: Decimal | float | int | None,
) -> datetime | None:
    if kind not in ("sunrise", "sunset"):
        return None
    lat = _as_float(latitude)
    lon = _as_float(longitude)
    if lat is None or lon is None or LocationInfo is None or sun is None:
        return None
    tz_name = getattr(settings, "TIME_ZONE", None) or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    try:
        loc = LocationInfo("ray", "", tz_name, lat, lon)
        s = sun(loc.observer, date=moment_date, tzinfo=tz)
        if kind == "sunrise":
            return s["sunrise"]
        return s["sunset"]
    except Exception:
        return None
