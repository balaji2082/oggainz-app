/**
 * Exercise the invite / account flow against the real Neon database.
 *
 *   node scripts/test-accounts.mjs
 *
 * Uses customer ids prefixed ZZTEST and deletes them at the end, so it never
 * collides with a real customer. Safe to run whenever.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) {
  const env = readFileSync(join(HERE, "..", ".env.local"), "utf8");
  process.env.DATABASE_URL = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
}

// Node strips the types from lib/accounts.ts on import, so the real module is
// tested rather than a copy of it.
const { createInvite, openInvite, redeemInvite, accountForCustomer, audit, sql } =
  await import("../lib/accounts.ts");

let fails = 0;
function check(label, ok, extra = "") {
  console.log(ok ? `  ok   ${label}` : `  FAIL ${label} ${extra}`);
  if (!ok) fails += 1;
}

const CID = "ZZTEST01";
const CID2 = "ZZTEST02";

async function cleanup() {
  await sql()`DELETE FROM audit_log WHERE account_id IN
              (SELECT id FROM accounts WHERE customer_id LIKE 'ZZTEST%')`;
  await sql()`DELETE FROM invites WHERE customer_id LIKE 'ZZTEST%'`;
  await sql()`DELETE FROM accounts WHERE customer_id LIKE 'ZZTEST%'`;
}

await cleanup();

console.log("== invites ==");
const invite = await createInvite(CID);
check("an invite is created", !!invite.token);
check("the token is long enough to be unguessable", invite.token.length >= 40,
      invite.token.length);
check("it expires in the future", new Date(invite.expires_at) > new Date());
const days = (new Date(invite.expires_at) - new Date()) / 86400000;
check("it expires in about 7 days", days > 6.9 && days < 7.1, days.toFixed(2));

check("a valid token opens", (await openInvite(invite.token)) !== null);
check("a made-up token does not", (await openInvite("not-a-real-token")) === null);

const second = await createInvite(CID);
check("two invites for one customer have different tokens",
      second.token !== invite.token);

console.log("\n== redeeming ==");
const r = await redeemInvite(invite.token, {
  email: "test@example.com", googleSub: "google-zztest-1", displayName: "Test",
});
check("the invite redeems", r.ok, r.ok ? "" : r.reason);
check("the account is bound to the right customer",
      r.ok && r.account.customer_id === CID);
check("the account is found by customer id",
      (await accountForCustomer(CID))?.id === (r.ok ? r.account.id : null));

console.log("\n== the laws ==");
const again = await redeemInvite(invite.token, { email: "x@example.com" });
check("the same link cannot be used twice", !again.ok, again.ok ? "REUSED" : "");

// The second outstanding invite must also fail — the customer already has one.
const other = await redeemInvite(second.token, { email: "y@example.com" });
check("a second account for the same customer is refused",
      !other.ok, other.ok ? "TWO ACCOUNTS" : "");

check("the failed attempt left no orphan account",
      (await sql()`SELECT COUNT(*)::int AS n FROM accounts
                   WHERE customer_id = ${CID}`)[0].n === 1);

const expired = await createInvite(CID2);
await sql()`UPDATE invites SET expires_at = now() - interval '1 day'
            WHERE token = ${expired.token}`;
check("an expired link does not open", (await openInvite(expired.token)) === null);
const exp = await redeemInvite(expired.token, { email: "z@example.com" });
check("an expired link cannot be redeemed", !exp.ok);
check("expired and used give the SAME message (no hints to a guesser)",
      !exp.ok && !again.ok && exp.reason === again.reason, exp.ok ? "" : exp.reason);

console.log("\n== disabling ==");
if (r.ok) {
  await sql()`UPDATE accounts SET disabled = true WHERE id = ${r.account.id}`;
  check("a disabled account is no longer found",
        (await accountForCustomer(CID)) === null);
  const third = await createInvite(CID);
  const re = await redeemInvite(third.token, { email: "new@example.com" });
  check("a customer can be re-invited after being disabled", re.ok,
        re.ok ? "" : re.reason);
}

console.log("\n== audit ==");
const acct = await accountForCustomer(CID);
await audit(acct?.id ?? null, "test.signin", { via: "test" }, "hashed-ip");
const [{ n }] = await sql()`SELECT COUNT(*)::int AS n FROM audit_log
                            WHERE action = 'test.signin'`;
check("an audit row is written", n >= 1);
const [{ raw }] = await sql()`SELECT COUNT(*)::int AS raw FROM audit_log
                              WHERE ip_hash ~ '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$'`;
check("no raw IP address is stored anywhere", raw === 0);

await cleanup();
const [{ left }] = await sql()`SELECT COUNT(*)::int AS left FROM accounts
                               WHERE customer_id LIKE 'ZZTEST%'`;
check("test data cleaned up", left === 0);

console.log();
if (fails) {
  console.log(`${fails} check(s) FAILED`);
  process.exit(1);
}
console.log("invite and account flow works.");
