import "server-only";

import { CommandCenterDown } from "./commandcenter";

/**
 * Asking the Command Center to change something.
 *
 * The mirror of lib/live.ts, which only ever reads. Everything here ends in a
 * POST to `customer_writes.py`, which calls `core.add_pause()` and friends —
 * the same engine that has been running the business since April.
 *
 * [LAW] docs/03 §1.4 — the app never *decides* anything. It renders meals and
 * requests changes. No meal count, no rupee and no subscription status is
 * computed in TypeScript.
 *
 * [LAW] docs/03 §6 — writes queue NOTHING. If the Command Center cannot be
 * reached, the write fails honestly and says so. A skip that looks applied but
 * never arrived is the worst bug this product can have: the customer stops
 * expecting food that is on its way, or expects food that isn't.
 *
 * [LAW] docs/03 §5.1 — the customer id passed to every function here comes from
 * the signed session, never from the request body. The callers in app/api/me/*
 * are where that is enforced.
 */

/** What the Command Center says happened. Rendered as-is — never second-guessed. */
export interface WriteResult {
  ok: true;
  /** applied = done now · requested = waiting on Balaji · partial = some of each */
  outcome: "applied" | "requested" | "partial";
  requestId?: number;
  applied: string[];
  pending: string[];
  mealsPaused?: number;
  /** Written by the server so the app and the API cannot word the promise differently. */
  message: string;
  /** "Your pack now runs to ..." — the line that answers *am I losing meals?* */
  packRunsTo: string | null;
  already?: boolean;
}

/** A refusal the customer should read, rather than a crash. */
export class WriteRefused extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "WriteRefused";
    this.status = status;
  }
}

function config() {
  const base = process.env.OG_API_BASE;
  const token = process.env.OG_API_TOKEN;
  if (!base || !token) return null;
  return { base: base.replace(/\/$/, ""), token };
}

