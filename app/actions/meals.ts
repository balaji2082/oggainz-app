"use server";

import { revalidatePath } from "next/cache";

import { sql } from "@/lib/accounts";
import { pauseRange, resumeFrom, skipDay, unskipDay, type WriteResult } from "@/lib/writes";
import { saveFeedback } from "@/lib/feedback";
import { asCustomer, explain, type ActionResult } from "./guard";

/**
 * The things a customer can actually change: which days they eat, and what they
 * thought of the food.
 *
 * Every meal action ends in the Command Center's engine (`core.add_pause` and
 * friends) — docs/03 §5.4. Nothing here computes a meal count or a date; it asks
 * and renders the answer.
 *
 * [LAW] docs/03 §5.3 + §6 — the SERVER decides whether an action was in time,
 * and the UI renders what came back rather than assuming its optimistic guess
 * was right. There is no optimistic state anywhere in this file.
 */

/** The cached payload is now wrong — drop it so the next read refetches. */
async function invalidate(customerId: string) {
  await sql()`
    UPDATE customer_profiles SET synced_at = now() - interval '1 day'
     WHERE customer_id = ${customerId}
  `;
  revalidatePath("/me", "layout");
}

function done(result: WriteResult): ActionResult<WriteResult> {
  return { ok: true, message: result.message, data: result };
}

export async function skipMeal(
  date: string,
  subscriptionId?: string,
  reason?: string
): Promise<ActionResult<WriteResult>> {
  try {
    const { customerId } = await asCustomer();
    const result = await skipDay(customerId, date, { subscriptionId, reason });
    await invalidate(customerId);
    return done(result);
  } catch (error) {
    return explain(error);
  }
}

export async function undoSkip(
  date: string,
  subscriptionId?: string
): Promise<ActionResult<WriteResult>> {
  try {
    const { customerId } = await asCustomer();
    const result = await unskipDay(customerId, date, { subscriptionId });
    await invalidate(customerId);
    return done(result);
  } catch (error) {
    return explain(error);
  }
}

export async function pauseMeals(
  start: string,
  end: string,
  subscriptionId?: string,
  reason?: string
): Promise<ActionResult<WriteResult>> {
  try {
    const { customerId } = await asCustomer();
    const result = await pauseRange(customerId, start, end, { subscriptionId, reason });
    await invalidate(customerId);
    return done(result);
  } catch (error) {
    return explain(error);
  }
}

export async function resumeMeals(
  from: string,
  subscriptionId?: string
): Promise<ActionResult<WriteResult>> {
  try {
    const { customerId } = await asCustomer();
    const result = await resumeFrom(customerId, from, { subscriptionId });
    await invalidate(customerId);
    return done(result);
  } catch (error) {
    return explain(error);
  }
}

/**
 * Feedback on one delivered meal.
 *
 * [LAW] docs/05 §4 — only on a day that was actually delivered. A rating on food
 * nobody ate is noise, and without this check someone could rate a meal they
 * skipped. The check reads the cached payload rather than calling the Command
 * Center, because it is a guard on our own data, not a business decision.
 */
export async function leaveFeedback(input: {
  date: string;
  slot: string;
  rating?: number | null;
  tags?: string[];
  comment?: string | null;
}): Promise<ActionResult> {
  try {
    const { customerId } = await asCustomer();

    const rows = await sql()`
      SELECT payload -> 'meals' AS meals FROM customer_profiles
       WHERE customer_id = ${customerId}
    `;
    const meals = (rows[0]?.meals ?? []) as { date: string; slot: string; status: string }[];
    const match = meals.find(
      (m) => m.date === input.date && m.slot === input.slot && m.status === "Delivered"
    );
    if (!match) {
      return {
        ok: false,
        message: "You can leave feedback once a meal has been delivered.",
      };
    }

    await saveFeedback({ customerId, ...input });
    revalidatePath("/me", "layout");
    return { ok: true, message: "Thank you — this goes straight to the kitchen." };
  } catch (error) {
    return explain(error);
  }
}
