import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .models import PushDevice

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push_to_user(user_id: int, *, title: str, body: str, url: str | None = None) -> None:
    tokens = list(
        PushDevice.objects.filter(user_id=user_id, enabled=True)
        .values_list("expo_push_token", flat=True)
    )
    if not tokens:
        return
    headers = {
        "Content-Type": "application/json",
    }
    access_token = os.environ.get("EXPO_ACCESS_TOKEN", "").strip()
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

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
    except (HTTPError, URLError, TimeoutError):
        return

    try:
        result = json.loads(raw)
    except Exception:
        return
    data = result.get("data") if isinstance(result, dict) else None
    if not isinstance(data, list):
        return
    for item, token in zip(data, tokens, strict=False):
        details = item.get("details") if isinstance(item, dict) else None
        error = item.get("details", {}).get("error") if isinstance(details, dict) else None
        if error == "DeviceNotRegistered":
            PushDevice.objects.filter(expo_push_token=token).update(enabled=False)
