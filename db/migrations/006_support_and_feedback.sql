-- 006 — the three things the customer can say back to us
--
-- Tickets, meal feedback, and a face. New data the Command Center has never
-- held, and — Balaji's call, 12 Aug 2026 — data that stays here rather than
-- being pushed into oggainz.db (docs/05 §4).
--
-- Why that is allowed, against the [LAW] in docs/03 §1.1: the test is "if this
-- database were deleted tomorrow, would the business lose a login or a meal
-- record?" A ticket thread and a "bit too spicy" note fail neither. No meal, no
-- rupee, no subscription state. The honest cost is that losing this database
-- would take the ticket history and the feedback with it — accepted, with eyes
-- open, because meals and money are untouched.
--
-- Everything a business decision actually depends on — the skip, the pause, the
-- request queue Balaji screens — is written to the Command Center by
-- customer_writes.py, not here.

-- ---------------------------------------------------------------------------
-- Support: the one place a customer can reach a human
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
    id           bigserial PRIMARY KEY,
    customer_id  text NOT NULL,
    account_id   uuid REFERENCES accounts(id) ON DELETE SET NULL,
    subject      text NOT NULL,
    category     text NOT NULL,            -- subscription | delivery | billing | meal | details | other
    status       text NOT NULL DEFAULT 'open',   -- open | answered | resolved
    -- What the ticket was raised FROM: the meal date, or the profile field the
    -- customer wants corrected. It is what turns "please change my address"
    -- into something Balaji can act on without a second message asking which
    -- address.
    context      jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    -- Who has not read the latest message. Drives both unread badges from one
    -- column, so the two can never disagree about whose turn it is.
    unread_for   text NOT NULL DEFAULT 'owner'   -- owner | customer | none
);

-- Balaji's inbox: anything not resolved, oldest first, because the one that has
-- been waiting longest is the one that matters.
CREATE INDEX IF NOT EXISTS support_tickets_open
    ON support_tickets (status, updated_at DESC);

-- A customer's own list.
CREATE INDEX IF NOT EXISTS support_tickets_mine
    ON support_tickets (customer_id, updated_at DESC);


CREATE TABLE IF NOT EXISTS ticket_messages (
    id         bigserial PRIMARY KEY,
    ticket_id  bigint NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author     text NOT NULL,              -- customer | owner
    body       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_messages_thread
    ON ticket_messages (ticket_id, created_at);


-- ---------------------------------------------------------------------------
-- Feedback on one day's meal
-- ---------------------------------------------------------------------------
-- Deliberately per DAY and SLOT, not per pack. "The chicken was dry on Tuesday"
-- is actionable; "4 stars overall" is not.
CREATE TABLE IF NOT EXISTS meal_feedback (
    id            bigserial PRIMARY KEY,
    customer_id   text NOT NULL,
    delivery_date date NOT NULL,
    slot          text NOT NULL,           -- Lunch | Dinner
    rating        smallint,                -- 1..5, optional — tags alone are valid
    tags          text[] NOT NULL DEFAULT '{}',
    comment       text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    -- An UPSERT key, not an append. Changing your mind about yesterday's lunch
    -- replaces the note; it does not leave two contradictory ones on file for
    -- the kitchen to average.
    UNIQUE (customer_id, delivery_date, slot)
);

-- The kitchen's view: what came back about the last fortnight, newest first.
CREATE INDEX IF NOT EXISTS meal_feedback_recent
    ON meal_feedback (delivery_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS meal_feedback_mine
    ON meal_feedback (customer_id, delivery_date DESC);


-- ---------------------------------------------------------------------------
-- The one thing about themselves a customer may change
-- ---------------------------------------------------------------------------
-- A column on customer_profiles, not a table and not a file store: at ~30
-- customers this is a few dozen small images, and S3 or Vercel Blob would be a
-- new service and a new bill for that.
--
-- [LAW] docs/05 §4.1 — this is the ONLY field in customer_profiles the app
-- writes from the customer's side. docs/03 §3.1 built that table as a
-- photograph of the Command Center with no write path back; `payload` is still
-- exactly that. `avatar` sits BESIDE the photograph, is never read by the
-- Command Center, and a profile refresh must not erase it — which is why it is
-- its own column and not a key inside payload.
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS avatar text;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS avatar_set_at timestamptz;