async function send<T>(path: string, body: unknown, method = "POST"): Promise<T> {
  const cfg = config();
  if (!cfg) {
    throw new CommandCenterDown("OG_API_BASE / OG_API_TOKEN are not set");
  }
  let response: Response;
  try {
    response = await fetch(`${cfg.base}${path}`, {
      method,
      headers: {
        "X-OG-Service-Token": cfg.token,
        "Content-Type": "application/json",
      },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
      // Shorter than the read timeout on purpose. A customer waiting to find out
      // whether tomorrow's meal is cancelled will not sit through twelve seconds
      // of spinner, and an honest "try again" beats a hung tap.
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
  } catch (cause) {
    throw new CommandCenterDown((cause as Error).message);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new CommandCenterDown(`Command Center answered ${response.status} with no JSON`);
  }

  if (!response.ok) {
    // 4xx is a decision the customer needs to read ("the kitchen is closed that
    // day"). 5xx is us being broken, and must not be dressed up as their fault.
    const message = String(payload.error ?? `error ${response.status}`);
    if (response.status >= 500) throw new CommandCenterDown(message);
    throw new WriteRefused(message, response.status);
  }
  return payload as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function shape(raw: any): WriteResult {
  return {
    ok: true,
    outcome: (raw.outcome ?? "applied") as WriteResult["outcome"],
    requestId: raw.request_id ?? undefined,
    applied: Array.isArray(raw.applied) ? raw.applied.map(String) : [],
    pending: Array.isArray(raw.pending) ? raw.pending.map(String) : [],
    mealsPaused: typeof raw.meals_paused === "number" ? raw.meals_paused : undefined,
    message: String(raw.message ?? ""),
    packRunsTo: raw.pack_runs_to ?? null,
    already: Boolean(raw.already),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const id = (customerId: string) => encodeURIComponent(customerId);

export async function skipDay(
  customerId: string,
  date: string,
  opts: { subscriptionId?: string; reason?: string } = {}
): Promise<WriteResult> {
  return shape(
    await send(`/api/v1/customer/${id(customerId)}/skip`, {
      date,
      subscription_id: opts.subscriptionId,
      reason: opts.reason,
    })
  );
}

export async function unskipDay(
  customerId: string,
  date: string,
  opts: { subscriptionId?: string } = {}
): Promise<WriteResult> {
  return shape(
    await send(`/api/v1/customer/${id(customerId)}/unskip`, {
      date,
      subscription_id: opts.subscriptionId,
    })
  );
}

export async function pauseRange(
  customerId: string,
  start: string,
  end: string,
  opts: { subscriptionId?: string; reason?: string } = {}
): Promise<WriteResult> {
  return shape(
    await send(`/api/v1/customer/${id(customerId)}/pause`, {
      start,
      end,
      subscription_id: opts.subscriptionId,
      reason: opts.reason,
    })
  );
}

export async function resumeFrom(
  customerId: string,
  from: string,
  opts: { subscriptionId?: string } = {}
): Promise<WriteResult> {
  return shape(
    await send(`/api/v1/customer/${id(customerId)}/resume`, {
      from,
      subscription_id: opts.subscriptionId,
    })
  );
}

// --- deadlines --------------------------------------------------------------

export interface Deadline {
  /** Absolute IST moment the day locks. The countdown is computed from THIS. */
  deadline: string;
  cutoffTime: string;
  late: boolean;
  secondsLeft: number;
  minutesLate: number;
}

/**
 * The deadline for every day in a window, decided by the server.
 *
 * [LAW] docs/02 §7.5 — the countdown must survive the screen being locked and
 * reopened, so it is computed from an absolute deadline the server supplied,
 * never from a timer the browser started at page load. `serverNow` comes back
 * with it so the client can correct for a phone whose clock is wrong.
 */
export async function deadlines(
  customerId: string,
  from: string,
  to: string
): Promise<{ serverNow: string; days: Record<string, Deadline> }> {
  const raw = await send<{
    server_now: string;
    deadlines: Record<
      string,
      {
        deadline: string;
        cutoff_time: string;
        late: boolean;
        seconds_left: number;
        minutes_late: number;
      }
    >;
  }>(
    `/api/v1/customer/${id(customerId)}/deadlines?from=${from}&to=${to}`,
    null,
    "GET"
  );
  const days: Record<string, Deadline> = {};
  for (const [date, d] of Object.entries(raw.deadlines ?? {})) {
    days[date] = {
      deadline: d.deadline,
      cutoffTime: d.cutoff_time,
      late: d.late,
      secondsLeft: d.seconds_left,
      minutesLate: d.minutes_late,
    };
  }
  return { serverNow: raw.server_now, days };
}

// --- a customer's own request history ---------------------------------------

export interface SkipRequest {
  id: number;
  kind: "skip" | "pause" | "resume" | "undo";
  targetDate: string | null;
  startDate: string | null;
  endDate: string | null;
  requestedAt: string;
  minutesLate: number;
  reason: string | null;
  outcome: "auto_applied" | "pending" | "allowed" | "declined" | "partial";
  declineReason: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function shapeRequest(r: any): SkipRequest {
  return {
    id: Number(r.id),
    kind: r.kind,
    targetDate: r.target_date ?? null,
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    requestedAt: String(r.requested_at),
    minutesLate: Number(r.minutes_late ?? 0),
    reason: r.reason ?? null,
    outcome: r.outcome,
    declineReason: r.decline_reason ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function myRequests(customerId: string): Promise<SkipRequest[]> {
  const raw = await send<{ requests: unknown[] }>(
    `/api/v1/customer/${id(customerId)}/requests`,
    null,
    "GET"
  );
  return (raw.requests ?? []).map(shapeRequest);
}

// --- owner only -------------------------------------------------------------

export interface QueuedRequest extends SkipRequest {
  customerId: string;
  customerName: string | null;
  history: {
    lateThisMonth: number;
    lateAllTime: number;
    allowed: number;
    declined: number;
  };
}

/**
 * Balaji's queue.
 *
 * [RULE] docs/02 §8.2 — the history rides along with each request so he sees the
 * pattern WHILE deciding, not a month later. It is information, not a verdict:
 * nothing here auto-declines and nothing recommends declining.
 */
export async function pendingRequests(): Promise<QueuedRequest[]> {
  const raw = await send<{ requests: unknown[] }>("/api/v1/requests", null, "GET");
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (raw.requests ?? []).map((r: any) => ({
    ...shapeRequest(r),
    customerId: String(r.customer_id),
    customerName: r.customer_name ?? null,
    history: {
      lateThisMonth: Number(r.history?.late_this_month ?? 0),
      lateAllTime: Number(r.history?.late_all_time ?? 0),
      allowed: Number(r.history?.allowed ?? 0),
      declined: Number(r.history?.declined ?? 0),
    },
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function decideRequest(
  requestId: number,
  outcome: "allowed" | "declined",
  reason?: string
): Promise<{ outcome: string; already?: boolean }> {
  return send(`/api/v1/requests/${requestId}/decide`, { outcome, reason, by: "Balaji" });
}

/** The settings Balaji can change from his phone (docs/05 §1). */
export async function readSettings(): Promise<Record<string, string | null>> {
  const raw = await send<{ settings: Record<string, string | null> }>(
    "/api/v1/admin/settings",
    null,
    "GET"
  );
  return raw.settings ?? {};
}

export async function writeSettings(
  values: Record<string, string>
): Promise<{ changed: Record<string, string>; ignored: string[] }> {
  return send("/api/v1/admin/settings", values);
}

// --- validity (docs/05 §1.1, docs/01 §7.2) -----------------------------------

export interface ValidityRow {
  subscriptionId: string;
  customerId: string;
  customerName: string | null;
  plan: string;
  status: string;
  enforced: boolean;
  override: "on" | "off" | null;
  expiresOn: string | null;
  daysLeft: number | null;
  expired: boolean;
  remainingMeals: number;
  note: string | null;
  changedAt: string | null;
  changedBy: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function shapeValidityRow(r: any): ValidityRow {
  return {
    subscriptionId: String(r.subscription_id),
    customerId: String(r.customer_id),
    customerName: r.customer_name ?? null,
    plan: String(r.plan),
    status: String(r.status),
    enforced: Boolean(r.enforced),
    override: r.override ?? null,
    expiresOn: r.expires_on ?? null,
    daysLeft: r.days_left ?? null,
    expired: Boolean(r.expired),
    remainingMeals: Number(r.remaining_meals ?? 0),
    note: r.note ?? null,
    changedAt: r.changed_at ?? null,
    changedBy: r.changed_by ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Every live pack, for the admin validity screen. */
export async function validitySummary(): Promise<ValidityRow[]> {
  const raw = await send<{ subscriptions: unknown[] }>("/api/v1/admin/validity", null, "GET");
  return (raw.subscriptions ?? []).map(shapeValidityRow);
}

export async function readValidityGlobal(): Promise<boolean> {
  const raw = await send<{ enabled: boolean }>("/api/v1/admin/validity/settings", null, "GET");
  return Boolean(raw.enabled);
}

/**
 * The master switch. Sweeps every pack Balaji has never explicitly decided
 * about; anything he has already set for one customer keeps that decision.
 */
export async function writeValidityGlobal(
  enabled: boolean
): Promise<{ enabled: boolean; packsAffected: number }> {
  const raw = await send<{ enabled: boolean; packs_affected: number }>(
    "/api/v1/admin/validity/settings",
    { enabled }
  );
  return { enabled: raw.enabled, packsAffected: raw.packs_affected };
}

/**
 * One pack's decision: on, off, or back to following the global switch
 * (`override: null`) — and, per docs/01 §7.2.0, a direct date edit that needs
 * no confirmation and no reason.
 */
export async function setValidityOverride(
  subscriptionId: string,
  override: "on" | "off" | null,
  opts: { expiresOn?: string; note?: string } = {}
): Promise<{ enforced: boolean; expiresOn: string | null; status: string }> {
  const raw = await send<{ enforced: boolean; expires_on: string | null; status: string }>(
    `/api/v1/admin/subscription/${encodeURIComponent(subscriptionId)}/validity`,
    { override, expires_on: opts.expiresOn, note: opts.note }
  );
  return { enforced: raw.enforced, expiresOn: raw.expires_on, status: raw.status };
}
