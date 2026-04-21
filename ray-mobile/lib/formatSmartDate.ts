/**
 * Calendar date from API (YYYY-MM-DD) → short display:
 * Today, Yesterday, 2d…7d, then "Mar 21" in the current year, else "Dec 18, 2025".
 */
export function formatSmartDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate;
  const [y, mo, d] = parts;
  const target = new Date(y, mo - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays >= 2 && diffDays <= 7) return `${diffDays}d`;

  if (diffDays < 0) {
    const ahead = Math.abs(diffDays);
    if (ahead === 1) return 'Tomorrow';
    if (ahead <= 7) return `in ${ahead}d`;
  }

  const currentYear = today.getFullYear();
  if (y === currentYear) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(target);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(target);
}
