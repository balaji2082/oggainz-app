import { NextResponse, type NextRequest } from "next/server";

import { audit, redeemInvite, sql } from "@/lib/accounts";
import { exchangeCode, FLOW_COOKIE, openFlow } from "@/lib/google";
import { cookieOptions, isOwnerEmail, SESSION_COOKIE, sign } from "@/lib/session";

/**
 * Google sends the customer back here.
 *
 * Two ways this ends:
 *   - the flow carried an invite  → bind this Google account to that customer
 *   - it did not                  → sign in an account already bound
 *
 * Everything that can go wrong lands on /join/error with a short reason. The
 * reasons are deliberately vague about *which* check failed: telling someone
 * whether a token was expired, used or invented helps them guess.
 */

function fail(request: NextRequest, reason: string) {
  const url = new URL("/join/error", request.nextUrl.origin);
  url.searchParams.set("reason", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(FLOW_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // The customer pressed Cancel on Google's screen. Not an error worth alarming
  // them about.
  if (params.get("error")) return fail(request, "cancelled");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail(request, "incomplete");

  const flow = await openFlow(request.cookies.get(FLOW_COOKIE)?.value);
  if (!flow) return fail(request, "expired");

  // [LAW] The state that comes back must match the one we sent. Without this
  // check, a link crafted by someone else could complete THEIR sign-in inside
  // this browser's session and bind their Google account to the customer.
  if (flow.state !== state) return fail(request, "mismatch");

  const redirectUri = new URL("/api/auth/callback/google", request.nextUrl.origin).toString();

  let identity;
  try {
    identity = await exchangeCode(code, flow.verifier, redirectUri);
  } catch {
    return fail(request, "google");
  }

  let accountId: string;
  let customerId: string;

  if (flow.invite) {
    const result = await redeemInvite(flow.invite, {
      email: identity.email ?? undefined,
      googleSub: identity.sub,
      displayName: identity.name ?? undefined,
    });
    if (!result.ok) return fail(request, "invite");
    accountId = result.account.id;
    customerId = result.account.customer_id;
    await audit(accountId, "account.created", { via: "google" });
  } else {
    // A returning customer. Matched on Google's stable subject id rather than
    // on email — an email address can be changed or reused, `sub` cannot.
    const rows = await sql()`
      SELECT id, customer_id FROM accounts
      WHERE google_sub = ${identity.sub} AND NOT disabled
    `;
    const account = rows[0] as { id: string; customer_id: string } | undefined;
    if (!account) {
      // Balaji signing in on one of his own Google addresses. He is the owner,
      // not a subscriber, so he must not need a customer record to get in —
      // requiring one is what locked him out of his own admin page.
      if (isOwnerEmail(identity.email)) {
        const response = NextResponse.redirect(new URL("/admin", request.nextUrl.origin));
        response.cookies.set(
          SESSION_COOKIE,
          await sign({ accountId: "owner", customerId: "", owner: true }),
          cookieOptions()
        );
        response.cookies.delete(FLOW_COOKIE);
        return response;
      }
      return fail(request, "unknown");
    }
    accountId = account.id;
    customerId = account.customer_id;
    await audit(accountId, "signin", { via: "google" });
  }

  await sql()`UPDATE accounts SET last_seen_at = now() WHERE id = ${accountId}`;

  const response = NextResponse.redirect(new URL("/me", request.nextUrl.origin));
  response.cookies.set(SESSION_COOKIE, await sign({ accountId, customerId }), cookieOptions());
  response.cookies.delete(FLOW_COOKIE);
  return response;
}
