import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  fetchMe,
  fetchMoments,
  postLogin,
  postLogout,
  type Me,
  type Moment,
} from './api'
import { RayLogo } from './components/RayLogo'
import { CreateMoment } from './pages/CreateMoment'
import { EntryView } from './pages/EntryView'
import { Profile } from './pages/Profile'
import { Timeline } from './pages/Timeline'
import './App.css'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<Me | null | undefined>(undefined)
  const [moments, setMoments] = useState<Moment[]>([])
  const [loadingMoments, setLoadingMoments] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)

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
        const list = await fetchMoments()
        if (!cancelled) setMoments(list)
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
    setMoments([])
    navigate('/', { replace: true })
  }

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
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div className="brand-lockup">
            <Link to="/" className="brand-logo-link" aria-label="Ray home">
              <RayLogo />
            </Link>
            <div className="brand-text">
              <p className="subtitle">
                Signed in as <strong>{user.username}</strong>
              </p>
            </div>
          </div>
          <div className="header-actions">
            <Link to="/profile" className="btn-secondary">
              Profile
            </Link>
            <Link to="/moments/new" className="header-new">
              New moment
            </Link>
            <button type="button" className="btn-secondary" onClick={() => void onLogout()}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <Timeline moments={moments} loading={loadingMoments} error={error} />
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/moments/new" element={<CreateMoment currentUser={user} />} />
        <Route path="/moments/:id/edit" element={<CreateMoment currentUser={user} />} />
        <Route path="/moments/:id" element={<EntryView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
