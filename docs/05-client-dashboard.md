# The client dashboard — build 2 (Aug 2026)

Steps 6–7 of the [03 §8](03-data-model.md) build order, plus three things those
docs never covered: meal feedback, support tickets, and a profile photo.

This is the build that turns a read-only app into one a customer *uses*.

Companion to [01-business-rules.md](01-business-rules.md),
[02-skip-and-pause.md](02-skip-and-pause.md) — **02 is the specification for
skip and pause and this document does not restate it.** Where the two disagree,
§2 below records why, dated and signed, rather than quietly overriding it.

---

## 0. What exists before this build

Everything read, nothing written.

| Working | Missing |
|---|---|
| 6 read endpoints on the Command Center | every write path, without exception |
| Google sign-in, invites, `/connect`, owner `/admin` | skip, pause, resume, undo |
| Today / Meals / My pack / Account screens | feedback, tickets, avatar |
| `skip_requests` table + 9 settings already migrated | anything that writes to them |

The `skip_requests` table and the `skip_cutoff_time` setting have existed in
`db.py` since the first migration and **have never had a single row written to
them.** This build is what fills them.

---

## 1. [LAW] The cutoff is owner-editable, from the app

Balaji's requirement, 12 Aug 2026. Doc 02 §2.0 already said the cutoff is a
setting and never a constant. This adds the missing half: **he can change it
himself, from his phone, without a deploy.**

```
app.oggainz.com/admin  →  Settings  →  Skip deadline   [ 18:00 ]
```

The chain that must hold, end to end:

```
settings.skip_cutoff_time   (oggainz.db — the one place that knows)
        │
        ├─→ GET /api/v1/settings/public  ─→ the countdown on every meal card
        ├─→ server-side validation of every skip/pause request
        ├─→ which calendar days render as past-deadline
        └─→ the generated terms page (doc 02 §2.0.1)
```

[LAW] No second copy. A component that needs the deadline asks for it; it never
carries its own default. The one permitted fallback is
`lib/live.ts`'s `FALLBACK_SETTINGS`, used **only** when the Command Center is
unreachable, and a screen rendering from it is already marked stale.

[LAW] Changing the setting affects **future** requests only. A request already
in the queue keeps the `cutoff_at` and `minutes_late` it was born with
(doc 03 §2.2). This is why those two columns are stored and never recomputed.

[RULE] The editor is owner-only — `OG_OWNER_EMAIL`, the same gate as `/admin`.
It writes through a new endpoint, not by editing a file.

### 1.1 What else becomes editable at the same time

The same screen, the same mechanism, because they are the same kind of value:

| Setting | Default | Why he'd change it |
|---|---|---|
| `skip_cutoff_time` | `18:00` | a second shift, a bigger team, a different rhythm |
| `late_requests_allowed` | `1` | turn the late path off entirely if it's abused |
| `pause_max_days` | *(empty)* | cap a runaway freeze |
| `freeze_eligible_plans` | `Elite Meal Pack,Athlete Meal Pack` | when Signature earns it |

---

## 2. Deviation from doc 02 §7.1 — late skips are not advertised

**Balaji's instruction, 12 Aug 2026, recorded because it contradicts the spec.**

Doc 02 §7.1 draws an after-cutoff meal card with a prominent
`[ Request to skip anyway ]` button and the line *"Balaji will confirm. Usually
fast."* That copy **promises a late skip is available**, and he does not want
the product to make that promise.

His reasoning is sound: a documented "ask and we'll cancel it" path stops being
an exception and becomes the expectation, and the food is already cooked and
paid for.

So the after-cutoff card becomes:

```
┌─────────────────────────────────────┐
│  TOMORROW · Fri 2 Aug         Lunch │
│                                     │
│  Elite Meal Pack                    │
│                                     │
│  ⏱  This meal is already being      │
│     prepared.                       │
│                                     │
│  ┌───────────────────────────────┐  │
│  │        Message us             │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

| Doc 02 §7.1 said | This build does | Why |
|---|---|---|
| "Request to skip anyway" | "Message us" | states no outcome |
| "Balaji will confirm. Usually fast." | *(nothing)* | promises nothing |
| A skip request | A support ticket, date pre-filled | he decides case by case, off the record |

What is **preserved** from §7.1: the button is never hidden and never greyed
out, and the customer never hits a dead end. What is removed is only the
promise. Nowhere in the app — not in the meal card, not in support, not in the
terms — does copy tell a customer that meals can be cancelled after the
deadline.

[LAW] The engine side is unchanged. If Balaji chooses to honour a late request,
he applies it from the queue and it is recorded in `skip_requests` exactly as
doc 02 §8 describes. The discretion is real; only the advertising is gone.

---

## 2.5 [LAW] A one-day skip is a one-day pause window

Doc 02 §3.1 says a skip before the cutoff should *"delete the Pending delivery
row"*. **Read against the code, that is wrong, and it would have shipped as an
intermittent bug that is very hard to reproduce.**

`core.ensure_day_rows()` re-creates a Pending row for every active subscription
on every operating day, and the only thing that stops it is
`is_paused_on(sub, day)`:

```python
for s in subs:
    if is_paused_on(conn, s["id"], day_iso):     # frozen this day → no order
        continue
    ...
    exists = conn.execute("SELECT 1 FROM deliveries WHERE ...").fetchone()
    if exists:
        continue
    INSERT INTO deliveries(... 'Pending' ...)
