# Data model & integration

How the new app gets its data without putting the business at risk.

Companion to [01-business-rules.md](01-business-rules.md) and
[02-skip-and-pause.md](02-skip-and-pause.md).

---

## 0. What this app is for

**This app is the improved and upgraded version of the Command Center.**

It is not a companion, not a customer portal bolted onto an admin tool. Its data,
logic and workflow are copied out of the Command Center, and once it reaches
verified parity — roughly a month of running side by side — it becomes the tool
Balaji actually uses every day.

[LAW] The Command Center itself is **never deleted, altered or dismantled.** It
stands down to a permanent, complete, working backup — still deployed, still
runnable, database intact. Everything is copied *out* of it; nothing is ever
moved or removed. See [04 §0](04-parity-and-cutover.md).

That intent changes how to read the rest of this document:

- The API bridge in §1 is a **temporary seam with a planned end**, not the final
  architecture.
- "The Command Center is the system of record" is true **for now**; the handover
  is planned in [04-parity-and-cutover.md](04-parity-and-cutover.md).
- Postgres is the app's own store today and becomes the **business** store at
  cutover — filled by a read-only copy, never by emptying SQLite.

Everything must therefore be built so the seam can be removed without rewriting
what sits in front of it.

---

## 1. The architecture during the build

> **Until cutover: the Command Center stays the system of record, and the new app
> is a second face on the same data — never a second copy of it.**

Everything in this section follows from that sentence, and everything in it is
designed to be reversible at cutover.

```
   ┌──────────────────────────────┐
   │  Customer PWA                │   Next.js on Vercel
   │  oggainz.com                 │   the only thing customers see
   └──────────────┬───────────────┘
                  │  session cookie
   ┌──────────────▼───────────────┐
   │  BFF — Next.js API routes    │   holds the service token
   │  /api/me/*                   │   proves who the customer is
   └──────┬────────────────┬──────┘
          │                │
          │ service token  │ SQL
   ┌──────▼─────────┐  ┌───▼──────────────┐
   │ Command Center │  │ app database     │  Neon Postgres, free
   │ Flask + SQLite │  │ accounts, push,  │
   │ PythonAnywhere │  │ sessions, audit  │
   │                │  └──────────────────┘
   │ ALL business   │
   │ data lives here│
   └────────────────┘
```

### 1.1 [LAW] Two databases, and only one of them holds business data

| `oggainz.db` (SQLite, PythonAnywhere) | `app` DB (Postgres, Neon) |
|---|---|
| customers, subscriptions, deliveries | login accounts |
| pauses, slot moves, components | push subscriptions |
| invoices, plans, porter points | sessions, invite links |
| **skip/pause requests** | rate-limit counters, audit log |
| every rupee and every meal | nothing a business decision depends on |

If the Postgres database were deleted tomorrow, the business would lose *nobody's
login* and *not one meal record*. That is the test. If a table fails it, the
table is in the wrong database.

### 1.2 Why not move everything to Postgres immediately

Because migrating the live business database is the highest-risk thing we could
possibly do *first*, and there is no reason to do it first.

- SQLite cannot be shared across two hosts, so the seam has to exist anyway
  during the build.
- The Command Center must keep working while the new app is half-built. A shared
  database couples their fates at exactly the moment they should be independent.

The migration is not cancelled, only sequenced — it happens at cutover, once the
new app has proven it produces the same answers. The API boundary is what makes
that safe: **swap what is behind the API, change nothing in front of it.**

### 1.3 The end state, after cutover

```
   ┌──────────────────────────────┐
   │  OG Gainz app                │   customer + admin + kitchen
   │  oggainz.com                 │   the only interface
   └──────────────┬───────────────┘
                  │
   ┌──────────────▼───────────────┐
   │  Postgres                    │   the single source of truth
   │  business + app data         │   (filled by a read-only COPY)
   └──────────────────────────────┘

   Command Center: still deployed, still runnable, read-only.
                   A permanent backup. Never deleted.
```

### 1.4 [LAW] The new app never becomes a source of truth — until cutover day

It renders meals, it requests changes, it never *decides* them. Every write goes
to the Command Center and is applied by the same engine that has been running
the business since April. No meal count, no rupee, and no subscription status is
ever computed in Next.js.

