import "server-only";

import { after } from "next/server";

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

/**
 * How long a cached copy is served with no network call at all.
 *
 * The Command Center answers in ~150ms and Neon in ~600ms, so the cache is not
 * protecting us from a slow kitchen — it is protecting every screen from doing
 * the same work twice within one visit. Tapping between four tabs used to mean
 * four full refetches.
 */
const FRESH_SECONDS = 60;

/**
 * Beyond this, a copy is old enough that the customer is told its age.
 *
 * Between FRESH_SECONDS and here, the copy is served INSTANTLY and refreshed
 * behind the screen. That is not the stale case docs/03 §6 legislates — that
 * law is about serving a copy when the Command Center cannot be reached, which
 * is exactly what still happens below, labelled, in the catch.
 */
const STALE_MINUTES = 20;

export interface CustomerData {
  customer: Customer | null;
  /** Where the food actually goes. Read-only to the customer (docs/05 §3). */
  addresses: { label: string | null; address: string; isDefault: boolean }[];
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
    // Default TRUE on purpose. If the Command Center has not been redeployed
    // yet these keys are absent, and defaulting false would hide skip and pause
    // from every customer the moment the app shipped ahead of the server.
    canSkip: p.can_skip !== false,
    canPause: p.can_pause !== false,
    pausedToday: Boolean(p.paused),
    pause: p.paused
      ? { start: p.start_date ?? "", end: p.paused_until ?? null, reason: null }
      : null,
    validity: {
      enforced: Boolean(p.validity_enforced),
      expiresOn: p.expires_on ?? null,
      daysLeft: p.validity_days_left ?? null,
    },
    pauses: Array.isArray(p.pauses)
      ? p.pauses.map((w: { start: string; end: string | null; kind: string }) => ({
          start: String(w.start),
          end: w.end ?? null,
          kind: w.kind === "skip" ? ("skip" as const) : ("pause" as const),
        }))
      : [],
  };
}

