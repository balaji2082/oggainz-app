import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { accountForCustomer, createInvite, INVITE_DAYS } from "@/lib/accounts";

/**
 * Mint an invite link. Called by the Command Center's "Invite to app" button.
 *
 * The direction matters. Invites live in this app's database (docs/03 §3), and
 * the Command Center has no access to Postgres — so the Command Center asks
 * here rather than writing a row itself. That keeps the rule that each database
 * is owned by exactly one application.
 *
 * [LAW] Guarded by its own shared token, never a customer session. This is an
 * admin endpoint: anyone who could call it could mint a link to any customer's
 * account.
 */

function authorised(request: NextRequest): boolean {
  const expected = process.env.OG_ADMIN_TOKEN;
  if (!expected) return false;
  const sent = request.headers.get("X-OG-Admin-Token") ?? "";
  // Constant-time: a plain !== returns early on the first wrong byte, which
  // leaks the token one character at a time to anyone timing the responses.
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!process.env.OG_ADMIN_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "invites are not configured — OG_ADMIN_TOKEN is unset" },
      { status: 503 }
    );
  }
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  let customerId: string;
  try {
    const body = (await request.json()) as { customer_id?: string };
    customerId = (body.customer_id ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }
  if (!customerId) {
    return NextResponse.json({ ok: false, error: "customer_id is required" }, { status: 400 });
  }

  // [LAW] docs/03 §4 — one active account per customer. Say so plainly rather
  // than minting a link that is guaranteed to fail when it is opened.
  const existing = await accountForCustomer(customerId);
  if (existing) {
    return NextResponse.json(
      { ok: false, error: "already_linked",
        message: "This customer already has an account. Remove their access first if they need a new link." },
      { status: 409 }
    );
  }

  const invite = await createInvite(customerId);
  const base = process.env.APP_BASE_URL ?? new URL(request.url).origin;

  return NextResponse.json({
    ok: true,
    url: `${base.replace(/\/$/, "")}/join/${invite.token}`,
    expires_at: invite.expires_at,
    expires_days: INVITE_DAYS,
  });
}
