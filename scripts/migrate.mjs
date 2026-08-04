/**
 * Apply the SQL files in db/migrations, in order, once each.
 *
 *   npm run db:migrate
 *
 * Every file that has run is recorded in _migrations, so running this again is
 * safe and does nothing. Migrations are never edited after they have run —
 * change the schema by adding 002, 003 and so on, so that every database
 * (yours, Vercel's, a future one) arrives at the same place by the same route.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "..", "db", "migrations");

/** Read DATABASE_URL from the environment, falling back to .env.local. */
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(join(HERE, "..", ".env.local"), "utf8");
    const m = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1];
  } catch {
    /* no .env.local — fall through to the error below */
  }
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
  );
}

const sql = neon(databaseUrl());

await sql`
  CREATE TABLE IF NOT EXISTS _migrations (
    name       text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

const done = new Set(
  (await sql`SELECT name FROM _migrations`).map((r) => r.name)
);
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

let applied = 0;
for (const file of files) {
  if (done.has(file)) {
    console.log(`  skip   ${file} (already applied)`);
    continue;
  }
  const text = readFileSync(join(DIR, file), "utf8");
  // The Neon HTTP driver sends one statement per round trip, so a multi-statement
  // file has to be split. Comments are stripped first, otherwise a semicolon
  // inside one would split a statement in the wrong place.
  const statements = text
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }
  await sql`INSERT INTO _migrations (name) VALUES (${file})`;
  console.log(`  applied ${file}  (${statements.length} statements)`);
  applied += 1;
}

console.log(
  applied ? `\n${applied} migration(s) applied.` : "\nAlready up to date."
);
