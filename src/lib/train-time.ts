const DEFAULT_TZ = "Asia/Kolkata";
const DEBUG = false;

export function formatLocalTimeFromISO(iso?: string | null, tz: string = DEFAULT_TZ): string {
  if (!iso) return "--";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    }).format(d);
  } catch {
    return String(iso);
  }
}

export function parseMinutesAny(v: any): number {
  const m = String(v ?? "").match(/-?\d+/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function formatMinutesToClock(
  minutesInput: any,
): { time: string; dayOffset: number; minutesOfDay: number } {
  const total = typeof minutesInput === "number" ? minutesInput : parseMinutesAny(minutesInput);
  if (!Number.isFinite(total)) return { time: "--", dayOffset: 0, minutesOfDay: 0 };
  const day = 1440;
  const dayOffset = Math.floor(total / day);
  let mod = total % day;
  if (mod < 0) mod += day;
  const h24 = Math.floor(mod / 60) % 24;
  const m2 = mod % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const time = `${String(h12).padStart(2, "0")}:${String(m2).padStart(2, "0")} ${ampm}`;
  return { time, dayOffset, minutesOfDay: mod };
}

export function formatMinutesToClockString(minutesInput: any): string {
  const { time, dayOffset } = formatMinutesToClock(minutesInput);
  if (time === "--") return "--";
  if (dayOffset > 0) return `${time} (+${dayOffset} day${dayOffset > 1 ? "s" : ""})`;
  if (dayOffset < 0) return `${time} (${dayOffset} day)`;
  return time;
}

export function resolveRouteEventTime(opts: {
  current_day?: any;
  minutes?: any;
}): string {
  const { time, dayOffset } = formatMinutesToClock(opts.minutes ?? 0);
  const baseDay = parseMinutesAny(opts.current_day ?? 0);
  const effectiveDay = baseDay + dayOffset;
  if (time === "--") return "--";
  if (effectiveDay > baseDay) return `${time} (+${effectiveDay - baseDay} day${effectiveDay - baseDay > 1 ? "s" : ""})`;
  if (effectiveDay < baseDay) return `${time} (${effectiveDay - baseDay} day)`;
  return time;
}

export function formatRelativeUpdateTime(iso?: string | null, tz: string = DEFAULT_TZ): string {
  if (!iso) return "--";
  try {
    const t = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - t);
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  } catch {
    return formatLocalTimeFromISO(iso, tz);
  }
}

export function debugTimeSample(label: string, data: {
  iso?: string | null;
  minutes?: any;
  current_day?: any;
}) {
  if (!DEBUG) return;
  try {
    const localFromIso = data.iso ? formatLocalTimeFromISO(data.iso) : "--";
    const mFmt = formatMinutesToClockString(data.minutes);
    const routeFmt = resolveRouteEventTime({ current_day: data.current_day, minutes: data.minutes });
    const nowLocal = formatLocalTimeFromISO(new Date().toISOString());
    // eslint-disable-next-line no-console
    console.log("[TIME DEBUG]", label, {
      iso: data.iso,
      localFromIso,
      minutes: data.minutes,
      minutesFmt: mFmt,
      routeFmt,
      nowLocal,
    });
  } catch {}
}

