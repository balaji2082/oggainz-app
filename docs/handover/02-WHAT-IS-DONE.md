# 02 — What is done, screen by screen

Honest state as of **21 October 2026**, read off the code rather than off an old
status note. The `docs/README.md` status table in this repo is from 4 August and
is badly out of date — a lot shipped after it. Trust this file.

34 commits. 18 library modules, 31 components, 18 routes, 6 database migrations.

---

## Customer screens — working

| Route | Screen | State |
|---|---|---|
| `/` | **Front door** | Done. A logged-out stranger gets what OG Gainz is, the packs and a way to make contact; a signed-in customer is redirected straight to their meals. One address, two front doors, decided by the session. |
| `/me` | **Home (real route)** | Done. Reads the customer id from the **signed session cookie**, never the URL. |
| `/me/[id]` | **Today** | Done. Today's meal, tomorrow's menu peek, what is coming, the skip/pause deadline countdown. |
| `/me/[id]/calendar` | **Calendar** | Done. A real month view (it was icon soup before and was rebuilt), skip and pause acting on it, resuming clears it correctly. |
| `/me/[id]/pack` | **My pack** | Done. Meals used and left, composition, validity, delivery history — openable and filterable. |
| `/me/[id]/menu` | **Menu** | Done — most recent work. Upcoming menu with a printable view. |
| `/me/[id]/account` | **Account / profile** | Done. Profile, avatar upload, and a theme switch (Dark and Playful; dark is the default). |
| `/me/[id]/support` | **Support** | Done. Raise a ticket, leave feedback, see replies. |

## Sign-in and onboarding — working

| Route | What |
|---|---|
| `/api/auth/google`, `/api/auth/callback/google`, `/api/auth/logout` | Google sign-in. Sessions are signed cookies, following Next 16's own guidance. |
| `/join/[token]`, `/join/error` | Invite links, sent over WhatsApp. A **used** link says "you're already set up — sign in" rather than "expired", and a wrong link is reversible. |
| `/connect` | Nobody hits a dead end. An unrecognised sign-in picks "I'm a subscriber" or "I'd like to start", leaves a phone number, and lands in Balaji's queue. |

**Why there is no OTP** — and this was considered properly, so do not re-open it
without reading the reasoning. Sending automated WhatsApp requires the number to
be on the WhatsApp Business Platform, and a number can only live in one place, so
moving Balaji's business number there would stop him using normal WhatsApp on it.
He would need a second number plus Meta business verification. Email OTP is
redundant next to Google sign-in. And at ~30 customers, **Balaji personally
knowing every one of them makes his approval stronger than an OTP**, not weaker.

## Customer writes — working

Real, shipped, in use: **skip a day**, **un-skip**, **pause a range**, **resume**,
**feedback**, **support tickets**. They answer immediately rather than making the
customer watch a refresh, and the server decides whether a pack *may* skip or
pause rather than offering an option the kitchen will refuse.

## Admin side — working

`/admin` and `/admin/ops`, owner-only:

- Mint an invite link for a customer id, with a WhatsApp button
- **Remove access** (a link binds to whoever opens it first — that has already
  needed undoing once)
- Approve a sign-in **by recognising the person**, not by looking up an id
- The request queue, activity feed, ticket inbox, feedback stream
- Settings, flexibility and validity controls

## Infrastructure — working

- **Neon Postgres**, 6 migrations: accounts, invites, customer profiles, reusable
  identity, customer cache, access requests, support and feedback
- **One round trip per screen** — it was slow, and that was fixed deliberately
- **Honest staleness.** A cached copy that could not be refreshed is served
  **labelled with its age** rather than silently pretending to be current
- `/api/health` reports exactly which link in the chain is broken: 404 = the
  Command Center API is not deployed, 503 = its token is unset, 401 = the two
  tokens do not match, timeout = PythonAnywhere is asleep. **Check this first
  whenever data looks wrong.**

---

## The two laws enforced by the database, not by code

Worth knowing because they will reject your test data rather than letting it
through:

1. **One active account per customer.**
2. **An invite token cannot be issued twice.**

---

## Known rough edges

- `docs/README.md` status table is stale (4 Aug). This file replaces it.
- The front page is plain, and **no prices are shown anywhere in the app.**
- The meal screens could look considerably more premium. Balaji said so himself.
- `/me/[id]` still exists next to `/me` — it is the development picker that
  predates sign-in. `/me` is the real route. They converge once the screen reads
  entirely through the API.
- No outbound email or WhatsApp sending from the app.
- One pre-existing failing check in the Command Center's `test_customer_api.py`:
  *"cutoff time is served from settings, not hardcoded."* It is not yours and it
  is not new.
- A real API-contract bug, reported and **not yet fixed**:
  `customer_api.py:429` flags skipped and paused days as `projected: true`. A day
  the customer took off is a recorded fact, not a projection, so the app
  currently shows real history as if it were a future promise. Fixing it changes
  a contract this app consumes, so **both sides change together** — write it up
  for Balaji, do not fix one half.

---

## The choice Balaji is leaving to you

| | **oggainz-app** (this repo) | **og-gainz-platform** |
|---|---|---|
| Source code | ✅ On GitHub, complete | ❌ **Missing. Config files only.** |
| Deployed | ✅ `app.oggainz.com` | ❌ Never deployed |
| Real customer data | ✅ Live, through the Command Center API | ❌ Seeded demo data only |
| Sign-in | ✅ Google + invites + approval | ⚠️ Credentials auth, no OTP UI |
| Customer dashboard | ✅ 8 screens, writes working | ✅ Fuller — nutrition log, referrals, wallet |
| Skip / pause | ✅ Working, with real cutoff rules | ✅ Built, never used by anyone |
| Buy a pack | ❌ Not built at all | ✅ Menu, 9-step builder, cart, checkout |
| Payments | ❌ None | ✅ Razorpay-ready, idempotent reconcile |
| Admin | ✅ Invites, requests, tickets | ✅ Fuller — KPIs, kitchen plan, catalog |
| Written spec | ✅ 2,147 lines, `[LAW]`-tagged | ⚠️ A README |
| Data model | Reads the Command Center; one source of truth | Its own Prisma database; **a second source of truth** |

**The honest read:** the platform is the better *product* and the app is the
better *foundation*. The platform's strength is everything around buying — the
builder, cart and checkout — and that is exactly what this app has none of. Its
weakness is the deeper one: it keeps **its own** copy of packs and meals, which
means two databases that can disagree about how many meals a customer has left.
This app deliberately avoids that by treating the Command Center as the single
source of truth until a proper cutover.

So the shape most likely to work is: **build on this app, and bring the
platform's buying flow across** once its code is recovered. But read
[07](07-THE-MISSING-CODE.md) first, because none of that is a decision anyone can
make while the code is still only on a dying laptop.
