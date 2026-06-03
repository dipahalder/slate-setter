export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Format raw dollars → "$110M" / "$1.4B" */
export function fmt(dollars: number): string {
  const m = dollars / 1_000_000;
  if (m >= 1000) return '$' + (m / 1000).toFixed(1) + 'B';
  if (m >= 100) return '$' + Math.round(m) + 'M';
  if (m >= 1) return '$' + m.toFixed(1) + 'M';
  return '$' + Math.round(dollars / 1000) + 'K';
}

/** Format a value already in $M */
export function fmtM(m: number): string {
  if (m == null || isNaN(m)) return '—';
  if (m >= 1000) return '$' + (m / 1000).toFixed(1) + 'B';
  if (m >= 100) return '$' + m.toFixed(0) + 'M';
  return '$' + m.toFixed(1) + 'M';
}

export function isoWeekToMonth(week: number): number {
  const boundaries = [4, 8, 12, 17, 21, 26, 30, 35, 39, 43, 47];
  const idx = boundaries.findIndex((b) => week <= b);
  return idx === -1 ? 11 : idx;
}

export function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function nextFriday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 5 ? 0 : (5 - day + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export function fmtShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function weekendLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const year = d.getFullYear();
  const ord = ['1st', '2nd', '3rd', '4th', '5th'][Math.ceil(d.getDate() / 7) - 1] ?? '';
  return `${month} ${year} / ${ord} weekend`;
}
