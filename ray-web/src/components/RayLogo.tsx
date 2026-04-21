import wordmarkUrl from '../../../visual/ray.png'

type Props = {
  className?: string
}

export function RayLogo({ className = '' }: Props) {
  return (
    <img
      src={wordmarkUrl}
      alt="Ray"
      className={`ray-logo ${className}`.trim()}
      decoding="async"
    />
  )
}
