import json
import logging
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .models import PushDevice

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_LOG_PREFIX = "[RayPush]"


def ray_push_log(msg: str) -> None:
    """Emit to stderr and to gunicorn's error logger (Supervisor stderr_logfile)."""
    print(msg, file=sys.stderr, flush=True)
    logging.getLogger("gunicorn.error").warning("%s", msg)


def send_push_to_user(user_id: int, *, title: str, body: str, url: str | None = None) -> None:
    tokens = list(
        PushDevice.objects.filter(user_id=user_id, enabled=True)
        .values_list("expo_push_token", flat=True)
    )
    access_token = os.environ.get("EXPO_ACCESS_TOKEN", "").strip()
    if not tokens:
        ray_push_log(
            f"{_LOG_PREFIX} No enabled push devices for user_id={user_id}; "
            f"EXPO_ACCESS_TOKEN is {'set' if access_token else 'not set'} (nothing sent)."
        )
        return
    headers = {
        "Content-Type": "application/json",
    }
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    ray_push_log(
        f"{_LOG_PREFIX} EXPO_ACCESS_TOKEN is {'set' if access_token else 'not set'}; "
        f"sending {len(tokens)} message(s) for user_id={user_id}"
    )

    messages = []
    for token in tokens:
        payload = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": {"url": url} if url else {},
        }
        messages.append(payload)

    req = Request(
        EXPO_PUSH_URL,
        data=json.dumps(messages).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urlopen(req, timeout=8) as response:
            raw = response.read().decode("utf-8")
    except (HTTPError, URLError, TimeoutError) as exc:
        ray_push_log(f"{_LOG_PREFIX} Expo Push API request failed for user_id={user_id}: {exc}")
        return

    try:
        result = json.loads(raw)
    except Exception as exc:
        ray_push_log(f"{_LOG_PREFIX} Expo Push API invalid JSON for user_id={user_id}: {exc}")
        return
    data = result.get("data") if isinstance(result, dict) else None
    if not isinstance(data, list):
        ray_push_log(
            f"{_LOG_PREFIX} Expo Push API unexpected response for user_id={user_id} "
            f"(expected data list, got {type(result).__name__})"
        )
        return
    ok = 0
    err = 0
    for item, token in zip(data, tokens, strict=False):
        if not isinstance(item, dict):
            err += 1
            ray_push_log(f"{_LOG_PREFIX} Non-dict ticket for user_id={user_id}: {item!r}")
            continue
        status = item.get("status")
        details = item.get("details")
        error_code = details.get("error") if isinstance(details, dict) else None
        if error_code == "DeviceNotRegistered":
            PushDevice.objects.filter(expo_push_token=token).update(enabled=False)
        if status == "ok":
            ok += 1
        else:
            err += 1
            ray_push_log(
                f"{_LOG_PREFIX} Ticket error user_id={user_id} status={status} "
                f"message={item.get('message')} details={details}"
            )
    ray_push_log(f"{_LOG_PREFIX} Expo Push API completed for user_id={user_id} ok={ok} error_tickets={err}")
