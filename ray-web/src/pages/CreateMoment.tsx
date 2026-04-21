import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createMoment,
  createPerson,
  deleteMomentPhoto,
  fetchMoment,
  fetchPeople,
  fetchSharingUsers,
  mediaUrl,
  patchMomentPhoto,
  updateMoment,
  uploadMomentPhoto,
  type CreateMomentPayload,
  type Me,
  type MomentPhoto,
  type Person,
  type SharingUser,
} from '../api'
import { LocationPinIcon } from '../components/LocationPinIcon'
import './CreateMoment.css'

const VIS = {
  private: 'private',
  tagged: 'tagged',
  custom: 'custom',
} as const

const ACCESS_LEVELS = [
  { value: 'view', label: 'View only' },
  { value: 'comment', label: 'View & comment' },
  { value: 'edit', label: 'Can edit' },
]

type PhotoDraft = {
  key: string
  file: File
  caption: string
  previewUrl: string
}

type CustomRow = {
  key: string
  userId: number
  accessLevel: string
}

function todayDateString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CreateMoment({ currentUser }: { currentUser: Me }) {
  const navigate = useNavigate()
  const { id: routeId } = useParams<{ id: string }>()
  const editId = useMemo(() => {
    if (!routeId) return null
    const n = Number.parseInt(routeId, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [routeId])
  const isEdit = editId != null
  const [people, setPeople] = useState<Person[]>([])
  const [shareUsers, setShareUsers] = useState<SharingUser[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)

  const [kind, setKind] = useState<'sunrise' | 'sunset'>('sunrise')
  const [date, setDate] = useState(todayDateString)
  const [observedAt, setObservedAt] = useState('')
  const [title, setTitle] = useState('')
  const [bibleVerse, setBibleVerse] = useState('')
  const [reflection, setReflection] = useState('')
  const [locationName, setLocationName] = useState('')
  const [visibility, setVisibility] = useState<string>(VIS.tagged)
  const [selectedPeople, setSelectedPeople] = useState<Set<number>>(new Set())
  const [customRows, setCustomRows] = useState<CustomRow[]>([])

  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const [existingPhotos, setExistingPhotos] = useState<MomentPhoto[]>([])
  const photosRef = useRef(photos)
  photosRef.current = photos
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<string | null>(null)
  const [loadingMoment, setLoadingMoment] = useState(false)
  const [momentLoadError, setMomentLoadError] = useState<string | null>(null)

  const [personModalOpen, setPersonModalOpen] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [newPersonNote, setNewPersonNote] = useState('')
  const [personSaving, setPersonSaving] = useState(false)
  const [personError, setPersonError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoadingRefs(true)
        const [p, u] = await Promise.all([fetchPeople(), fetchSharingUsers()])
        if (!cancelled) {
          setPeople(p)
          setShareUsers(u.filter((x) => x.id !== currentUser.id))
        }
      } catch {
        if (!cancelled) setSubmitError('Could not load people or users for sharing.')
      } finally {
        if (!cancelled) setLoadingRefs(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentUser.id])

  useEffect(() => {
    if (!isEdit || editId == null) return
    let cancelled = false
    ;(async () => {
      try {
        setLoadingMoment(true)
        setMomentLoadError(null)
        const m = await fetchMoment(editId)
        if (cancelled) return
        if (m.my_access !== 'edit') {
          navigate(`/moments/${editId}`, { replace: true })
          return
        }
        setKind(m.kind === 'sunset' ? 'sunset' : 'sunrise')
        setDate(m.date)
        setObservedAt(m.observed_at ? toDatetimeLocal(m.observed_at) : '')
        setTitle(m.title)
        setBibleVerse(m.bible_verse ?? '')
        setReflection(m.reflection)
        setLocationName(m.location_name)
        setVisibility(m.visibility_mode)
        setSelectedPeople(new Set(m.tagged_people.map((p) => p.id)))
        const accessList = m.access_list ?? []
        setCustomRows(
          accessList
            .filter((a) => a.user_id !== m.author)
            .map((a) => ({
              key: crypto.randomUUID(),
              userId: a.user_id,
              accessLevel: a.access_level,
            })),
        )
        setExistingPhotos([...m.photos].sort((a, b) => a.sort_order - b.sort_order))
      } catch (e) {
        if (!cancelled)
          setMomentLoadError(e instanceof Error ? e.message : 'Could not load this moment.')
      } finally {
        if (!cancelled) setLoadingMoment(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, editId, navigate])

  useEffect(() => {
    return () => {
      photosRef.current.forEach((ph) => URL.revokeObjectURL(ph.previewUrl))
    }
  }, [])

  const addPhotoFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    setPhotos((prev) => {
      const next = [...prev]
      for (const file of list) {
        next.push({
          key: crypto.randomUUID(),
          file,
          caption: '',
          previewUrl: URL.createObjectURL(file),
        })
      }
      return next
    })
  }, [])

  const removePhoto = useCallback((key: string) => {
    setPhotos((prev) => {
      const ph = prev.find((p) => p.key === key)
      if (ph) URL.revokeObjectURL(ph.previewUrl)
      return prev.filter((p) => p.key !== key)
    })
  }, [])

  const movePhoto = useCallback((index: number, dir: -1 | 1) => {
    setPhotos((prev) => {
      const j = index + dir
      if (j < 0 || j >= prev.length) return prev
      const copy = [...prev]
      const t = copy[index]!
      copy[index] = copy[j]!
      copy[j] = t
      return copy
    })
  }, [])

  const updatePhotoCaption = useCallback((key: string, caption: string) => {
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, caption } : p)))
  }, [])

  const updateExistingPhotoCaption = useCallback((photoId: number, caption: string) => {
    setExistingPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, caption } : p)))
  }, [])

  const removeExistingPhoto = useCallback(
    async (photoId: number) => {
      if (!isEdit || editId == null) return
      setSubmitError(null)
      try {
        await deleteMomentPhoto(editId, photoId)
        setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId))
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Could not remove photo.')
      }
    },
    [isEdit, editId],
  )

  function togglePerson(id: number) {
    setSelectedPeople((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function addCustomRow() {
    const first = shareUsers[0]
    setCustomRows((rows) => [
      ...rows,
      {
        key: crypto.randomUUID(),
        userId: first?.id ?? 0,
        accessLevel: 'comment',
      },
    ])
  }

  function setVisibilityMode(next: string) {
    setVisibility(next)
    if (next === VIS.custom && shareUsers.length > 0) {
      setCustomRows((rows) => {
        if (rows.length > 0) return rows
        return [
          {
            key: crypto.randomUUID(),
            userId: shareUsers[0].id,
            accessLevel: 'comment',
          },
        ]
      })
    }
  }

  function updateCustomRow(key: string, patch: Partial<Pick<CustomRow, 'userId' | 'accessLevel'>>) {
    setCustomRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeCustomRow(key: string) {
    setCustomRows((rows) => rows.filter((r) => r.key !== key))
  }

  async function onAddPerson(e: FormEvent) {
    e.preventDefault()
    setPersonError(null)
    if (!newPersonName.trim()) return
    setPersonSaving(true)
    try {
      const p = await createPerson({
        name: newPersonName.trim(),
        note: newPersonNote.trim() || undefined,
      })
      setPeople((list) => [...list, p].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedPeople((prev) => new Set(prev).add(p.id))
      setNewPersonName('')
      setNewPersonNote('')
      setPersonModalOpen(false)
    } catch (err) {
      setPersonError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setPersonSaving(false)
    }
  }

  function buildPayload(): CreateMomentPayload {
    const payload: CreateMomentPayload = {
      kind,
      date,
      visibility_mode: visibility,
      title: title.trim() || undefined,
      bible_verse: bibleVerse.trim(),
      reflection: reflection.trim() || undefined,
      location_name: locationName.trim() || undefined,
    }
    if (observedAt.trim()) {
      const d = new Date(observedAt)
      if (!Number.isNaN(d.getTime())) payload.observed_at = d.toISOString()
    } else {
      payload.observed_at = null
    }

    if (visibility === VIS.tagged) {
      payload.people = [...selectedPeople].map((person_id) => ({
        person_id,
        role: 'present',
      }))
    } else {
      payload.people = []
    }
    if (visibility === VIS.custom) {
      payload.access = customRows
        .filter((r) => r.userId > 0)
        .map((r) => ({
          user_id: r.userId,
          access_level: r.accessLevel,
        }))
    }
    return payload
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (visibility === VIS.tagged && selectedPeople.size === 0) {
      setSubmitError('Choose at least one person to tag, or switch to Private visibility.')
      return
    }
    if (visibility === VIS.custom) {
      const valid = customRows.filter((r) => r.userId > 0)
      if (valid.length === 0) {
        setSubmitError('Add at least one person and access level for custom sharing.')
        return
      }
    }

    setSubmitting(true)
    setUploadPhase(null)
    try {
      const payload = buildPayload()

      if (isEdit && editId != null) {
        await updateMoment(editId, payload)
        for (const ph of existingPhotos) {
          await patchMomentPhoto(editId, ph.id, { caption: ph.caption.trim() })
        }
        for (let i = 0; i < photos.length; i++) {
          const ph = photos[i]!
          setUploadPhase(`Uploading photo ${i + 1} of ${photos.length}…`)
          await uploadMomentPhoto(editId, ph.file, ph.caption.trim(), existingPhotos.length + i)
        }
        navigate(`/moments/${editId}`, { replace: true })
      } else {
        const created = await createMoment(payload)

        for (let i = 0; i < photos.length; i++) {
          const ph = photos[i]!
          setUploadPhase(`Uploading photo ${i + 1} of ${photos.length}…`)
          await uploadMomentPhoto(created.id, ph.file, ph.caption.trim(), i)
        }

        navigate(`/moments/${created.id}`, { replace: true })
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
      setUploadPhase(null)
    }
  }

  return (
    <div className="create-page">
      <header className="create-header">
        <div className="create-header-text">
          <Link to={isEdit && editId != null ? `/moments/${editId}` : '/'} className="create-back">
            ← Back
          </Link>
          <h1 className="create-title">{isEdit ? 'Edit moment' : 'New moment'}</h1>
          <p className="create-lead">
            {isEdit
              ? 'Update the story, who can see it, and photos.'
              : 'Capture a sunrise or sunset — who was there, what you felt, and who can see it.'}
          </p>
        </div>
      </header>

      {loadingRefs || (isEdit && loadingMoment) ? (
        <p className="muted">Loading…</p>
      ) : momentLoadError ? (
        <div className="create-banner" role="alert">
          {momentLoadError}
        </div>
      ) : (
        <form className="create-form" onSubmit={onSubmit}>
          {submitError ? (
            <div className="create-banner" role="alert">
              {submitError}
            </div>
          ) : null}
          {uploadPhase ? <p className="create-upload-phase">{uploadPhase}</p> : null}

          <section className="create-section" aria-labelledby="sec-photos">
            <h2 id="sec-photos" className="create-section-title">
              Photos
            </h2>
            <p className="photos-hint">
              Start here — large, honest images work best. {isEdit ? 'Add new images; edit captions or remove existing.' : 'You can reorder before saving.'}
            </p>
            <label
              className="photo-drop"
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (e.dataTransfer.files?.length) addPhotoFiles(e.dataTransfer.files)
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="photo-input"
                onChange={(e) => {
                  if (e.target.files?.length) addPhotoFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <span className="photo-drop-text">
                Drop images here or <span className="photo-browse">browse</span>
              </span>
            </label>

            {existingPhotos.length > 0 ? (
              <ul className="photo-list">
                {existingPhotos.map((ph) => (
                  <li key={`existing-${ph.id}`} className="photo-item">
                    <div className="photo-thumb-wrap">
                      <img src={mediaUrl(ph.image)} alt="" className="photo-thumb" />
                    </div>
                    <div className="photo-fields">
                      <label>
                        <span className="sr-only">Caption</span>
                        <input
                          type="text"
                          value={ph.caption}
                          onChange={(e) => updateExistingPhotoCaption(ph.id, e.target.value)}
                          placeholder="Caption (optional)"
                          maxLength={240}
                        />
                      </label>
                      <div className="photo-actions">
                        <button
                          type="button"
                          className="btn-text danger"
                          onClick={() => void removeExistingPhoto(ph.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {photos.length > 0 ? (
              <ul className="photo-list">
                {photos.map((ph, index) => (
                  <li key={ph.key} className="photo-item">
                    <div className="photo-thumb-wrap">
                      <img src={ph.previewUrl} alt="" className="photo-thumb" />
                    </div>
                    <div className="photo-fields">
                      <label>
                        <span className="sr-only">Caption</span>
                        <input
                          type="text"
                          value={ph.caption}
                          onChange={(e) => updatePhotoCaption(ph.key, e.target.value)}
                          placeholder="Caption (optional)"
                          maxLength={240}
                        />
                      </label>
                      <div className="photo-actions">
                        <button
                          type="button"
                          className="btn-text"
                          disabled={index === 0}
                          onClick={() => movePhoto(index, -1)}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="btn-text"
                          disabled={index === photos.length - 1}
                          onClick={() => movePhoto(index, 1)}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className="btn-text danger"
                          onClick={() => removePhoto(ph.key)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="create-section" aria-labelledby="sec-kind">
            <h2 id="sec-kind" className="create-section-title">
              Kind &amp; time
            </h2>
            <div className="kind-grid" role="group" aria-label="Sunrise or sunset">
              <button
                type="button"
                className={`kind-option ${kind === 'sunrise' ? 'is-selected' : ''}`}
                onClick={() => setKind('sunrise')}
              >
                <span className="kind-option-icon" aria-hidden>
                  ☀️
                </span>
                <span className="kind-option-label">Sunrise</span>
                <span className="kind-option-hint">First light</span>
              </button>
              <button
                type="button"
                className={`kind-option ${kind === 'sunset' ? 'is-selected' : ''}`}
                onClick={() => setKind('sunset')}
              >
                <span className="kind-option-icon" aria-hidden>
                  🌙
                </span>
                <span className="kind-option-label">Sunset</span>
                <span className="kind-option-hint">Day closing</span>
              </button>
            </div>

            <div className="create-field-row">
              <label className="create-field">
                <span>Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <label className="create-field create-field-grow">
                <span>Exact time (optional)</span>
                <input
                  type="datetime-local"
                  value={observedAt}
                  onChange={(e) => setObservedAt(e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="create-section" aria-labelledby="sec-story">
            <h2 id="sec-story" className="create-section-title">
              Story
            </h2>
            <label className="create-field">
              <span>Title</span>
              <input
                type="text"
                maxLength={140}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional — a line to remember this day"
              />
            </label>
            <label className="create-field">
              <span>Bible verse</span>
              <input
                type="text"
                maxLength={300}
                value={bibleVerse}
                onChange={(e) => setBibleVerse(e.target.value)}
                placeholder="Optional — e.g. Psalm 23:1 (ESV)"
              />
            </label>
            <label className="create-field">
              <span>Reflection</span>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={6}
                placeholder="What stayed with you?"
              />
            </label>
            <label className="create-field create-field-place">
              <span className="create-field-label-with-icon">
                <LocationPinIcon className="create-field-icon" />
                Place
              </span>
              <input
                type="text"
                maxLength={200}
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Where you were"
              />
            </label>
          </section>

          <section className="create-section" aria-labelledby="sec-visibility">
            <h2 id="sec-visibility" className="create-section-title">
              Who can see this?
            </h2>
            <div className="visibility-grid">
              <button
                type="button"
                className={`visibility-card ${visibility === VIS.private ? 'is-selected' : ''}`}
                onClick={() => setVisibilityMode(VIS.private)}
              >
                <span className="visibility-card-title">Private</span>
                <span className="visibility-card-body">Only you. Nothing is shared.</span>
              </button>
              <button
                type="button"
                className={`visibility-card ${visibility === VIS.tagged ? 'is-selected' : ''}`}
                onClick={() => setVisibilityMode(VIS.tagged)}
              >
                <span className="visibility-card-title">Tagged people</span>
                <span className="visibility-card-body">
                  People you tag can join in. If they have accounts, they get access automatically.
                </span>
              </button>
              <button
                type="button"
                className={`visibility-card ${visibility === VIS.custom ? 'is-selected' : ''}`}
                onClick={() => setVisibilityMode(VIS.custom)}
              >
                <span className="visibility-card-title">Custom</span>
                <span className="visibility-card-body">
                  Pick exactly who can view, comment, or edit — by account.
                </span>
              </button>
            </div>

            {visibility === VIS.tagged ? (
              <div className="tagged-panel">
                <div className="tagged-toolbar">
                  <p className="tagged-intro">Who was present?</p>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => {
                      setPersonError(null)
                      setPersonModalOpen(true)
                    }}
                  >
                    + Add someone new
                  </button>
                </div>
                {people.length === 0 ? (
                  <p className="muted">
                    You don’t have anyone in your list yet. Add a name to tag them on moments.
                  </p>
                ) : (
                  <ul className="people-pick">
                    {people.map((p) => (
                      <li key={p.id}>
                        <label className="people-pick-item">
                          <input
                            type="checkbox"
                            checked={selectedPeople.has(p.id)}
                            onChange={() => togglePerson(p.id)}
                          />
                          <span>{p.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {visibility === VIS.custom ? (
              <div className="custom-panel">
                <p className="custom-intro">
                  Choose accounts on this site and what they can do. You always have full edit access.
                </p>
                {shareUsers.length === 0 ? (
                  <p className="muted">No other users to share with yet.</p>
                ) : (
                  <>
                    <ul className="custom-rows">
                      {customRows.map((row, idx) => (
                        <li key={row.key} className="custom-row">
                          <select
                            value={row.userId || ''}
                            onChange={(e) =>
                              updateCustomRow(row.key, {
                                userId: Number(e.target.value),
                              })
                            }
                            aria-label={`User ${idx + 1}`}
                          >
                            <option value="">Select person…</option>
                            {shareUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.username}
                              </option>
                            ))}
                          </select>
                          <select
                            value={row.accessLevel}
                            onChange={(e) =>
                              updateCustomRow(row.key, { accessLevel: e.target.value })
                            }
                            aria-label={`Access for row ${idx + 1}`}
                          >
                            {ACCESS_LEVELS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => removeCustomRow(row.key)}
                            aria-label="Remove row"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="btn-secondary btn-add-row" onClick={addCustomRow}>
                      + Add someone
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </section>

          <div className="create-actions">
            <Link
              to={isEdit && editId != null ? `/moments/${editId}` : '/'}
              className="btn-secondary create-cancel"
            >
              Cancel
            </Link>
            <button type="submit" className="login-btn create-submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Save moment'}
            </button>
          </div>
        </form>
      )}

      {personModalOpen ? (
        <div
          className="modal-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="modal-scrim"
            onClick={() => !personSaving && setPersonModalOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && !personSaving && setPersonModalOpen(false)}
          />
          <div className="modal-panel">
            <h2 id="modal-title" className="modal-title">
              Add someone
            </h2>
            <p className="modal-copy">They’ll appear in your list for tagging on any moment.</p>
            <form onSubmit={onAddPerson}>
              <label className="create-field">
                <span>Name</span>
                <input
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  autoFocus
                  required
                  maxLength={120}
                />
              </label>
              <label className="create-field">
                <span>Note (optional)</span>
                <input
                  value={newPersonNote}
                  onChange={(e) => setNewPersonNote(e.target.value)}
                  maxLength={140}
                />
              </label>
              {personError ? (
                <p className="form-error" role="alert">
                  {personError}
                </p>
              ) : null}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPersonModalOpen(false)}
                  disabled={personSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="login-btn" disabled={personSaving}>
                  {personSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
