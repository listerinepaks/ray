import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AspectFitImage } from '../components/AspectFitImage'
import { LocationPinIcon } from '../components/LocationPinIcon'
import { SparklesIcon } from '../components/SparklesIcon'
import { formatSmartDate } from '../formatSmartDate'
import {
  createMomentComment,
  createMomentReaction,
  deleteMomentComment,
  deleteMomentReaction,
  fetchMoment,
  fetchMomentComments,
  fetchMomentReactions,
  mediaUrl,
  MomentNotFoundError,
  postConvertMoment,
  type Me,
  type Moment,
  type MomentComment,
  type MomentReaction,
} from '../api'

function formatKindLabel(kind: string): string {
  if (kind === 'sunrise') return 'Sunrise'
  if (kind === 'sunset') return 'Sunset'
  return 'Other'
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

function parseYmdLocal(ymd: string): Date {
  const parts = ymd.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date(NaN)
  const [y, mo, d] = parts
  return new Date(y!, mo! - 1, d!)
}

function isOnOrBeforeToday(ymd: string): boolean {
  const t = parseYmdLocal(ymd)
  if (Number.isNaN(t.getTime())) return false
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return t.getTime() <= today.getTime()
}

function formatCalculatedLight(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d)
  } catch {
    return null
  }
}

function formatCommentTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d)
  } catch {
    return ''
  }
}

const REACTION_TYPES = [
  { type: 'heart', label: 'Heart', emoji: '❤️' },
  { type: 'glow', label: 'Glow', emoji: '✨' },
  { type: 'wow', label: 'Wow', emoji: '⚡' },
] as const

const DOUBLE_CLICK_MS = 320

