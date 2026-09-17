import "server-only";

import { CommandCenterDown } from "./commandcenter";

/**
 * The tentative weekly menu, read from the Command Center.
 *
 * The Command Center is the only place a menu is decided (`menu_plan.py`), and
 * it decides two things before anything reaches here:
 *
 *   1. the day is planned  — a protein and a carb have been chosen, and
 *   2. its week is published — Balaji pressed the button.
 *
 * A day failing either simply is not in the response. That is deliberate and it
 * is the whole safety property: this app can never show a customer a menu that
 * nobody chose. There is no fallback, no "probably chicken", no cached guess
 * from last week — an unplanned day renders as nothing at all.
 *
 * [LAW] Read-only, and public in the sense that every customer sees the same
 * menu. Unlike every other call in this app it takes no customer id, because
 * the menu is not per-customer — which also means nothing here can leak one
 * customer's data to another.
 */

export interface MenuItem {
  key: string;
  /** "Protein", "Lunch carb", "Veg of the day" … */
  label: string;
  name: string;
  emoji: string | null;
  /** The one-line description Balaji wrote for the dish, if any. */
  desc: string | null;
}

export interface MenuDay {
  date: string;
  weekday: string;
  /** "Mon 08 Sep" — formatted by the Command Center so both surfaces agree. */
  label: string;
  items: MenuItem[];
}

export interface MenuWeek {
  weekStart: string;
  published: boolean;
  note: string | null;
  days: MenuDay[];
}

function config() {
  const base = process.env.OG_API_BASE;
  const token = process.env.OG_API_TOKEN;
  if (!base || !token) return null;
  return { base: base.replace(/\/$/, ""), token };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toWeek(w: any): MenuWeek {
  return {
    weekStart: String(w?.week_start ?? ""),
    published: Boolean(w?.published),
    note: w?.note ?? null,
    days: Array.isArray(w?.days)
      ? w.days.map((d: any) => ({
          date: String(d?.date ?? ""),
          weekday: String(d?.weekday ?? ""),
          label: String(d?.label ?? ""),
          items: Array.isArray(d?.items)
            ? d.items.map((i: any) => ({
                key: String(i?.key ?? ""),
                label: String(i?.label ?? ""),
                name: String(i?.name ?? ""),
                emoji: i?.emoji ?? null,
                desc: i?.desc ?? null,
              }))
            : [],
        }))
      : [],
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * This week and next, in one call.
 *
 * Returns [] rather than throwing when the Command Center is asleep or the
 * tokens are unset. The menu is a nice-to-have on every screen it appears on —
 * a customer's meal count, deadlines and skip buttons must never fail to render
 * because the menu could not be fetched. Callers render nothing and the screen
 * is simply a little less rich.
 */
export async function fetchUpcomingMenu(startISO?: string): Promise<MenuWeek[]> {
  const cfg = config();
  if (!cfg) return [];
  const q = startISO ? `?start=${encodeURIComponent(startISO)}` : "";
  try {
    const response = await fetch(`${cfg.base}/api/v1/menu/upcoming${q}`, {
      headers: { "X-OG-Service-Token": cfg.token },
      signal: AbortSignal.timeout(8000),
      // A menu changes when Balaji edits it, which is rarely, but it must not
      // be stale for long when he does. A minute is short enough that a fix
      // reaches customers while he is still looking at the screen.
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new CommandCenterDown(`menu: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data?.weeks) ? data.weeks.map(toWeek) : [];
  } catch {
    return [];
  }
}

/** One day's menu, or null when it is not planned, not published, or unreachable. */
export async function fetchMenuDay(dateISO: string): Promise<MenuDay | null> {
  const weeks = await fetchUpcomingMenu(dateISO);
  for (const week of weeks) {
    const day = week.days.find((d) => d.date === dateISO);
    if (day) return day;
  }
  return null;
}

/** The headline of a day — what a customer actually wants to know at a glance. */
export function menuHeadline(day: MenuDay): string {
  const protein = day.items.find((i) => i.key === "protein");
  const carb = day.items.find((i) => i.key === "carb");
  return [protein?.name, carb?.name].filter(Boolean).join(" · ");
}
