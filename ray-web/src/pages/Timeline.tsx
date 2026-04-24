import { Link } from 'react-router-dom'
import { AspectFitImage } from '../components/AspectFitImage'
import { LocationPinIcon } from '../components/LocationPinIcon'
import { formatSmartDate } from '../formatSmartDate'
import {
  LIST_BIBLE_VERSE_MAX_WORDS,
  LIST_REFLECTION_MAX_WORDS,
  truncateWords,
} from '../truncateWords'
import { SparklesIcon } from '../components/SparklesIcon'
import { mediaUrl, type Moment } from '../api'

export type LookingAheadSummary = {
  preview: Moment[]
  total: number
}

type Props = {
  moments: Moment[]
  loading: boolean
  error: string | null
  /** When the feed filter has no rows (e.g. Friends) — show this instead of the empty-state hero. */
  emptyHint?: string | null
  /** On the All feed: compact block for upcoming looking-ahead moments (main list excludes them). */
  lookingAheadSummary?: LookingAheadSummary | null
  onLookingAheadSeeAll?: () => void
}

function formatKindLabel(kind: string): string {
  return kind === 'sunrise' ? 'Sunrise' : kind === 'sunset' ? 'Sunset' : kind
}

export function Timeline({
  moments,
  loading,
  error,
  emptyHint = null,
  lookingAheadSummary = null,
  onLookingAheadSeeAll,
}: Props) {
  const hasLaSummary = Boolean(lookingAheadSummary && lookingAheadSummary.total > 0)
  const showEmptyHero =
    !loading && !error && moments.length === 0 && !emptyHint && !hasLaSummary

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

      {!loading && !error && moments.length === 0 && emptyHint ? (
        <p className="muted timeline-tab-empty">{emptyHint}</p>
      ) : null}

      {!loading && !error && hasLaSummary && lookingAheadSummary ? (
        <section className="la-summary" aria-label="Looking ahead">
          <div className="la-summary-header">
            <h2 className="la-summary-title">Looking ahead</h2>
            <span className="la-summary-count">{lookingAheadSummary.total}</span>
          </div>
          <ul className="la-summary-rows">
            {lookingAheadSummary.preview.map((m) => {
              const posterName = m.author_username ?? `user_${m.author}`
              const posterAvatar = m.author_avatar ? mediaUrl(m.author_avatar) : ''
              const sub =
                (m.countdown_phrase && m.countdown_phrase.trim()) || formatSmartDate(m.date)
              return (
                <li key={m.id}>
                  <Link className="la-summary-row" to={`/moments/${m.id}`}>
                    {posterAvatar ? (
                      <img
                        src={posterAvatar}
                        alt=""
                        className="la-summary-avatar"
                        width={28}
                        height={28}
                      />
                    ) : (
                      <span className="la-summary-avatar la-summary-avatar--fallback" aria-hidden>
                        {posterName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="la-summary-row-text">
                      <span className="la-summary-name">{posterName}</span>
                      <span className="la-summary-sub">{sub}</span>
                    </span>
                    <span className="la-summary-chevron" aria-hidden>
                      ›
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {lookingAheadSummary.total > 3 && onLookingAheadSeeAll ? (
            <button type="button" className="la-summary-see-all" onClick={onLookingAheadSeeAll}>
              See all
            </button>
          ) : null}
        </section>
      ) : null}

      {!loading && !error && moments.length === 0 && hasLaSummary ? (
        <p className="muted timeline-tab-empty">No other moments yet.</p>
      ) : null}

      <ul className="moments">
        {moments.map((m) => {
          const photos = m.photos ?? []
          const thumb = photos.length
            ? [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]
            : null
          const posterName = m.author_username ?? `user_${m.author}`
          const posterAvatar = m.author_avatar ? mediaUrl(m.author_avatar) : ''
          return (
            <li key={m.id}>
              <Link
                className={`moment-card${m.moment_type === 'looking_ahead' ? ' moment-card--looking-ahead' : ''}`}
                to={`/moments/${m.id}`}
              >
                <div className="moment-card-poster">
                  {posterAvatar ? (
                    <img
                      src={posterAvatar}
                      alt=""
                      className="moment-card-poster-avatar"
                      width={36}
                      height={36}
                    />
                  ) : (
                    <span className="moment-card-poster-avatar moment-card-poster-avatar--fallback" aria-hidden>
                      {posterName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="moment-card-poster-main">
                    <div className="moment-card-poster-row">
                      <span className="moment-card-poster-name">{posterName}</span>
                      {m.moment_type === 'looking_ahead' ? (
                        <span className="moment-card-looking-label">
                          <SparklesIcon
                            className="moment-card-looking-label-icon"
                            variant="solid"
                            size={11}
                          />
                          Looking ahead
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
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
                {m.moment_type === 'looking_ahead' && m.countdown_phrase ? (
                  <div className="moment-card-countdown-under-thumb" role="status">
                    {m.countdown_phrase}
                  </div>
                ) : null}
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
                  <div
                    className="moment-card-activity"
                    aria-label={`${m.comments_count ?? 0} comments, ${m.reactions_count ?? 0} reactions`}
                  >
                    <span className="moment-card-activity-item" aria-hidden>
                      <span className="moment-card-activity-icon">💬</span>
                      <span className="moment-card-activity-count">{m.comments_count ?? 0}</span>
                    </span>
                    <span className="moment-card-activity-item" aria-hidden>
                      <span className="moment-card-activity-icon">❤️</span>
                      <span className="moment-card-activity-count">{m.reactions_count ?? 0}</span>
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
