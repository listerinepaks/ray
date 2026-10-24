import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  clampHeart, heartBounds, heartParticles, heartSize, LOVE_CELEBRATION_MS,
  LOVE_HEART, nextHeartPosition,
} from '../../../ray-shared/loveHeart'
import './FloatingLoveHeart.css'

type Phase = 'playing' | 'celebrating' | 'cooldown'
const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight })

export function FloatingLoveHeart() {
  const [viewport, setViewport] = useState(viewportSize)
  const [phase, setPhase] = useState<Phase>('playing')
  const [taps, setTaps] = useState(0)
  const tapCount = useRef(0)
  const [point, setPoint] = useState(() => {
    const bounds = heartBounds(window.innerWidth, window.innerHeight, 0)
    return { x: bounds.maxX, y: bounds.maxY }
  })
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  const { width, height } = viewport

  useEffect(() => {
    const resize = () => setViewport(viewportSize())
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (phase === 'playing') return
    const timer = setTimeout(() => {
      if (phase === 'celebrating') {
        setPhase('cooldown')
      } else {
        const bounds = heartBounds(width, height, 0)
        tapCount.current = 0
        setTaps(0)
        setPoint({ x: bounds.maxX, y: bounds.maxY })
        setPhase('playing')
      }
    }, phase === 'celebrating' ? LOVE_CELEBRATION_MS : LOVE_HEART.cooldownMs)
    return () => clearTimeout(timer)
  }, [phase, width, height])

  function tapHeart(event: MouseEvent<HTMLButtonElement>) {
    if (tapCount.current >= LOVE_HEART.taps) return
    const next = ++tapCount.current
    setTaps(next)
    const rect = event.currentTarget.getBoundingClientRect()
    if (next === LOVE_HEART.taps) {
      setOrigin({ x: rect.left + rect.width / 2 - width / 2, y: rect.top + rect.height / 2 - height / 2 })
      setPhase('celebrating')
    } else {
      setPoint(nextHeartPosition(heartBounds(width, height, next), { x: rect.left, y: rect.top }))
    }
  }

  const size = heartSize(taps)
  const box = Math.max(44, size + 12)
  const position = clampHeart(point, heartBounds(width, height, taps))
  const finaleStyle = {
    '--heart-color': LOVE_HEART.color,
    '--heart-wash': LOVE_HEART.backdrop,
    '--heart-origin-x': origin.x + 'px',
    '--heart-origin-y': origin.y + 'px',
    '--heart-scale': Math.max(1, Math.min(width * 0.8, height * 0.65) / heartSize(4)),
    '--heart-duration': LOVE_CELEBRATION_MS + 'ms',
    '--heart-burst-delay': LOVE_HEART.growMs + LOVE_HEART.beatMs * 2 + 'ms',
    '--heart-burst-duration': LOVE_HEART.burstMs + 'ms',
  } as CSSProperties

  return (
    <>
      {phase === 'playing' ? (
        <button type="button" className="love-heart-catcher" onClick={tapHeart}
          aria-label={'Love heart, ' + taps + ' of ' + LOVE_HEART.taps + ' taps'}
          title="Catch the heart five times for a surprise"
          style={{ left: position.x, top: position.y, width: box, height: box, fontSize: size, color: LOVE_HEART.color }}>
          <span key={taps} className="love-heart-glyph" aria-hidden>♥</span>
        </button>
      ) : null}
      {phase === 'celebrating' ? createPortal(
        <div className="love-heart-celebration" style={finaleStyle} aria-hidden>
          <div className="love-heart-wash" />
          <span className="love-heart-hero">♥</span>
          {heartParticles(width, height).map((particle, index) => (
            <span key={index} className="love-heart-particle" style={{
              fontSize: particle.size,
              '--heart-dx': particle.x + 'px',
              '--heart-dy': particle.y + 'px',
              '--heart-turn': particle.rotation + 'deg',
            } as CSSProperties}>♥</span>
          ))}
        </div>, document.body,
      ) : null}
      {phase === 'celebrating' ? <span className="sr-only" role="status">Love everywhere!</span> : null}
    </>
  )
}
