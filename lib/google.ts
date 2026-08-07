import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Google sign-in (docs/03 §9).
 *
 * The standard authorisation-code flow, with two protections that are easy to
 * leave out and expensive to leave out:
 *
 *   state — a random value we send to Google and check when it comes back. It
 *     is what stops someone sending your browser a link that completes THEIR
 *     sign-in inside YOUR session. Without it, an attacker can bind their own
 *     Google account to a customer's app account.
 *
 *   PKCE — a secret we keep, sending only its hash to Google. Even if the
 *     authorisation code leaks in a redirect, browser history or a log, it
 *     cannot be exchanged without the original secret.
 *
 * Both live in a short-lived signed cookie between the two requests, because
 * there is nowhere else to keep them — the browser leaves and comes back.
 */

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Google's public keys, fetched and cached by jose. */
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export const FLOW_COOKIE = "og_oauth";
/** The round trip to Google should take seconds. Ten minutes is generous. */
const FLOW_SECONDS = 600;

export interface FlowState {
  state: string;
  verifier: string;
  /** The invite being redeemed, if this sign-in started from a join link. */
  invite?: string;
}

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set — see .env.example");
  return new TextEncoder().encode(secret);
}

function credentials() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
  }
  return { id, secret };
}

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

/** Start a sign-in: the URL to send the browser to, plus what to remember. */
export function startFlow(invite?: string): { state: string; verifier: string } {
  return {
    state: base64url(randomBytes(24)),
    verifier: base64url(randomBytes(32)),
  };
}

export function challengeFor(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function authUrl(
  redirectUri: string,
  state: string,
  verifier: string
): string {
  const { id } = credentials();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: "code",
    // Only the two basic scopes. Anything more triggers a Google review that
    // takes weeks, and we do not need anything more.
    scope: "openid email profile",
    state,
    code_challenge: challengeFor(verifier),
    code_challenge_method: "S256",
    // Always show the account chooser: several people share a phone, and
    // silently reusing whichever Google account is already signed in is how the
    // wrong person ends up bound to a customer.
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${params}`;
}

/** Remember state + verifier across the redirect, signed so it cannot be forged. */
export async function sealFlow(flow: FlowState): Promise<string> {
  return new SignJWT({ ...flow })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${FLOW_SECONDS}s`)
    .sign(key());
}

export async function openFlow(token: string | undefined): Promise<FlowState | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.state !== "string") return null;
    if (typeof payload.verifier !== "string") return null;
    return {
      state: payload.state,
      verifier: payload.verifier,
      invite: typeof payload.invite === "string" ? payload.invite : undefined,
    };
  } catch {
    return null;
  }
}

export interface GoogleIdentity {
  sub: string;
  email: string | null;
  name: string | null;
}

/**
 * Swap the authorisation code for tokens, then verify the identity token.
 *
 * The token is verified against Google's published keys rather than merely
 * decoded — checking the signature, the issuer and that the audience is OUR
 * client id. An id_token that is valid but issued for a different application
 * must not sign anyone in here.
 */
export async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string
): Promise<GoogleIdentity> {
  const { id, secret } = credentials();

  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google refused the code exchange: ${response.status} ${detail}`);
  }

  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Google returned no id_token");

  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: GOOGLE_ISSUERS,
    audience: id,
  });

  if (typeof payload.sub !== "string") throw new Error("id_token has no subject");

  // An unverified email must not be trusted: anyone can put someone else's
  // address on an account they control unless Google says it is confirmed.
  const verified = payload.email_verified === true;

  return {
    sub: payload.sub,
    email: verified && typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}

export function flowCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: FLOW_SECONDS,
  };
}
