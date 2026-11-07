export function formatManilaDateTime(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  }).format(date);
}

export function getManilaDateString(value = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (!year || !month || !day) throw new Error('Unable to format the Asia/Manila date.');
  return `${year}-${month}-${day}`;
}

export function getRaisingDay(startDate: string, at = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error(`Invalid rearing start date "${startDate}".`);
  const start = Date.parse(`${startDate}T00:00:00+08:00`);
  const today = Date.parse(`${getManilaDateString(at)}T00:00:00+08:00`);
  if (Number.isNaN(start)) throw new Error(`Invalid rearing start date "${startDate}".`);
  const days = Math.floor((today - start) / 86_400_000);
  return Math.max(0, Math.min(21, days));
}

export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
