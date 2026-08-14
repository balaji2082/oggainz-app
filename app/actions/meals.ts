"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { sql } from "@/lib/accounts";
import { refreshCustomer } from "@/lib/live";
import { forgetScreen } from "@/lib/screen";
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

/**
 * The pack has just changed, so re-read it NOW and store the new truth.
 *
 * This used to mark the cache dirty and let the next render refetch, which is
 * why a skip felt like it took seconds and often needed a manual reload: the
 * action returned, the page began re-rendering, and only THEN did the slow
 * Command Center read happen — with the customer watching a half-drawn screen.
 *
 * Doing it here costs the same one round trip, but it happens while the button
 * is already showing its spinner, so by the time `router.refresh()` runs the
 * data is sitting in Postgres and the re-render is a single fast read.
 *
 * A failure here is deliberately swallowed: the WRITE already succeeded and the
 * customer must be told so. The cache simply ages a few seconds and the next
 * load refreshes it.
 */
async function resync(customerId: string) {
  // The in-process memo would otherwise serve the pre-skip copy for a few
  // seconds — which is exactly long enough for the customer to tap, see no
  // change, and tap again.
  forgetScreen(customerId);

  // Mark the cached copy dirty IMMEDIATELY, so nothing can serve the old one,
  // then re-read it AFTER the response has gone out.
  //
  // The re-read used to be awaited here, and it is the reason a skip took three
  // to five seconds: the write itself is one fast call, but the action then sat
  // through five more fetches before replying. The customer was waiting on work
  // that only needed to be done before the *next* screen, not before the answer.
  //
  // `after()` runs once the response is sent, so the button stops spinning as
  // soon as the Command Center has confirmed — which is the only moment that
  // was ever load-bearing (docs/03 §6: confirm nothing the server has not).
  await sql()`
    UPDATE customer_profiles SET synced_at = now() - interval '1 day'
     WHERE customer_id = ${customerId}
  `;
  revalidatePath("/me", "layout");

  after(async () => {
    try {
      await refreshCustomer(customerId);
      forgetScreen(customerId);
    } catch {
      // Left dirty on purpose: the next render fetches it properly rather than
      // trusting a copy we know is behind.
    }
  });
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
    await resync(customerId);
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
    await resync(customerId);
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
    await resync(customerId);
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
    await resync(customerId);
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
    forgetScreen(customerId);
    revalidatePath("/me", "layout");
    return { ok: true, message: "Thank you — this goes straight to the kitchen." };
  } catch (error) {
    return explain(error);
  }
}
