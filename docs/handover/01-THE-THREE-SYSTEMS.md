# 01 — The three systems

There is more than one OG Gainz codebase, they overlap, and the overlap is the
main reason this pack exists. Here is each one: what it is, who uses it, what
state it is really in, and whether you touch it.

---

## 1. The Command Center — `balaji2082/oggainz-os`

**This is the business.** Not a prototype, not a side project. Balaji opens it
every morning to see what the kitchen cooks, every evening to see what the rider
delivers, and at the end of the month to see what was earned.

| | |
|---|---|
| **Repo** | `github.com/balaji2082/oggainz-os` (private) |
| **Live at** | `oggainz.pythonanywhere.com` (password-protected) |
| **Stack** | Python 3.10, Flask, SQLite, Jinja templates, vanilla JS. No Node, no build step. |
| **Size** | ~19,000 lines across 25 Python modules and 45 templates |
| **Users** | Balaji. Occasionally kitchen/delivery staff on a limited screen. |
| **Your access** | **Read only. Never push. Never deploy.** |

### What is in it

| Module | What it does |
|---|---|
| `app.py` (3,700 lines) | Every route and screen |
| `core.py` (1,530) | The engine: meal counts, pack status, order generation, schedules, pauses |
| `ops.py` (1,550) | Delivery routing, distances, zones, rider allowances, printed shift sheets |
| `menu.py` (630) | The component catalog, pack recipes, and the kitchen prep list (gram-by-gram) |
| `crm.py` (1,250) | Lead pipeline, follow-ups, win-backs, WhatsApp message drafting |
| `customer_api.py` (504) | **The read API the app uses.** 7 endpoints, token-authenticated |
| `customer_writes.py` (939) | **The write API the app uses.** Skip, unskip, pause, resume, the request queue, admin settings |
| `db.py` (1,045) | Schema and migrations |
| `validity.py`, `flexibility.py`, `cutoff.py` | Pack expiry, flexible-day rules, the 9 AM skip cutoff |
| `finance_hub.py`, `content_hub.py`, `brochure.py`, `agent.py` | Money dashboard, content board, the public digital brochure, and an assistant that drafts a daily digest |

### Why you need to know it exists

Because **the app gets all its real data from it.** Customers, packs, meals,
addresses, invoices — none of that lives in the app's own database. The app asks
the Command Center over HTTPS. If you are debugging "why is this customer's meal
count wrong", the answer is almost always in `core.py`, and the fix is almost
always Balaji's to make, not yours.

### The hard rule

There is a documented law in this project, written after it was broken twice:

> **The Command Center is never deleted, altered or dismantled.** Not one file,
> not one line, not one table. Everything is *copied* out of it; nothing is moved
> or removed. When the new app eventually takes over, the Command Center stands
> down to a permanent, still-running backup.

If something you are building needs a change on the Command Center side, that is
a normal and expected thing to need — but you **write it up and give it to
Balaji**, you do not push it. See [05](05-RULES.md).

---

## 2. The app — `balaji2082/oggainz-app`  ← **this is your job**

The customer-facing phone app. A subscriber signs in, sees today's meal, skips a
day they are away, pauses the pack for a trip, and messages us.

| | |
|---|---|
| **Repo** | `github.com/balaji2082/oggainz-app` (private) |
| **Live at** | `app.oggainz.com` (per the project record — verify with `/api/health`) |
| **Stack** | Next.js 16.2.12, React 19.2.4, TypeScript (strict), Tailwind 4 |
| **Databases** | Neon Postgres for accounts/sessions. Everything else comes from the Command Center API. |
| **Hosting** | Vercel |
| **Size** | 34 commits, 18 library modules, 31 components, 18 routes, 6 migrations |
| **Your access** | **Build here.** On a branch. |

It is a **PWA, not a store app** — deliberately. Free, instant updates, works on
every phone, no App Store review.

The design documents are the best thing in this repo. Before you write a line,
read [`docs/01-business-rules.md`](../01-business-rules.md) — 743 lines of the
rules the business actually runs on, each one extracted from the Command Center.
Sections are tagged:

- **[LAW]** — an invariant. Breaking it corrupts money or meal counts. **Every
  single one was learned from a real bug**, so they are not theoretical.
- **[RULE]** — deliberate business behaviour. Changeable, with a conversation.
- **[GAP]** — something the Command Center does not do, and this app should.

Full state of it is in [02](02-WHAT-IS-DONE.md).

---

## 3. og-gainz-platform — **the source code is missing**

A second, considerably more complete customer platform, built in July 2026:
landing page, menu with macros, a 9-step meal builder, cart, checkout wired for
Razorpay, a full customer dashboard, **and** an admin area.

On paper it is a better product than the app in §2. In practice:

> ⚠️ **Only 12 configuration files of it exist on GitHub.** No `src/`, no
> `app/`, no `prisma/`, no `docs/`. The actual source code is not in the repo,
> not in Balaji's workspace backup, and not in any branch. It exists only on his
> laptop — and that laptop shuts off whenever it is unplugged.

This is not yours to fix and it is not a coding problem. It is a 20-minute
recovery job that only Balaji can do, and [07](07-THE-MISSING-CODE.md) has the
exact commands. **Do that before anything else**, because if the laptop dies
first, roughly a month of work is gone with no copy anywhere.

The surviving README is kept at
[`og-gainz-platform-README.md`](og-gainz-platform-README.md) in this folder — it
is the best description of what the app was, and it is what you would use to
judge whether its code is worth merging once it is recovered.

**Balaji's instruction:** you get both this and the app in §2, you are told
plainly what state each is in, and **you choose which to build on.** The honest
comparison is at the end of [02](02-WHAT-IS-DONE.md).

---

## Kept separate — the old site at `www.oggainz.com`

Not part of your work. Here so you know what it is.

| | |
|---|---|
| **Repo** | `github.com/oggainzofficial-dotcom/og-gainz` (a different GitHub account) |
| **Built by** | Mohamed Irreef S, a friend of Balaji's |
| **Stack** | MERN — React + Vite + TypeScript + Tailwind/shadcn front end; Node + Express + Mongoose + MongoDB back end. Razorpay, Google OAuth, Cloudinary, nodemailer. |
| **Size** | ~54,000 lines, 38 models, 36 controllers, 52 pages (25 of them admin) |
| **State** | Audited June 2026, then deliberately left alone. Still serves the marketing site at `www.oggainz.com`. |

Two real money-path bugs were found in it and fixed **locally only** — never
committed, so the live site still has both:

1. **"Payment not recognised."** A JavaScript syntax error committed into
   `Server/src/controllers/webhooks.controller.js` crashed the server at boot,
   which killed the Razorpay webhook — the reliable backstop that confirms a
   payment when the customer's browser does not finish the redirect. Those
   payments never reconciled and the orders stayed stuck on `pending_payment`.
2. **"Razorpay always shows ₹5,999."** `initiateCheckout` reused *any* existing
   pending order for the user and ignored the items actually selected. Once bug
   1 left an order stuck, every later checkout quoted that stale amount.

They are one system: broken webhook → stuck orders → wrong reused amount. That
exact failure is the reason the app in §2 has a `[LAW]` about one status field
and an atomic, idempotent payment confirmation.

> 🔒 **Security, unresolved:** `Server/.env.example` in that repo has **real
> MongoDB Atlas credentials committed to it.** They need rotating. That is also
> why this project's own `.env.example` carries a law saying placeholders only,
> always — see the comment at the top of
> [`.env.example`](../../.env.example).

Do not start work in this repo. If Balaji later wants its bugs fixed, that is a
separate conversation with its own access.
