import {
  CommandCenterDown,
  fetchAddresses,
  type CommandCenterAddress,
} from "./commandcenter";
import { sql } from "./accounts";

/**
 * The customer's own details — name, phone, addresses — cached in the app.
 *
 * DECISION, Balaji, 4 Aug 2026: keep a copy here rather than asking the Command
 * Center every time, so a customer's screen still works when it is unreachable.
 *
 * The copy is a PHOTOGRAPH, never the original:
 *
 *   - the Command Center stays the source of truth (docs/03 §1.4)
 *   - nothing here is ever edited by the app, and nothing is written back
 *   - every row carries `synced_at`, and anything served from a stale row is
 *     labelled "as of <time>" so an old address can never masquerade as current
 *
 * That last point is the whole reason this is safe. A copy that cannot say how
 * old it is will eventually send food to an address someone moved out of.
 */

/** Older than this and we refresh before serving, if we can reach the API. */
const FRESH_MINUTES = 15;

export interface Profile {
  customer_id: string;
  name: string | null;
  phone: string | null;
  locality: string | null;
  addresses: CommandCenterAddress[];
  synced_at: Date;
}

export interface ProfileResult {
  profile: Profile | null;
  /** True when this came from a copy we could not refresh just now. */
  stale: boolean;
  /** Present only when stale — show it to the customer, do not hide it. */
  asOf: Date | null;
}

function minutesSince(when: Date): number {
  return (Date.now() - new Date(when).getTime()) / 60000;
}

async function readCache(customerId: string): Promise<Profile | null> {
  const rows = await sql()`
    SELECT customer_id, name, phone, locality, addresses, synced_at
    FROM customer_profiles WHERE customer_id = ${customerId}
  `;
  return (rows[0] as unknown as Profile) ?? null;
}

/**
 * Refresh one customer's copy from the Command Center.
 *
 * Returns the fresh profile, or throws CommandCenterDown if it is unreachable.
 * Callers that can tolerate old data should use `getProfile` instead, which
 * falls back rather than throwing.
 */
export async function refreshProfile(customerId: string): Promise<Profile> {
  const addresses = await fetchAddresses(customerId);
  const rows = await sql()`
    INSERT INTO customer_profiles (customer_id, addresses, synced_at)
    VALUES (${customerId}, ${JSON.stringify(addresses)}::jsonb, now())
    ON CONFLICT (customer_id) DO UPDATE
      SET addresses = EXCLUDED.addresses, synced_at = now()
    RETURNING customer_id, name, phone, locality, addresses, synced_at
  `;
  return rows[0] as unknown as Profile;
}

/**
 * The customer's details, refreshed if they are old and the Command Center is
 * reachable, falling back to the cached copy if it is not.
 *
 * [LAW] docs/03 §6 — never present a stale read as current. When the fallback
 * is used, `stale` is true and `asOf` says how old it is, and the interface
 * must show that rather than swallow it.
 */
export async function getProfile(customerId: string): Promise<ProfileResult> {
  const cached = await readCache(customerId);

  if (cached && minutesSince(cached.synced_at) < FRESH_MINUTES) {
    return { profile: cached, stale: false, asOf: null };
  }

  try {
    const fresh = await refreshProfile(customerId);
    return { profile: fresh, stale: false, asOf: null };
  } catch (error) {
    if (!(error instanceof CommandCenterDown)) throw error;
    // Unreachable. An old answer clearly labelled beats no answer at all —
    // but it must be labelled.
    if (cached) {
      return { profile: cached, stale: true, asOf: new Date(cached.synced_at) };
    }
    return { profile: null, stale: true, asOf: null };
  }
}

/** Drop a customer's cached copy — used when their account is revoked. */
export async function forgetProfile(customerId: string): Promise<void> {
  await sql()`DELETE FROM customer_profiles WHERE customer_id = ${customerId}`;
}
