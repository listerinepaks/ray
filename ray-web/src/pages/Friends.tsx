import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  acceptFriendRequest,
  fetchFriendships,
  fetchSharingUsers,
  mediaUrl,
  removeFriend,
  sendFriendRequest,
  type Friendship,
  type FriendshipList,
  type SharingUser,
} from '../api'

function otherUserId(row: Friendship, meId: number): number {
  return row.requester_id === meId ? row.addressee_id : row.requester_id
}

function otherUsername(row: Friendship, meId: number): string {
  return row.requester_id === meId ? row.addressee_username : row.requester_username
}

function AvatarChip({ uri, label }: { uri: string; label: string }) {
  const letter = label.slice(0, 1).toUpperCase()
  return (
    <span className="friends-avatar-wrap" aria-hidden>
      {uri ? (
        <img src={uri} className="friends-avatar-img" alt="" />
      ) : (
        <span className="friends-avatar-img friends-avatar-fallback">{letter}</span>
      )}
    </span>
  )
}

export function Friends({ meId }: { meId: number }) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sharingUsers, setSharingUsers] = useState<SharingUser[]>([])
  const [friendships, setFriendships] = useState<FriendshipList>({
    accepted: [],
    pending_incoming: [],
    pending_outgoing: [],
  })

  const load = useCallback(async () => {
    setError(null)
    setMessage(null)
    try {
      const [users, f] = await Promise.all([fetchSharingUsers(), fetchFriendships()])
      setSharingUsers(users.filter((u) => u.id !== meId))
      setFriendships(f)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load friends.')
    } finally {
      setLoading(false)
    }
  }, [meId])

  useEffect(() => {
    void load()
  }, [load])

  const q = search.trim().toLowerCase()

  const avatarByUserId = useMemo(() => {
    const m = new Map<number, string | null | undefined>()
    for (const u of sharingUsers) m.set(u.id, u.avatar)
    return m
  }, [sharingUsers])

  const acceptedFriendUserIds = useMemo(
    () => new Set(friendships.accepted.map((f) => otherUserId(f, meId))),
    [friendships.accepted, meId],
  )
  const incomingUserIds = useMemo(
    () => new Set(friendships.pending_incoming.map((f) => otherUserId(f, meId))),
    [friendships.pending_incoming, meId],
  )
  const outgoingUserIds = useMemo(
    () => new Set(friendships.pending_outgoing.map((f) => otherUserId(f, meId))),
    [friendships.pending_outgoing, meId],
  )

  const friendCandidates = useMemo(
    () =>
      sharingUsers.filter(
        (u) =>
          !acceptedFriendUserIds.has(u.id) &&
          !incomingUserIds.has(u.id) &&
          !outgoingUserIds.has(u.id) &&
          (q === '' || u.username.toLowerCase().includes(q)),
      ),
    [acceptedFriendUserIds, incomingUserIds, outgoingUserIds, q, sharingUsers],
  )

  const filteredIncoming = useMemo(
    () =>
      friendships.pending_incoming.filter((f) =>
        q === '' ? true : f.requester_username.toLowerCase().includes(q),
      ),
    [friendships.pending_incoming, q],
  )
  const filteredOutgoing = useMemo(
    () =>
      friendships.pending_outgoing.filter((f) =>
        q === '' ? true : f.addressee_username.toLowerCase().includes(q),
      ),
    [friendships.pending_outgoing, q],
  )
  const filteredAccepted = useMemo(
    () =>
      friendships.accepted.filter((f) =>
        q === '' ? true : otherUsername(f, meId).toLowerCase().includes(q),
      ),
    [friendships.accepted, meId, q],
  )

  async function onSend(userId: number) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await sendFriendRequest(userId)
      await load()
      setMessage('Request sent.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send request.')
    } finally {
      setBusy(false)
    }
  }

  async function onAccept(friendshipId: number) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await acceptFriendRequest(friendshipId)
      await load()
      setMessage('Friend request accepted.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept request.')
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveOrCancel(userId: number) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await removeFriend(userId)
      await load()
      setMessage('Updated.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update.')
    } finally {
      setBusy(false)
    }
  }

  function rowAvatar(userId: number, username: string, relFromApi?: string | null) {
    const rel = relFromApi ?? avatarByUserId.get(userId)
    return <AvatarChip uri={mediaUrl(rel)} label={username} />
  }

  return (
    <section className="friends-page">
      <h1 className="friends-title">Friends</h1>

      <label className="friends-search">
        <span>Search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Username"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>

      {loading ? <p className="muted">Loading friends…</p> : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="friends-message">{message}</p> : null}

      {!loading && filteredIncoming.length > 0 ? (
        <section className="friends-section">
          <h2 className="friends-section-title">Requests</h2>
          {filteredIncoming.map((f) => (
            <div key={f.id} className="friends-row">
              <Link to={`/people/${f.requester_id}`} className="friends-row-person">
                {rowAvatar(f.requester_id, f.requester_username, f.requester_avatar)}
                <span className="friends-row-name">{f.requester_username}</span>
              </Link>
              <button disabled={busy} onClick={() => void onAccept(f.id)} className="btn-secondary" type="button">
                Accept
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {!loading && filteredOutgoing.length > 0 ? (
        <section className="friends-section">
          <h2 className="friends-section-title">Pending</h2>
          {filteredOutgoing.map((f) => (
            <div key={f.id} className="friends-row">
              <Link to={`/people/${f.addressee_id}`} className="friends-row-person">
                {rowAvatar(f.addressee_id, f.addressee_username, f.addressee_avatar)}
                <span className="friends-row-name">{f.addressee_username}</span>
              </Link>
              <button
                disabled={busy}
                onClick={() => void onRemoveOrCancel(f.addressee_id)}
                className="btn-secondary"
                type="button">
                Cancel
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="friends-section">
        <h2 className="friends-section-title">Your friends</h2>
        {filteredAccepted.length === 0 ? (
          <p className="muted">No matches.</p>
        ) : (
          filteredAccepted.map((f) => {
            const oid = otherUserId(f, meId)
            const name = otherUsername(f, meId)
            const rel = oid === f.requester_id ? f.requester_avatar : f.addressee_avatar
            return (
              <div key={f.id} className="friends-row">
                <Link to={`/people/${oid}`} className="friends-row-person">
                  {rowAvatar(oid, name, rel)}
                  <span className="friends-row-name">{name}</span>
                </Link>
                <button
                  disabled={busy}
                  onClick={() => void onRemoveOrCancel(oid)}
                  className="btn-secondary"
                  type="button">
                  Remove
                </button>
              </div>
            )
          })
        )}
      </section>

      <section className="friends-section">
        <h2 className="friends-section-title">Add friend</h2>
        {friendCandidates.length === 0 ? (
          <p className="muted">{q ? 'No users match that search.' : 'No users available to add.'}</p>
        ) : (
          friendCandidates.map((u) => (
            <div key={u.id} className="friends-row">
              <Link to={`/people/${u.id}`} className="friends-row-person">
                {rowAvatar(u.id, u.username)}
                <span className="friends-row-name">{u.username}</span>
              </Link>
              <button disabled={busy} onClick={() => void onSend(u.id)} className="btn-secondary" type="button">
                Request
              </button>
            </div>
          ))
        )}
      </section>
    </section>
  )
}
