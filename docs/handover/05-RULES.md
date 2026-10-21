# 05 — Rules: read this before you write code

Balaji asked specifically for this file: **what should be done, and what should
not.**

These are not style preferences. Each one is here because of something that
happened, or because of what the system would do to real customers if it were
got wrong. OG Gainz is a working food business — roughly 27 customers, over a
thousand delivery records, and about four months of hard-won correctness. A
mistake here is not a failing test; it is somebody not getting fed, or being
charged wrong.

---

## 🔴 Never — no exceptions

### 1. Never push to `balaji2082/oggainz-os` (the Command Center)

Read it all you like. Clone it, run it locally, study `core.py` — that is
encouraged, and you will need to. But **no commits, no pushes, no branches.**

There is a documented law:

> The Command Center is never deleted, altered or dismantled. Not one file, not
> one line, not one table.

This has been broken twice before, both times by someone who thought a small
change was obviously fine, and both times had to be reverted. **The second time
was mentioned in a single passing line, which Balaji reasonably did not read as
"I am about to modify the thing you told me not to modify."**

He does not refuse these changes when they are explained — he approves them once
he understands what they do. The problem was never the change. It was finding out
afterwards.

**So:** if your work needs something on the Command Center side — and it
legitimately will, the API lives there — write up what is needed, in plain
language, and give it to Balaji. Name the files. Say what it changes and what it
does not. Then wait.

### 2. Never deploy. Anything. To anywhere.

- Not `git push` to the app's `main`
- Not `vercel deploy`
- Not a `git pull` + Reload on PythonAnywhere
- Not `npm run db:migrate` against the live Neon database

**Balaji's instruction, in his own words: nothing you build is pulled to the live
website unless he says okay.**

He does the deploying. Every time. Even when the change is obviously correct,
even when it is a one-line fix, even when he is asleep and you are sure.

### 3. Never run anything against live data

The live SQLite database (`oggainz.db`) and the live Neon Postgres hold real
customers, real meal counts and real money.

- Local development uses `data/snapshot.db` — a **read-only copy**. The app never
  opens the live database. Keep it that way.
- For Neon, ask Balaji for a **separate Neon branch or your own free project**.
  Neon branching is free and takes a minute.
- There is a hard-won pattern for this on the Python side: `db.py` reads an
  `OG_DB_PATH` environment variable, and tests run as a subprocess with
  `OG_DB_PATH=_t.db` so the connections **physically cannot reach** the live
  database. That exists because monkeypatching the connection was tried, was
  unreliable, and **polluted the real database twice.**

### 4. Never commit a secret

Not a token, not a connection string, not a password, not an API key. Not even
"temporarily". Not even in a file you intend to delete.

`.env.local` is gitignored and stays that way. `.env.example` is committed and
holds **placeholders only** — there is a law about it at the top of the file.

This is not hypothetical: the older MERN site has **real MongoDB Atlas
credentials committed in `Server/.env.example`** right now, and they have still
not been rotated. That is the mistake this rule exists to prevent repeating.

### 5. Never contact a customer

No messages, no emails, no test WhatsApps, no "just checking the flow works" to a
real number. Customer communication is Balaji's, always. Use your own number and
your own Google account for testing.

### 6. Never disable, skip or delete a test to make things pass

If a test fails, either the code is wrong or the test's assumption is stale.
Both are findings worth reporting. Neither is fixed by deleting the test.

### 7. Never design a feature that needs the Command Center to call out

PythonAnywhere's free tier blocks outbound HTTP. It physically cannot. See
[04](04-HOW-IT-WORKS.md). There is already one piece of dead code in the repo
from this being missed once.

---

## 🟡 Ask first

- **Changing anything in `docs/01`–`docs/04`.** Those are the contract. A `[LAW]`
  is changed by a written, dated override with the cost stated — the way Balaji's
  caching decision was recorded in `docs/03 §3.1` — not by editing the line.
- **Adding a dependency.** Free tiers only; the whole stack is about ₹0/month and
  staying that way is a business constraint, not a preference.
- **Anything touching money, pricing or meal counts.** Even a display change.
- **Changing an API shape** that the Command Center and the app both rely on.
  Both sides change together or neither does.
- **Starting the TypeScript port** of the business engine. It is an open
  decision, it needs a parity harness first, and it is not a solo call.
- **Moving the app to the apex domain** `oggainz.com`. Balaji's call. He has
  already decided to wait.

---

## 🟢 Do, freely

- Read every line of both codebases
- Run the app locally against the snapshot
- Build on a branch
- Write tests
- **Improve the UI.** It is explicitly wanted: the landing page is plain, no
  prices appear anywhere, and the meal screens could look far more premium
- Fix bugs you find — on a branch, with a note on what was wrong
- **Ask questions.** Balaji would rather answer ten than discover one wrong
  assumption later
- Write down anything confusing you work out. Half this pack exists because
  somebody did

---

## How to read a `[LAW]`

Tags in `docs/01`–`docs/04`:

| Tag | Means |
|---|---|
| **[LAW]** | An invariant. Breaking it corrupts money or meal counts. **Every one was learned from a real bug.** Do not touch. |
| **[RULE]** | Deliberate business behaviour. Changeable, with a conversation. |
| **[GAP]** | The Command Center does not do this, and the app should. Fair game. |

Three examples of why they are not decoration:

- **A customer's own skip cannot be un-skipped from the business side.** One
  mis-tap would otherwise turn "the customer told us not to cook" into "cook and
  deliver this" — so a meal is cooked and wasted, or sent to somebody who is not
  expecting it and was never told.
- **A pack is drawn down in `SUM(qty)`, never `COUNT(*)`.** One delivery row can
  carry two boxes. Counting rows made a day's order list read 7 when 8 boxes were
  going out.
- **A schedule change must never restate the past.** Changing one customer's
  delivery days once invented three past orders, which silently turned her
  20-meal pack into 17. That one cost real meals, and it is why delivery-day
  plans are now stored in dated generations.

---

## The one-line version

> **Read anything. Build on a branch. Deploy nothing. Ask when money, meals or
> the Command Center are involved.**
