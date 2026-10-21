# 04 — How it works

The architecture in plain English, and the one diagram worth having in your head.

---

## The shape of it

```
   CUSTOMER'S PHONE
         │
         ▼
  ┌─────────────────────────────────────────────────────┐
  │  THE APP      Next.js on Vercel  ·  app.oggainz.com │
  │                                                     │
  │  Screens ──► lib/screen.ts ──► lib/live.ts          │
  │                                    │                │
  │  Accounts, sessions, tickets ──► NEON POSTGRES      │
  │  (who is signed in, and nothing about meals)        │
  └────────────────────────────────────┼────────────────┘
                                       │ HTTPS + bearer token
                                       │ ONE DIRECTION ONLY ──►
                                       ▼
  ┌─────────────────────────────────────────────────────┐
  │  COMMAND CENTER   Flask on PythonAnywhere           │
  │                                                     │
  │  customer_api.py     7 read endpoints               │
  │  customer_writes.py  skip / pause / requests        │
  │                                                     │
  │  core.py · menu.py · ops.py   ← the real engine     │
  │  oggainz.db (SQLite)          ← the real data       │
  └─────────────────────────────────────────────────────┘
```

### The one rule that explains most design decisions

**The Command Center is the single source of truth. The app is a second face on
the same data — never a second copy of it.**

Customers, packs, meal counts, addresses, invoices: the app does not own any of
them. It asks. Its own database holds only *who is signed in* and things the app
itself invented, like support tickets.

This is deliberate, and it is the biggest difference from `og-gainz-platform`,
which keeps its own Prisma copy of packs and meals. Two databases that both
think they know how many meals a customer has left will eventually disagree, and
when they do, somebody does not get fed.

---

## Why the connection only goes one way

**PythonAnywhere's free tier blocks all outbound HTTP** except an allowlist. Its
proxy answers "Tunnel connection failed". So:

> The Command Center can **never** call the app. The app calls the Command
> Center. Always.

This is close to a law in its consequences. **Never design a feature that needs
the Command Center to reach out to the app** — not a webhook, not a push, not a
callback. It cannot work and it will waste your week.

There is already a casualty of this: `app_invites.py` in the Command Center is an
"Invite to app" button that **cannot function** and is effectively dead code.
Invites are minted from `app.oggainz.com/admin` instead, which is the right side
of the wall.

---

## The three levels of data freshness

In order of preference:

1. **Live** — `lib/live.ts` fetches from the Command Center API. One parallel
   fetch per screen.
2. **Cached** — the result is written to `customer_profiles.payload` in Neon. If
   a refresh fails, the cached copy is served **labelled stale with its age**
   (`StaleNotice.tsx`). An honest stale answer beats a spinner or a lie.
3. **Snapshot** — local development only, when `OG_API_BASE`/`OG_API_TOKEN` are
   unset. `data/snapshot.db` is a read-only **copy**. The live database is never
   opened by the app.

A note on why the cache exists at all: Balaji **overrode** the recommendation to
store only a `customer_id`. He wanted the screen to work when PythonAnywhere is
asleep. It was built as a timestamped photograph — written only from the Command
Center, never edited, never written back — and recorded as a dated override in
`docs/03 §3.1` **with its cost stated**: a leak would now expose names and
addresses, though still no money and no meal history. That is how disagreements
get resolved here: written down with the trade-off visible, not quietly
rewritten.

---

## How a skip actually travels

Worth tracing once, because it is the feature customers touch most and it is the
only write path that currently exists.

```
Customer taps "skip Thursday"
   │
   ▼  components/MealActions.tsx
lib/writes.ts  skipDay()
   │
   ▼  POST /api/v1/customer/<cid>/skip     (+ bearer token)
Command Center  customer_writes.py
   │
   ├─ is it before the 9 AM cutoff?         cutoff.py
   ├─ is this pack even allowed to skip?    flexibility.py
   ├─ write it, or queue it for Balaji      skip_requests
   │
   ▼  core.py
the pack's meal count and validity are recalculated
   │
   ▼
the day re-appears at the tail of the delivery schedule
```

Two things about this:

- **The server decides, not the screen.** A later commit was specifically about
  *not offering a pause the kitchen is going to refuse*. Ask the server what is
  allowed; do not reimplement the rule in TypeScript and hope the two agree.
- **A skipped meal is not a lost meal.** It re-appends at the end and extends
  validity. Getting that wrong shortens a customer's pack, which is the same as
  taking money from them.

---

## Who is allowed in

- **Google sign-in** only. No passwords in this app.
- The customer id comes from the **signed session cookie, never the URL**. This
  is a `[LAW]` — `/me/[id]` cannot be pointed at somebody else's data by editing
  the address bar.
- **Balaji approves** anyone the app does not recognise, from `/admin`. At ~30
  customers he personally knows every one, which makes his judgement a stronger
  check than an OTP.
- **Owner sign-in** works on any of his three Google addresses
  (`OG_OWNER_EMAIL` is a comma-separated list) and needs **no customer record**
  — before that he was locked out of his own admin page because signing in
  required being a subscriber.

---

## Why the app is on a subdomain

`app.oggainz.com`, not `oggainz.com`. This is not branding.

Vercel's SSO protection is set to `all_except_custom_domains`, so `*.vercel.app`
URLs are gated while the custom domain is public. The apex `www.oggainz.com`
still serves the old MERN marketing site from a **separate Vercel project**.

The landing page that would make moving to the apex safe now exists, so the move
is roughly a two-minute job — **and it is Balaji's call, not yours.** He decided
on 8 August to stay on the subdomain until the site is further along.

---

## The deploy gotcha, already solved — do not re-debug it

If you ever deploy by hand, this is the recipe that works:

```bash
rm -rf .vercel/output && mv .git ../_tmp && npx vercel deploy --prod --yes && mv ../_tmp .git
```

Six deployments sat at `status UNKNOWN` with no logs before the cause turned up
in the dashboard: **"Deployment Blocked — the commit email could not be matched
to a GitHub account."** The Vercel account and the GitHub account are different
people (`oggainzofficial@gmail.com` vs `balaji2082`). Moving `.git` aside for the
duration is what works — no commit, no author to check.

Also: **`--prebuilt` is broken** on Next 16.2.12 with Vercel CLI 58. Let Vercel
do the build.

> **You should not need any of this.** Deploying is Balaji's decision, not
> yours — see [05](05-RULES.md). It is written down so that nobody spends another
> day on it.

---

## The open architectural question

Not yours to settle alone, but you should know it is open, because it shapes
everything you build.

The business engine — `core.py`, `menu.py`, `ops.py`, about 2,150 lines of
Python — either gets **ported to TypeScript** so the app owns its own logic, or
**kept as a Python service** behind the API.

The recommendation on record is to port, **gated behind a nightly parity diff
harness that must exist first** and prove both engines give identical answers.
Cutover needs **30 consecutive days of zero differences**. Nothing moves until
then.

If you have a view on this after a few weeks in the code, that is a genuinely
useful conversation to have with Balaji. Just do not start the port on your own.
