import "server-only";

import { sql } from "./accounts";
import { CommandCenterDown } from "./commandcenter";
import type {
  Component,
  Customer,
  Invoice,
  Meal,
  Pack,
  PackStatus,
  PublicSettings,
  Slot,
} from "./types";

/**
 * Everything a customer's screens need, read live from the Command Center.
 *
 * This is the second implementation of the seam in lib/types.ts — the first
 * being lib/snapshot.ts, which reads a copy of the SQLite file and only works
 * on the laptop. Same types out, so no component changes.
 *
 * ONE ROUND TRIP PER SCREEN, NOT SIX. Everything is fetched together and cached
 * as a single payload, because the Command Center is a single free worker that
 * sleeps: six sequential calls to a waking server is the difference between a
 * page that loads and a page that times out.
 *
 * [LAW] docs/03 §6 — when it cannot be reached, the last copy is served WITH
 * its age. Never silently, and never presented as current.
 */

const FRESH_MINUTES = 5;

export interface CustomerData {
  customer: Customer | null;
  packs: Pack[];
  meals: Meal[];
  invoices: Invoice[];
  settings: PublicSettings;
  /** True when this came from a copy that could not be refreshed just now. */
  stale: boolean;
  /** Present only when stale. Show it — do not hide it. */
  asOf: Date | null;
}

const FALLBACK_SETTINGS: PublicSettings = {
  cutoffTime: "18:00",
  operatingWeekdays: [0, 1, 2, 3, 4],
  lunchWindow: "11:00-13:45",
  dinnerWindow: "17:30-20:00",
};

function config() {
  const base = process.env.OG_API_BASE;
  const token = process.env.OG_API_TOKEN;
  if (!base || !token) return null;
  return { base: base.replace(/\/$/, ""), token };
}

/** True when the app is configured to read live rather than from a local copy. */
export function liveAvailable(): boolean {
  return config() !== null;
}

