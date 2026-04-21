import { useEffect, useState } from 'react'

type Props = {
  src: string
  alt: string
  /** Shown while dimensions load (matches mobile 1:1 fallback). */
  fallbackAspect?: number
  loading?: 'lazy' | 'eager'
  className?: string
}

/**
 * Sizes the box to the image’s natural aspect ratio (no letterboxing/crop).
 * Same idea as `ray-mobile` `AspectFitImage`: portrait images get more vertical space.
 */
export function AspectFitImage({
  src,
  alt,
  fallbackAspect = 1,
  loading = 'lazy',
  className = '',
}: Props) {
  const [aspect, setAspect] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (w > 0 && h > 0) setAspect(w / h)
    }
    img.onerror = () => {}
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  const ar = aspect ?? fallbackAspect

  return (
    <div
      className={`aspect-fit-media ${className}`.trim()}
      style={{ aspectRatio: ar }}
    >
      <img src={src} alt={alt} loading={loading} decoding="async" />
    </div>
  )
}
