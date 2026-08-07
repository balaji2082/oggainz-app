import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE, verify, type Session } from "./session";

/**
 * Who is asking, according to the signed cookie.
 *
 * [LAW] docs/03 §5.1 — this is the ONLY place a page or route may learn which
 * customer it is serving. Never take a customer id from the URL, a form field
 * or a query parameter: those are typed by the browser and can say anything.
 * The cookie is signed, so it cannot.
 *
 * Kept apart from lib/session.ts because that file is pure crypto with no
 * framework in it, which is what lets it be tested directly.
 */
export async function currentSession(): Promise<Session | null> {
  const store = await cookies();
  return verify(store.get(SESSION_COOKIE)?.value);
}
