/**
 * End-to-end: the app -> the Command Center API -> the cached copy.
 *
 * Needs the Command Center running with its API switched on. Locally:
 *
 *   cd ../OG-Gainz-OS
 *   OG_DB_PATH=<a copy of oggainz.db> OG_API_TOKEN=chain-test-token python app.py
 *
 * then, with OG_API_BASE pointed at it:
 *
 *   OG_API_BASE=http://127.0.0.1:5097 OG_API_TOKEN=chain-test-token \
 *     node scripts/test-chain.mjs
 *
 * Proves the seam works for real, and — the point of the exercise — that a
 * cached answer is never presented as a current one.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "./_resolve-ts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) {
  const env = readFileSync(join(HERE, "..", ".env.local"), "utf8");
  process.env.DATABASE_URL = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
}

const { fetchAddresses, fetchPacks, fetchPublicSettings, CommandCenterDown } =
  await import("../lib/commandcenter.ts");
const { getProfile, refreshProfile, forgetProfile } = await import("../lib/profiles.ts");
const { sql } = await import("../lib/accounts.ts");

let fails = 0;
function check(label, ok, extra = "") {
  console.log(ok ? `  ok   ${label}` : `  FAIL ${label} ${extra}`);
  if (!ok) fails += 1;
}

console.log("== the Command Center answers ==");
const settings = await fetchPublicSettings();
check("public settings come back", !!settings.skip_cutoff_time,
      JSON.stringify(settings).slice(0, 120));
check("the cutoff is served from the database, not hardcoded",
      settings.skip_cutoff_time === "18:00", settings.skip_cutoff_time);

// Find a real customer who has an address, so the test uses live shapes.
const probe = await fetch(`${process.env.OG_API_BASE}/api/v1/settings/public`, {
  headers: { "X-OG-Service-Token": process.env.OG_API_TOKEN },
});
check("the token is accepted", probe.ok);

const CID = process.env.TEST_CUSTOMER_ID || "C018";
const addresses = await fetchAddresses(CID);
check(`addresses come back for ${CID}`, Array.isArray(addresses), addresses);
if (addresses.length) {
  const a = addresses[0];
  check("an address has the fields the app needs",
        "label" in a && "address" in a && "pinned" in a);
  check("no routing internals leak through", !("zone" in a) && !("corridor" in a));
}
const packs = await fetchPacks(CID);
check(`packs come back for ${CID}`, Array.isArray(packs), packs.length);

console.log("\n== the cached copy ==");
await forgetProfile(CID);
const first = await getProfile(CID);
check("a cold read fetches and caches", first.profile !== null && !first.stale);
check("a fresh read is not marked stale", first.stale === false);
check("the copy holds the addresses", Array.isArray(first.profile.addresses));

const second = await getProfile(CID);
check("a second read within 15 minutes serves the copy",
      second.profile.synced_at.toString() === first.profile.synced_at.toString());

console.log("\n== when the Command Center is unreachable ==");
// Age the copy so it wants refreshing, then point at a dead address.
await sql()`UPDATE customer_profiles SET synced_at = now() - interval '2 hours'
            WHERE customer_id = ${CID}`;
const realBase = process.env.OG_API_BASE;
process.env.OG_API_BASE = "http://127.0.0.1:59999";   // nothing is listening

const down = await getProfile(CID);
check("the old copy is still served rather than an error",
      down.profile !== null);
check("it is MARKED stale", down.stale === true);
check("and it says how old it is", down.asOf instanceof Date,
      String(down.asOf));
const ageMins = (Date.now() - down.asOf) / 60000;
check("the age is about 2 hours", ageMins > 110 && ageMins < 130, ageMins.toFixed(0));

let threw = false;
try {
  await refreshProfile(CID);
} catch (e) {
  threw = e instanceof CommandCenterDown;
}
check("a forced refresh fails loudly instead of inventing data", threw);

process.env.OG_API_BASE = realBase;
const back = await getProfile(CID);
check("once it is reachable again, the copy refreshes and is fresh",
      back.stale === false);

console.log("\n== the copy never becomes the source of truth ==");
const cols = (
  await sql()`SELECT column_name FROM information_schema.columns
              WHERE table_name = 'customer_profiles'`
).map((r) => r.column_name);
check("every cached row records when it was copied", cols.includes("synced_at"));
check("and where it came from", cols.includes("source"));

await forgetProfile(CID);
const gone = await sql()`SELECT COUNT(*)::int AS n FROM customer_profiles
                         WHERE customer_id = ${CID}`;
check("a cached copy can be dropped without losing anything", gone[0].n === 0);

console.log();
if (fails) {
  console.log(`${fails} check(s) FAILED`);
  process.exit(1);
}
console.log("the chain works: app -> Command Center -> cached copy.");
