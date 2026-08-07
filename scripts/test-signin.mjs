/**
 * Sign-in flow tests against a running server.
 *
 *   npm run dev          (in another terminal)
 *   node scripts/test-signin.mjs
 *
 * The final hop — a human choosing a Google account — cannot be automated, so
 * this covers everything either side of it: that we send Google the right
 * request, and that the callback refuses everything it should.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "./_resolve-ts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(HERE, "..", ".env.local"), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"\n]*)"?/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const BASE = process.env.TEST_BASE || "http://localhost:3000";
const { createInvite, sql } = await import("../lib/accounts.ts");

let fails = 0;
function check(label, ok, extra = "") {
  console.log(ok ? `  ok   ${label}` : `  FAIL ${label} ${extra}`);
  if (!ok) fails += 1;
}

const res = await fetch(BASE).catch(() => null);
if (!res) {
  console.error(`Nothing is serving ${BASE}. Run "npm run dev" first.`);
  process.exit(1);
}

console.log("== starting a sign-in ==");
let r = await fetch(`${BASE}/api/auth/google`, { redirect: "manual" });
check("it redirects", r.status === 307 || r.status === 302, r.status);
const to = new URL(r.headers.get("location"));
check("straight to Google", to.host === "accounts.google.com", to.host);
check("with our client id",
      to.searchParams.get("client_id") === process.env.GOOGLE_CLIENT_ID);
check("asking for the authorisation code flow",
      to.searchParams.get("response_type") === "code");
check("only the two basic scopes — nothing that needs Google's review",
      to.searchParams.get("scope") === "openid email profile",
      to.searchParams.get("scope"));
check("with a CSRF state", (to.searchParams.get("state") || "").length > 20);
check("with PKCE, SHA-256",
      to.searchParams.get("code_challenge_method") === "S256" &&
      (to.searchParams.get("code_challenge") || "").length > 20);
check("the account chooser is forced",
      to.searchParams.get("prompt") === "select_account");
check("the redirect URI matches what is registered in Google",
      to.searchParams.get("redirect_uri") === `${BASE}/api/auth/callback/google`,
      to.searchParams.get("redirect_uri"));

const flowCookie = (r.headers.get("set-cookie") || "");
check("the flow cookie is set", flowCookie.includes("og_oauth"));
check("...httpOnly", /httponly/i.test(flowCookie));
check("...and short-lived", /max-age=600/i.test(flowCookie), flowCookie.slice(0, 90));
check("the PKCE secret is NOT in the cookie in readable form",
      !flowCookie.includes(to.searchParams.get("code_challenge")));

console.log("\n== the callback refuses what it should ==");
r = await fetch(`${BASE}/api/auth/callback/google`, { redirect: "manual" });
check("no code at all -> error page",
      (r.headers.get("location") || "").includes("/join/error"), r.status);

r = await fetch(`${BASE}/api/auth/callback/google?code=x&state=y`, { redirect: "manual" });
check("a code with no flow cookie is refused",
      (r.headers.get("location") || "").includes("reason=expired"),
      r.headers.get("location"));

// With a real flow cookie, but the wrong state coming back.
const cookie = flowCookie.split(";")[0];
r = await fetch(`${BASE}/api/auth/callback/google?code=x&state=WRONG`, {
  redirect: "manual", headers: { cookie },
});
check("a MISMATCHED state is refused (the CSRF check)",
      (r.headers.get("location") || "").includes("reason=mismatch"),
      r.headers.get("location"));

r = await fetch(`${BASE}/api/auth/callback/google?error=access_denied`, { redirect: "manual" });
check("pressing cancel is handled gently",
      (r.headers.get("location") || "").includes("reason=cancelled"));

console.log("\n== the join page ==");
const CID = "ZZSIGNIN";
await sql()`DELETE FROM accounts WHERE customer_id = ${CID}`;
await sql()`DELETE FROM invites WHERE customer_id = ${CID}`;
const invite = await createInvite(CID);

let html = await (await fetch(`${BASE}/join/${invite.token}`)).text();
check("a valid invite shows the sign-in button", html.includes("Continue with Google"));
check("and points at the invite", html.includes(`invite=${encodeURIComponent(invite.token)}`));

html = await (await fetch(`${BASE}/join/not-a-real-token`)).text();
check("a bad token says expired, without a button",
      html.includes("expired") && !html.includes("Continue with Google"));

await sql()`UPDATE invites SET used_at = now() WHERE token = ${invite.token}`;
html = await (await fetch(`${BASE}/join/${invite.token}`)).text();
check("a used invite is dead", html.includes("expired"));

console.log("\n== error wording gives nothing away ==");
const reasons = ["invite", "expired", "mismatch"];
const bodies = [];
for (const reason of reasons) {
  bodies.push(await (await fetch(`${BASE}/join/error?reason=${reason}`)).text());
}
check("no error page reveals which check failed",
      bodies.every((b) => !/signature|token invalid|not found in database/i.test(b)));

console.log("\n== signed out ==");
r = await fetch(`${BASE}/me`, { redirect: "manual" });
check("/me with no session sends you away",
      r.status === 307 || r.status === 302, r.status);

r = await fetch(`${BASE}/api/auth/logout`, { redirect: "manual" });
const cleared = r.headers.get("set-cookie") || "";
check("logout clears the session cookie",
      cleared.includes("og_session=") && /max-age=0|expires=thu, 01 jan 1970/i.test(cleared),
      cleared.slice(0, 80));

await sql()`DELETE FROM invites WHERE customer_id = ${CID}`;
await sql()`DELETE FROM accounts WHERE customer_id = ${CID}`;

console.log();
if (fails) {
  console.log(`${fails} check(s) FAILED`);
  process.exit(1);
}
console.log("sign-in flow is sound up to Google's own screen.");
