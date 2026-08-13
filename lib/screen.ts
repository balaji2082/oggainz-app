import "server-only";

import { sql } from "./accounts";
import { getCustomerData, type CustomerData } from "./data";
import { fromCache, liveAvailable, type CacheRow } from "./live";
import type { Feedback } from "./feedback";

/**
 * Everything one screen needs from Postgres, in ONE round trip.
 *
 * This exists because of a measurement, not a hunch. The Command Center answers
 * in about 150ms; Neon takes roughly 600ms cold. Each screen was making three
 * or four SEPARATE Neon queries — the cached payload, the avatar, the unread
 * count, the feedback — and the `@neondatabase/serverless` driver sends one
 * HTTPS request per query. That is most of a second of pure waiting, repeated
 * on every single tab change, and it is why the app felt slow.
 *
 * `sql.transaction([...])` sends them as a single request instead. Same
 * queries, same results, one network round trip.
 */

export interface ScreenData {
  data: CustomerData;
  avatar: string | null;
  unread: number;
  feedback: Record<string, Feedback>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function shapeFeedback(r: any): Feedback {
  return {
    customerId: String(r.customer_id),
    date:
      typeof r.delivery_date === "string"
        ? r.delivery_date.slice(0, 10)
        : new Date(r.delivery_date).toISOString().slice(0, 10),
    slot: String(r.slot),
    rating: r.rating === null || r.rating === undefined ? null : Number(r.rating),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    comment: r.comment ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * @param feedbackWindow  [from, to] — omit on screens that show no feedback, so
 *                        the query is not paid for where it is not rendered.
 */
/**
 * A short-lived cache inside the running server process.
 *
 * Vercel reuses a warm instance across requests, so moving between tabs hits
 * the same process. Without this, every tab change paid the full Postgres round
 * trip again for data that had not changed in the two seconds since the last
 * screen asked for it. With it, the second and third tab are free.
 *
 * Deliberately tiny and deliberately short. It is not a substitute for the
 * Postgres cache — it disappears whenever the instance recycles, which is often
 * — it just stops one person's burst of navigation costing four round trips.
 */
const MEMO = new Map<string, { at: number; value: ScreenData }>();
const MEMO_MS = 8000;

function memoKey(customerId: string, window?: [string, string]) {
  return `${customerId}|${window?.join(":") ?? ""}`;
}

export async function loadScreen(
  customerId: string,
  feedbackWindow?: [string, string]
): Promise<ScreenData> {
  const key = memoKey(customerId, feedbackWindow);
  const hit = MEMO.get(key);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.value;

  const value = await loadScreenUncached(customerId, feedbackWindow);

  // Bounded so a busy instance cannot grow this without limit.
  if (MEMO.size > 200) MEMO.clear();
  MEMO.set(key, { at: Date.now(), value });
  return value;
}

/** Drop a customer's memo after a write, so the next render sees the change. */
export function forgetScreen(customerId: string) {
  for (const k of MEMO.keys()) {
    if (k.startsWith(`${customerId}|`)) MEMO.delete(k);
  }
}

async function loadScreenUncached(
  customerId: string,
  feedbackWindow?: [string, string]
): Promise<ScreenData> {
  // Local development against a snapshot file has no Postgres at all.
  if (!liveAvailable()) {
    return {
      data: await getCustomerData(customerId),
      avatar: null,
      unread: 0,
      feedback: {},
    };
  }

  const db = sql();
  const [from, to] = feedbackWindow ?? ["1970-01-01", "1970-01-01"];

  const [profileRows, unreadRows, feedbackRows] = await db.transaction([
    db`SELECT payload, synced_at, avatar FROM customer_profiles WHERE customer_id = ${customerId}`,
    db`SELECT COUNT(*)::int AS n FROM support_tickets
        WHERE unread_for = 'customer' AND customer_id = ${customerId}`,
    db`SELECT * FROM meal_feedback
        WHERE customer_id = ${customerId}
          AND delivery_date BETWEEN ${from}::date AND ${to}::date`,
  ]);

  const row = profileRows[0] as (CacheRow & { avatar: string | null }) | undefined;

  const feedback: Record<string, Feedback> = {};
  if (feedbackWindow) {
    for (const r of feedbackRows) {
      const f = shapeFeedback(r);
      feedback[`${f.date}|${f.slot}`] = f;
    }
  }

  return {
    // Given the row we already have, this only touches the network when the
    // copy is too old to serve — and even then it hands back the old copy and
    // refreshes behind the screen.
    data: await fromCache(customerId, row),
    avatar: row?.avatar ?? null,
    unread: Number((unreadRows[0] as { n: number } | undefined)?.n ?? 0),
    feedback,
  };
}
