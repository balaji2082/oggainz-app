# 06 — What is pending

Your work queue, in the order Balaji would want it. Each item says what it is,
why it matters, and roughly where in the code it lives.

Items 0 and 1 are not optional and not negotiable about order.

---

## 0. Get the missing code off the laptop — **Balaji, today**

Not your task, and it blocks a real decision. See
[07](07-THE-MISSING-CODE.md). Until `og-gainz-platform` is in a repo, nobody can
judge whether its buying flow is worth merging, and if the laptop dies first the
question answers itself badly.

---

## 1. Read before building

| | |
|---|---|
| [05 — Rules](05-RULES.md) | The do-not list |
| [`docs/01-business-rules.md`](../01-business-rules.md) | 743 lines. The contract. |
| [`docs/02-skip-and-pause.md`](../02-skip-and-pause.md) | 538 lines. The feature customers touch most. |
| [`docs/03-data-model.md`](../03-data-model.md) | 456 lines. Tables, API boundary, auth, security. |
| [`docs/04-parity-and-cutover.md`](../04-parity-and-cutover.md) | 347 lines. How this app eventually takes over. |

Then run it locally and click every screen. A day well spent.

---

## 2. The real bug that is waiting — `projected: true`

**Where:** `customer_api.py:429` in the Command Center, and whatever consumes it
in `lib/live.ts` / `lib/data.ts` here.

**What:** skipped and paused days are flagged `projected: true`. A day the
customer took off is a **recorded fact**, not a projection — so the app currently
shows real history as if it were a future promise.

**Why it is still open:** fixing it changes an API contract that this app
consumes, so both halves move together. The Command Center half is **Balaji's to
apply**, not yours.

**What you do:** confirm it from the app side, write up exactly what the response
should look like instead, and hand it over. This is a good first task — it is
small, it is real, and it teaches you the seam between the two systems.

It is also why one of the Command Center's own tests has been failing: *"a
Mon/Wed/Fri pack promises nothing on Tue/Thu"*.

---

## 3. UI polish — explicitly wanted

Balaji said this himself, and then said to do the brand assets first, so the
appetite is real:

- **The landing page is plain.** `app/page.tsx`.
- **No prices appear anywhere in the app.** Not one screen. For a meal
  subscription business, that is a gap.
- **The meal screens could look far more premium.** `/me/[id]`, the calendar, the
  pack screen.

There is a brand kit and a React component library (`og-gainz-ds`, nine
components built on `--og-*` CSS variable tokens) — ask Balaji for them before
you invent a visual language. One already exists.

Lowest-risk, highest-visibility work in the whole queue. A sensible place to
start once you have read the docs.

---

## 4. Tidy the two home routes

`/me/[id]` is the development picker that predates sign-in. `/me` is the real
route and reads the id from the session cookie.

They converge once the screen reads entirely through the API. Worth doing — two
routes to the same screen is how somebody eventually ships the one that trusts
the URL, and the `[LAW]` exists precisely because the URL must never be trusted.

---

## 5. Buying a pack — the big gap

The app can **manage** an existing pack and cannot **sell** one. A customer still
buys over WhatsApp and Balaji enters it by hand in the Command Center.

`og-gainz-platform` already has this: a menu, a 9-step meal builder with live
macros and price, a cart with server-authoritative pricing, and a checkout wired
for Razorpay with an idempotent reconcile. **That is the strongest argument for
recovering its code** — not to adopt the whole app, but to bring this flow
across.

> ⚠️ Before touching payments, read what went wrong on the old site: a broken
> webhook left orders stuck, and the stuck order then made every later checkout
> quote the wrong amount. Details in
> [01 §Kept separate](01-THE-THREE-SYSTEMS.md). The design that avoids it is
> **one status field** plus an append-only event history, and a payment
> confirmation that is **atomic and idempotent** across all three paths — the
> browser callback, the webhook, and a manual admin reconcile.

Do not start this without talking to Balaji. It is the biggest piece of work in
the queue and it handles money.

---

## 6. Things deliberately not built yet

Not oversights. Decided against, for now.

| | Why |
|---|---|
| Outbound email / WhatsApp from the app | Needs the WhatsApp Business Platform; see [02](02-WHAT-IS-DONE.md) |
| Push notifications | The `push_subscriptions` table exists; nothing sends |
| OTP login | Google sign-in plus Balaji's approval is stronger at this scale |
| Full catalog CRUD in the app | The Command Center owns the catalog |
| The TypeScript engine port | Open decision, needs a parity harness first |
| Moving to the apex `oggainz.com` | Balaji's call; he decided to wait |

---

## 7. The known-stale things in this repo

Small, worth fixing as you pass:

- `docs/README.md`'s status table is from 4 August and understates what is
  built. [02](02-WHAT-IS-DONE.md) replaces it; the table itself should be
  updated or pointed here.
- The top-level `README.md` is still the untouched `create-next-app` boilerplate.
  Nobody ever replaced it. Worth a real one.
- `app_invites.py` in the Command Center is dead code that cannot work — noted
  so you do not try to make it work. **Do not delete it; it is not your repo.**

---

## Suggested first week

| Day | |
|---|---|
| 1 | Read [05](05-RULES.md), then `docs/01`. Get it running on the snapshot. Click every screen. |
| 2 | Read `docs/02` and `docs/03`. Trace one skip end to end through the code. |
| 3 | Confirm the `projected: true` bug and write it up for Balaji. |
| 4–5 | UI polish on the landing page or a meal screen. Branch, build, show him. |

By the end of that you will know the seam between the two systems, you will have
found something real, and you will have shipped something visible — without
having gone near anything live.
