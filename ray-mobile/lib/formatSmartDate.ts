/**
 * Calendar date from API (YYYY-MM-DD) → short display:
 * Today, Yesterday, 2d…7d, then "Mar 21" in the current year, else "Dec 18, 2025".
 */
const DAY_MS = 86_400_000;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function calendarDayDiff(target: Date, reference = new Date()): number {
  return Math.round((startOfLocalDay(reference).getTime() - startOfLocalDay(target).getTime()) / DAY_MS);
}

function formatShortCalendarDate(d: Date, reference = new Date()): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== reference.getFullYear()) opts.year = 'numeric';
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

function formatClockTime(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(d);
}

export function formatSmartDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate;
  const [y, mo, d] = parts;
  const target = new Date(y, mo - 1, d);
  const today = new Date();
  const diffDays = calendarDayDiff(target, today);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays >= 2 && diffDays <= 7) return `${diffDays}d`;

  if (diffDays < 0) {
    const ahead = Math.abs(diffDays);
    if (ahead === 1) return 'Tomorrow';
    if (ahead <= 7) return `in ${ahead}d`;
  }

  return formatShortCalendarDate(target, today);
}

export function formatSmartDateTime(isoDateTime: string): string {
  const target = new Date(isoDateTime);
  if (Number.isNaN(target.getTime())) return '';

  const time = formatClockTime(target);
  const today = new Date();
  const diffDays = calendarDayDiff(target, today);

  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;
  if (diffDays >= 2 && diffDays <= 7) return `${diffDays}d ago at ${time}`;

  if (diffDays < 0) {
    const ahead = Math.abs(diffDays);
    if (ahead === 1) return `Tomorrow at ${time}`;
    if (ahead <= 7) return `in ${ahead}d at ${time}`;
  }

  return `${formatShortCalendarDate(target, today)} at ${time}`;
}

export function formatSmartTimestamp(isoDateTime: string): string {
  const target = new Date(isoDateTime);
  if (Number.isNaN(target.getTime())) return '';

  const diffMs = Date.now() - target.getTime();
  if (diffMs >= 0) {
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
  }

  return formatSmartDateTime(isoDateTime);
}
