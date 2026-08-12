"use server";

import { revalidatePath } from "next/cache";

import {
  decideRequest,
  readValidityGlobal,
  setValidityOverride,
  validitySummary,
  writeSettings,
  writeValidityGlobal,
  type ValidityRow,
} from "@/lib/writes";
import { asOwner, explain, type ActionResult } from "./guard";

/**
 * Balaji's side: deciding a late request, and changing the deadline.
 *
 * [LAW] docs/02 §8.5 — he has no cutoff. The deadline is a customer-facing rule
 * and never a constraint on the owner, so nothing here checks a clock.
 */

export async function decide(
  requestId: number,
  outcome: "allowed" | "declined",
  reason?: string
): Promise<ActionResult> {
  try {
    await asOwner();
    if (outcome === "declined" && !(reason ?? "").trim()) {
      // [§8.3] The customer sees this line. A decline with no reason is the
      // thing that turns a decision into a grievance.
      return { ok: false, message: "Give a short reason — they'll see it." };
    }
    const result = await decideRequest(requestId, outcome, reason);
    revalidatePath("/admin", "layout");
    revalidatePath("/me", "layout");
    if (result.already) {
      return { ok: true, message: "That one was already decided." };
    }
    return {
      ok: true,
      message: outcome === "allowed" ? "Allowed." : "Declined, and they've been told why.",
    };
  } catch (error) {
    return explain(error);
  }
}

/**
 * Change the deadline — docs/05 §1, Balaji's requirement of 12 Aug 2026.
 *
 * This is what makes `skip_cutoff_time` genuinely a setting rather than a
 * setting in name only. It writes to the ONE place that knows the cutoff, and
 * every countdown, every validation and the terms page follow from that row.
 *
 * [RULE] docs/02 §9 — the change applies to FUTURE requests only. Anything
 * already in the queue keeps the `cutoff_at` it was born with, which is exactly
 * why that column is stored rather than recomputed.
 */
export async function updateSettings(values: Record<string, string>): Promise<ActionResult> {
  try {
    await asOwner();
    const result = await writeSettings(values);
    revalidatePath("/admin", "layout");
    revalidatePath("/me", "layout");

    const changed = Object.keys(result.changed ?? {});
    if (changed.length === 0) {
      return { ok: false, message: "Nothing changed." };
    }
    const cutoff = result.changed["skip_cutoff_time"];
    return {
      ok: true,
      message: cutoff
        ? `Deadline is now ${cutoff}. Every customer's countdown updates from here.`
        : "Saved.",
    };
  } catch (error) {
    return explain(error);
  }
}

/**
 * Pack validity — docs/05 §1.1, Balaji's requirement of 12 Aug 2026: a global
 * switch he can flip for everyone, and a per-customer override that always
 * wins over it (docs/01 §7.2.0's [LAW] — a promise made to one customer is
 * never silently broken by a flag flipped for everyone else).
 */

export async function loadValidity(): Promise<
  ActionResult<{ globalEnabled: boolean; rows: ValidityRow[] }>
> {
  try {
    await asOwner();
    const [globalEnabled, rows] = await Promise.all([readValidityGlobal(), validitySummary()]);
    return { ok: true, message: "", data: { globalEnabled, rows } };
  } catch (error) {
    return explain(error);
  }
}

export async function toggleValidityGlobal(enabled: boolean): Promise<ActionResult> {
  try {
    await asOwner();
    const result = await writeValidityGlobal(enabled);
    revalidatePath("/admin", "layout");
    revalidatePath("/me", "layout");
    const n = result.packsAffected;
    return {
      ok: true,
      message: enabled
        ? `Validity is on. ${n} pack${n === 1 ? "" : "s"} with no decision of their own just picked it up — anything you've already set stays as you left it.`
        : `Validity is off for everyone without their own decision. ${n} pack${n === 1 ? "" : "s"} affected.`,
    };
  } catch (error) {
    return explain(error);
  }
}

export async function setPackValidity(
  subscriptionId: string,
  override: "on" | "off" | null,
  opts: { expiresOn?: string; note?: string } = {}
): Promise<ActionResult> {
  try {
    await asOwner();
    const result = await setValidityOverride(subscriptionId, override, opts);
    revalidatePath("/admin", "layout");
    revalidatePath("/me", "layout");
    const label =
      override === null
        ? "This pack now follows the global switch."
        : result.enforced
          ? `Validity on — expires ${result.expiresOn ?? "unset"}.`
          : "Validity off for this pack.";
    return { ok: true, message: label };
  } catch (error) {
    return explain(error);
  }
}
