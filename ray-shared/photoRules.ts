export const AVATAR_MAX_PX = 600;
export const MOMENT_MAX_PX = 1600;
export const PHOTO_JPEG_QUALITY = 0.85;

export function fitImageDimensions(width: number, height: number, max: number) {
  if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('Could not read the photo dimensions.');
  }
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
