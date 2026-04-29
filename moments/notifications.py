import re

from django.contrib.auth import get_user_model
from django.db import IntegrityError

from .access import get_accepted_friend_user_ids
from .models import Comment, Friendship, Moment, Notification
from .push import send_push_to_user


MENTION_RE = re.compile(r"@([A-Za-z0-9_.-]+)")


def _create_notification(**kwargs) -> None:
    try:
        notification = Notification.objects.create(**kwargs)
    except IntegrityError:
        return
    _send_push(notification)


def _push_copy(notification: Notification) -> tuple[str, str]:
    actor_name = notification.actor.username
    if notification.type == Notification.TYPE_FRIEND_POSTED:
        return "New friend moment", f"{actor_name} shared a new moment."
    if notification.type == Notification.TYPE_FRIEND_REQUEST_RECEIVED:
        return "Friend request", f"{actor_name} sent you a friend request."
    if notification.type == Notification.TYPE_FRIEND_REQUEST_ACCEPTED:
        return "Friend request accepted", f"{actor_name} accepted your friend request."
    if notification.type == Notification.TYPE_MOMENT_COMMENTED:
        return "New comment", f"{actor_name} commented on your moment."
    if notification.type == Notification.TYPE_MOMENT_REACTED:
        return "New reaction", f"{actor_name} reacted to your moment."
    if notification.type == Notification.TYPE_MENTIONED:
        return "You were mentioned", f"{actor_name} mentioned you."
    return "Notification", f"{actor_name} sent you a notification."


def _send_push(notification: Notification) -> None:
    title, body = _push_copy(notification)
    target_url = "raymobile://notifications"
    if notification.moment_id:
        target_url = f"raymobile://moment/{notification.moment_id}"
    send_push_to_user(
        notification.user_id,
        title=title,
        body=body,
        url=target_url,
    )


def notify_friend_posted(moment: Moment) -> None:
    friend_ids = get_accepted_friend_user_ids(moment.author_id)
    for friend_id in friend_ids:
        _create_notification(
            user_id=friend_id,
            actor_id=moment.author_id,
            moment=moment,
            type=Notification.TYPE_FRIEND_POSTED,
            dedupe_key=f"moment:{moment.id}",
        )


def notify_friend_request_received(friendship: Friendship) -> None:
    _create_notification(
        user_id=friendship.addressee_id,
        actor_id=friendship.requester_id,
        friendship=friendship,
        type=Notification.TYPE_FRIEND_REQUEST_RECEIVED,
        dedupe_key=f"friendship:{friendship.id}",
    )


def notify_friend_request_accepted(friendship: Friendship) -> None:
    _create_notification(
        user_id=friendship.requester_id,
        actor_id=friendship.addressee_id,
        friendship=friendship,
        type=Notification.TYPE_FRIEND_REQUEST_ACCEPTED,
        dedupe_key=f"friendship:{friendship.id}",
    )


def notify_moment_commented(comment: Comment) -> None:
    moment = comment.moment
    if moment.author_id != comment.author_id:
        _create_notification(
            user_id=moment.author_id,
            actor_id=comment.author_id,
            moment=moment,
            comment=comment,
            type=Notification.TYPE_MOMENT_COMMENTED,
            dedupe_key=f"comment:{comment.id}:owner",
        )
    notify_mentions(comment)


def notify_moment_reacted(moment: Moment, actor_id: int, reaction_id: int) -> None:
    if moment.author_id == actor_id:
        return
    _create_notification(
        user_id=moment.author_id,
        actor_id=actor_id,
        moment=moment,
        type=Notification.TYPE_MOMENT_REACTED,
        dedupe_key=f"reaction:{reaction_id}:owner",
    )


def notify_mentions(comment: Comment) -> None:
    usernames = {m.group(1).strip() for m in MENTION_RE.finditer(comment.text or "")}
    usernames.discard("")
    if not usernames:
        return
    User = get_user_model()
    for user in User.objects.filter(username__in=usernames).only("id"):
        if user.id == comment.author_id:
            continue
        _create_notification(
            user_id=user.id,
            actor_id=comment.author_id,
            moment=comment.moment,
            comment=comment,
            type=Notification.TYPE_MENTIONED,
            dedupe_key=f"comment:{comment.id}:mention:{user.id}",
        )
