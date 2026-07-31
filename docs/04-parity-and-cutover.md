# Parity & cutover

How the new app takes over from the Command Center without a day of broken
service.

---

## 0. [LAW] The Command Center is never deleted, altered or dismantled

**Not one file. Not one line. Not one table. Not at cutover, not afterwards,
not ever.**

The Command Center is the thing that made this business run. When the new app
takes over day-to-day work, the Command Center **stands down to being a
permanent, complete, working backup** — code, database, and history, kept intact
and kept runnable.

What "taking over" means, precisely:

| | |
|---|---|
| **Copied** — from Command Center to the new app | data, logic, workflow |
| **Moved** | nothing |
| **Deleted** | nothing, ever |
| **Command Center afterwards** | intact, runnable, the fallback |

[LAW] Every migration is a **copy**. `oggainz.db` is read, never emptied. The
Flask app keeps every route, every template and every module it has today.

[LAW] If any instruction in this document — or any future one — appears to
require removing part of the Command Center, that instruction is wrong. Stop and
ask.

> This is not caution for its own sake. The Command Center is four months of
> hard-won correctness and the only proven record of 1,043 delivered meals. It
> costs nothing to keep and would be irreplaceable to lose.

---

## 1. What has to be rebuilt in the new app

The Command Center is 7,045 lines of Python and 4,663 lines of templates, grown
over four months of running a real business. All of it **stays where it is**.
This table is about what the new app has to grow of its own.

| Module | Lines | What it does | Difficulty to rebuild |
|---|---:|---|---|
| `app.py` | 2,188 | 101 routes, all screens | Mechanical — the new UI is the point |
| `core.py` | 923 | Subscriptions, orders, revenue | **Hard.** Every invariant in doc 01 lives here |
| `ops.py` | 789 | Zones, routing, porter, allowance | **Hard.** Geometry, providers, corridor logic |
| `db.py` | 515 | Schema + migrations | Becomes the Postgres schema |
| `importer.py` | 437 | One-time Excel import | Not needed — its job is done |
| `menu.py` | 436 | Composition, rules, prep list | **Hard.** Kitchen correctness depends on it |
| `agent.py` | 410 | OG Agent digest + chat | Later, not parity-critical |
| `content_hub.py` | 319 | Social media board | Later, or stays where it is |
| `crm.py` | 262 | Leads, follow-ups | Straightforward |
| `brochure.py` | 182 | Editable brochure | Straightforward |
| `sheet_i18n.py` | 179 | Tamil kitchen labels | Straightforward, but must be exact |
| `exporter.py`, `backup.py` | 137 | Excel export, backups | Straightforward |

**The real work is `core.py` + `menu.py` + `ops.py` — about 2,150 lines** where
nearly every line encodes something learned from a bug.

[RULE] "Rebuild" here always means **write a new implementation in the new app
and prove it agrees with the original.** The original stays untouched and
running throughout, and afterwards.

---

## 2. The engine decision

This is the biggest technical choice in the project and it should be made
deliberately, not by drift.

### Option A — Port the engine to TypeScript

Rewrite `core.py`, `menu.py`, `ops.py` in TypeScript inside the Next.js app.

**For:** one language, one codebase, one deploy, one thing to maintain. A beginner
maintaining this alone is far better served by a single stack. Nothing to keep
alive on PythonAnywhere.

**Against:** ~2,150 lines of subtle logic reimplemented. Every invariant has to be
relearned or re-derived. The duplicate-order bug, the recompute-on-unmark
cascade, the "never plan more than the pack owes" rule — these are exactly the
kind of thing that looks simple and isn't.

### Option B — Reuse the Python engine behind an API

Take a **copy** of `core.py`, `menu.py` and `ops.py` and run it as a small API
service that the new app calls. The Command Center itself carries on unchanged;
this is a second deployment of the same code, not a dismemberment of it.

**For:** 2,150 lines of battle-tested logic are reused rather than reimplemented.
Dramatically lower risk. Balaji only ever opens the new app.

**Against:** two languages and two deploys forever. Postgres access from Python
and TypeScript both. More moving parts to understand when something breaks at
9 PM.

### Recommendation

