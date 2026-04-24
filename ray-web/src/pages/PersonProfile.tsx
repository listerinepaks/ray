import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchMoments, fetchProfileByPerson, mediaUrl, type Moment, type Profile } from '../api'

export function PersonProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authorMoments, setAuthorMoments] = useState<Moment[]>([])
  const [momentsLoading, setMomentsLoading] = useState(false)
  const [momentsError, setMomentsError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!profile?.linked_user) {
      setAuthorMoments([])
      setMomentsError(null)
      setMomentsLoading(false)
      return
    }
    const authorId = profile.linked_user
    let cancelled = false
    ;(async () => {
      try {
        setMomentsLoading(true)
        setMomentsError(null)
        const all = await fetchMoments()
        if (cancelled) return
        const rows = all
          .filter((m) => m.author === authorId)
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setAuthorMoments(rows)
      } catch (e) {
        if (!cancelled) setMomentsError(e instanceof Error ? e.message : 'Could not load moments.')
      } finally {
        if (!cancelled) setMomentsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile])

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

      <section className="profile-moments" aria-label="Moments from this person">
        <h2 className="profile-moments-title">Moments</h2>
        {!profile.linked_user ? (
          <p className="muted profile-moments-hint">
            Moments from this person will show here once their profile is linked to an account.
          </p>
        ) : momentsLoading ? (
          <p className="muted">Loading moments…</p>
        ) : momentsError ? (
          <p className="profile-moments-error" role="alert">
            {momentsError}
          </p>
        ) : authorMoments.length === 0 ? (
          <p className="muted profile-moments-hint">No moments to show yet.</p>
        ) : (
          <div className="profile-moments-grid">
            {authorMoments.map((m) => {
              const photos = m.photos ?? []
              const thumb = photos.length
                ? [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]
                : null
              return (
                <Link
                  key={m.id}
                  className="profile-moment-tile"
                  to={`/moments/${m.id}`}
                  aria-label={`Open moment ${m.id}`}>
                  {thumb ? (
                    <img src={mediaUrl(thumb.image)} alt="" loading="lazy" />
                  ) : (
                    <span className="profile-moment-tile-fallback">No photo</span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}
