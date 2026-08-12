import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

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
 * Reads the Command Center snapshot.
 *
 * SAFETY: opens `data/snapshot.db` — a COPY produced by scripts/snapshot.mjs —
 * and opens it READ-ONLY. The live oggainz.db is never opened by the app at all.
 * See docs/04 §0.
 *
 * This is one implementation of the seam in lib/types.ts. Swapping it for the
 * Command Center API later must not require touching a single component.
 */

const DB_PATH = join(process.cwd(), "data", "snapshot.db");

let handle: DatabaseSync | null = null;

function db(): DatabaseSync {
  if (handle) return handle;
  if (!existsSync(DB_PATH)) {
    throw new Error(
      `No snapshot found at ${DB_PATH}. Run:  node scripts/snapshot.mjs`,
    );
  }
  handle = new DatabaseSync(DB_PATH, { readOnly: true });
  return handle;
}

const LIVE: PackStatus[] = ["Active", "Ending Soon", "Paused"];

function asSlot(v: unknown): Slot {
  return v === "Dinner" ? "Dinner" : "Lunch";
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function todayISO(): string {
  // The business runs in IST; a server in another timezone must still agree
  // with the kitchen about what day it is.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function listCustomers(): Customer[] {
  return db()
    .prepare(
      `SELECT c.id, c.name, c.phone, c.locality
         FROM customers c
        WHERE EXISTS (SELECT 1 FROM subscriptions s
                       WHERE s.customer_id = c.id
                         AND s.status IN ('Active','Ending Soon','Paused'))
        ORDER BY c.name`,
    )
    .all()
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      phone: str(r.phone),
      locality: str(r.locality),
    }));
}

export function getCustomer(id: string): Customer | null {
  const r = db()
    .prepare("SELECT id, name, phone, locality FROM customers WHERE id = ?")
    .get(id);
  if (!r) return null;
  return {
    id: String(r.id),
    name: String(r.name),
    phone: str(r.phone),
    locality: str(r.locality),
  };
}

function componentsFor(packId: string): Component[] {
  return db()
    .prepare(
      `SELECT sc.qty, sc.kind, sc.note, c.name, c.unit, c.emoji, c.protein, c.sort
         FROM subscription_components sc
         JOIN components c ON c.id = sc.component_id
        WHERE sc.subscription_id = ?
        ORDER BY (sc.kind = 'addon'), c.sort`,
    )
    .all(packId)
    .map((r) => ({
      name: String(r.name),
      qty: num(r.qty),
      unit: String(r.unit ?? "serving"),
      emoji: str(r.emoji),
      protein: str(r.protein),
      kind: r.kind === "addon" ? ("addon" as const) : ("base" as const),
      note: str(r.note),
    }));
}

export function getPacks(customerId: string): Pack[] {
  const today = todayISO();
  const rows = db()
    .prepare(
      `SELECT id, plan_name, duration, slot, status, start_date, notes,
              COALESCE(total_meals_scheduled,0) AS total,
              COALESCE(delivered_count,0)       AS delivered,
              COALESCE(remaining_meals,0)       AS remaining,
              COALESCE(skipped_count,0)         AS skipped
         FROM subscriptions
        WHERE customer_id = ? AND status IN ('Active','Ending Soon','Paused')
        ORDER BY start_date DESC, id DESC`,
    )
    .all(customerId);

  const pauseStmt = db().prepare(
    `SELECT start_date, end_date, reason
       FROM subscription_pauses
      WHERE subscription_id = ? AND start_date <= ?
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY start_date DESC LIMIT 1`,
  );

  return rows.map((r) => {
    const id = String(r.id);
    const p = pauseStmt.get(id, today, today);
    return {
      id,
      planName: String(r.plan_name ?? "Meal Pack"),
      duration: str(r.duration),
      slot: asSlot(r.slot),
      status: (LIVE.includes(r.status as PackStatus)
        ? r.status
        : "Active") as PackStatus,
      startDate: str(r.start_date),
      mealsTotal: num(r.total),
      delivered: num(r.delivered),
      remaining: num(r.remaining),
      skipped: num(r.skipped),
      components: componentsFor(id),
      notes: str(r.notes),
      pausedToday: Boolean(p),
      pause: p
        ? {
            start: String(p.start_date),
            end: str(p.end_date),
            reason: str(p.reason),
          }
        : null,
      // The snapshot script copies the SQLite file rather than reading through
      // the API, and doesn't shape validity.py's columns — this dev-only path
      // (laptop, no OG_API_BASE set) simply doesn't have an opinion on it.
      validity: null,
    };
  });
}

