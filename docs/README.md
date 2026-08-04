# OG Gainz app — design documents

The specification for the new OG Gainz app.

**This app is the improved and upgraded version of the Command Center** — same
business, same rules, better everything. Its data, logic and workflow are
**copied** from the Command Center (`Projects/OG-Gainz-OS`), which keeps running
the business until the new app has proven it produces the same answers.

> ### The Command Center is never deleted or altered
>
> Not one file, not one line, not one table — not at cutover, not afterwards.
> When the new app takes over daily work, the Command Center **stands down to a
> permanent, complete, working backup**, still deployed and still runnable.
> Everything is copied out of it; nothing is ever moved or removed.
> See [04 §0](04-parity-and-cutover.md#0-law-the-command-center-is-never-deleted-altered-or-dismantled).

Until cutover, the new app is a second face on the same data — never a second
copy, and never the source of truth.

## The documents

| | What it covers |
|---|---|
| [01-business-rules.md](01-business-rules.md) | Every rule the business actually runs on, extracted from the Command Center. The contract. |
| [02-skip-and-pause.md](02-skip-and-pause.md) | The feature customers touch most: cutoff logic, request screening, full mobile UI. |
| [03-data-model.md](03-data-model.md) | Tables, the API boundary, auth, security, and how none of this endangers the live business. |
| [04-parity-and-cutover.md](04-parity-and-cutover.md) | What matching the Command Center actually costs, how parity is proven, and how it stands down to a permanent backup. |

Plus [reference/](reference/) — working prototypes kept for their design
decisions, not their code. Nothing in there is part of the app or runs.

## Reading order

Start with **01**. Sections marked **[LAW]** are invariants — breaking one
corrupts money or meal counts, and every single one was learned from a real bug.
**[RULE]** is business behaviour, changeable but deliberately. **[GAP]** is
something the Command Center does not do and this app should.

## The decisions already made

- **PWA, not a store app.** Free, instant updates, works on every phone.
- **Lives on `oggainz.com` itself** — already ours, already on Vercel.
- **Google sign-in + email magic links.** Invite links sent over WhatsApp.
- **First milestone is customer manage-only.** View and adjust an existing pack.
  No buying, no payments — those come later.
- **Free tiers only.** Vercel + Neon + Resend. ~₹0/month.
- **The Command Center is the system of record until cutover**, then it stands
  down to a permanent, runnable backup. It is never deleted.

## Status

Against the build order in [03 §8](03-data-model.md#8-build-order):

| Step | | |
|---|---|---|
| 1 | `db.py` migration — new columns, `skip_requests`, app settings | **written, verified, not deployed** |
| 2 | `customer_api.py` — read endpoints + token auth | **written, tested, not deployed** |
| 3 | Neon Postgres, `accounts`, `invites`, "Invite to app" | not started |
| 4 | Next.js skeleton, Google sign-in, invite redemption | skeleton exists, no auth |
| 5 | Read-only customer app | first slice reads a local snapshot |

Steps 1 and 2 live in the Command Center repo (`Projects/OG-Gainz-OS`) and reach
the server the usual way: `git pull` + Reload. Step 1 was verified by recording
every business number, applying the migration, and recomputing all of them —
revenue, every subscription's status and meal counts, today's orders and the prep
list were identical, and no existing pack starts expiring. Step 2 adds no write
path of any kind and is off entirely unless `OG_API_TOKEN` is set.

The app itself still reads `data/snapshot.db` — a copy, opened read-only. It
cannot deploy usefully until steps 3 and 4 give it a real data source.

## The open decision

[04 §2](04-parity-and-cutover.md#2-the-engine-decision) — whether to **port** the
2,150 lines of business engine (`core.py`, `menu.py`, `ops.py`) to TypeScript, or
**keep** them as a Python service behind an API. Recommendation is to port, gated
behind a nightly diff harness that proves both engines agree. Not yet decided.

*Last updated 4 Aug 2026.*
