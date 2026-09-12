const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcDate(value: string): Date {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new Error("Expected an ISO date (YYYY-MM-DD)");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new Error("Invalid ISO date");
  return date;
}

export function toUtcStorageTimestamp(value: Date | string | number): string {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid timestamp");
  return date.toISOString();
}

/** Inclusive ISO dates become an inclusive start and exclusive end range. */
export function utcDateRange(from: string, through: string = from): { start: Date; end: Date } {
  const start = utcDate(from);
  const end = utcDate(through);
  if (end < start) throw new Error("Date range ends before it starts");
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function reportDateKey(value: Date | string | number, timeZone = "Asia/Manila"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid timestamp");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}