**Option A, with a parallel-run diff harness (§3).**

The reasoning: Option B's "lower risk" is real but temporary, while its
complexity cost is permanent. Two stacks is a genuinely heavy burden for one
person who is still learning to code — and the moment something breaks across
the seam, it is the hardest possible thing to debug.

Option A's risk is real but *measurable and reducible*. We can prove the port is
correct by running both engines against the same data every day and comparing
their answers. That turns "did I reimplement it right?" from a worry into a
test that either passes or fails.

[RULE] Do not start the port until the diff harness exists. The harness is what
makes the port safe; writing it afterwards proves nothing.

---

## 3. The parity harness

The mechanism that makes a one-month cutover credible instead of hopeful.

```
Every night:
  1. Snapshot the live oggainz.db
  2. Load it into the new app's Postgres
  3. Run both engines over the same dates
  4. Diff every number that matters
  5. Any disagreement -> alert, with the exact row
```

### 3.1 What gets compared

| Check | Passing means |
|---|---|
| Today's order list | Same customers, same slots, same count |
| Prep list quantities | Every component, gram for gram |
| Each subscription's remaining/delivered/status | Identical for all 64 |
| Revenue — sold, per month | Rupee for rupee |
| Revenue — earned/delivered, per day | Rupee for rupee |
| Route order + total km + allowance | Same stop sequence, km within 0.1 |
| Porter mode per stop | Same rider/handoff/direct decision |
| Invoice totals | Rupee for rupee |

### 3.2 [LAW] Parity means zero differences, not few

A 1-rupee discrepancy is not "close enough" — it means one engine is wrong, and
the one that is wrong might be the new one on a different day with different
data. Every difference is either fixed or explicitly signed off with a written
reason.

### 3.3 The month of parallel running

Both systems live. Balaji uses the **Command Center** for real work, and the new
app in parallel. The harness runs nightly. Cutover requires:

- **30 consecutive days** of zero unexplained differences
- Every screen he uses daily present and working in the new app
- One full month-end close done in the new app and reconciled

[RULE] The 30-day clock **resets** on any unexplained difference. It is a
confidence measure, not a countdown.

---

## 4. Parity checklist — what "as good as Command Center" means

Balaji's actual daily use. Nothing ships as "done" until every line is ticked.

**Daily kitchen**
- [ ] Today's orders, per slot, with tick-off
- [ ] Prep list with exact quantities + tick-offs
- [ ] Printed shift sheet with Tamil labels
- [ ] Backlog of unmarked past orders
- [ ] Per-order day notes

**Delivery**
- [ ] Route with stop order + Maps link
- [ ] Zones, corridors, porter handoff decisions
- [ ] km + ₹3/km allowance, actual-km correction
- [ ] Map pins, porter points
- [ ] Unpinned orders flagged, never dropped

**Customers & subscriptions**
- [ ] Create/edit customer, multiple addresses per slot
- [ ] Create/edit/renew subscription with the composition builder
- [ ] Add-ons with negotiated per-customer rates
- [ ] Pause / freeze windows, slot moves
- [ ] Composition audit ("what the kitchen sees")
- [ ] Multiple concurrent packs per customer

**Money**
- [ ] Revenue: sold vs earned, kept distinct
- [ ] Day / week / month views with drill-down
- [ ] Outstanding, itemised
- [ ] Invoices with public token links
- [ ] Customer analytics: new, retained, lost

**Other**
- [ ] Trials
- [ ] CRM leads and follow-ups
- [ ] Editable brochure + public page
- [ ] Terms page, generated from settings
- [ ] Excel export
- [ ] Menu/component catalog editor
- [ ] Settings — every one of them
- [ ] OG Agent *(may lag cutover — not parity-critical)*
- [ ] Content Hub *(may lag cutover, or stay separate)*

---

## 5. Data copy

One-time, at cutover. Rehearsed until boring.

```
SQLite (27 tables)  ──copy──>  Postgres

  * Read-only against oggainz.db. Nothing is written to it, ever.
  * Every table copied, including full history
  * IDs preserved exactly — C001 stays C001, S053 stays S053
  * Row counts asserted equal, table by table
  * Every money column summed on both sides and compared
  * Delivered-meal count asserted equal (1,043 and rising)
```

