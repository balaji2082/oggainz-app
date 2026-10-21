# OG Gainz — handover pack

**For:** Abishek
**From:** Balaji
**Written:** 21 October 2026

---

You have been asked to take over building the **customer-facing OG Gainz app** —
the thing a meal-subscription customer opens on their phone to see their meals,
skip a day, pause their pack and talk to us.

Balaji runs the business on a different piece of software, and that one is **not
yours to change**. Keeping those two things straight is the single most important
thing in this pack, so it is the first thing explained.

Read these in order. The first two get you oriented, the third gets you running,
and **05 is the one that matters most** — it is the list of things that must not
happen.

| | File | Why |
|---|---|---|
| **01** | [The three systems](01-THE-THREE-SYSTEMS.md) | What exists, who uses it, which one is yours. Start here. |
| **02** | [What is done, screen by screen](02-WHAT-IS-DONE.md) | Honest state of the app. What works today. |
| **03** | [Get set up](03-GET-SET-UP.md) | Laptop to a running app. About 30 minutes. |
| **04** | [How it works](04-HOW-IT-WORKS.md) | The architecture in plain English. Where data comes from. |
| **05** | [Rules — read before you write code](05-RULES.md) | **The do-not list.** Non-negotiable. |
| **06** | [What is pending](06-WHAT-IS-PENDING.md) | Your work queue, in priority order. |
| **07** | [The missing code](07-THE-MISSING-CODE.md) | A second app whose source is not backed up. Needs Balaji, not you. |
| **08** | [Working with Balaji](08-WORKING-WITH-BALAJI.md) | Branches, reviews, what needs his approval. |

---

## The 60-second version

There are **two** OG Gainz codebases you will touch, and **one** you must not.

```
                    ┌──────────────────────────────────────────┐
                    │  COMMAND CENTER  (oggainz-os)            │
  Balaji only  ───► │  Python / Flask / SQLite                 │
                    │  oggainz.pythonanywhere.com — LIVE       │
                    │  Runs the real business. 27 customers.   │
                    │  ★ READ ONLY FOR YOU. NEVER PUSH. ★      │
                    └──────────────┬───────────────────────────┘
                                   │  JSON API over HTTPS
                                   │  (read + a few writes)
                                   ▼
                    ┌──────────────────────────────────────────┐
                    │  THE APP  (oggainz-app)   ← YOUR JOB     │
  Customers    ───► │  Next.js 16 / React 19 / TypeScript      │
                    │  app.oggainz.com — deployed              │
                    │  Accounts in Neon Postgres               │
                    └──────────────────────────────────────────┘

                    ┌──────────────────────────────────────────┐
                    │  og-gainz-platform                      │
    Nobody      ─── │  A second, more complete customer app.   │
                    │  ⚠ SOURCE CODE IS MISSING FROM GITHUB.   │
                    │  See 07. Balaji has to recover it.       │
                    └──────────────────────────────────────────┘
```

Plus, kept entirely separate and **not part of your work**: the older site at
`www.oggainz.com`, built by a friend of Balaji's. It is described at the end of
01 so you know what it is if you trip over it, and that is all.

---

## The three things to remember

1. **The Command Center is live and it is the business.** Balaji takes orders,
   plans the kitchen, prints delivery sheets and tracks money in it every single
   day. A mistake in there is a customer not getting fed. You read it; you do not
   write to it.

2. **Nothing you build goes live until Balaji says so.** Not a push to the app's
   main branch, not a Vercel deploy, not a database migration on the live
   database. Work locally, open a branch, show him. He decides.

3. **Ask rather than guess.** Balaji is a beginner coder and this app has real
   customers' money and meals in it. A question costs five minutes. A wrong
   assumption about how a pack's meal count works has already cost real meals
   once — that is why half the rules in 05 exist.
