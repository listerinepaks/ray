import { Image } from 'expo-image';

export const MEMORY_DISK_CACHE_POLICY = 'memory-disk' as const;

const requestedPrefetchUris = new Set<string>();

export function prefetchImageUris(uris: Array<string | null | undefined>) {
  const nextUris = uris.filter((uri): uri is string => Boolean(uri));
  const uniqueUris = [...new Set(nextUris)].filter((uri) => !requestedPrefetchUris.has(uri));
  if (!uniqueUris.length) return;

  for (const uri of uniqueUris) requestedPrefetchUris.add(uri);

  void Image.prefetch(uniqueUris, { cachePolicy: MEMORY_DISK_CACHE_POLICY })
    .then((ok) => {
      if (ok) return;
      for (const uri of uniqueUris) requestedPrefetchUris.delete(uri);
    })
    .catch(() => {
      for (const uri of uniqueUris) requestedPrefetchUris.delete(uri);
    });
}