---

## 2. Changes to `oggainz.db`

All additive. No column is dropped, renamed or retyped. Every one goes through
the existing `MIGRATIONS` mechanism in `db.py`, which runs automatically on
Reload.

### 2.1 New columns

```sql
-- Validity is opt-in per pack (doc 01 §7.2.0)
ALTER TABLE subscriptions ADD COLUMN enforce_validity  INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN expires_on        TEXT;
ALTER TABLE subscriptions ADD COLUMN validity_note     TEXT;

-- Pre-agreed late delivery, past the 8 PM promise (doc 01 §11.7.1)
ALTER TABLE subscriptions ADD COLUMN late_delivery_agreed INTEGER DEFAULT 0;

-- The negotiated add-on rate, e.g. Ashok's Rs50/50g vs catalog Rs60 (doc 01 §4.1.1)
ALTER TABLE subscription_components ADD COLUMN agreed_price REAL;
ALTER TABLE subscription_components ADD COLUMN price_note   TEXT;

-- Who put the pin there (doc 01 §11.8.1)
ALTER TABLE customer_addresses ADD COLUMN pin_source TEXT;     -- customer | admin
ALTER TABLE customer_addresses ADD COLUMN pin_set_at TEXT;
```

[LAW] Defaults must preserve today's behaviour exactly. `enforce_validity`
defaults to `0`, so **not one existing pack starts expiring** the moment this
ships. See doc 01 §7.3.

### 2.2 New table — requests

```sql
CREATE TABLE IF NOT EXISTS skip_requests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     TEXT NOT NULL,
    subscription_id TEXT,
    kind            TEXT NOT NULL,   -- skip | pause | resume | undo
    target_date     TEXT,            -- for skip / resume
    start_date      TEXT,            -- for pause
    end_date        TEXT,
    requested_at    TEXT NOT NULL,
    cutoff_at       TEXT NOT NULL,   -- the deadline that applied AT THE TIME
    minutes_late    INTEGER NOT NULL DEFAULT 0,
    reason          TEXT,
    outcome         TEXT NOT NULL,   -- auto_applied | pending | allowed | declined
    decided_at      TEXT,
    decided_by      TEXT,
    decline_reason  TEXT,
    source          TEXT DEFAULT 'app'
);
CREATE INDEX IF NOT EXISTS idx_skipreq_pending
    ON skip_requests(outcome, requested_at);
CREATE INDEX IF NOT EXISTS idx_skipreq_customer
    ON skip_requests(customer_id, requested_at);
```

[LAW] `cutoff_at` and `minutes_late` are **stored, never recomputed.** The cutoff
is a setting and will change; history must keep saying how late a request was
against the rule in force when it was made (doc 02 §8.1).

[RULE] A request is written for *every* action, including ones applied instantly
(`outcome = 'auto_applied'`). Without that there is no history to screen against.

### 2.3 New settings

Rows in the existing `settings` table — no schema change:

```
skip_cutoff_time         18:00
skip_cutoff_applies_to   calendar_day
late_requests_allowed    1
pause_max_days           (empty = unlimited)
freeze_eligible_plans    Elite Meal Pack,Athlete Meal Pack
delivery_promise_lunch   11:00-13:45
delivery_promise_dinner  17:30-20:00
fee_band_free_km         5
fee_band_mid_km          10
fee_band_far_km          15
```

The last five exist so the terms page can be **generated** rather than typed
(doc 02 §2.0.1).

---

## 3. The app database (Postgres)

Only things that are meaningless to the business.

```sql
CREATE TABLE accounts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   text NOT NULL,          -- 'C001' — the link to the business
    email         text UNIQUE,
    google_sub    text UNIQUE,            -- Google's stable user id
    display_name  text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_seen_at  timestamptz,
    disabled      boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX ON accounts (customer_id) WHERE NOT disabled;

CREATE TABLE invites (
    token       text PRIMARY KEY,          -- random, 32+ bytes, single use
    customer_id text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    used_by     uuid REFERENCES accounts(id)
);

CREATE TABLE push_subscriptions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    endpoint   text NOT NULL UNIQUE,
    p256dh     text NOT NULL,
    auth       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    failed_at  timestamptz
);

CREATE TABLE audit_log (
    id         bigserial PRIMARY KEY,
    account_id uuid REFERENCES accounts(id),
    at         timestamptz NOT NULL DEFAULT now(),
    action     text NOT NULL,
    detail     jsonb,
    ip_hash    text                        -- hashed, never the raw IP
);
```