function toMeal(m: any, index: number): Meal & { expected: boolean } {
  // `projected` means "no delivery row exists yet" — which is true of three
  // very different days: one that simply hasn't been generated, one the
  // customer skipped, and one inside a freeze. Only the first is Pending.
  //
  // Collapsing all three to Pending is what would have re-hidden skipped days
  // in the app even after the API started reporting them correctly.
  const raw = String(m.status ?? "Pending");
  const status: Meal["status"] =
    raw === "Expected" ? "Pending" : (raw as Meal["status"]);

  return {
    // Projected days have no row and therefore no id; index keeps React keys
    // unique without inventing an id that looks real.
    id: Number(m.id ?? -(index + 1)),
    date: String(m.date),
    slot: asSlot(m.slot),
    status,
    packId: m.subscription_id ?? null,
    planName: m.plan ?? null,
    dayNote: m.note ?? null,
    isTrial: false,
    // Only a genuinely-unwritten future day is "expected". A skipped day is a
    // decision the customer made, not a forecast.
    expected: raw === "Expected",
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
  // Matched to what the screens actually render: the calendar shows -35 to
  // +60, and the order history shows the past. Fetching -90 to +21 was both
  // too much history to ship on every load and too little future for the
  // calendar's last three weeks, which simply rendered blank.
  return { from: iso(-70), to: iso(62) };
}

async function fetchAll(customerId: string): Promise<Omit<CustomerData, "stale" | "asOf">> {
  const { from, to } = windowDates();
  const id = encodeURIComponent(customerId);

  // In parallel: one slow call is the floor, not the sum of five.
  const [customer, packs, meals, invoices, settings, addresses] = await Promise.all([
    get<{ customer: any }>(`/api/v1/customer/${id}`).catch(() => null),          // eslint-disable-line @typescript-eslint/no-explicit-any
    get<{ packs: any[] }>(`/api/v1/customer/${id}/packs`),                       // eslint-disable-line @typescript-eslint/no-explicit-any
    get<{ meals: any[] }>(`/api/v1/customer/${id}/meals?from=${from}&to=${to}`), // eslint-disable-line @typescript-eslint/no-explicit-any
    get<{ invoices: any[] }>(`/api/v1/customer/${id}/invoices`).catch(() => ({ invoices: [] })), // eslint-disable-line @typescript-eslint/no-explicit-any
    get<{ settings: any }>(`/api/v1/settings/public`).catch(() => null),         // eslint-disable-line @typescript-eslint/no-explicit-any
    get<{ addresses: any[] }>(`/api/v1/customer/${id}/addresses`).catch(() => ({ addresses: [] })), // eslint-disable-line @typescript-eslint/no-explicit-any
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
    addresses: (addresses.addresses ?? []).map((a: { label: string | null; address: string; is_default: boolean }) => ({
      label: a.label ?? null,
      address: String(a.address ?? ""),
      isDefault: Boolean(a.is_default),
    })),
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
  return fromCache(customerId, cached[0] as CacheRow | undefined);
}

export interface CacheRow {
  payload: unknown;
  synced_at: string;
}

/**
 * Turn a cache row into a screen's worth of data, fetching only when it has to.
 *
 * Split out from `loadCustomer` so a caller that has ALREADY read the row — as
 * part of one batched Neon round trip (lib/screen.ts) — does not read it again.
 * Every extra Neon query is ~150-600ms of a customer staring at nothing.
 */
export async function fromCache(
  customerId: string,
  row: CacheRow | undefined
): Promise<CustomerData> {
  const ageSeconds = row ? (Date.now() - new Date(row.synced_at).getTime()) / 1000 : Infinity;

  // Recent enough to serve outright. No network at all — this is what makes
  // moving between tabs feel instant instead of costing a round trip each time.
  if (row?.payload && ageSeconds < FRESH_SECONDS) {
    return { ...(row.payload as Omit<CustomerData, "stale" | "asOf">), stale: false, asOf: null };
  }

  // Older, but we have something real to show. Render it NOW and refresh behind
  // the screen: a customer who already had this data must never wait on a
  // network call to see it again. `after()` runs once the response has been
  // streamed, so it costs the render nothing.
  if (row?.payload) {
    after(async () => {
      try {
        await refreshCustomer(customerId);
      } catch {
        // A background refresh that fails changes nothing on screen. The copy
        // simply ages, and crosses STALE_MINUTES into being labelled.
      }
    });
    const tooOld = ageSeconds > STALE_MINUTES * 60;
    return {
      ...(row.payload as Omit<CustomerData, "stale" | "asOf">),
      stale: tooOld,
      asOf: tooOld ? new Date(row.synced_at) : null,
    };
  }

  // Nothing cached: there is no honest way to avoid waiting.
  try {
    return await refreshCustomer(customerId);
  } catch (error) {
    if (!(error instanceof CommandCenterDown)) throw error;
    // Nothing cached and nothing reachable. Say so honestly rather than
    // rendering an empty screen that looks like "you have no meals".
    throw error;
  }
}

/**
 * Force a read from the Command Center and write it to the cache.
 *
 * Called directly after a skip or pause. The alternative — marking the cache
 * dirty and letting the next render refetch — is what made a skip feel like it
 * took several seconds: the action returned, the page re-rendered, and only
 * THEN did the slow fetch happen, with the customer watching.
 */
/**
 * Re-read ONLY what a skip, pause or resume can change, and merge it in.
 *
 * The full refresh reads six endpoints. Five of them — the customer, their
 * addresses, the public settings, their invoices — cannot be changed by taking
 * a day off, so a skip was paying for them anyway, six requests deep, against a
 * server that runs one worker and answers them one at a time.
 *
 * Two calls instead of six is what makes it affordable to WAIT for this before
 * answering, and waiting is the point: the pack gets a day longer when you skip,
 * so a new day appears at the end of it. Doing this in the background meant the
 * screen re-rendered from the copy taken before the skip, the extra day was
 * missing, and it only turned up when the customer reloaded the page by hand.
 *
 * Merged into the stored payload rather than replacing it, so the fields this
 * does not fetch keep their existing values instead of vanishing.
 */
export async function refreshPacksAndMeals(customerId: string): Promise<void> {
  const { from, to } = windowDates();
  const id = encodeURIComponent(customerId);

  const [packs, meals] = await Promise.all([
    get<{ packs: any[] }>(`/api/v1/customer/${id}/packs`),                       // eslint-disable-line @typescript-eslint/no-explicit-any
    get<{ meals: any[] }>(`/api/v1/customer/${id}/meals?from=${from}&to=${to}`), // eslint-disable-line @typescript-eslint/no-explicit-any
  ]);

  const patch = JSON.stringify({
    packs: (packs.packs ?? []).map(toPack),
    meals: (meals.meals ?? []).map(toMeal),
  });

  // `||` merges the two objects at the top level, so only these two keys move.
  //
  // `payload IS NOT NULL` is load-bearing, not defensive noise: in Postgres
  // `NULL || anything` is NULL, so without it a row that had never been filled
  // would be *emptied* by this. And merging into an empty object would be worse
  // still — a payload holding packs and meals but no customer renders as
  // notFound(). Touching nothing leaves the next screen to do a full read,
  // which is exactly the right outcome.
  await sql()`
    UPDATE customer_profiles
       SET payload = payload || ${patch}::jsonb, synced_at = now()
     WHERE customer_id = ${customerId} AND payload IS NOT NULL
  `;

  // The freshly-merged copy must not be shadowed by a full refresh that started
  // before the write and is about to overwrite it with pre-skip data.
  inFlight.delete(customerId);
  lastDone.delete(customerId);
}

/**
 * Refreshes already running or just finished, so one skip cannot become twelve
 * calls to a single free worker.
 *
 * This is what made skipping feel slow again. A skip fired a background refresh
 * (six Command Center calls), returned, and the page then re-rendered — which
 * found the cache marked dirty and fired a SECOND background refresh, six more.
 * Neither blocked the response, so neither showed up as the skip being slow;
 * they showed up as the NEXT thing the customer did being slow, because
 * PythonAnywhere's free tier is one worker and it was still working through the
 * queue.
 *
 * `inFlight` collapses concurrent refreshes onto one promise. `lastDone` stops
 * a refresh that just finished from being immediately repeated — the data
 * cannot have changed in three seconds, and the only thing that could have
 * changed it is us.
 */
const inFlight = new Map<string, Promise<CustomerData>>();
const lastDone = new Map<string, { at: number; value: CustomerData }>();
const REFRESH_COOLDOWN_MS = 3000;

/**
 * @param force  Set ONLY on the refresh that follows a write.
 *
 * Both shortcuts above are wrong after a skip, and dangerously so. Joining a
 * fetch that STARTED BEFORE the write would store a payload that predates it,
 * and the cooldown would skip the refresh entirely — either way the cache would
 * be left claiming the meal is still on. A write must always produce a fetch
 * that begins after it.
 */
export function refreshCustomer(
  customerId: string,
  { force = false }: { force?: boolean } = {}
): Promise<CustomerData> {
  if (!force) {
    const running = inFlight.get(customerId);
    if (running) return running;

    const done = lastDone.get(customerId);
    if (done && Date.now() - done.at < REFRESH_COOLDOWN_MS) {
      return Promise.resolve(done.value);
    }
  }

  const task = (async () => {
    const fresh = await fetchAll(customerId);
    await sql()`
      INSERT INTO customer_profiles (customer_id, payload, synced_at)
      VALUES (${customerId}, ${JSON.stringify(fresh)}::jsonb, now())
      ON CONFLICT (customer_id) DO UPDATE
        SET payload = EXCLUDED.payload, synced_at = now()
    `;
    const value: CustomerData = { ...fresh, stale: false, asOf: null };
    if (lastDone.size > 200) lastDone.clear();
    lastDone.set(customerId, { at: Date.now(), value });
    return value;
  })();

  inFlight.set(customerId, task);
  // Cleared whether it worked or not: a failure must not block the retry.
  task.finally(() => inFlight.delete(customerId)).catch(() => {});
  return task;
}
