import { NextResponse } from "next/server";

import { sql } from "@/lib/accounts";

/**
 * Is everything this app depends on actually reachable?
 *
 * Exists because the two halves live on different machines and "it doesn't
 * work" is otherwise impossible to narrow down: is the Command Center asleep,
 * is the token wrong, is the database unreachable? This answers that in one
 * request, from anywhere, without needing to sign in.
 *
 * Deliberately reveals NO secrets — only whether each connection works, and how
 * long it took. A token is reported as configured or not, never echoed.
 */
export async function GET() {
  const checks: Record<string, unknown> = {};

  // --- the app's own database ---
  const dbStart = Date.now();
  try {
    await sql()`SELECT 1`;
    checks.database = { ok: true, ms: Date.now() - dbStart };
  } catch (error) {
    checks.database = { ok: false, error: (error as Error).message.slice(0, 120) };
  }

  // --- the Command Center ---
  const base = process.env.OG_API_BASE;
  const token = process.env.OG_API_TOKEN;
  if (!base || !token) {
    checks.commandCenter = {
      ok: false,
      configured: false,
      hint: "OG_API_BASE / OG_API_TOKEN are not set on this deployment",
    };
  } else {
    const ccStart = Date.now();
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/settings/public`, {
        headers: { "X-OG-Service-Token": token },
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      const ms = Date.now() - ccStart;
      if (response.ok) {
        const body = (await response.json()) as { settings?: Record<string, unknown> };
        checks.commandCenter = {
          ok: true,
          ms,
          // Proof it is really talking to the Command Center and not something
          // that merely returns 200 — this value comes from its settings table.
          cutoffTime: body.settings?.skip_cutoff_time ?? null,
        };
      } else if (response.status === 401) {
        checks.commandCenter = {
          ok: false, ms, status: 401,
          hint: "reachable, but the token here does not match OG_API_TOKEN on PythonAnywhere",
        };
      } else if (response.status === 503) {
        checks.commandCenter = {
          ok: false, ms, status: 503,
          hint: "reachable, but OG_API_TOKEN is not set on PythonAnywhere",
        };
      } else if (response.status === 404) {
        checks.commandCenter = {
          ok: false, ms, status: 404,
          hint: "reachable, but the API is not deployed there yet — needs git pull + Reload",
        };
      } else {
        checks.commandCenter = { ok: false, ms, status: response.status };
      }
    } catch (error) {
      checks.commandCenter = {
        ok: false,
        ms: Date.now() - ccStart,
        hint: "could not be reached at all — asleep, down, or the wrong address",
        error: (error as Error).message.slice(0, 120),
      };
    }
  }

  checks.signIn = {
    googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    sessionSecretSet: Boolean(process.env.AUTH_SECRET),
  };
  checks.invites = { configured: Boolean(process.env.OG_ADMIN_TOKEN) };

  const ok =
    (checks.database as { ok: boolean }).ok &&
    (checks.commandCenter as { ok: boolean }).ok;

  return NextResponse.json({ ok, at: new Date().toISOString(), checks }, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
