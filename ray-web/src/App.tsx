import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  fetchProfile,
  fetchFriendships,
  fetchMe,
  fetchMoments,
  mediaUrl,
  postLogin,
  postLogout,
  type Friendship,
  type Me,
  type Moment,
  type Profile as ProfileType,
} from './api'
import { RayLogo } from './components/RayLogo'
import { SparklesIcon } from './components/SparklesIcon'
import { CreateMoment } from './pages/CreateMoment'
import { EntryView } from './pages/EntryView'
import { PersonProfile } from './pages/PersonProfile'
import { Profile } from './pages/Profile'
import { Timeline } from './pages/Timeline'
import './App.css'

type FeedTab = 'all' | 'looking_ahead' | 'friends' | 'mentions'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<Me | null | undefined>(undefined)
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [moments, setMoments] = useState<Moment[]>([])
  const [loadingMoments, setLoadingMoments] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedTab, setFeedTab] = useState<FeedTab>('all')
  const [friendUserIds, setFriendUserIds] = useState<Set<number>>(() => new Set())
  const [pendingIncoming, setPendingIncoming] = useState<Friendship[]>([])
  const [loginError, setLoginError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await fetchMe()
        if (cancelled) return
        setUser(me)
      } catch {
        if (!cancelled) setUser(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user || location.pathname !== '/') return
    let cancelled = false
    ;(async () => {
      try {
        setLoadingMoments(true)
        setError(null)
        const [list, friendships] = await Promise.all([
          fetchMoments(),
          fetchFriendships().catch(() => null),
        ])
        if (cancelled) return
        setMoments(list)
        if (friendships) {
          const accepted = new Set<number>()
          for (const row of friendships.accepted) {
            accepted.add(row.requester_id === user.id ? row.addressee_id : row.requester_id)
          }
          setFriendUserIds(accepted)
          setPendingIncoming(friendships.pending_incoming ?? [])
        } else {
          setFriendUserIds(new Set())
          setPendingIncoming([])
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Could not load moments.')
      } finally {
        if (!cancelled) setLoadingMoments(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, location.pathname])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const next = await fetchProfile()
        if (!cancelled) setProfile(next)
      } catch {
        if (!cancelled) setProfile(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const visibleMoments = useMemo(() => {
    if (!user) return []
    if (feedTab === 'looking_ahead') {
      return moments
        .filter((m) => m.moment_type === 'looking_ahead')
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }
    if (feedTab === 'friends') return moments.filter((m) => friendUserIds.has(m.author))
    if (feedTab === 'mentions') {
      return moments.filter((m) =>
        m.tagged_people.some(
          (p) =>
            (user.id != null && p.linked_user === user.id) ||
            (profile?.person_id != null && p.id === profile.person_id),
        ),
      )
    }
    return moments
  }, [user, feedTab, friendUserIds, moments, profile?.person_id])

  const lookingAheadSorted = useMemo(
    () =>
      moments
        .filter((m) => m.moment_type === 'looking_ahead')
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [moments],
  )

  const momentsForTimeline = useMemo(() => {
    if (!user || feedTab !== 'all') return visibleMoments
    return visibleMoments.filter((m) => m.moment_type !== 'looking_ahead')
  }, [user, feedTab, visibleMoments])

  const lookingAheadSummary = useMemo(() => {
    if (!user || feedTab !== 'all' || lookingAheadSorted.length === 0) return null
    return {
      preview: lookingAheadSorted.slice(0, 3),
      total: lookingAheadSorted.length,
    }
  }, [user, feedTab, lookingAheadSorted])

  const feedEmptyHint = useMemo(() => {
    if (!user || loadingMoments || error) return null
    if (visibleMoments.length > 0) return null
    if (feedTab === 'looking_ahead') return 'No looking-ahead moments yet.'
    if (feedTab === 'friends') return 'No friend moments yet.'
    if (feedTab === 'mentions') return 'No moments mention you yet.'
    return null
  }, [user, loadingMoments, error, visibleMoments.length, feedTab])

  const onHome = location.pathname === '/'

  useEffect(() => {
    if (!accountMenuOpen) return
    function onPointerDown(e: MouseEvent) {
      if (!accountMenuRef.current?.contains(e.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAccountMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [accountMenuOpen])

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError(null)
    setLoginBusy(true)
    try {
      const me = await postLogin(username, password)
      setUser(me)
      setPassword('')
      setError(null)
      navigate(location.pathname, { replace: true })
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setLoginBusy(false)
    }
  }

  async function onLogout() {
    setLoginError(null)
    setError(null)
    try {
      await postLogout()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed.')
    }
    setUser(null)
    setProfile(null)
    setMoments([])
    setFeedTab('all')
    setFriendUserIds(new Set())
    setPendingIncoming([])
    setAccountMenuOpen(false)
    navigate('/', { replace: true })
  }

  const accountLabel = profile?.display_name || user?.username || ''
  const accountAvatar = mediaUrl(profile?.avatar)
  const accountInitial = accountLabel.slice(0, 1).toUpperCase() || '?'

  if (user === undefined) {
    return (
      <div className="app app-boot">
        <RayLogo className="ray-logo--boot" />
        <p className="muted">Checking session…</p>
      </div>
    )
  }

  if (user === null) {
    return (
      <div className="app">
        <header className="header">
          <RayLogo className="ray-logo--login" />
        </header>

        <form className="login-form" onSubmit={onLogin}>
          <label className="field">
            <span>Username</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {loginError ? (
            <p className="form-error" role="alert">
              {loginError}
            </p>
          ) : null}
          <button type="submit" className="login-btn" disabled={loginBusy}>
            {loginBusy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className={`app${onHome ? ' app--with-feed-tabs' : ''}`}>
      <header className="header">
        <div className="header-row">
          <div className="brand-lockup">
            <Link to="/" className="brand-logo-link" aria-label="Ray home">
              <RayLogo />
            </Link>
          </div>
          <div className="header-actions">
            <Link to="/moments/new" className="header-new">
              New moment
            </Link>
            <div className="account-menu" ref={accountMenuRef}>
              <button
                type="button"
                className="account-menu-trigger"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label="Open account menu"
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                {accountAvatar ? (
                  <img src={accountAvatar} alt="" className="account-avatar-image" />
                ) : (
                  <span className="account-avatar-fallback" aria-hidden>
                    {accountInitial}
                  </span>
                )}
              </button>
              {accountMenuOpen ? (
                <div className="account-menu-popover" role="menu">
                  <div className="account-menu-summary">
                    <div className="account-menu-name">{accountLabel}</div>
                    <div className="account-menu-username">@{user.username}</div>
                  </div>
                  <Link
                    to="/profile"
                    className="account-menu-item"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    className="account-menu-item account-menu-item--button"
                    role="menuitem"
                    onClick={() => void onLogout()}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <Timeline
              moments={momentsForTimeline}
              loading={loadingMoments}
              error={error}
              emptyHint={feedEmptyHint}
              lookingAheadSummary={lookingAheadSummary}
              onLookingAheadSeeAll={() => setFeedTab('looking_ahead')}
            />
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/people/:id" element={<PersonProfile />} />
        <Route path="/moments/new" element={<CreateMoment currentUser={user} />} />
        <Route path="/moments/:id/edit" element={<CreateMoment currentUser={user} />} />
        <Route path="/moments/:id" element={<EntryView currentUser={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {onHome ? (
        <nav className="feed-tabs-float" aria-label="Feed filter">
          <button
            type="button"
            className={`feed-tab-btn${feedTab === 'all' ? ' feed-tab-btn--on' : ''}`}
            aria-pressed={feedTab === 'all'}
            aria-label="All moments"
            onClick={() => setFeedTab('all')}
          >
            <svg className="feed-tab-icon" width={20} height={20} viewBox="0 0 24 24" aria-hidden>
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
            </svg>
            <span className="sr-only">All</span>
          </button>
          {/*
            Icon alternatives: hourglass (pending), calendar (date), telescope (gaze), flag (milestone).
            Mobile uses Ionicons sparkles (filled) in ray-mobile/app/(app)/index.tsx.
          */}
          <button
            type="button"
            className={`feed-tab-btn${feedTab === 'looking_ahead' ? ' feed-tab-btn--on' : ''}`}
            aria-pressed={feedTab === 'looking_ahead'}
            aria-label="Looking ahead moments"
            onClick={() => setFeedTab('looking_ahead')}
          >
            <SparklesIcon className="feed-tab-icon" variant="outline" size={20} />
            <span className="sr-only">Looking ahead</span>
          </button>
          <button
            type="button"
            className={`feed-tab-btn${feedTab === 'friends' ? ' feed-tab-btn--on' : ''}`}
            aria-pressed={feedTab === 'friends'}
            aria-label="Friends moments"
            onClick={() => setFeedTab('friends')}
          >
            <span className="feed-tab-inner">
              <svg className="feed-tab-icon" width={20} height={20} viewBox="0 0 24 24" aria-hidden>
                <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  d="M3 21v-1.2A5 5 0 0 1 8 15h2a5 5 0 0 1 5 4.8V21"
                />
                <circle cx="17" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  d="M21 21v-0.8a4 4 0 0 0-3-3.9"
                />
              </svg>
              {pendingIncoming.length > 0 ? (
                <span className="feed-tab-badge" aria-label={`${pendingIncoming.length} pending friend requests`}>
                  {pendingIncoming.length > 9 ? '9+' : String(pendingIncoming.length)}
                </span>
              ) : null}
            </span>
            <span className="sr-only">Friends</span>
          </button>
          <button
            type="button"
            className={`feed-tab-btn${feedTab === 'mentions' ? ' feed-tab-btn--on' : ''}`}
            aria-pressed={feedTab === 'mentions'}
            aria-label="Mentioned moments"
            onClick={() => setFeedTab('mentions')}
          >
            <span className="feed-tab-mention-char" aria-hidden>
              @
            </span>
            <span className="sr-only">Mentions</span>
          </button>
        </nav>
      ) : null}

      {user.groups?.includes('love') ? (
        <div className="floating-love-heart" aria-hidden>
          ♥
        </div>
      ) : null}
    </div>
  )
}

export default App
