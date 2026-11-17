// Date and money helpers. Dates from Postgres `date` columns arrive as "YYYY-MM-DD"
// and are treated as calendar days (no timezone shifting).

const MS_DAY = 86_400_000;

export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayString(now: Date = new Date()): string {
  // Local calendar day for the person using the app.
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(day: string, n: number): string {
  return toDayString(new Date(parseDay(day).getTime() + n * MS_DAY));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / MS_DAY);
}

/** Every calendar day from start to end inclusive. Empty if either is missing. */
export function tripDays(start: string | null, end: string | null): string[] {
  if (!start || !end) return [];
  const n = daysBetween(start, end);
  if (n < 0 || n > 366) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

export function formatDay(day: string | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!day) return "";
  return parseDay(day).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...opts,
  });
}

export function formatDayLong(day: string | null): string {
  return formatDay(day, { weekday: "long", month: "long", day: "numeric" });
}

export function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Dates not set";
  if (start && !end) return `From ${formatDay(start, { weekday: undefined, year: "numeric" })}`;
  if (!start && end) return `Until ${formatDay(end, { weekday: undefined, year: "numeric" })}`;
  if (start === end) return formatDay(start, { weekday: "short", year: "numeric" });
  const s = parseDay(start!);
  const e = parseDay(end!);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const left = formatDay(start, { weekday: undefined, year: sameYear ? undefined : "numeric" });
  const right = formatDay(end, { weekday: undefined, year: "numeric" });
  return `${left} – ${right}`;
}

/** "14:30:00" -> "2:30 PM" */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

/** Local timestamp without zone ("2027-10-20T15:05:00") -> parts. */
export function splitLocal(ts: string | null): { day: string | null; time: string | null } {
  if (!ts) return { day: null, time: null };
  const [day, time] = ts.replace(" ", "T").split("T");
  return { day: day ?? null, time: time ? time.slice(0, 8) : null };
}

export function formatMoney(amount: number | null | undefined, currency = "USD", compact = false): string {
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: compact || Number.isInteger(n) ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function countdown(start: string | null, end: string | null, now: Date = new Date()) {
  const today = todayString(now);
  if (!start) return { phase: "undated" as const, days: 0 };
  const toStart = daysBetween(today, start);
  if (toStart > 0) return { phase: "before" as const, days: toStart };
  if (end && daysBetween(today, end) >= 0) {
    return { phase: "during" as const, days: daysBetween(start, today) + 1, total: daysBetween(start, end) + 1 };
  }
  return { phase: "after" as const, days: end ? daysBetween(end, today) : -toStart };
}

export function initials(name: string | null | undefined): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function hostname(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Accepts "example.com" and returns "https://example.com". */
export function normalizeUrl(input: string | null | undefined): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export function uid(prefix = "b"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}