[LAW] **The copy opens `oggainz.db` read-only.** Not "carefully" — literally, with
a read-only connection, so a bug in the copy script physically cannot modify the
source. Work from a snapshot file, never the live database.

[LAW] IDs are preserved. They appear on invoices customers already hold, and in
Balaji's own memory. Renumbering during the copy would be a small, permanent
sabotage.

[RULE] Rehearse the full copy at least **three times** against a snapshot before
cutover day, timing each run. The real one should hold no surprises.

---

## 6. Cutover day

```
1.  Kitchen closed (a Saturday). No orders in flight.
2.  Snapshot oggainz.db. Command Center set to read-only in the UI,
    with a banner saying the new app is now the daily tool.
3.  Final data copy. Assertions must all pass.
4.  oggainz.com serves the new app for admin as well as customers.
5.  Balaji does a full day's work in the new app: orders, prep,
    route, marking delivered, one invoice.
6.  Monday morning: real service on the new app.
7.  Command Center stays deployed and running, read-only.
```

### 6.1 [LAW] The Command Center remains a working backup, permanently

It is **not** switched off at the end of the rollback window, and it is **not**
uninstalled. It stays deployed, stays runnable, and keeps its database.

Read-only is a **setting**, not surgery — a flag that hides the save buttons.
Turning it off restores full function in seconds. That is the entire point of
keeping it: a fallback that needs a rebuild is not a fallback.

### 6.2 The 30-day write-back window

For the first 30 days after cutover, **every change made in the new app is also
written back into `oggainz.db`** by a sync job.

If something is badly wrong in week one, the fallback is: clear the read-only
flag and carry on in the Command Center, with data that never diverged. Boring,
temporary, and the difference between a bad week and a catastrophe.

After 30 days the write-back stops. The Command Center then holds a complete,
correct record up to that date and remains available for reference and for
restoring history.

### 6.3 Keeping the backup genuinely alive

A backup nobody ever runs is a backup that has quietly stopped working.

[RULE] Every quarter: open the Command Center, confirm it loads, confirm the
data is there. PythonAnywhere free accounts also need a login every three months
to stay active — same reminder, same calendar entry.

[RULE] Keep a copy of the final `oggainz.db` snapshot, the last 30 daily backups
and every parity report somewhere that is neither the laptop nor the server.

---

## 7. Sequencing

```
Now      ── customer app, read-only, on the API bridge      (doc 03 §8, steps 1-5)
   |        Command Center untouched and in full use
   |
   +─────── customer writes: pin, skip, pause               (steps 6-8)
   |        still via the API, still Command Center's engine
   |
   +─────── parity harness built                            <- gate before porting
   |
   +─────── engine ported to TypeScript, module by module
   |        core -> menu -> ops, each proven by the harness
   |
   +─────── admin + kitchen screens built in the new app
   |
   +─────── 30 days parallel running, zero differences
   |
   +─────── CUTOVER
   |
   +─────── 30 days read-only Command Center + write-back
   |
   └─────── Command Center stands down to permanent backup
            (still deployed, still runnable, never deleted)
```

[RULE] The customer app ships and delivers value **long before** any of the
parity work. Customers get something useful in the first milestone; the handover
happens underneath, without pressure.

---

## 8. Honest assessment of the timeline

One month of *verification* is realistic. One month to *build* full parity is not.

The customer app is a few weeks. Full admin, kitchen, delivery, revenue,
invoicing and a proven engine port is a substantially larger piece of work than
everything built so far — because it has to be as good as four months of
iteration on the first try, and correct on data that pays for food.

A more honest shape:

| | |
|---|---|
| Customer app, read-only, live | weeks |
| Customer writes (skip/pause/pin) | + weeks |
| Parity harness + engine port | the long middle |
| Admin + kitchen screens | overlapping |
| **30 days parallel running** | the month Balaji means |
| Cutover | one Saturday |

The 30 days of parallel running is the month — and it starts only once
everything else works.

[RULE] Nothing about this schedule justifies skipping the harness or shortening
the parallel run. The Command Center currently works. Replacing it with
something slightly wrong is worse than not replacing it at all.
