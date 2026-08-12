import "server-only";

import { sql } from "./accounts";

/**
 * What the customer thought of one day's meal.
 *
 * Per DAY and SLOT, never per pack: "the chicken was dry on Tuesday" is
 * something the kitchen can act on, and "4 stars overall" is not. That is the
 * whole reason this exists — Balaji wanted the small adjustments people mention
 * in passing on WhatsApp ("a bit spicy", "less oil") captured against the actual
 * meal, so a pattern is visible instead of being remembered.
 *
 * Postgres, not the Command Center (docs/05 §4).
 */

/** The things people actually say. Free text is still there for everything else. */
export const TAGS: { value: string; label: string; group: "taste" | "portion" | "good" }[] = [
  { value: "too_spicy", label: "Too spicy", group: "taste" },
  { value: "bland", label: "Needs more flavour", group: "taste" },
  { value: "too_oily", label: "Too oily", group: "taste" },
  { value: "dry", label: "A bit dry", group: "taste" },
  { value: "portion_small", label: "Portion felt small", group: "portion" },
  { value: "portion_large", label: "Portion too much", group: "portion" },
  { value: "late", label: "Arrived late", group: "portion" },
  { value: "loved_it", label: "Loved it", group: "good" },
  { value: "perfect_spice", label: "Spice was perfect", group: "good" },
  { value: "great_portion", label: "Portion was spot on", group: "good" },
];

const VALID = new Set(TAGS.map((t) => t.value));

export interface Feedback {
  customerId: string;
  customerName?: string | null;
  date: string;
  slot: string;
  rating: number | null;
  tags: string[];
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function shape(r: any): Feedback {
  return {
    customerId: String(r.customer_id),
    customerName: r.customer_name ?? null,
    date: typeof r.delivery_date === "string"
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
 * Save (or replace) feedback for one meal.
 *
 * [RULE] An upsert, not an append. Changing your mind about yesterday's lunch
 * replaces the note rather than leaving two contradictory ones for the kitchen
 * to average.
 *
 * Unknown tags are dropped rather than stored: the tag list is a fixed
 * vocabulary the kitchen reports on, and one typo'd value would quietly become
 * a category of its own.
 */
export async function saveFeedback(input: {
  customerId: string;
  date: string;
  slot: string;
  rating?: number | null;
  tags?: string[];
  comment?: string | null;
}): Promise<Feedback> {
  const tags = (input.tags ?? []).filter((t) => VALID.has(t)).slice(0, 6);
  const rating =
    input.rating === null || input.rating === undefined
      ? null
      : Math.min(5, Math.max(1, Math.round(Number(input.rating))));
  const comment = (input.comment ?? "").trim().slice(0, 1000) || null;

  if (!rating && tags.length === 0 && !comment) {
    throw new Error("nothing to save");
  }

  const rows = await sql()`
    INSERT INTO meal_feedback (customer_id, delivery_date, slot, rating, tags, comment)
    VALUES (${input.customerId}, ${input.date}::date, ${input.slot},
            ${rating}, ${tags}::text[], ${comment})
    ON CONFLICT (customer_id, delivery_date, slot) DO UPDATE
      SET rating = EXCLUDED.rating,
          tags = EXCLUDED.tags,
          comment = EXCLUDED.comment,
          updated_at = now()
    RETURNING *
  `;
  return shape(rows[0]);
}

/** Everything this customer has said, keyed by `date|slot` for a fast lookup. */
export async function myFeedback(
  customerId: string,
  from: string,
  to: string
): Promise<Record<string, Feedback>> {
  const rows = await sql()`
    SELECT * FROM meal_feedback
     WHERE customer_id = ${customerId}
       AND delivery_date BETWEEN ${from}::date AND ${to}::date
  `;
  const out: Record<string, Feedback> = {};
  for (const r of rows) {
    const f = shape(r);
    out[`${f.date}|${f.slot}`] = f;
  }
  return out;
}

export async function feedbackFor(
  customerId: string,
  date: string,
  slot: string
): Promise<Feedback | null> {
  const rows = await sql()`
    SELECT * FROM meal_feedback
     WHERE customer_id = ${customerId} AND delivery_date = ${date}::date AND slot = ${slot}
  `;
  return rows.length ? shape(rows[0]) : null;
}

/** The kitchen's view: what came back recently, newest first. */
export async function recentFeedback(days = 21): Promise<Feedback[]> {
  const rows = await sql()`
    SELECT f.*, p.payload -> 'customer' ->> 'name' AS customer_name
      FROM meal_feedback f
      LEFT JOIN customer_profiles p ON p.customer_id = f.customer_id
     WHERE f.delivery_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - ${days}::int
     ORDER BY f.delivery_date DESC, f.updated_at DESC
     LIMIT 200
  `;
  return rows.map(shape);
}

/**
 * Which tags keep coming up, over a window.
 *
 * The point of collecting any of this: one person saying "too spicy" is taste,
 * six people saying it in a fortnight is a recipe problem.
 */
export async function tagTally(days = 30): Promise<{ tag: string; n: number }[]> {
  const rows = await sql()`
    SELECT tag, COUNT(*)::int AS n
      FROM meal_feedback f, unnest(f.tags) AS tag
     WHERE f.delivery_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - ${days}::int
     GROUP BY tag
     ORDER BY n DESC
  `;
  return rows.map((r) => ({ tag: String(r.tag), n: Number(r.n) }));
}

export function tagLabel(value: string): string {
  return TAGS.find((t) => t.value === value)?.label ?? value;
}