export function getMeals(
  customerId: string,
  from: string,
  to: string,
): Meal[] {
  return db()
    .prepare(
      `SELECT d.id, d.date, d.meal_type, d.status, d.subscription_id,
              d.trial_id, d.day_note,
              COALESCE(s.plan_name, d.notes) AS plan_name
         FROM deliveries d
         LEFT JOIN subscriptions s ON s.id = d.subscription_id
        WHERE d.customer_id = ? AND d.date >= ? AND d.date <= ?
        ORDER BY d.date, (d.meal_type = 'Dinner')`,
    )
    .all(customerId, from, to)
    .map((r) => ({
      id: num(r.id),
      date: String(r.date),
      slot: asSlot(r.meal_type),
      status: (r.status ?? "Pending") as Meal["status"],
      packId: str(r.subscription_id),
      planName: str(r.plan_name),
      dayNote: str(r.day_note),
      isTrial: Boolean(r.trial_id),
    }));
}

export function getInvoices(customerId: string): Invoice[] {
  return db()
    .prepare(
      `SELECT id, token, inv_date, COALESCE(total,0) AS total,
              COALESCE(received,0) AS received, payment_status
         FROM invoices WHERE customer_id = ?
        ORDER BY inv_date DESC, id DESC`,
    )
    .all(customerId)
    .map((r) => ({
      id: String(r.id),
      token: str(r.token),
      date: str(r.inv_date),
      total: num(r.total),
      received: num(r.received),
      paymentStatus: String(r.payment_status ?? "Unpaid"),
    }));
}

function setting(key: string, fallback: string): string {
  const r = db().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return r && typeof r.value === "string" && r.value ? r.value : fallback;
}

export function getSettings(): PublicSettings {
  return {
    cutoffTime: setting("skip_cutoff_time", "18:00"),
    operatingWeekdays: setting("operating_weekdays", "0,1,2,3,4")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n)),
    lunchWindow: setting("delivery_promise_lunch", "11:00-13:45"),
    dinnerWindow: setting("delivery_promise_dinner", "17:30-20:00"),
  };
}

/**
 * The customer's next few meal days.
 *
 * The Command Center creates delivery rows lazily — only when a day is actually
 * opened in the app — so future rows usually do not exist yet. Reading the table
 * alone would show a customer an empty week and look broken.
 *
 * So: use real rows where they exist, and otherwise PROJECT the next operating
 * days from the pack. A projected day is flagged `expected: true` and the UI
 * must label it as expected, never as confirmed.
 *
 * This is display only. It never writes, and it never changes a meal count —
 * the pack's `remaining` still comes from the Command Center (docs/03 §1.4).
 */
export function getUpcoming(
  customerId: string,
  limit = 5,
): Array<Meal & { expected: boolean }> {
  const today = todayISO();
  const horizon = addDaysISO(today, 21);
  const real = getMeals(customerId, addDaysISO(today, 1), horizon).map((m) => ({
    ...m,
    expected: false,
  }));
  if (real.length >= limit) return real.slice(0, limit);

  const packs = getPacks(customerId).filter(
    (p) => p.remaining > 0 && !p.pausedToday,
  );
  const taken = new Set(real.map((m) => `${m.date}|${m.slot}`));
  const projected: Array<Meal & { expected: boolean }> = [];
  const budget = new Map(packs.map((p) => [p.id, p.remaining]));

  for (let i = 1; i <= 21 && real.length + projected.length < limit; i++) {
    const date = addDaysISO(today, i);
    if (!isOperatingDay(date)) continue;
    for (const p of packs) {
      const left = budget.get(p.id) ?? 0;
      if (left <= 0) continue;
      if (taken.has(`${date}|${p.slot}`)) continue;
      if (isPausedOn(p.id, date)) continue;
      projected.push({
        id: -(projected.length + 1),
        date,
        slot: p.slot,
        status: "Pending",
        packId: p.id,
        planName: p.planName,
        dayNote: null,
        isTrial: false,
        expected: true,
      });
      budget.set(p.id, left - 1);
      if (real.length + projected.length >= limit) break;
    }
  }

  return [...real, ...projected]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, limit);
}

function isPausedOn(packId: string, iso: string): boolean {
  return Boolean(
    db()
      .prepare(
        `SELECT 1 AS x FROM subscription_pauses
          WHERE subscription_id = ? AND start_date <= ?
            AND (end_date IS NULL OR end_date >= ?) LIMIT 1`,
      )
      .get(packId, iso, iso),
  );
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Is the kitchen open on this date? Mirrors core.is_operating_day. */
export function isOperatingDay(iso: string): boolean {
  const ov = db()
    .prepare("SELECT is_open FROM day_overrides WHERE date = ?")
    .get(iso);
  if (ov) return Boolean(ov.is_open);

  const holiday = db()
    .prepare("SELECT 1 AS x FROM holidays WHERE date = ?")
    .get(iso);
  if (holiday) return false;

  // JS: Sunday = 0. The Command Center uses Python's Monday = 0.
  const jsDay = new Date(`${iso}T12:00:00`).getDay();
  const pyDay = (jsDay + 6) % 7;
  return getSettings().operatingWeekdays.includes(pyDay);
}
