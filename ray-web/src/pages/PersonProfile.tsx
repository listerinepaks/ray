import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchProfileByPerson, mediaUrl, type Profile } from '../api'

export function PersonProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const personId = id ? Number.parseInt(id, 10) : Number.NaN
    if (Number.isNaN(personId)) {
      setError('Invalid person.')
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchProfileByPerson(personId)
        if (!cancelled) setProfile(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load profile.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <p className="muted">Loading profile…</p>

  if (error || !profile) {
    return (
      <section className="profile-page">
        <div className="banner" role="alert">
          {error ?? 'Profile unavailable.'}
        </div>
        <button className="btn-secondary" type="button" onClick={() => navigate(-1)}>
          Back
        </button>
      </section>
    )
  }

  const avatarSrc = mediaUrl(profile.avatar)

  return (
    <section className="profile-page">
      <div className="profile-hero">
        <div className="profile-avatar-wrap">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="profile-avatar" />
          ) : (
            <div className="profile-avatar profile-avatar--placeholder" aria-hidden="true">
              {(profile.display_name || profile.username || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="profile-hero-copy">
          <p className="profile-kicker">Profile</p>
          <h1>{profile.display_name || profile.username || 'Person'}</h1>
        </div>
      </div>

      <div className="profile-card">
        {profile.bio ? (
          <label className="field field--full">
            <span>Bio</span>
            <textarea value={profile.bio} rows={4} readOnly />
          </label>
        ) : null}

        <div className="profile-stats">
          <div className="profile-stat">
            <strong>{profile.moments_authored}</strong>
            <span>Moments written</span>
          </div>
          <div className="profile-stat">
            <strong>{profile.moments_shared_with_me}</strong>
            <span>Moments shared</span>
          </div>
        </div>

        <div className="profile-actions">
          <Link className="btn-secondary" to="/">
            Back to timeline
          </Link>
        </div>
      </div>
    </section>
  )
}
