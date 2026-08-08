import "server-only";

import { SignJWT, jwtVerify } from "jose";

/**
 * Who is signed in, held in a signed cookie.
 *
 * Stateless, as Next's own guide recommends: the session is a short JWT signed
 * with AUTH_SECRET, so no database read is needed to know who is asking. The
 * cookie carries the account id and the customer id and nothing else — no name,
 * no email, because a cookie is readable by anyone holding the device.
 *
 * [LAW] docs/03 §5.1 — the customer_id used to fetch data ALWAYS comes from
 * here, never from the URL or the request body. That is the whole reason this
 * file exists: a signed cookie cannot be edited by the browser to say C019
 * instead of C018, and a query parameter can.
 */

const COOKIE = "og_session";
const DAYS = 30;

export interface Session {
  accountId: string;
  /** Empty for an owner who is not also a customer. */
  customerId: string;
  /** Balaji. Set from OG_OWNER_EMAIL at sign-in, never from anything the browser sends. */
  owner?: boolean;
}

/**
 * Is this Google address one of Balaji's? Comma-separated, because he has
 * several — a personal one, a business one, and the one he first signed in
 * with. Being the owner must not depend on remembering which.
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.OG_OWNER_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Failing here is correct. A missing secret must never fall back to an
    // unsigned or predictably-signed cookie — that would let anyone mint a
    // session for any customer.
    throw new Error("AUTH_SECRET is not set — see .env.example");
  }
  return new TextEncoder().encode(secret);
}

export async function sign(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(key());
}

/** Returns null for anything that is not a valid, unexpired session. */
export async function verify(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.accountId !== "string") return null;
    if (typeof payload.customerId !== "string") return null;
    return {
      accountId: payload.accountId,
      customerId: payload.customerId,
      owner: payload.owner === true,
    };
  } catch {
    // Expired, tampered with, signed by something else — all the same answer.
    return null;
  }
}

/** Cookie options. Kept in one place so no route can accidentally weaken them. */
export function cookieOptions() {
  return {
    httpOnly: true,        // JavaScript in the page can never read it
    // Secure everywhere except plain-HTTP localhost, where the browser would
    // refuse to store it and sign-in would silently fail in development.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,  // survives the redirect back from Google
    path: "/",
    maxAge: DAYS * 24 * 60 * 60,
  };
}

export const SESSION_COOKIE = COOKIE;
