import { NextResponse, type NextRequest } from "next/server";

import { FLOW_COOKIE } from "@/lib/google";
import { SESSION_COOKIE } from "@/lib/session";

/** Sign out: drop the session cookie and go back to the front page. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(FLOW_COOKIE);
  return response;
}
