# 03 — Get set up

About 30 minutes, most of it waiting for `npm install`.

You can get the app running and see **real screens with real data** without
touching anything live. That is the whole point of how it is built.

---

## What you need

| | |
|---|---|
| Node.js | 20 or newer (`node -v`) |
| Git | any recent version |
| An editor | VS Code is what Balaji uses |
| GitHub access | Balaji adds you as a collaborator on `balaji2082/oggainz-app` |

**From Balaji, separately — never over anything public:**

| Secret | What it unlocks |
|---|---|
| `DATABASE_URL` | Neon Postgres (accounts, sessions, tickets) |
| `OG_API_TOKEN` | The Command Center's customer API |
| `OG_API_BASE` | `https://oggainz.pythonanywhere.com` |
| Google OAuth client id + secret | Sign-in |

Ask him to send these over a direct message, one at a time, **not** in a
document, not in a repo, not in email. If you ever paste one into a file, check
that file is in `.gitignore` before you commit anything. The older MERN site
leaked live database credentials through exactly this mistake and they still have
not been rotated.

---

## Step 1 — clone and install

```bash
git clone https://github.com/balaji2082/oggainz-app.git
cd oggainz-app
npm install
```

## Step 2 — make your own branch, immediately

Before you write anything. Do not work on `main`.

```bash
git checkout -b abishek/<what-you-are-doing>
```

## Step 3 — environment file

```bash
cp .env.example .env.local
```

Fill in `.env.local` with what Balaji sent. **`.env.local` is gitignored and must
stay that way.** `.env.example` is committed and contains placeholders only —
keep it that way too; there is a documented law about it.

## Step 4 — run it

```bash
npm run dev          # http://localhost:3000
npm run dev:phone    # also serves on your LAN, for testing on a real phone
```

`npm run dev` refreshes a local data snapshot first (see below).

---

## How to run it with no secrets at all

If Balaji has not sent credentials yet, you are **not blocked**.

When `OG_API_BASE` and `OG_API_TOKEN` are unset, the app falls back to reading
`data/snapshot.db` — a **copy** of the Command Center's database, opened
read-only. It is created by `scripts/snapshot.mjs`, it is gitignored so it never
reaches GitHub, and **the live database is never opened by the app**.

That means you can build and see real-shaped screens with zero access to
anything live. Use it. It is deliberately the default for local development.

---

## Useful commands

```bash
npm run dev          # dev server (refreshes the snapshot first)
npm run dev:phone    # dev server on the LAN, for phone testing
npm run build        # production build — run this before you ask for a review
npm run lint         # eslint
npm run snapshot     # refresh the local data snapshot by hand
npm run db:migrate   # apply database migrations   ← see the warning below
npm run db:check     # verify the database schema is what the code expects
```

Plus the test scripts in `scripts/`: `test-accounts.mjs`, `test-chain.mjs`,
`test-session.mjs`, `test-signin.mjs`.

> ⚠️ **`npm run db:migrate` writes to whatever `DATABASE_URL` points at.** If
> Balaji gives you the live Neon connection string, that is the **live customer
> accounts database**. Ask him for a separate Neon branch or your own free Neon
> project for development. Neon branching is free and takes a minute. Do not run
> migrations against live.

---

## Step 5 — is the data chain actually alive?

```bash
curl https://app.oggainz.com/api/health
```

| Response | Meaning |
|---|---|
| `ok: true` | Everything is connected |
| `404` | The Command Center's API is not deployed |
| `503` | `OG_API_TOKEN` is not set on the Command Center side |
| `401` | The two tokens do not match |
| timeout | PythonAnywhere is asleep — it is a free tier, this is normal |

Check this **first** any time data looks wrong. It will usually tell you the
answer before you start reading code.

---

## Read before writing code

In this order:

1. **[05 — Rules](05-RULES.md).** The do-not list. Non-negotiable.
2. [`docs/01-business-rules.md`](../01-business-rules.md) — 743 lines. The
   contract. Every `[LAW]` in it came from a real bug.
3. [`docs/02-skip-and-pause.md`](../02-skip-and-pause.md) — 538 lines. The
   feature customers touch most, including the cutoff logic and the full mobile
   UI.
4. [`docs/03-data-model.md`](../03-data-model.md) — 456 lines. Tables, the API
   boundary, auth, security, and why none of this endangers the live business.
5. [04 — How it works](04-HOW-IT-WORKS.md) in this folder, for the plain-English
   version.

One more thing, from this repo's own `AGENTS.md`:

> **This is NOT the Next.js you know.** Next 16 has breaking changes. Middleware
> is now `proxy.ts`. `params`, `searchParams` and `cookies` are all Promises and
> must be awaited. If something behaves unlike the Next you remember, read
> `node_modules/next/dist/docs/` rather than guessing.

A real bug this already caused, so you do not spend a day on it: the Auth.js
cookie is `__Secure-`-prefixed **only on HTTPS**, not based on `NODE_ENV`. Code
that reads it must decide from the request protocol.
