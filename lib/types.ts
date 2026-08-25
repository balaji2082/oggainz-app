/**
 * The shape of everything the app reads.
 *
 * This is the seam described in docs/03 §1: today these types are filled from a
 * read-only snapshot of the Command Center's SQLite file; later they will be
 * filled from the Command Center API, and after cutover from Postgres. Nothing
 * in the UI should ever need to change when that swap happens.
 */

export type Slot = "Lunch" | "Dinner";

export type MealStatus =
  | "Pending"
  | "Delivered"
  | "Skipped"
  | "Off"
  /** Inside a multi-day freeze. No order generates, and that is correct. */
  | "Paused";

export type PackStatus =
  | "Active"
  | "Ending Soon"
  | "Completed"
  | "Paused"
  /** Validity (docs/01 §7.2) closed with meals still unclaimed. Off by default
   *  — see validity.py on the Command Center; most packs never reach this. */
  | "Expired";

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  locality: string | null;
}

/** One line in a meal — "Chicken 100g", "Egg 1 pc". */
export interface Component {
  name: string;
  qty: number;
  unit: string;
  emoji: string | null;
  protein: string | null;
  /** 'base' is part of the pack; 'addon' is paid extra on top. */
  kind: "base" | "addon";
  note: string | null;
}

export interface Pack {
  id: string;
  planName: string;
  duration: string | null;
  slot: Slot;
  status: PackStatus;
  startDate: string | null;
  /** Counts come from the Command Center. The app never recomputes them. */
  mealsTotal: number;
  delivered: number;
  remaining: number;
  skipped: number;
  components: Component[];
  notes: string | null;
  /** True while a pause window covers today. */
  /**
   * Whether THIS pack may skip / pause, as decided by the SERVER.
   *
   * [LAW] docs/03 §1.4 — the app renders, it never decides. The app briefly
   * re-derived this from a comma-separated list of plan names, which is the app
   * deciding a business rule with its own copy of the data. Balaji then needed
   * to switch it off for one CUSTOMER, which a list of plan names could never
   * express, so the Command Center owns the whole question now (flexibility.py)
   * and answers it per pack.
   */
  canSkip: boolean;
  canPause: boolean;
  pausedToday: boolean;
  pause: { start: string; end: string | null; reason: string | null } | null;
  /**
   * EVERY freeze on this pack, past and future — not just one covering today.
   *
   * `pause` above answers "is it frozen right now", which is a different
   * question from "which days are off". A skip three weeks out never covers
   * today, so relying on `pause` alone made skipped days invisible.
   *
   * `kind` separates the two words the interface must not confuse: a one-day
   * window is a *skip*, a stretch is a *pause* (docs/02 §7.4).
   */
  pauses: { start: string; end: string | null; kind: "skip" | "pause" }[];
  /**
   * Validity (docs/01 §7.2, docs/05 §1.1). `enforced` is false for every pack
   * that exists today by default — validity.py on the Command Center is the
   * only place that decides this, on. or off. per pack or globally, and this
   * is simply what it decided. `expiresOn` is only meaningful when enforced.
   */
  validity: { enforced: boolean; expiresOn: string | null; daysLeft: number | null } | null;
}

export interface Meal {
  id: number;
  date: string;
  slot: Slot;
  status: MealStatus;
  packId: string | null;
  planName: string | null;
  /** The one-off note for this date only. */
  dayNote: string | null;
  isTrial: boolean;
}

export interface Invoice {
  id: string;
  token: string | null;
  date: string | null;
  total: number;
  received: number;
  paymentStatus: string;
}

/** Values the UI and the terms both read, so they can never disagree. */
export interface PublicSettings {
  cutoffTime: string;
  operatingWeekdays: number[];
  lunchWindow: string;
  dinnerWindow: string;
}
