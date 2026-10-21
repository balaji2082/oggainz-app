# 07 — The missing code

> **This page is for Balaji, not Abishek, and it is the most time-sensitive thing
> in the pack.**

---

## What is wrong

`og-gainz-platform` — the full customer platform with the landing page, the menu,
the 9-step meal builder, the cart, the Razorpay-ready checkout, the customer
dashboard and the admin area — **is not backed up anywhere.**

Verified on 21 October 2026:

| Where it should be | What is actually there |
|---|---|
| A GitHub repo of its own | **Does not exist.** The account has exactly two repos: `oggainz-os` and `oggainz-app`. |
| `ai-workspace` → `Projects/og-gainz-platform/` | **12 configuration files only.** `package.json`, `tsconfig.json`, `Dockerfile`, `README.md` and friends. |
| `src/`, `app/`, `prisma/`, `docs/` | **Absent.** On `main` and on the `og-gainz-design-system` branch both. |
| Any other branch | Checked. Nothing. |

So what survives is the scaffolding and **none of the code**. No pages, no
components, no Prisma schema, no seed script, no architecture doc.

The project record says it was *"uncommitted on branch og-gainz-design-system"* —
that branch exists but carries the same 12 files, so the work was never actually
committed anywhere.

## Why it is urgent rather than annoying

The laptop that holds the only copy **shuts off whenever it is unplugged**. That
is the reason for moving to phone-first working in the first place. It is a
machine that is already failing.

If it stops before this is done, that entire app is gone. From the README, that
is a landing page, a menu with macros and reviews, a nine-step meal builder with
a shared client/server pricing engine, a cart with server-authoritative pricing,
an idempotent checkout with dual reconcile paths, a full customer dashboard with
delivery calendar, wallet, nutrition log, referrals and support, and an admin
area with KPIs, a kitchen production plan and freeze approvals.

There is also no way to answer Abishek's actual question — *which of these two
should I build on?* — while one of them cannot be read.

---

## What to do about it — roughly 15 minutes

On the laptop, plugged in. Replace the path if yours differs.

### 1. Check what is actually there

```bash
cd D:\AI-Workspace\Projects\og-gainz-platform
dir
git status
```

You are looking for `src/` or `app/`, and `prisma/`. If they are there, the code
is alive and this is a 10-minute job.

### 2. Make sure no secrets are about to be committed

```bash
type .gitignore
dir /b .env*
```

`.env`, `.env.local` and `prisma/dev.db` must all be ignored. The existing
`.gitignore` covers them — confirm before pushing, not after.

### 3. Commit everything locally

```bash
git init
git add -A
git status
```

**Read that `git status` list before committing.** If any `.env` file appears in
it, stop and fix `.gitignore` first.

```bash
git commit -m "og-gainz-platform: the July 2026 build, recovered from the laptop"
```

### 4. Create the repo and push

Easiest on the phone or in a browser: GitHub → **New repository** →
`og-gainz-platform` → **Private** → do not add a README or `.gitignore` (the
code already has them) → Create.

```bash
git remote add origin https://github.com/balaji2082/og-gainz-platform.git
git branch -M main
git push -u origin main
```

### 5. If the code is NOT there

Then it was lost before now, and the places worth checking are:

- `D:\AI-Workspace\_Junk\` — the staging folder for things moved aside
- Windows **Previous Versions** / File History on the `Projects` folder
- OneDrive version history, if that folder was ever synced
- Any `node_modules` sibling folder — its presence proves where the project ran

If none of that finds it: the README in this folder
([`og-gainz-platform-README.md`](og-gainz-platform-README.md)) is a detailed,
accurate specification of what was built. It would be a rebuild, not a recovery
— but it would not be a guess.

### 6. Then tell Abishek

Send him the repo link and the one-line verdict: whether the code was there or
not. That is the last thing blocking his decision in
[02](02-WHAT-IS-DONE.md).

---

## While you are at it — two other backup gaps

Found in the same check, same root cause.

### `Projects/OG-Gainz-OS` in the workspace is a broken reference

In `ai-workspace`, that path is recorded as a **git submodule pointing at commit
`130b1c6`** — but there is no `.gitmodules` file, so nothing can resolve it. A
fresh clone of the workspace gets an **empty folder** where the Command Center
should be.

The code itself is safe — it is in `balaji2082/oggainz-os`, and that is where it
is worked on. But anyone cloning the workspace (including every cloud session)
gets a hole instead of a pointer. Worth either registering it as a proper
submodule or replacing it with a `README` that says where the real repo is. Low
risk, five minutes, and it stops the next person being confused by it.

### The friend's MERN app has no copy under your control

`github.com/oggainzofficial-dotcom/og-gainz` is on a **different GitHub
account**. It still serves `www.oggainz.com`, and it still carries the two
money-path bugs described in [01](01-THE-THREE-SYSTEMS.md) plus **live MongoDB
Atlas credentials committed in `Server/.env.example`.**

Two separate things to do, neither of them Abishek's:

1. **Rotate those Atlas credentials.** They are in a repo's committed history.
   Rotating is the only real fix; deleting the file does not remove them from
   history.
2. **Take a copy you control** — a fork, or a mirror push to your own account —
   so the site serving your domain is not sitting on an account you do not own.
