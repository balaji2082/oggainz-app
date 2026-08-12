import "server-only";

import { liveAvailable, loadCustomer, type CustomerData } from "./live";
import {
  getCustomer,
  getInvoices,
  getMeals,
  getPacks,
  getSettings,
  todayISO,
} from "./snapshot";
import type { Meal } from "./types";
import { deadlines as fetchDeadlines, type Deadline } from "./writes";

/**
 * One door to the customer's data, whichever side it comes from.
 *
 *   live      — the Command Center API, when OG_API_BASE + OG_API_TOKEN are set.
 *               This is what a deployed app uses; a snapshot file cannot travel
 *               to a server.
 *   snapshot  — a local copy of the SQLite file. Laptop only, and the reason the
 *               app could be built before any of the plumbing existed.
 *
 * The pages call this and never learn which one answered. That is the seam from
 * docs/03 §1 doing its job: when the engine moves to Postgres at cutover, this
 * file changes and nothing in front of it does.
 */

export type { CustomerData };

export function usingLiveData(): boolean {
  return liveAvailable();
}

export async function getCustomerData(customerId: string): Promise<CustomerData> {
  if (liveAvailable()) return loadCustomer(customerId);

  // Local mode. The snapshot reader is synchronous and already returns the
  // right shapes, so this is just an adapter.
  const today = todayISO();
  const day = 86400000;
  const iso = (d: number) => new Date(Date.parse(today) + d * day).toISOString().slice(0, 10);
  return {
    customer: getCustomer(customerId),
    packs: getPacks(customerId),
    meals: getMeals(customerId, iso(-90), iso(21)),
    invoices: getInvoices(customerId),
    settings: getSettings(),
    stale: false,
    asOf: null,
  };
}

// --- shared derivations, so every screen agrees ------------------------------
// These used to live in the snapshot reader. They belong here instead: they are
// the same arithmetic regardless of where the rows came from, and duplicating
// them per data source is how two screens start disagreeing about "today".

export type MealPlus = Meal & { expected?: boolean };

export function mealsOn(data: CustomerData, dateISO: string): MealPlus[] {
  return (data.meals as MealPlus[]).filter((m) => m.date === dateISO && !m.expected);
}

export function mealsBefore(data: CustomerData, dateISO: string): MealPlus[] {
  return (data.meals as MealPlus[])
    .filter((m) => m.date < dateISO && !m.expected)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function mealsAfter(data: CustomerData, dateISO: string, limit?: number): MealPlus[] {
  const out = (data.meals as MealPlus[])
    .filter((m) => m.date > dateISO)
    .sort((a, b) => (a.date > b.date ? 1 : -1));
  return typeof limit === "number" ? out.slice(0, limit) : out;
}

export function isOperatingDay(data: CustomerData, dateISO: string): boolean {
  // JS weeks start on Sunday; the Command Center counts Monday as 0.
  const weekday = (new Date(`${dateISO}T00:00:00`).getDay() + 6) % 7;
  return data.settings.operatingWeekdays.includes(weekday);
}

export { todayISO };

/**
 * Server-computed deadlines for a window of days (docs/02 §7.5 — never a
 * client-side timer). Supplementary to the read above: if it can't be
 * reached — offline, or simply not deployed there yet — the screen shows no
 * countdown rather than failing to load. `getCustomerData` already carries its
 * own honest stale/offline state for the data that actually matters.
 *
 * Deliberately swallows EVERY failure, not just CommandCenterDown: a 404
 * because this endpoint hasn't reached that Command Center yet is a
 * `WriteRefused`, not a `CommandCenterDown`, and a rollout ordering detail is
 * not a reason to take the whole page down. Skip/pause themselves are never
 * this forgiving — only the decorative countdown is.
 */
export async function getDeadlines(
  customerId: string,
  from: string,
  to: string
): Promise<{ serverNow: string | null; days: Record<string, Deadline> }> {
  if (!liveAvailable()) return { serverNow: null, days: {} };
  try {
    return await fetchDeadlines(customerId, from, to);
  } catch {
    return { serverNow: null, days: {} };
  }
}