```

A deleted row is not remembered. It comes back the moment Balaji opens that
day in the Command Center — which he does every morning. The customer would
skip Friday, see it disappear, and the meal would silently reappear on the prep
list hours later.

So:

```
skip(date)     →  core.add_pause(sub, start=date, end=date)
undo skip      →  core.delete_pause(that window)
```

One mechanism, not two. It is durable, it already purges the Pending row
(`_purge_pending_in_range`), it already recomputes the pack, and a skipped day
correctly generates **no order at all** rather than an order that has to be
suppressed later. Doc 02 §3.1's own words — *"exactly as a one-day pause
would"* — were closer to right than the sentence they explain.

[RULE] `subscription_pauses` therefore holds two kinds of row that read
identically. The `reason` column distinguishes them for anyone reading the
table later: a one-day skip writes `"skip via app"`.

---

## 3. What the customer can and cannot change

Balaji's rule: the business owns the record, the customer owns their face.

| Field | Who edits | How a customer changes it |
|---|---|---|
| Name, phone, email, customer id | **Balaji only** | raises a request; he edits in the Command Center |
| Delivery address, map pin | **Balaji only** *(pin: see below)* | raises a request |
| Pack, plan, add-ons, dates | **Balaji only** | raises a request |
| Profile photo | **the customer** | uploads it, immediately |
| Skip / pause / resume | **the customer**, before the deadline | in the app, instantly |
| Meal feedback | **the customer** | on the day, or any past day |

[LAW] Every identity field renders **read-only with a visible reason** — never a
disabled input with no explanation, which reads as a bug. Each row carries a
"Request a change" action that opens a support ticket pre-filled with the field
name and its current value.

> Your details are kept by us so deliveries and invoices always match.
> Need something corrected? Ask us and we'll update it.

[RULE] The map pin is the one exception already sanctioned by doc 03 §5.2 —
`POST /pin` with `pin_source='customer'`. **Not in this build.** It needs a map
component and it is not on the one-week list. The column and endpoint design
stay as specified so it drops in later.

---

## 4. New data — and why none of it is in the Command Center

Feedback, tickets and photos go in **Postgres**, managed from the app's
`/admin`. Balaji's call, 12 Aug 2026.

Doc 03 §1.1's test is *"if this database were deleted tomorrow, would the
business lose a login or a meal record?"* A ticket thread and a "bit too spicy"
note fail neither: no meal, no rupee, no subscription state. They are also
things the Command Center has never held and would need new tables, new routes
and new templates to hold — inside a week, on a live business, for no gain.

The honest cost: a Postgres loss would take the ticket history and the feedback
with it. Accepted. Meals and money are untouched, which is the line that
matters.

```sql
-- migration 006
CREATE TABLE support_tickets (
    id           bigserial PRIMARY KEY,
    customer_id  text NOT NULL,
    account_id   uuid REFERENCES accounts(id),
    subject      text NOT NULL,
    category     text NOT NULL,   -- subscription | delivery | billing | meal | other
    status       text NOT NULL DEFAULT 'open',   -- open | answered | resolved
    context      jsonb,           -- the date/field the ticket was raised from
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    unread_for   text NOT NULL DEFAULT 'owner'   -- owner | customer | none
);

CREATE TABLE ticket_messages (
    id         bigserial PRIMARY KEY,
    ticket_id  bigint NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author     text NOT NULL,     -- customer | owner
    body       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE meal_feedback (
    id            bigserial PRIMARY KEY,
    customer_id   text NOT NULL,
    delivery_date date NOT NULL,
    slot          text NOT NULL,
    rating        smallint,        -- 1..5, optional
    tags          text[] NOT NULL DEFAULT '{}',
    comment       text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (customer_id, delivery_date, slot)
);
```

[RULE] Feedback is an **upsert**, not an append. Changing your mind about
yesterday's lunch replaces the note; it does not create a second one.

[LAW] Feedback may only be left on a day that has actually been delivered. A
rating on food nobody ate is noise, and it lets someone rate a meal they skipped.

### 4.1 The avatar

A column on `customer_profiles`, not a table, and not a file store.

Resized client-side to 512 px, JPEG, and refused above 200 KB after that. Stored
as a data URL. No S3, no Vercel Blob, no new service and no new bill for what
will be at most a few dozen small images.

[LAW] The avatar is the **only** thing in `customer_profiles` the app writes
from the customer's side. Doc 03 §3.1 built that table as a photograph of the
Command Center with no write-back; this puts one field beside the photograph
that the Command Center never had and never reads. It is not part of the cached
payload and a refresh must not erase it.

---

## 5. The screens

Mobile first, thumb-first, five tabs.

```
Today          the meal, the countdown, one action
Calendar       the month, skip a day, pause a range
My pack        composition, progress, past packs, invoices
Support        tickets and replies
Profile        details, avatar, request a change
```

| Screen | What it answers |
|---|---|
| **Today** | Is food coming? When? Can I still stop it? |
| **Calendar** | What's coming, what happened, and when am I away? |
| **My pack** | What am I paying for, how much is left, what did I get? |
| **Support** | Something's wrong and I need a human |
| **Profile** | Do they have my right address and number? |

Every skip and pause confirmation restates the carry-forward promise in doc 02
§7.4's exact words. Repetition is correct; it is the fact that builds trust.

---

## 6. Build order

1. Command Center write endpoints + the IST cutoff module, with boundary tests
   **and a test that changing the setting moves the boundary.**
2. Postgres migration 006.
3. The UI kit — the premium layer everything else is drawn with.
4. Today, with the live countdown and skip/undo.
5. Calendar, day sheet, pause range, partial application.
6. My pack + history + invoices.
7. Feedback.
8. Support tickets.
9. Profile + avatar.
10. Owner admin: request queue, ticket inbox, feedback stream, **the cutoff editor.**
11. Verification, then deploy.

Step 1 is the only one that touches the running business, and it is additive:
new routes in `customer_api.py`, no existing view, function or template altered.
