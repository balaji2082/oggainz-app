import "server-only";

import { currentSession } from "@/lib/current-user";
import { CommandCenterDown } from "@/lib/commandcenter";
import { WriteRefused } from "@/lib/writes";

/**
 * Who is allowed to do what, in one place.
 *
 * [LAW] docs/03 §5.1 — a customer id is taken from the SIGNED SESSION and from
 * nowhere else. Not from the URL, not from a form field, not from an argument
 * the client passed. Every action in this folder starts by calling `asCustomer`
 * or `asOwner`, so there is no path into a write that skipped the check.
 *
 * Server Actions rather than API routes on purpose: an action cannot be called
 * without Next's own origin check, there is no URL for someone to curl, and the
 * customer id never travels over the wire at all — it is read from the cookie on
 * the server, so there is nothing for the browser to tamper with.
 */

export class NotAllowed extends Error {
  constructor(message = "Please sign in again.") {
    super(message);
    this.name = "NotAllowed";
  }
}

/** The signed-in customer's id. Throws rather than returning a default. */
export async function asCustomer(): Promise<{ customerId: string; accountId: string }> {
  const session = await currentSession();
  if (!session?.customerId) throw new NotAllowed();
  return { customerId: session.customerId, accountId: session.accountId };
}

/** Balaji. `owner` is set at sign-in from OG_OWNER_EMAIL, never from the browser. */
export async function asOwner(): Promise<void> {
  const session = await currentSession();
  if (!session?.owner) throw new NotAllowed("That's not yours to change.");
}

/** What every action returns, so the UI has one shape to render. */
export interface ActionResult<T = unknown> {
  ok: boolean;
  /** Always safe to show a customer. Never a stack trace or a raw error. */
  message: string;
  data?: T;
}

/**
 * Turn anything thrown into something a person can read.
 *
 * The three cases are genuinely different and must not be flattened into "went
 * wrong": a refusal is a decision they need to understand, an unreachable
 * Command Center is temporary and worth retrying, and anything else is our bug
 * and should say so rather than blaming them.
 */
export function explain<T = unknown>(error: unknown): ActionResult<T> {
  if (error instanceof NotAllowed) {
    return { ok: false, message: error.message };
  }
  if (error instanceof WriteRefused) {
    return { ok: false, message: error.message };
  }
  if (error instanceof CommandCenterDown) {
    // [LAW] docs/03 §6 — writes queue nothing. Say so plainly; never imply it
    // was saved and will go through later, because it will not.
    return {
      ok: false,
      message: "We couldn't reach the kitchen just now. Nothing was changed — please try again in a moment.",
    };
  }
  if (error instanceof Error && error.message) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: "Something went wrong. Please try again." };
}
