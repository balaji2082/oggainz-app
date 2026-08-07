import { NextResponse, type NextRequest } from "next/server";

import { authUrl, flowCookieOptions, FLOW_COOKIE, sealFlow, startFlow } from "@/lib/google";

/**
 * Start a Google sign-in.
 *
 *   /api/auth/google              — a returning customer signing in
 *   /api/auth/google?invite=<t>   — someone opening a join link for the first time
 *
 * Sends the browser to Google, remembering the CSRF state and the PKCE secret
 * in a short-lived signed cookie so the callback can check them.
 */
export async function GET(request: NextRequest) {
  const invite = request.nextUrl.searchParams.get("invite") ?? undefined;
  const { state, verifier } = startFlow(invite);

  // Built from the origin actually being served, so this works on localhost and
  // on oggainz.com without a second setting to keep in step. Google will only
  // accept it if it exactly matches a URI registered in the console, which is
  // what stops this being pointed anywhere else.
  const redirectUri = new URL("/api/auth/callback/google", request.nextUrl.origin).toString();

  const response = NextResponse.redirect(authUrl(redirectUri, state, verifier));
  response.cookies.set(
    FLOW_COOKIE,
    await sealFlow({ state, verifier, invite }),
    flowCookieOptions()
  );
  return response;
}
