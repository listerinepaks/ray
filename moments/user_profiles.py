from .models import Person


PERSON_NAME_MAX_LENGTH = Person._meta.get_field("name").max_length


def _truncate_person_name(value):
    value = (value or "").strip()
    return value[:PERSON_NAME_MAX_LENGTH].strip()


def _default_person_name(user):
    return (
        _truncate_person_name(user.get_full_name())
        or _truncate_person_name(getattr(user, "first_name", ""))
        or _truncate_person_name(user.get_username())
        or f"User {user.pk}"
    )


def _with_suffix(base, suffix):
    suffix = str(suffix)
    available = PERSON_NAME_MAX_LENGTH - len(suffix)
    if available <= 0:
        return suffix[:PERSON_NAME_MAX_LENGTH]
    return f"{base[:available].rstrip()}{suffix}"


def _unique_person_name_for_user(user):
    base = _default_person_name(user)
    if not Person.objects.filter(created_by=user, name=base).exists():
        return base

    username = _truncate_person_name(user.get_username())
    candidates = []
    if username and username.lower() != base.lower():
        candidates.append(username)
    candidates.append(_with_suffix(base, " profile"))

    for candidate in candidates:
        if not Person.objects.filter(created_by=user, name=candidate).exists():
            return candidate

    for idx in range(2, 1000):
        candidate = _with_suffix(base, f" {idx}")
        if not Person.objects.filter(created_by=user, name=candidate).exists():
            return candidate

    return _with_suffix(base, f" {user.pk}")


def ensure_linked_person_for_user(user):
    person = Person.objects.filter(linked_user=user).first()
    if person is not None:
        return person, False
    return (
        Person.objects.create(
            created_by=user,
            linked_user=user,
            name=_unique_person_name_for_user(user),
        ),
        True,
    )
