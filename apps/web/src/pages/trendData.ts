import type { Reading } from '@hydrosense/shared';

export function prepareTrendRows(readings: Reading[]) {
  const rows = [...readings].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return { rows, chartRows: rows.map((row) => ({ ...row, timestamp: Date.parse(row.timestamp) })) };
}

export function trendMarkerIndices(values: number[]) {
  if (!values.length) return [];
  return [...new Set([values.indexOf(Math.min(...values)), values.indexOf(Math.max(...values)), values.length - 1])];
}

export function nightRanges(rows: Reading[]) {
  if (!rows.length) return [];
  const start = new Date(rows[0].timestamp);
  const end = new Date(rows[rows.length - 1].timestamp);
  const ranges: Array<{ x1: number; x2: number }> = [];
  for (let day = -1; day <= 22; day += 1) {
    const date = new Date(start.getTime() + day * 86_400_000);
    const localDate = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const x1 = Date.parse(`${localDate}T22:00:00+08:00`);
    const next = new Date(Date.parse(`${localDate}T00:00:00+08:00`) + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const x2 = Date.parse(`${next}T06:00:00+08:00`);
    if (x2 >= start.getTime() && x1 <= end.getTime()) ranges.push({ x1, x2 });
  }
  return ranges;
}
