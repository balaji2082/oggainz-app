import "server-only";

import { sql } from "./accounts";

/**
 * Requests to get in, from people the app does not recognise yet.
 *
 * The identity is already proven — they signed in with Google before reaching
 * this. What is unproven is the claim "I am the person who gets the Elite pack
 * at this phone number", and no automated check can settle that for free.
 *
 * Balaji settling it by hand is not a compromise here: he knows all thirty of
 * these people and talks to them weekly, so recognising a name and number is
 * stronger evidence than a code sent to a phone. It costs nothing, needs no
 * second number and no Meta business account, and it stays comfortable well
 * past a hundred customers.
 */

export interface AccessRequest {
  id: string;
  google_sub: string;
  email: string | null;
  display_name: string | null;
  phone: string;
  kind: "subscriber" | "new";
  goal: string | null;
  status: "pending" | "approved" | "declined" | "handled";
  customer_id: string | null;
  created_at: string;
}

/** Normalise so 98765 43210, +91 98765-43210 and 9876543210 are one number. */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export async function createRequest(input: {
  googleSub: string;
  email: string | null;
  displayName: string | null;
  phone: string;
  kind: "subscriber" | "new";
  goal?: string | null;
}): Promise<void> {
  // Coming back a second time replaces the earlier ask rather than adding to
  // it — the unique index makes the insert fail, and an update is what the
  // person actually meant.
  await sql()`
    INSERT INTO access_requests (google_sub, email, display_name, phone, kind, goal)
    VALUES (${input.googleSub}, ${input.email}, ${input.displayName},
            ${normalisePhone(input.phone)}, ${input.kind}, ${input.goal ?? null})
    ON CONFLICT (google_sub) WHERE status = 'pending'
    DO UPDATE SET phone = EXCLUDED.phone, kind = EXCLUDED.kind,
                  goal = EXCLUDED.goal, created_at = now()
  `;
}

export async function pendingRequests(): Promise<AccessRequest[]> {
  const rows = await sql()`
    SELECT * FROM access_requests WHERE status = 'pending'
    ORDER BY created_at DESC
  `;
  return rows as unknown as AccessRequest[];
}

/** Does this Google account already have a request waiting? */
export async function pendingFor(googleSub: string): Promise<AccessRequest | null> {
  const rows = await sql()`
    SELECT * FROM access_requests
    WHERE google_sub = ${googleSub} AND status = 'pending'
  `;
  return (rows[0] as unknown as AccessRequest) ?? null;
}

/**
 * Approve a subscriber: bind their Google account to a customer record.
 *
 * Returns a reason rather than throwing when it cannot be done, because both
 * failures are ordinary and Balaji needs to read them: the customer may already
 * be linked to someone, or this Google account may already hold another
 * customer's access.
 */
export async function approveRequest(
  id: string,
  customerId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const rows = await sql()`SELECT * FROM access_requests WHERE id = ${id}`;
  const req = rows[0] as unknown as AccessRequest | undefined;
  if (!req) return { ok: false, reason: "That request is no longer there." };

  const cid = customerId.trim().toUpperCase();
  if (!cid) return { ok: false, reason: "Enter the customer id to link them to." };

  try {
    await sql()`
      INSERT INTO accounts (customer_id, email, google_sub, display_name)
      VALUES (${cid}, ${req.email}, ${req.google_sub}, ${req.display_name})
    `;
  } catch {
    // Either the customer already has an active account, or this Google
    // account already has one. Both are guarded by unique indexes.
    return {
      ok: false,
      reason: `Couldn't link ${cid}. Either that customer already has access, or this Google account is already linked to someone. Remove the old access first.`,
    };
  }

  await sql()`
    UPDATE access_requests
    SET status = 'approved', customer_id = ${cid}, decided_at = now()
    WHERE id = ${id}
  `;
  return { ok: true };
}

/** Turn a request down, or mark an enquiry as dealt with. */
export async function closeRequest(
  id: string,
  status: "declined" | "handled"
): Promise<void> {
  await sql()`
    UPDATE access_requests SET status = ${status}, decided_at = now()
    WHERE id = ${id}
  `;
}
