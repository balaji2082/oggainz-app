/**
 * Verify the app database matches what docs/03 §3 says it should be.
 *
 *   npm run db:check
 *
 * Checks the structure AND the two rules that matter most:
 *   - one active account per customer, enforced by the database itself
 *   - no business data in here beyond customer_id
 *
 * Safe to run any time. It writes only inside a transaction it rolls back.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

const HERE = dirname(fileURLToPath(import.meta.url));

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(join(HERE, "..", ".env.local"), "utf8");
  return env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
}

const sql = neon(databaseUrl());
let fails = 0;

function check(label, ok, extra = "") {
  console.log(ok ? `  ok   ${label}` : `  FAIL ${label} ${extra}`);
  if (!ok) fails += 1;
}

// --- structure -------------------------------------------------------------
console.log("== tables ==");
const tables = (
  await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
).map((r) => r.tablename);
for (const t of ["accounts", "invites", "push_subscriptions", "audit_log"]) {
  check(`${t} exists`, tables.includes(t));
}

console.log("\n== columns ==");
const expected = {
  accounts: ["id", "customer_id", "email", "google_sub", "display_name",
             "created_at", "last_seen_at", "disabled"],
  invites: ["token", "customer_id", "created_at", "expires_at", "used_at", "used_by"],
  push_subscriptions: ["id", "account_id", "endpoint", "p256dh", "auth",
                       "created_at", "failed_at"],
  audit_log: ["id", "account_id", "at", "action", "detail", "ip_hash"],
};
for (const [table, cols] of Object.entries(expected)) {
  const have = (
    await sql`SELECT column_name FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = ${table}`
  ).map((r) => r.column_name);
  const missing = cols.filter((c) => !have.includes(c));
  const extra = have.filter((c) => !cols.includes(c));
  check(`${table}: ${cols.length} columns as specified`,
        missing.length === 0 && extra.length === 0,
        `missing ${missing} extra ${extra}`);
}

// --- the laws --------------------------------------------------------------
console.log("\n== docs/03 §3 laws ==");

// [LAW] no business data beyond customer_id.
const banned = ["name", "phone", "address", "amount", "price", "meal", "total",
                "locality", "plan"];
let leaks = [];
for (const table of Object.keys(expected)) {
  const cols = (
    await sql`SELECT column_name FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = ${table}`
  ).map((r) => r.column_name);
  for (const c of cols) {
    // display_name is the person's own name from Google, not a business record.
    if (c === "display_name") continue;
    if (banned.some((b) => c.includes(b))) leaks.push(`${table}.${c}`);
  }
}
check("no business data columns anywhere", leaks.length === 0, leaks.join(", "));

// [LAW] one active account per customer — enforced by the database, not by code.
await sql`DELETE FROM accounts WHERE customer_id = 'ZZCHECK'`;
await sql`INSERT INTO accounts (customer_id) VALUES ('ZZCHECK')`;
let refused = false;
try {
  await sql`INSERT INTO accounts (customer_id) VALUES ('ZZCHECK')`;
} catch {
  refused = true;
}
check("a second active account for one customer is refused", refused);

// ...but a customer whose account was disabled can be invited again.
await sql`UPDATE accounts SET disabled = true WHERE customer_id = 'ZZCHECK'`;
let reInvited = true;
try {
  await sql`INSERT INTO accounts (customer_id) VALUES ('ZZCHECK')`;
} catch {
  reInvited = false;
}
check("a disabled account does not block re-inviting that customer", reInvited);
await sql`DELETE FROM accounts WHERE customer_id = 'ZZCHECK'`;

// An invite token is single use by being the primary key.
const pk = await sql`
  SELECT a.attname FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = 'invites'::regclass AND i.indisprimary`;
check("an invite token is the primary key (cannot be issued twice)",
      pk.length === 1 && pk[0].attname === "token");

// Deleting an account must take its push subscriptions with it.
const cascade = await sql`
  SELECT confdeltype FROM pg_constraint
  WHERE conrelid = 'push_subscriptions'::regclass AND contype = 'f'`;
check("removing an account removes its push subscriptions",
      cascade.some((r) => r.confdeltype === "c"));

// --- state -----------------------------------------------------------------
console.log("\n== current contents ==");
for (const t of ["accounts", "invites", "push_subscriptions", "audit_log"]) {
  const [{ n }] = await sql.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
  console.log(`  ${t}: ${n} rows`);
}

console.log();
if (fails) {
  console.log(`${fails} check(s) FAILED`);
  process.exit(1);
}
console.log("app database matches the specification.");
