import "server-only";

import { SignJWT, jwtVerify } from "jose";

/**
 * Who just signed in with Google but has no account yet.
 *
 * They are proven — Google verified them seconds ago — but they are not a
 * customer, so there is nothing to put in a session. This holds their identity
 * across the one step where they tell us who they are, and nowhere else.
 *
 * Signed for the same reason the real session is: without it, anyone could
 * craft a cookie claiming to be any Google account and file a request in their
 * name. Short-lived, because it is only meant to survive one form.
 */

export const PENDING_COOKIE = "og_pending";
const MINUTES = 30;

export interface PendingIdentity {
  sub: string;
  email: string | null;
  name: string | null;
}

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function sealPending(identity: PendingIdentity): Promise<string> {
  return new SignJWT({ ...identity })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MINUTES}m`)
    .sign(key());
}

export async function readPending(
  token: string | undefined
): Promise<PendingIdentity | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    return null;
  }
}

export function pendingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MINUTES * 60,
  };
}
