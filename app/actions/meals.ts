"use server";

import { revalidatePath } from "next/cache";

import { sql } from "@/lib/accounts";
import { forgetRequests } from "@/lib/data";
import { refreshPacksAndMeals } from "@/lib/live";
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
 * WHY THIS IS AWAITED, when the whole point of the last round was not to await
 * it. Skipping a day makes the pack one day longer, so a new day appears at its
 * end — and pausing or resuming moves several. Doing the re-read in the
 * background meant the screen re-rendered from the copy taken BEFORE the write:
 * the day the customer tapped changed (that part is carried across by the
 * confirmed-state in the calendar), but the extra day at the end was missing,
 * and it only turned up when they reloaded the page by hand.
 *
 * What makes waiting affordable is that it is no longer a full refresh. A skip
 * cannot change your name, your address, the kitchen's hours or your invoices,
 * so `refreshPacksAndMeals` reads the two things it CAN change. Two requests
 * rather than six, against a server that answers them one at a time.
 *
 * A failure is still swallowed. The WRITE succeeded and the customer must be
 * told so — a re-read that failed afterwards is our problem, not theirs. The
 * cache is left dirty so the next screen fetches it properly.
 */
async function resync(customerId: string) {
  // The in-process memo would otherwise serve the pre-skip copy for a few
  // seconds — which is exactly long enough for the customer to tap, see no
  // change, and tap again.
  forgetScreen(customerId);

  // A late skip queues a request, and the calendar draws those days as "waiting
  // on us" — so the cached request list has to go with the cached pack.
  forgetRequests(customerId);

  try {
    await refreshPacksAndMeals(customerId);
  } catch {
    // Mark the copy dirty so the next render re-reads rather than trusting one
    // we know is behind. Five minutes, not a day: it only has to beat
    // FRESH_SECONDS (60s), and a day put it past STALE_MINUTES, which made the
    // next render announce "we can't reach the kitchen right now" after a skip
    // that had just succeeded.
    try {
      await sql()`
        UPDATE customer_profiles SET synced_at = now() - interval '5 minutes'
         WHERE customer_id = ${customerId}
      `;
    } catch {
      // Nothing left to try. The memo is already cleared, so the next screen
      // reads Postgres directly rather than serving anything from this request.
    }
  }

  forgetScreen(customerId);
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