export function EntryView({
  currentUser,
  viewerPersonId,
}: {
  currentUser: Me
  viewerPersonId?: number | null
}) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [moment, setMoment] = useState<Moment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [comments, setComments] = useState<MomentComment[]>([])
  const [reactions, setReactions] = useState<MomentReaction[]>([])
  const [socialError, setSocialError] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [reactionBusy, setReactionBusy] = useState<string | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null)
  const [convertBusy, setConvertBusy] = useState(false)
  const [heartFlash, setHeartFlash] = useState(false)
  const lastHeroClickAtRef = useRef(0)
  const heartFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const reloadSocial = useCallback(async (momentId: number) => {
    setSocialError(null)
    try {
      const [c, r] = await Promise.all([
        fetchMomentComments(momentId),
        fetchMomentReactions(momentId),
      ])
      setComments(c)
      setReactions(r)
    } catch (e) {
      setSocialError(e instanceof Error ? e.message : 'Could not load reactions or comments.')
    }
  }, [])

  useEffect(() => {
    if (moment?.id == null) return
    let cancelled = false
    ;(async () => {
      try {
        setSocialError(null)
        const [c, r] = await Promise.all([
          fetchMomentComments(moment.id),
          fetchMomentReactions(moment.id),
        ])
        if (!cancelled) {
          setComments(c)
          setReactions(r)
        }
      } catch (e) {
        if (!cancelled)
          setSocialError(e instanceof Error ? e.message : 'Could not load reactions or comments.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [moment?.id])

  useEffect(() => {
    return () => {
      if (heartFlashTimerRef.current) clearTimeout(heartFlashTimerRef.current)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  const canCommentOrReact =
    moment?.my_access === 'comment' || moment?.my_access === 'edit'

  async function onSubmitComment(e: FormEvent) {
    e.preventDefault()
    if (!moment || !canCommentOrReact) return
    const text = commentDraft.trim()
    if (!text) return
    setPostingComment(true)
    setSocialError(null)
    try {
      const row = await createMomentComment(moment.id, text)
      setCommentDraft('')
      setComments((prev) => [...prev, row])
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : 'Could not post comment.')
    } finally {
      setPostingComment(false)
    }
  }

  async function onToggleReaction(type: string) {
    if (!moment || !canCommentOrReact) return
    const mine = reactions.find((x) => x.user === currentUser.id && x.type === type)
    setReactionBusy(type)
    setSocialError(null)
    try {
      if (mine) {
        await deleteMomentReaction(moment.id, mine.id)
        setReactions((prev) => prev.filter((x) => x.id !== mine.id))
      } else {
        const row = await createMomentReaction(moment.id, type)
        setReactions((prev) => [...prev, row])
      }
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : 'Could not update reaction.')
      await reloadSocial(moment.id)
    } finally {
      setReactionBusy(null)
    }
  }

  async function onConvertLookingAhead() {
    if (!moment) return
    const ok = window.confirm(
      'Did this happen? Your note will be kept, and you can add how it felt and any photos on the next screen.',
    )
    if (!ok) return
    setConvertBusy(true)
    setSocialError(null)
    try {
      await postConvertMoment(moment.id, { reflection: '' })
      navigate(`/moments/${moment.id}/edit`, { replace: true })
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : 'Could not update this moment.')
    } finally {
      setConvertBusy(false)
    }
  }

  async function onDeleteComment(commentId: number) {
    if (!moment) return
    setDeletingCommentId(commentId)
    setSocialError(null)
    try {
      await deleteMomentComment(moment.id, commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : 'Could not delete comment.')
    } finally {
      setDeletingCommentId(null)
    }
  }

  function onHeroImageClick() {
    if (!canCommentOrReact || reactionBusy) return
    const now = Date.now()
    if (now - lastHeroClickAtRef.current <= DOUBLE_CLICK_MS) {
      lastHeroClickAtRef.current = 0
      if (heartFlashTimerRef.current) clearTimeout(heartFlashTimerRef.current)
      setHeartFlash(true)
      heartFlashTimerRef.current = setTimeout(() => {
        setHeartFlash(false)
        heartFlashTimerRef.current = null
      }, 650)
      void onToggleReaction('heart')
      return
    }
    lastHeroClickAtRef.current = now
  }

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
  const posterName = moment.author_username ?? `user_${moment.author}`
  const posterAvatar = moment.author_avatar ? mediaUrl(moment.author_avatar) : ''
  const isLookingAhead = moment.moment_type === 'looking_ahead'
  const viewerPid = viewerPersonId ?? null
  const authorPid = moment.author_person_id ?? null
  const isSelfMoment = moment.author === currentUser.id
  const posterProfileTo =
    isSelfMoment || (authorPid != null && viewerPid != null && authorPid === viewerPid)
      ? '/profile'
      : authorPid != null
        ? `/people/${authorPid}`
        : null

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
        </div>
      </nav>

      <div className="entry-moment-shell">
        <div
          className={`moment-card entry-moment-card${isLookingAhead ? ' moment-card--looking-ahead' : ''}`}>
          {posterProfileTo ? (
            <Link className="moment-card-poster" to={posterProfileTo}>
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
                  {isLookingAhead ? (
                    <span className="moment-card-looking-label">
                      <SparklesIcon className="moment-card-looking-label-icon" variant="outline" size={11} />
                      Looking ahead
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ) : (
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
                  {isLookingAhead ? (
                    <span className="moment-card-looking-label">
                      <SparklesIcon className="moment-card-looking-label-icon" variant="outline" size={11} />
                      Looking ahead
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {hero ? (
            <div
              className="moment-card-thumb entry-hero-thumb"
              role={canCommentOrReact && !reactionBusy ? 'button' : undefined}
              tabIndex={canCommentOrReact && !reactionBusy ? 0 : undefined}
              onClick={() => onHeroImageClick()}
              onKeyDown={(e) => {
                if (!canCommentOrReact || reactionBusy) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onHeroImageClick()
                }
              }}
              aria-label={canCommentOrReact ? 'Photo — double-click to heart' : undefined}>
              <AspectFitImage
                src={mediaUrl(hero.image)}
                alt={hero.caption || displayTitle}
                loading="eager"
                className="moment-card-aspect-fit"
              />
              {sortedPhotos.length > 1 ? (
                <span className="moment-card-photo-badge">{sortedPhotos.length} photos</span>
              ) : null}
              {heartFlash ? (
                <div className="entry-hero-heart-flash" aria-hidden>
                  <span>❤️</span>
                </div>
              ) : null}
              {hero.caption ? <p className="entry-hero-caption">{hero.caption}</p> : null}
            </div>
          ) : (
            <div className="moment-card-placeholder" aria-hidden />
          )}

          {isLookingAhead &&
          (moment.countdown_phrase ||
            formatCalculatedLight(moment.calculated_light_at) ||
            (moment.my_access === 'edit' && isOnOrBeforeToday(moment.date))) ? (
            <div className="entry-looking-detail-band" role="status">
              <div className="entry-looking-detail-band-main">
                {moment.countdown_phrase ? (
                  <span className="entry-looking-detail-countdown">{moment.countdown_phrase}</span>
                ) : null}
                {formatCalculatedLight(moment.calculated_light_at) ? (
                  <span className="entry-looking-detail-sun">
                    ~{formatKindLabel(moment.kind).toLowerCase()} {formatCalculatedLight(moment.calculated_light_at)}
                  </span>
                ) : null}
              </div>
              {moment.my_access === 'edit' && isOnOrBeforeToday(moment.date) ? (
                <button
                  type="button"
                  className="entry-convert-btn entry-convert-btn--in-band"
                  disabled={convertBusy}
                  onClick={() => void onConvertLookingAhead()}>
                  {convertBusy ? 'Opening…' : 'We lived this'}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="moment-card-body entry-moment-body">
            <header className="entry-header">
              <div className="moment-head">
                <span className="kind">{formatKindLabel(moment.kind)}</span>
                <time className="date" dateTime={moment.date}>
                  {formatSmartDate(moment.date)}
                </time>
                {observedTime ? <span className="date">{observedTime}</span> : null}
                {moment.my_access ? (
                  <span className="access" title="Your permission on this moment (not a button)">
                    {moment.my_access}
                  </span>
                ) : null}
              </div>
              {moment.title.trim() ? (
                <h1 className="title entry-moment-title">{moment.title.trim()}</h1>
              ) : (
                <h1 className="title title-fallback entry-moment-title">
                  {formatKindLabel(moment.kind)} · {formatSmartDate(moment.date)}
                </h1>
              )}
              {moment.bible_verse ? <p className="bible-verse">{moment.bible_verse}</p> : null}
              {moment.location_name ? (
                <p className="location location-with-icon">
                  <LocationPinIcon className="location-icon" />
                  <span className="location-text">{moment.location_name}</span>
                </p>
              ) : null}
            </header>

            {moment.reflection ? (
              <div className="reflection entry-moment-reflection">
                {moment.reflection.split('\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            ) : null}

            {moment.original_looking_ahead_note?.trim() ? (
              <section className="entry-original-lookahead" aria-label="Original looking ahead note">
                <h2 className="entry-section-label">What you were looking forward to</h2>
                <div className="reflection entry-moment-reflection entry-reflection--original">
                  {moment.original_looking_ahead_note.split('\n').map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </section>
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

            {moment.tagged_people.length > 0 ? (
              <section className="entry-people" aria-label="People">
                <h2 className="entry-section-label">People</h2>
                <ul className="people-chips">
                  {moment.tagged_people.map((p) => (
                    <li key={p.id}>
                      <Link to={`/people/${p.id}`}>{p.name}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {moment.my_access ? (
              <section className="entry-social" aria-label="Reactions and comments">
                <h2 className="entry-section-label">Reactions</h2>
                {socialError ? (
                  <p className="entry-social-error" role="alert">
                    {socialError}
                  </p>
                ) : null}
                <div className="entry-reaction-bar">
                  {REACTION_TYPES.map(({ type, label, emoji }) => {
                    const count = reactions.filter((r) => r.type === type).length
                    const mine = reactions.some((r) => r.user === currentUser.id && r.type === type)
                    const busy = reactionBusy === type
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`entry-reaction-btn${mine ? ' entry-reaction-btn--mine' : ''}`}
                        disabled={!canCommentOrReact || busy}
                        onClick={() => void onToggleReaction(type)}
                        aria-pressed={mine}
                        aria-label={`${label}, ${count}`}>
                        {busy ? (
                          <span className="entry-reaction-busy">…</span>
                        ) : (
                          <>
                            <span className="entry-reaction-emoji" aria-hidden>
                              {emoji}
                            </span>
                            <span className="entry-reaction-count">{count}</span>
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
                {!canCommentOrReact ? (
                  <p className="entry-social-hint muted">View-only: you can see reactions but not add your own.</p>
                ) : null}

                <h2 className="entry-section-label entry-comments-heading">Comments</h2>
                {comments.length === 0 ? (
                  <p className="muted entry-no-comments">No comments yet.</p>
                ) : (
                  <ul className="entry-comment-list">
                    {comments.map((c) => (
                      <li key={c.id} className="entry-comment-card">
                        <div className="entry-comment-head">
                          <span className="entry-comment-author">
                            {c.author_username ?? `User ${c.author}`}
                          </span>
                          <time className="entry-comment-time" dateTime={c.created_at}>
                            {formatCommentTime(c.created_at)}
                          </time>
                        </div>
                        <p className="entry-comment-body">{c.text}</p>
                        {c.author === currentUser.id ? (
                          <button
                            type="button"
                            className="entry-comment-remove"
                            disabled={deletingCommentId === c.id}
                            onClick={() => void onDeleteComment(c.id)}>
                            {deletingCommentId === c.id ? 'Removing…' : 'Remove'}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {canCommentOrReact ? (
                  <form className="entry-comment-form" onSubmit={onSubmitComment}>
                    <label className="entry-comment-label">
                      <span className="visually-hidden">New comment</span>
                      <textarea
                        className="entry-comment-input"
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Write a comment…"
                        rows={3}
                        disabled={postingComment}
                      />
                    </label>
                    <button
                      type="submit"
                      className="entry-comment-submit"
                      disabled={postingComment || !commentDraft.trim()}>
                      {postingComment ? 'Posting…' : 'Post'}
                    </button>
                  </form>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