[LAW] `accounts.customer_id` is the **only** business identifier stored here, and
it is a reference, not a copy. No name, no phone, no address, no meal, no
amount. If this database leaks, it reveals who has an account — nothing more.

---

## 4. Linking a customer to an account

Free-tier only means no SMS OTP (doc 01 §15.2). The answer is better than OTP
anyway.

```
1. Balaji opens a customer in the Command Center, taps "Invite to app".
2. A single-use link is generated:  oggainz.com/join/<token>   (7-day expiry)
3. He sends it on WhatsApp — where he already talks to every customer.
4. Customer opens it, signs in with Google (or an email link).
5. That Google account binds to C0xx. The invite is burned.
```

Why this is the right shape:

- **Free.** No SMS cost, ever.
- **Secure.** Nobody can claim an account by guessing a phone number — the link
  is the proof, and it comes down the channel Balaji already trusts.
- **Zero friction.** One tap. No password to invent or forget.
- **Matches reality.** Every customer arrives through a WhatsApp conversation.

[LAW] One active account per customer. A second binding attempt is refused, not
silently merged.

[RULE] Balaji can revoke an account from the Command Center. Revoking never
deletes business data — it only unbinds the login.

---

## 5. The Command Center API

A new Flask blueprint, `customer_api.py`. Additive — it registers routes and
touches no existing view.

### 5.1 Authentication

Follows the existing `/content/api/sync` pattern, with two corrections.

```python
# Header, not the JSON body — bodies land in logs and proxies.
token = request.headers.get("X-OG-Service-Token", "")
# Constant-time compare — '!=' leaks length and prefix through timing.
if not hmac.compare_digest(token, os.environ["OG_API_TOKEN"]):
    return jsonify({"ok": False, "error": "unauthorised"}), 401
```

[LAW] The service token **never reaches the browser.** Only the BFF holds it, in
a Vercel environment variable. A customer's browser talks exclusively to
`oggainz.com/api/me/*`, which knows who they are from their session cookie.

[LAW] Every endpoint takes an explicit `customer_id` and returns only that
customer's rows. The BFF passes the id from the session — never from anything
the browser sent.

### 5.2 Endpoints

```
GET   /api/v1/settings/public
        cutoff time, delivery windows, fee bands — for the UI and the terms

GET   /api/v1/customer/<cid>/packs
        live subscriptions: plan, composition (base + add-ons), meals
        remaining, status, expires_on when enforced

GET   /api/v1/customer/<cid>/meals?from=&to=
        one row per day: date, slot, status, pack, day_note, request state

GET   /api/v1/customer/<cid>/invoices
GET   /api/v1/customer/<cid>/addresses

POST  /api/v1/customer/<cid>/pin
        { address_id, lat, lng }            → sets pin_source='customer'

POST  /api/v1/customer/<cid>/skip
        { date, reason? }                   → applied | requested
POST  /api/v1/customer/<cid>/pause
        { start, end, reason? }             → applied | partial | requested
POST  /api/v1/customer/<cid>/resume
        { from }                            → applied | requested
POST  /api/v1/customer/<cid>/undo
        { request_id }                      → applied | requested
```

### 5.3 [LAW] The cutoff is decided on the server, always

The browser shows a countdown. The **server** decides whether a request is in
time, using its own clock and the current setting. A client that lies about the
time, or is simply 20 minutes fast, must not be able to skip a cooked meal.

Every write endpoint returns what actually happened, and the UI renders the
answer rather than assuming its optimistic guess was right:

```json
{ "ok": true,
  "outcome": "partial",
  "applied": ["2026-08-05", "2026-08-06", "2026-08-07"],
  "pending": ["2026-08-02"],
  "message": "Paused from Monday 5 August. Friday's meal is already being prepared." }
```

### 5.4 [LAW] Writes call the existing engine, never raw SQL

