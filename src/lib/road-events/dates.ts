/** Calendar date in Asia/Taipei as YYYY-MM-DD. */
export function taipeiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function fromParts(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Accepts ISO dates, ROC `115/10/30`, compact `1151030`, and ROC datetimes `11510302100`.
 */
export function parseTaiwanDate(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return fromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const slashed = /^(\d{2,3})\/(\d{1,2})\/(\d{1,2})/.exec(text);
  if (slashed) {
    return fromParts(Number(slashed[1]) + 1911, Number(slashed[2]), Number(slashed[3]));
  }
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 7) {
    return fromParts(
      Number(digits.slice(0, 3)) + 1911,
      Number(digits.slice(3, 5)),
      Number(digits.slice(5, 7)),
    );
  }
  return null;
}

export function dateInWindow(
  today: string,
  start: string | null,
  end: string | null,
): boolean {
  if (!start || !end) return false;
  return start <= today && today <= end;
}
