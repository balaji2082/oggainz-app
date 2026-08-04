-- 001 — accounts, invites, push subscriptions, audit log
--
-- Build-order step 3 (docs/03 §8). This is the APP's own database, and it holds
-- nothing the business depends on.
--
-- [LAW] docs/03 §1.1 — the test this schema has to pass: if this database were
-- deleted tomorrow, the business would lose nobody's login and not one meal
-- record. Every customer, subscription, delivery and rupee lives in the Command
-- Center's oggainz.db and stays there until cutover.
--
-- [LAW] docs/03 §3 — accounts.customer_id is the ONLY business identifier here,
-- and it is a reference, not a copy. No name, no phone, no address, no meal, no
-- amount. If this database leaked it would reveal who has an account, and
-- nothing else about them.

-- Who can sign in, and which customer they are.
CREATE TABLE IF NOT EXISTS accounts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   text NOT NULL,          -- 'C001' — the link to the business
    email         text UNIQUE,
    google_sub    text UNIQUE,            -- Google's stable user id
    display_name  text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_seen_at  timestamptz,
    disabled      boolean NOT NULL DEFAULT false
);

-- [LAW] One active account per customer. A second binding attempt is refused,
-- not silently merged. Partial index so a disabled account does not block the
-- customer from ever being re-invited.
CREATE UNIQUE INDEX IF NOT EXISTS accounts_customer_active
    ON accounts (customer_id) WHERE NOT disabled;

-- Single-use links Balaji sends on WhatsApp: oggainz.com/join/<token>
-- Chosen over SMS OTP because it is free, needs no third party, and arrives
-- down the channel he already uses with every customer.
CREATE TABLE IF NOT EXISTS invites (
    token       text PRIMARY KEY,          -- 32+ random bytes, single use
    customer_id text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,      -- 7 days
    used_at     timestamptz,
    used_by     uuid REFERENCES accounts(id)
);

-- Finding a customer's outstanding invite, and expiring old ones.
CREATE INDEX IF NOT EXISTS invites_customer ON invites (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invites_open     ON invites (expires_at) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    endpoint   text NOT NULL UNIQUE,
    p256dh     text NOT NULL,
    auth       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    failed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS push_by_account ON push_subscriptions (account_id);

-- What accounts did here — sign-ins, invite redemptions, settings changes.
-- Not the business audit trail; that belongs to the Command Center.
CREATE TABLE IF NOT EXISTS audit_log (
    id         bigserial PRIMARY KEY,
    account_id uuid REFERENCES accounts(id),
    at         timestamptz NOT NULL DEFAULT now(),
    action     text NOT NULL,
    detail     jsonb,
    -- [LAW] docs/03 §7 — hashed, never the raw IP.
    ip_hash    text
);

CREATE INDEX IF NOT EXISTS audit_recent ON audit_log (at DESC);
