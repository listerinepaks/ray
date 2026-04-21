import { Link } from 'react-router-dom'
import { AspectFitImage } from '../components/AspectFitImage'
import { LocationPinIcon } from '../components/LocationPinIcon'
import { formatSmartDate } from '../formatSmartDate'
import {
  LIST_BIBLE_VERSE_MAX_WORDS,
  LIST_REFLECTION_MAX_WORDS,
  truncateWords,
} from '../truncateWords'
import { mediaUrl, type Moment } from '../api'

type Props = {
  moments: Moment[]
  loading: boolean
  error: string | null
}

function formatKindLabel(kind: string): string {
  return kind === 'sunrise' ? 'Sunrise' : kind === 'sunset' ? 'Sunset' : kind
}

export function Timeline({ moments, loading, error }: Props) {
  const showEmptyHero = !loading && !error && moments.length === 0

  return (
    <>
      {showEmptyHero ? (
        <div className="timeline-hero">
          <div className="timeline-hero-copy">
            <p className="timeline-hero-text">Add a sunrise or sunset when you’re ready.</p>
            <Link className="timeline-hero-cta" to="/moments/new">
              Write a moment
            </Link>
          </div>
        </div>
      ) : null}

      {loading && <p className="muted">Loading moments…</p>}
      {error && (
        <div className="banner" role="alert">
          <strong>Could not load moments.</strong> {error}
        </div>
      )}

      <ul className="moments">
        {moments.map((m) => {
          const photos = m.photos ?? []
          const thumb = photos.length
            ? [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]
            : null
          return (
            <li key={m.id}>
              <Link className="moment-card" to={`/moments/${m.id}`}>
                {thumb ? (
                  <div className="moment-card-thumb">
                    <AspectFitImage
                      src={mediaUrl(thumb.image)}
                      alt=""
                      loading="lazy"
                      className="moment-card-aspect-fit"
                    />
                    {photos.length > 1 ? (
                      <span className="moment-card-photo-badge">{photos.length} photos</span>
                    ) : null}
                  </div>
                ) : (
                  <div className="moment-card-placeholder" aria-hidden />
                )}
                <div className="moment-card-body">
                  <div className="moment-head">
                    <span className="kind">{formatKindLabel(m.kind)}</span>
                    <span className="date">{formatSmartDate(m.date)}</span>
                    {m.my_access ? (
                      <span className="access" title="Your access on this moment">
                        {m.my_access}
                      </span>
                    ) : null}
                  </div>
                  {m.title ? (
                    <h2 className="title">{m.title}</h2>
                  ) : (
                    <h2 className="title title-fallback">
                      {formatKindLabel(m.kind)} · {formatSmartDate(m.date)}
                    </h2>
                  )}
                  {m.bible_verse ? (
                    <p className="bible-verse preview">
                      {truncateWords(m.bible_verse, LIST_BIBLE_VERSE_MAX_WORDS)}
                    </p>
                  ) : null}
                  {m.location_name ? (
                    <p className="location preview location-with-icon">
                      <LocationPinIcon className="location-icon" />
                      <span className="location-text">{m.location_name}</span>
                    </p>
                  ) : null}
                  {m.reflection ? (
                    <p className="reflection preview">
                      {truncateWords(m.reflection, LIST_REFLECTION_MAX_WORDS)}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
