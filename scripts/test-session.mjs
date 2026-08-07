/**
 * Session cookie tests — the thing that decides whose data gets shown.
 *
 *   node scripts/test-session.mjs
 *
 * No database and no network. The check that matters most is that a tampered
 * cookie is rejected: if it were not, anyone could edit their own cookie to say
 * a different customer id and read someone else's meals and address.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "./_resolve-ts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
if (!process.env.AUTH_SECRET) {
  const env = readFileSync(join(HERE, "..", ".env.local"), "utf8");
  process.env.AUTH_SECRET = env.match(/^AUTH_SECRET\s*=\s*"?([^"\n]+)"?/m)[1];
}

// lib/session.ts imports "server-only", which throws outside a React server
// build. Stub it so the module can be tested directly.
const { registerHooks } = await import("node:module");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export{}", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { sign, verify, cookieOptions } = await import("../lib/session.ts");

let fails = 0;
function check(label, ok, extra = "") {
  console.log(ok ? `  ok   ${label}` : `  FAIL ${label} ${extra}`);
  if (!ok) fails += 1;
}

console.log("== signing and reading back ==");
const token = await sign({ accountId: "acc-1", customerId: "C018" });
check("a session signs", typeof token === "string" && token.length > 40);
const back = await verify(token);
check("it reads back the same account", back?.accountId === "acc-1");
check("it reads back the same customer", back?.customerId === "C018");

console.log("\n== rubbish is rejected ==");
check("no cookie at all", (await verify(undefined)) === null);
check("empty string", (await verify("")) === null);
check("random text", (await verify("not-a-token")) === null);
check("a token from a different secret", await (async () => {
  const real = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "a-completely-different-secret-value-here";
  const forged = await sign({ accountId: "acc-9", customerId: "C999" });
  process.env.AUTH_SECRET = real;
  return (await verify(forged)) === null;
})());

console.log("\n== tampering ==");
// Flip the payload to claim a different customer, keeping the original signature.
const [h, p, s] = token.split(".");
const payload = JSON.parse(Buffer.from(p, "base64url").toString());
payload.customerId = "C999";
const tampered = [
  h,
  Buffer.from(JSON.stringify(payload)).toString("base64url"),
  s,
].join(".");
check("a cookie edited to name another customer is REJECTED",
      (await verify(tampered)) === null);

// And with the signature stripped entirely.
check("a cookie with no signature is rejected",
      (await verify(`${h}.${p}.`)) === null);

// alg:none — the classic JWT hole.
const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }))
  .toString("base64url");
check("an 'alg: none' token is rejected",
      (await verify(`${noneHeader}.${p}.`)) === null);

console.log("\n== expiry ==");
const { SignJWT } = await import("jose");
const expired = await new SignJWT({ accountId: "acc-1", customerId: "C018" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 40)
  .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
  .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
check("an expired session is rejected", (await verify(expired)) === null);

console.log("\n== the payload gives nothing away ==");
const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
check("no email in the cookie", !("email" in claims), Object.keys(claims));
check("no name in the cookie", !("name" in claims));
check("only what is needed", Object.keys(claims).sort().join(",") ===
      "accountId,customerId,exp,iat", Object.keys(claims).sort().join(","));

console.log("\n== cookie flags ==");
const o = cookieOptions();
check("httpOnly — page scripts cannot read it", o.httpOnly === true);
check("sameSite lax — survives the return trip from Google", o.sameSite === "lax");
check("path is the whole site", o.path === "/");
check("lasts 30 days", o.maxAge === 30 * 24 * 60 * 60);
process.env.NODE_ENV = "production";
const { cookieOptions: prodOptions } = await import("../lib/session.ts?prod");
check("HTTPS-only in production", prodOptions().secure === true);

console.log();
if (fails) {
  console.log(`${fails} check(s) FAILED`);
  process.exit(1);
}
console.log("session handling is sound.");