async function get<T>(path: string): Promise<T> {
  const cfg = config();
  if (!cfg) throw new CommandCenterDown("OG_API_BASE / OG_API_TOKEN are not set");
  let response: Response;
  try {
    response = await fetch(`${cfg.base}${path}`, {
      headers: { "X-OG-Service-Token": cfg.token },
      // Generous, because a sleeping free worker takes a few seconds to wake —
      // but bounded, because a customer staring at a spinner is worse than a
      // clearly-labelled old reading.
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch (cause) {
    throw new CommandCenterDown((cause as Error).message);
  }
  if (!response.ok) {
    throw new CommandCenterDown(`Command Center answered ${response.status}`);
  }
  return (await response.json()) as T;
}

// --- shaping the API's answers into the app's types -------------------------

function asSlot(v: unknown): Slot {
  return String(v) === "Dinner" ? "Dinner" : "Lunch";
}

interface ApiComponent {
  name: string; qty: number; unit: string; display: string;
  emoji: string | null; protein: string | null; note: string | null;
}

function toComponents(list: ApiComponent[] | undefined, kind: "base" | "addon"): Component[] {
  return (list ?? []).map((c) => ({
    name: c.name, qty: c.qty, unit: c.unit, emoji: c.emoji,
    protein: c.protein, kind, note: c.note,
  }));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toPack(p: any): Pack {
  return {
    id: String(p.id),
    planName: String(p.plan ?? "Meal pack"),
    duration: p.duration ?? null,
    slot: asSlot(p.slot),
    status: String(p.status ?? "Active") as PackStatus,
    startDate: p.start_date ?? null,
    mealsTotal: Number(p.meals_total ?? 0),
    delivered: Number(p.meals_delivered ?? 0),
    remaining: Number(p.meals_remaining ?? 0),
    skipped: Number(p.meals_skipped ?? 0),
    components: [
      ...toComponents(p.composition?.base, "base"),
      ...toComponents(p.composition?.addons, "addon"),
    ],
    notes: null,
    pausedToday: Boolean(p.paused),
    pause: p.paused
      ? { start: p.start_date ?? "", end: p.paused_until ?? null, reason: null }
      : null,
    validity: {
      enforced: Boolean(p.validity_enforced),
      expiresOn: p.expires_on ?? null,
      daysLeft: p.validity_days_left ?? null,
    },
  };
}

function toMeal(m: any, index: number): Meal & { expected: boolean } {
  return {
    // Projected days have no row and therefore no id; index keeps React keys
    // unique without inventing an id that looks real.
    id: Number(m.id ?? -(index + 1)),
    date: String(m.date),
    slot: asSlot(m.slot),
    status: (m.projected ? "Pending" : (m.status ?? "Pending")) as Meal["status"],
    packId: m.subscription_id ?? null,
    planName: m.plan ?? null,
    dayNote: m.note ?? null,
    isTrial: false,
    expected: Boolean(m.projected),
  };
}

function toInvoice(i: any): Invoice {
  return {
    id: String(i.id),
    token: i.url ? String(i.url).split("/").pop() ?? null : null,
    date: i.date ?? null,
    total: Number(i.total ?? 0),
    received: Number(i.received ?? 0),
    paymentStatus: String(i.payment_status ?? "Unpaid"),
  };
}

function toSettings(s: any): PublicSettings {
  if (!s) return FALLBACK_SETTINGS;
  const [lunch, dinner] = [s.delivery_promise_lunch, s.delivery_promise_dinner];
  return {
    cutoffTime: s.skip_cutoff_time ?? FALLBACK_SETTINGS.cutoffTime,
    operatingWeekdays: Array.isArray(s.operating_weekdays)
      ? s.operating_weekdays.map(Number)
      : FALLBACK_SETTINGS.operatingWeekdays,
    lunchWindow: lunch ?? FALLBACK_SETTINGS.lunchWindow,
    dinnerWindow: dinner ?? FALLBACK_SETTINGS.dinnerWindow,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- fetching + caching -----------------------------------------------------

function windowDates(): { from: string; to: string } {
  const day = 86400000;
  const iso = (d: number) => new Date(Date.now() + d * day).toISOString().slice(0, 10);
  return { from: iso(-90), to: iso(21) };
}

async function fetchAll(customerId: string): Promise<Omit<CustomerData, "stale" | "asOf">> {
  const { from, to } = windowDates();
  const id = encodeURIComponent(customerId);

  // In parallel: one slow call is the floor, not the sum of five.
  const [customer, packs, meals, invoices, settings] = await Promise.all([
    get<{ customer: any }>(`/api/v1/customer/${id}`).catch(() => null),          // eslint-disable-line @typescript-eslint/no-explicit-any
    get<{ packs: any[] }>(`/api/v1/customer/${id}/packs`),                       // eslint-disable-line @typescript-eslint/no-explicit-any
    get<{ meals: any[] }>(`/api/v1/customer/${id}/meals?from=${from}&to=${to}`), // eslint-disable-line @typescript-eslint/no-explicit-any
    get<{ invoices: any[] }>(`/api/v1/customer/${id}/invoices`).catch(() => ({ invoices: [] })), // eslint-disable-line @typescript-eslint/no-explicit-any
    get<{ settings: any }>(`/api/v1/settings/public`).catch(() => null),         // eslint-disable-line @typescript-eslint/no-explicit-any
  ]);

  return {
    customer: customer?.customer
      ? {
          id: String(customer.customer.id),
          name: String(customer.customer.name ?? "there"),
          phone: customer.customer.phone ?? null,
          locality: customer.customer.locality ?? null,
        }
      : null,
    packs: (packs.packs ?? []).map(toPack),
    meals: (meals.meals ?? []).map(toMeal),
    invoices: (invoices.invoices ?? []).map(toInvoice),
    settings: toSettings(settings?.settings),
  };
}

/**
 * A customer's data, refreshed if it is older than a few minutes, falling back
 * to the last copy — clearly marked — if the Command Center cannot be reached.
 */
export async function loadCustomer(customerId: string): Promise<CustomerData> {
  const cached = await sql()`
    SELECT payload, synced_at FROM customer_profiles WHERE customer_id = ${customerId}
  `;
  const row = cached[0] as { payload: unknown; synced_at: string } | undefined;
  const ageMinutes = row ? (Date.now() - new Date(row.synced_at).getTime()) / 60000 : Infinity;

  if (row?.payload && ageMinutes < FRESH_MINUTES) {
    return { ...(row.payload as Omit<CustomerData, "stale" | "asOf">), stale: false, asOf: null };
  }

  try {
    const fresh = await fetchAll(customerId);
    await sql()`
      INSERT INTO customer_profiles (customer_id, payload, synced_at)
      VALUES (${customerId}, ${JSON.stringify(fresh)}::jsonb, now())
      ON CONFLICT (customer_id) DO UPDATE
        SET payload = EXCLUDED.payload, synced_at = now()
    `;
    return { ...fresh, stale: false, asOf: null };
  } catch (error) {
    if (!(error instanceof CommandCenterDown)) throw error;
    if (row?.payload) {
      return {
        ...(row.payload as Omit<CustomerData, "stale" | "asOf">),
        stale: true,
        asOf: new Date(row.synced_at),
      };
    }
    // Nothing cached and nothing reachable. Say so honestly rather than
    // rendering an empty screen that looks like "you have no meals".
    throw error;
  }
}
