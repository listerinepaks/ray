/** Keep signed S3 URLs for the same file in the same image-cache entry. */
export function imageCacheKey(uri: string): string {
  try {
    const url = new URL(uri);
    const keys = [...url.searchParams.keys()];
    const isSigned = keys.some((key) => key.toLowerCase() === 'x-amz-signature') ||
      (url.searchParams.has('AWSAccessKeyId') && url.searchParams.has('Signature'));
    if (!isSigned) return uri;

    for (const key of keys) {
      if (/^x-amz-/i.test(key) || ['AWSAccessKeyId', 'Signature', 'Expires'].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    // Preserve other parameters, including object versions and image transformations.
    return url.toString();
  } catch {
    return uri;
  }
}

const aspectRatios = new Map<string, number>();
const MAX_ASPECT_RATIOS = 300;

export function cachedImageAspect(uri: string): number | undefined {
  return aspectRatios.get(imageCacheKey(uri));
}

export function rememberImageAspect(uri: string, width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const key = imageCacheKey(uri);
  aspectRatios.delete(key);
  aspectRatios.set(key, width / height);
  if (aspectRatios.size > MAX_ASPECT_RATIOS) {
    aspectRatios.delete(aspectRatios.keys().next().value!);
  }
}