`core.add_pause()`, `core.resume_subscription()`, `core.recompute_subscription()`
already encode the invariants in doc 01 §6. The API calls those functions. It
does not write to `deliveries` or `subscription_pauses` itself.

> Every one of those laws was learned from a real bug. Reimplementing them in a
> second language is how they get relearned.

---

## 6. When the Command Center is unreachable

PythonAnywhere free tier is one small web worker, and free apps need a login
every three months to stay alive. Plan for downtime.

| | Behaviour |
|---|---|
| **Reads** | Serve the last cached copy, with a visible "as of 6:42 PM" stamp |
| **Writes** | Queue nothing. Fail honestly: "Can't reach the kitchen right now — try again in a minute." |

[LAW] Never optimistically confirm a skip the server has not accepted. A skip
that looks applied but never arrived is the worst bug this product can have —
the customer stops expecting food that is on its way, or expects food that isn't.

---

## 7. Security

| Concern | Measure |
|---|---|
| Service token | Vercel env var only. Never in the repo, never in the browser. |
| Token comparison | `hmac.compare_digest`, never `!=` |
| Customer isolation | `customer_id` comes from the server session, never from the request body |
| Invite links | 32+ random bytes, single use, 7-day expiry |
| Session cookies | `HttpOnly`, `Secure`, `SameSite=Lax` |
| Rate limiting | Per account and per IP on all write endpoints |
| PII | Postgres stores no name, phone or address — only `customer_id` |
| IP addresses | Hashed in the audit log, never stored raw |
| Transport | HTTPS end to end; Vercel and PythonAnywhere both terminate TLS |
| Secrets in git | `.gitignore` already covers `*_token`, `*.key`, `.env*` |

[LAW] Repeating the mistake in the old MERN app is not an option: **no
credential, of any kind, in `.env.example` or any committed file.**

---

## 8. Build order

1. `db.py` migrations — new columns and `skip_requests`. Ship to the Command
   Center alone and confirm nothing changes. **This is the only step that
   touches the running business.**
2. `customer_api.py` — read endpoints only, plus token auth.
3. Neon Postgres + `accounts`, `invites`; the "Invite to app" button.
4. Next.js skeleton, Google sign-in, invite redemption.
5. Read-only customer app: my packs, my meals, my invoices. **Usable here.**
6. Write endpoints: pin, then skip, then pause.
7. Request queue in the Command Center for Balaji.
8. Push notifications.
9. Terms page generated from settings.

Step 1 is the only risk to the live business, and it is defaults-only —
`enforce_validity = 0` everywhere means behaviour is provably unchanged.

Steps 1–5 produce something real customers can use, with **zero write paths**
into the business. That is a deliberately safe first milestone.

---

## 9. Decisions — 1 Aug 2026

| | Decision |
|---|---|
| Where the app lives | **`oggainz.com` itself.** Not a subdomain. The app *is* the brand's front door. |
| Sign-in | **Google + email magic link.** Google for one-tap; magic link for anyone without a Google account on their phone. |
| Command Center URL | **Stays at `oggainz.pythonanywhere.com`** — no paid plan, no custom domain needed for a backup. |
| End state | Once the new app reaches verified parity it becomes the daily tool, and **the Command Center stands down to a permanent, runnable backup** — still deployed, never deleted. See [04-parity-and-cutover.md](04-parity-and-cutover.md). |

### 9.1 Consequence of putting the app on the apex

`oggainz.com` currently serves the old MERN marketing site from Vercel. Replacing
it means the marketing content either moves into the new app or goes away.

[RULE] The apex must still greet a **logged-out stranger** sensibly — what OG
Gainz is, the packs, the prices, and a way to get in touch. A signed-in customer
lands straight on their meals instead. One domain, two front doors, decided by
session.

### 9.2 Magic links need an email sender

Google sign-in is free and needs nothing. Magic links need outbound email —
Resend's free tier (3,000/month) is far beyond what ~30 customers will ever use,
and its domain setup is a DNS record on a domain already sitting in Vercel.

[LAW] Magic links: single use, 15-minute expiry, invalidated when a newer one is
issued. An email link is a password that arrives in plain text — it must not
linger.
