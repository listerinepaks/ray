import type { Moment } from './types';

export type FeedTab = 'all' | 'looking_ahead' | 'friends' | 'mentions';

type Viewer = {
  userId?: number;
  personId?: number | null;
  friendUserIds: ReadonlySet<number>;
};

function apiDateLocalTime(date: string): number {
  const parts = date.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return Number.NaN;
  const [year, month, day] = parts;
  return new Date(year!, month! - 1, day!).getTime();
}

export function isUpcomingLookingAhead(moment: Moment, reference = new Date()): boolean {
  if (moment.moment_type !== 'looking_ahead') return false;
  const dateTime = apiDateLocalTime(moment.date);
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
  return !Number.isNaN(dateTime) && dateTime >= today;
}

export function compareLookingAheadMoments(a: Moment, b: Moment, reference = new Date()): number {
  const aUpcoming = isUpcomingLookingAhead(a, reference);
  const bUpcoming = isUpcomingLookingAhead(b, reference);
  if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
  const aTime = apiDateLocalTime(a.date);
  const bTime = apiDateLocalTime(b.date);
  const safeATime = Number.isNaN(aTime) ? Number.NEGATIVE_INFINITY : aTime;
  const safeBTime = Number.isNaN(bTime) ? Number.NEGATIVE_INFINITY : bTime;
  if (aUpcoming && bUpcoming) return safeATime - safeBTime || a.id - b.id;
  return safeBTime - safeATime || b.id - a.id;
}

export function selectFeedMoments(moments: Moment[], tab: FeedTab, viewer: Viewer, reference = new Date()): Moment[] {
  if (tab === 'looking_ahead') {
    return moments.filter((m) => m.moment_type === 'looking_ahead')
      .sort((a, b) => compareLookingAheadMoments(a, b, reference));
  }
  if (tab === 'friends') return moments.filter((m) => viewer.friendUserIds.has(m.author));
  if (tab === 'mentions') {
    return moments.filter((m) => m.tagged_people.some((p) =>
      (viewer.userId != null && p.linked_user === viewer.userId) ||
      (viewer.personId != null && p.id === viewer.personId),
    ));
  }
  return moments;
}

export function selectUpcomingMoments(moments: Moment[], reference = new Date()): Moment[] {
  return moments.filter((m) => isUpcomingLookingAhead(m, reference))
    .sort((a, b) => apiDateLocalTime(a.date) - apiDateLocalTime(b.date) || a.id - b.id);
}

export function selectTimelineMoments(moments: Moment[], tab: FeedTab, reference = new Date()): Moment[] {
  if (tab !== 'all') return moments;
  return moments.filter((m) => !isUpcomingLookingAhead(m, reference));
}
