import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AspectFitImage } from '../components/AspectFitImage'
import { LocationPinIcon } from '../components/LocationPinIcon'
import { formatSmartDate } from '../formatSmartDate'
import { fetchMoment, mediaUrl, MomentNotFoundError, type Moment } from '../api'

function formatKindLabel(kind: string): string {
  return kind === 'sunrise' ? 'Sunrise' : kind === 'sunset' ? 'Sunset' : kind
}

function formatObserved(iso: string | null): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat(undefined, {
      timeStyle: 'short',
    }).format(d)
  } catch {
    return null
  }
}

export function EntryView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [moment, setMoment] = useState<Moment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const numId = id ? Number.parseInt(id, 10) : Number.NaN
    if (Number.isNaN(numId)) {
      setError('Invalid entry.')
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const m = await fetchMoment(numId)
        if (!cancelled) setMoment(m)
      } catch (e) {
        if (e instanceof MomentNotFoundError) {
          navigate('/', { replace: true })
          return
        }
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Could not load this entry.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  if (loading) {
    return (
      <div className="entry-shell">
        <p className="muted">Loading entry…</p>
      </div>
    )
  }

  if (error || !moment) {
    return (
      <div className="entry-shell">
        <div className="banner" role="alert">
          {error ?? 'Something went wrong.'}
        </div>
        <Link className="entry-back" to="/">
          ← Back to journal
        </Link>
      </div>
    )
  }

  const sortedPhotos = [...moment.photos].sort((a, b) => a.sort_order - b.sort_order)
  const hero = sortedPhotos[0]
  const rest = sortedPhotos.slice(1)
  const observedTime = formatObserved(moment.observed_at)
  const displayTitle =
    moment.title.trim() ||
    `${formatKindLabel(moment.kind)} · ${formatSmartDate(moment.date)}`

  return (
    <article className="entry-view">
      <nav className="entry-nav" aria-label="Entry">
        <Link className="entry-back" to="/">
          ← All moments
        </Link>
        <div className="entry-nav-actions">
          {moment.my_access === 'edit' ? (
            <Link className="entry-new" to={`/moments/${moment.id}/edit`}>
              Edit moment
            </Link>
          ) : null}
          <Link className="entry-new" to="/moments/new">
            + New moment
          </Link>
          {moment.my_access ? (
            <span className="access" title="Your permission on this moment (not a button)">
              {moment.my_access}
            </span>
          ) : null}
        </div>
      </nav>

      {hero ? (
        <figure className="entry-hero">
          <AspectFitImage
            src={mediaUrl(hero.image)}
            alt={hero.caption || displayTitle}
            loading="eager"
            className="entry-hero-fit"
          />
          {hero.caption ? <figcaption>{hero.caption}</figcaption> : null}
        </figure>
      ) : null}

      <div className="entry-content">
        <header className="entry-header">
          <p className="entry-meta">
            <span className="kind">{formatKindLabel(moment.kind)}</span>
            <span className="meta-sep" aria-hidden>
              ·
            </span>
            <time dateTime={moment.date}>{formatSmartDate(moment.date)}</time>
            {observedTime ? (
              <>
                <span className="meta-sep" aria-hidden>
                  ·
                </span>
                <span className="observed">{observedTime}</span>
              </>
            ) : null}
          </p>
          <h1 className="entry-title">{displayTitle}</h1>
          {moment.bible_verse ? (
            <p className="entry-bible-verse">{moment.bible_verse}</p>
          ) : null}
          {moment.location_name ? (
            <p className="entry-location entry-location-with-icon">
              <LocationPinIcon className="entry-location-icon" />
              <span>{moment.location_name}</span>
            </p>
          ) : null}
        </header>

        {moment.tagged_people.length > 0 ? (
          <section className="entry-people" aria-label="People">
            <h2 className="entry-section-label">With</h2>
            <ul className="people-chips">
              {moment.tagged_people.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {moment.reflection ? (
          <div className="entry-reflection">
            {moment.reflection.split('\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        ) : null}

        {rest.length > 0 ? (
          <div className="entry-gallery">
            {rest.map((ph) => (
              <figure key={ph.id} className="entry-gallery-item">
                <AspectFitImage
                  src={mediaUrl(ph.image)}
                  alt={ph.caption || ''}
                  loading="lazy"
                  className="entry-gallery-fit"
                />
                {ph.caption ? <figcaption>{ph.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        ) : null}

        
      </div>
    </article>
  )
}
