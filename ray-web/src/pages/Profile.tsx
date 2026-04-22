import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import {
  fetchPeople,
  fetchProfile,
  mediaUrl,
  updateProfile,
  type Person,
  type Profile as ProfileType,
} from '../api'

export function Profile() {
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [claimPersonId, setClaimPersonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const [data, sharedPeople] = await Promise.all([fetchProfile(), fetchPeople()])
        if (cancelled) return
        setProfile(data)
        setPeople(sharedPeople)
        setDisplayName(data.display_name)
        setBio(data.bio)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load profile.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  function onAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setAvatarFile(file)
    setSaveMessage(null)
    setError(null)
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaveMessage(null)
    try {
      const next = await updateProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar: avatarFile ?? undefined,
      })
      setProfile(next)
      setDisplayName(next.display_name)
      setBio(next.bio)
      setAvatarFile(null)
      setAvatarPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setSaveMessage('Profile saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  async function onClaimPerson() {
    if (!claimPersonId) return
    setSaving(true)
    setError(null)
    setSaveMessage(null)
    try {
      const next = await updateProfile({ person_id: Number(claimPersonId) })
      setProfile(next)
      setDisplayName(next.display_name)
      setBio(next.bio)
      setClaimPersonId('')
      setSaveMessage('Person claimed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim this person.')
    } finally {
      setSaving(false)
    }
  }

  const avatarSrc = avatarPreview || mediaUrl(profile?.avatar)
  const claimablePeople = people.filter((p) => p.linked_user == null)

  return (
    <section className="profile-page">
      <div className="profile-hero">
        <div className="profile-avatar-wrap">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="profile-avatar" />
          ) : (
            <div className="profile-avatar profile-avatar--placeholder" aria-hidden="true">
              {(displayName || profile?.username || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="profile-hero-copy">
          <p className="profile-kicker">Your profile</p>
          <h1>{profile?.display_name || profile?.username || 'Profile'}</h1>
          <p className="profile-subtle">
            This is the shared person record linked to your account. If someone joins later, their
            login can attach to the same person entry.
          </p>
        </div>
      </div>

      {loading ? <p className="muted">Loading profile…</p> : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {profile ? (
        <form className="profile-form" onSubmit={onSubmit}>
          <div className="profile-card">
            {profile.person_id == null ? (
              <div className="profile-claim">
                <p className="profile-claim-title">Claim an existing person</p>
                <p className="profile-subtle">
                  If someone already added you, claim that shared person entry instead of creating a
                  duplicate.
                </p>
                {claimablePeople.length > 0 ? (
                  <div className="profile-claim-row">
                    <select
                      value={claimPersonId}
                      onChange={(e) => setClaimPersonId(e.target.value)}
                    >
                      <option value="">Choose a person…</option>
                      {claimablePeople.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void onClaimPerson()}
                      disabled={!claimPersonId || saving}
                    >
                      Claim person
                    </button>
                  </div>
                ) : (
                  <p className="muted">No unclaimed shared people are available right now.</p>
                )}
              </div>
            ) : null}

            <div className="profile-grid">
              <label className="field">
                <span>Display name</span>
                <input
                  type="text"
                  value={displayName}
                  maxLength={120}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={profile.username}
                />
              </label>
              <label className="field">
                <span>Username</span>
                <input type="text" value={profile.username} disabled />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={profile.email} disabled />
              </label>
              <label className="field">
                <span>Avatar</span>
                <input type="file" accept="image/*" onChange={onAvatarChange} />
              </label>
            </div>

            <label className="field field--full">
              <span>Bio</span>
              <textarea
                value={bio}
                maxLength={280}
                rows={4}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A few lines about you."
              />
            </label>

            <div className="profile-stats">
              <div className="profile-stat">
                <strong>{profile.moments_authored}</strong>
                <span>Moments written</span>
              </div>
              <div className="profile-stat">
                <strong>{profile.moments_shared_with_me}</strong>
                <span>Moments shared with you</span>
              </div>
            </div>

            <div className="profile-actions">
              <button type="submit" className="login-btn" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              {saveMessage ? <p className="profile-saved">{saveMessage}</p> : null}
            </div>
          </div>
        </form>
      ) : null}
    </section>
  )
}
