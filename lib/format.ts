import type { Component } from "./types";

const IST = "Asia/Kolkata";

export function parseISO(iso: string): Date {
  // Midday avoids any chance of a timezone shift moving the date.
  return new Date(`${iso}T12:00:00`);
}

export function dayName(iso: string, long = false): string {
  return parseISO(iso).toLocaleDateString("en-GB", {
    weekday: long ? "long" : "short",
    timeZone: IST,
  });
}

/** "Fri 2 Aug" */
export function shortDate(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: IST,
  });
}

/** "2 August" */
export function longDate(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: IST,
  });
}

/** "Today", "Tomorrow", or the weekday. */
export function relativeDay(iso: string, todayISO: string): string {
  if (iso === todayISO) return "Today";
  const diff = Math.round(
    (parseISO(iso).getTime() - parseISO(todayISO).getTime()) / 86_400_000,
  );
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return dayName(iso, true);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: IST });
}

/** "100g", "2 pcs", "1 serving" — matches menu.fmt_qty exactly. */
export function formatQty(qty: number, unit: string): string {
  const n = Number.isInteger(qty) ? qty : Math.round(qty * 100) / 100;
  if (unit === "g") return `${n}g`;
  if (unit === "pcs") return `${n} pc${n !== 1 ? "s" : ""}`;
  return `${n} serving${n !== 1 ? "s" : ""}`;
}

export function componentLabel(c: Component): string {
  return `${c.name} ${formatQty(c.qty, c.unit)}`.trim();
}

export function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
