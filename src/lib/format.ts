/** "102.5" — up to 2 decimals, trailing zeros trimmed. */
export function formatWeightKg(weightKg: number): string {
  return String(Math.round(weightKg * 100) / 100);
}

/** Local date as YYYY-MM-DD. */
export function toISODay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseISODay(isoDay: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDay.split('-').map(Number);
  return { year, month, day };
}

/** "today", "1d ago", "3w ago", "2mo ago", "1y ago" relative to `now`. */
export function timeAgo(isoDay: string, now: Date): string {
  const { year, month, day } = parseISODay(isoDay);
  const then = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month) - (now.getDate() < day ? 1 : 0);

  if (days <= 0) return 'today';
  if (days < 7) return `${days}d ago`;
  if (months < 2) return `${Math.floor(days / 7)}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Jul 3" for the current year, "Jul 3, 2025" otherwise. */
export function formatDay(isoDay: string, now: Date): string {
  const { year, month, day } = parseISODay(isoDay);
  const base = `${MONTHS[month - 1]} ${day}`;
  return year === now.getFullYear() ? base : `${base}, ${year}`;
}
