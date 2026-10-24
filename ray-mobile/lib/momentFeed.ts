import type { Moment, MomentPhoto } from './api';

export const FEED_STALE_MS = 5 * 60_000;

export type MomentFeedChange =
  | { type: 'upsert'; moment: Moment }
  | { type: 'remove'; momentId: number }
  | { type: 'photo-upsert'; momentId: number; photo: MomentPhoto }
  | { type: 'photo-remove'; momentId: number; photoId: number };

const listeners = new Set<(change: MomentFeedChange) => void>();

export function subscribeToMomentFeed(listener: (change: MomentFeedChange) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishMomentFeedChange(change: MomentFeedChange) {
  for (const listener of listeners) listener(change);
}

function timestamp(value: string | null) {
  return value ? Date.parse(value) : Number.NEGATIVE_INFINITY;
}

export function applyMomentFeedChange(moments: Moment[], change: MomentFeedChange): Moment[] {
  if (change.type === 'upsert') {
    return [...moments.filter((moment) => moment.id !== change.moment.id), change.moment]
      .sort((a, b) =>
        b.date.localeCompare(a.date) ||
        timestamp(b.observed_at) - timestamp(a.observed_at) ||
        timestamp(b.created_at) - timestamp(a.created_at) ||
        b.id - a.id,
      );
  }
  if (change.type === 'remove') return moments.filter((moment) => moment.id !== change.momentId);
  return moments.map((moment) => {
    if (moment.id !== change.momentId) return moment;
    const photos = change.type === 'photo-remove'
      ? moment.photos.filter((photo) => photo.id !== change.photoId)
      : [...moment.photos.filter((photo) => photo.id !== change.photo.id), change.photo]
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    return { ...moment, photos };
  });
}

/** Replay confirmed writes over a response that may have started before them. */
export function reconcileMomentFeed(moments: Moment[], changes: MomentFeedChange[]) {
  return changes.reduce(applyMomentFeedChange, moments);
}
