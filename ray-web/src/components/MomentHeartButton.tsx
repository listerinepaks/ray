import { useEffect, useRef, useState } from 'react'
import { addMomentHeart, type Moment } from '../api'
import { canHeartMoment } from '../../../ray-shared/momentHeart'

type Props = {
  moment: Pick<Moment, 'id' | 'my_access' | 'reactions_count'>
  userId: number
  onCountChange: (momentId: number, count: number) => void
}

export function MomentHeartButton({ moment, userId, onCountChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [hearted, setHearted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const mounted = useRef(true)
  const allowed = canHeartMoment(moment.my_access)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function addHeart() {
    if (!allowed || pending.current || hearted) return
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      const count = await addMomentHeart(moment.id, userId)
      if (mounted.current) {
        onCountChange(moment.id, count)
        setHearted(true)
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not add heart. Try again.')
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <div>
      <button type="button" className="moment-heart-button" onClick={() => { void addHeart() }}
        disabled={!allowed || busy || hearted} aria-busy={busy}
        aria-label={(busy ? 'Adding heart' : hearted ? 'Heart added' : 'Add heart') + ', ' + (moment.reactions_count ?? 0) + ' reactions'}
        title={!allowed ? 'You have view-only access to this moment' : hearted ? 'Heart added' : 'Add a heart'}>
        <span aria-hidden>{hearted ? '♥' : '♡'}</span>
        <span className="moment-card-activity-count">{moment.reactions_count ?? 0}</span>
      </button>
      {error ? <p className="moment-heart-error" role="alert">{error}</p> : null}
    </div>
  )
}
