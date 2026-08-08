import { randomBytes } from "node:crypto";

import { neon } from "@neondatabase/serverless";

/**
 * The app's own database — logins and invites, nothing else.
 *
 * SAFETY: this database holds no business data. Not a name, not a phone number,
 * not an address, not a meal, not a rupee — only `customer_id` as a reference
 * to the Command Center, which remains the system of record until cutover
 * (docs/03 §1.1). If this database were deleted tomorrow the business would
 * lose nobody's login and not one meal record. That is the test every table
 * here has to pass.
 *
 * Schema lives in db/migrations. Apply with `npm run db:migrate`, verify with
 * `npm run db:check`.
 */

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
    );
  }
  return neon(url);
}

// The exact type connect() hands back. Writing ReturnType<typeof neon> instead
// widens the generics to <boolean, boolean> and stops matching.
type Sql = ReturnType<typeof connect>;

// Created on first use rather than at import, so a build without the env var
// set fails where it is used instead of failing to build at all.
let handle: Sql | null = null;

export function sql(): Sql {
  if (!handle) handle = connect();
  return handle;
}

export interface Account {
  id: string;
  customer_id: string;
  email: string | null;
  google_sub: string | null;
  display_name: string | null;
  disabled: boolean;
}

export interface Invite {
  token: string;
  customer_id: string;
  expires_at: Date;
  used_at: Date | null;
}

/** How long an invite link stays good for. docs/03 §4. */
export const INVITE_DAYS = 7;

/**
 * Create a single-use invite for a customer.
 *
 * 32 random bytes: long enough that guessing one is not a strategy. The link is
 * the proof of identity, so it must be unguessable — it travels over WhatsApp,
 * the channel Balaji already uses with every customer, which is why this is
 * both cheaper and safer than an SMS OTP.
 */
export async function createInvite(customerId: string): Promise<Invite> {
  const token = randomBytes(32).toString("base64url");
  const rows = await sql()`
    INSERT INTO invites (token, customer_id, expires_at)
    VALUES (${token}, ${customerId}, now() + ${`${INVITE_DAYS} days`}::interval)
    RETURNING token, customer_id, expires_at, used_at
  `;
  return rows[0] as unknown as Invite;
}

/**
 * Look up an invite that can still be used.
 *
 * Returns null for a token that does not exist, has expired, or has already
 * been redeemed — the caller must not be able to tell those apart, because
 * distinguishing them tells an attacker which guesses were close.
 */
export async function openInvite(token: string): Promise<Invite | null> {
  const rows = await sql()`
    SELECT token, customer_id, expires_at, used_at FROM invites
    WHERE token = ${token} AND used_at IS NULL AND expires_at > now()
  `;
  return (rows[0] as unknown as Invite) ?? null;
}

/**
 * Why a link did not work.
 *
 * `openInvite` deliberately cannot tell these apart — it returns null for all of
 * them, so a guesser learns nothing. But a real customer clicking their own link
 * a second time deserves better than "expired, ask for a new one", so the join
 * page asks this instead. Distinguishing them is safe: you need a valid 32-byte
 * token to see any difference at all, and knowing a token is spent gets you no
 * closer to getting in.
 */
export async function inviteState(
  token: string
): Promise<"ok" | "used" | "expired" | "unknown"> {
  const rows = await sql()`
    SELECT used_at, expires_at FROM invites WHERE token = ${token}
  `;
  const row = rows[0] as { used_at: string | null; expires_at: string } | undefined;
  if (!row) return "unknown";
  if (row.used_at) return "used";
  if (new Date(row.expires_at) <= new Date()) return "expired";
  return "ok";
}

/**
 * Remove a customer's access, so they — or the right person — can be invited
 * again. Disabled, never deleted: the row is referenced by the invite that
 * created it, and the history of who had access when is worth keeping.
 */
export async function unlinkCustomer(customerId: string): Promise<void> {
  await sql()`UPDATE accounts SET disabled = true WHERE customer_id = ${customerId}`;
  await sql()`DELETE FROM invites WHERE customer_id = ${customerId} AND used_at IS NULL`;
  await sql()`DELETE FROM customer_profiles WHERE customer_id = ${customerId}`;
}

/** Everyone who currently has access, newest first. */
export async function linkedAccounts(): Promise<
  { customer_id: string; email: string | null; last_seen_at: string | null }[]
> {
  const rows = await sql()`
    SELECT customer_id, email, last_seen_at FROM accounts
    WHERE NOT disabled ORDER BY created_at DESC
  `;
  return rows as unknown as {
    customer_id: string;
    email: string | null;
    last_seen_at: string | null;
  }[];
}

export async function accountForCustomer(
  customerId: string
): Promise<Account | null> {
  const rows = await sql()`
    SELECT id, customer_id, email, google_sub, display_name, disabled
    FROM accounts WHERE customer_id = ${customerId} AND NOT disabled
  `;
  return (rows[0] as unknown as Account) ?? null;
}

/**
 * Redeem an invite: bind this Google/email identity to that customer.
 *
 * [LAW] docs/03 §4 — one active account per customer, and a second binding
 * attempt is refused rather than silently merged. The unique index does the
 * refusing, so this holds even if two requests arrive at the same moment. The
 * invite is burned in the same statement chain, so a link cannot be used twice.
 */
export async function redeemInvite(
  token: string,
  identity: { email?: string; googleSub?: string; displayName?: string }
): Promise<{ ok: true; account: Account } | { ok: false; reason: string }> {
  const invite = await openInvite(token);
  if (!invite) return { ok: false, reason: "This link has expired or been used." };

  const existing = await accountForCustomer(invite.customer_id);
  if (existing) {
    return { ok: false, reason: "This customer already has an account." };
  }

  let account: Account;
  try {
    const rows = await sql()`
      INSERT INTO accounts (customer_id, email, google_sub, display_name)
      VALUES (${invite.customer_id}, ${identity.email ?? null},
              ${identity.googleSub ?? null}, ${identity.displayName ?? null})
      RETURNING id, customer_id, email, google_sub, display_name, disabled
    `;
    account = rows[0] as unknown as Account;
  } catch {
    // The unique index fired — someone else bound this customer first.
    return { ok: false, reason: "This customer already has an account." };
  }

  // Burn the invite, but only if it is still unused: two people opening the
  // same link at once must not both get in.
  const burned = await sql()`
    UPDATE invites SET used_at = now(), used_by = ${account.id}
    WHERE token = ${token} AND used_at IS NULL
    RETURNING token
  `;
  if (burned.length === 0) {
    await sql()`DELETE FROM accounts WHERE id = ${account.id}`;
    return { ok: false, reason: "This link has expired or been used." };
  }

  return { ok: true, account };
}

/** Record what an account did. IPs are hashed by the caller, never stored raw. */
export async function audit(
  accountId: string | null,
  action: string,
  detail?: unknown,
  ipHash?: string
): Promise<void> {
  await sql()`
    INSERT INTO audit_log (account_id, action, detail, ip_hash)
    VALUES (${accountId}, ${action},
            ${detail ? JSON.stringify(detail) : null}::jsonb, ${ipHash ?? null})
  `;
}
