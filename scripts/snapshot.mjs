/**
 * Take a read-only snapshot of the live Command Center database.
 *
 * SAFETY (docs/04 §0, §5):
 *   - The source is opened READ-ONLY and is never written to, ever.
 *   - We copy the file (plus its WAL sidecars) rather than querying across a
 *     live connection, so the Command Center is never blocked by us.
 *   - Everything the app reads comes from the COPY, never the original.
 *
 * Usage:  node scripts/snapshot.mjs
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = dirname(HERE);

const SOURCE =
  process.env.OG_SOURCE_DB ??
  join(APP, "..", "OG-Gainz-OS", "oggainz.db");
const TARGET = join(APP, "data", "snapshot.db");

if (!existsSync(SOURCE)) {
  console.error(`Source database not found: ${SOURCE}`);
  process.exit(1);
}

mkdirSync(dirname(TARGET), { recursive: true });

// Copy the main file and its WAL sidecars together. Without the -wal the copy
// can silently miss recent writes, because the Command Center runs in WAL mode.
let copied = 0;
for (const suffix of ["", "-wal", "-shm"]) {
  const from = SOURCE + suffix;
  const to = TARGET + suffix;
  if (existsSync(from)) {
    copyFileSync(from, to);
    copied += 1;
  }
}

// Open the COPY (never the source) and fold the WAL in, so snapshot.db is a
// single self-contained file afterwards.
const db = new DatabaseSync(TARGET);
db.exec("PRAGMA journal_mode = DELETE;");

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  .all();

let rows = 0;
const counts = {};
for (const { name } of tables) {
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get();
  counts[name] = n;
  rows += n;
}
db.close();

const kb = (statSync(TARGET).size / 1024).toFixed(0);
console.log(`snapshot written : ${TARGET}`);
console.log(`source           : ${SOURCE}  (read-only, untouched)`);
console.log(`files copied     : ${copied}`);
console.log(`tables           : ${tables.length}`);
console.log(`rows             : ${rows}`);
console.log(`size             : ${kb} KB`);
console.log("");
for (const [name, n] of Object.entries(counts).filter(([, n]) => n > 0)) {
  console.log(`  ${name.padEnd(26)} ${n}`);
}
