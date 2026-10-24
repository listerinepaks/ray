export const LOVE_HEART = {
  taps: 5,
  sizes: [32, 48, 68, 92, 124],
  color: '#c94b6a',
  backdrop: '#fff3f6',
  hopMs: 280,
  growMs: 460,
  beatMs: 180,
  burstMs: 1050,
  cooldownMs: 12_000,
} as const;

export const LOVE_CELEBRATION_MS = LOVE_HEART.growMs + LOVE_HEART.beatMs * 2 + LOVE_HEART.burstMs;
export type HeartPoint = { x: number; y: number };
export type HeartBounds = { minX: number; maxX: number; minY: number; maxY: number };

export function heartSize(taps: number) {
  return LOVE_HEART.sizes[Math.max(0, Math.min(4, taps))];
}

export function heartBounds(
  width: number, height: number, taps: number,
  insets = { top: 0, right: 0, bottom: 0, left: 0 },
): HeartBounds {
  const box = Math.max(44, heartSize(taps) + 12);
  const minX = Math.min(insets.left + 16, Math.max(0, width - box));
  const maxX = Math.max(minX, width - insets.right - 16 - box);
  const maxY = Math.max(0, height - insets.bottom - 112 - box);
  const minY = Math.min(insets.top + 96, maxY);
  return { minX, maxX, minY, maxY };
}

export function clampHeart(point: HeartPoint, bounds: HeartBounds): HeartPoint {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  };
}

export function nextHeartPosition(bounds: HeartBounds, previous: HeartPoint, random = Math.random): HeartPoint {
  const candidates = [
    { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY }, { x: bounds.maxX, y: bounds.maxY },
    { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
  ];
  const distance = (point: HeartPoint) => Math.hypot(point.x - previous.x, point.y - previous.y);
  const farthest = Math.max(...candidates.map(distance));
  const choices = candidates.filter((point) => distance(point) >= farthest * 0.65);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

export function heartParticles(width: number, height: number) {
  return Array.from({ length: 18 }, (_, index) => {
    const angle = index / 18 * Math.PI * 2;
    return {
      x: Math.cos(angle) * Math.min(width * 0.62, 420),
      y: Math.sin(angle) * Math.min(height * 0.3, 280) - 120,
      size: 16 + index % 4 * 6,
      rotation: (index % 2 ? 1 : -1) * (15 + index * 3),
    };
  });
}
