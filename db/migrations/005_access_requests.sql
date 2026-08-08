-- 005 — people asking to get in
--
-- Someone signs in with Google and the app does not recognise them. Two very
-- different people arrive at that moment:
--
--   an existing subscriber whose Google account is not linked yet
--   a stranger who found the site and wants to start
--
-- Both used to hit "No account yet", a dead end that reads like a broken app.
-- Now both land here, and Balaji sees them in one list.
--
-- The Google identity is held here rather than in `accounts` because they do
-- not have an account yet — that is the whole point. A row is created only
-- after they have signed in with Google, so `google_sub` is already proven;
-- what is NOT proven is that they are the customer they claim to be, which is
-- exactly what Balaji's approval decides.

CREATE TABLE IF NOT EXISTS access_requests (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Proven by Google at sign-in.
    google_sub  text NOT NULL,
    email       text,
    display_name text,
    -- Claimed by them, verified by Balaji recognising it.
    phone       text NOT NULL,
    kind        text NOT NULL,          -- subscriber | new
    goal        text,                   -- only for 'new': what they are after
    status      text NOT NULL DEFAULT 'pending',  -- pending | approved | declined | handled
    customer_id text,                   -- set when approved
    created_at  timestamptz NOT NULL DEFAULT now(),
    decided_at  timestamptz
);

-- The admin list reads pending-first, newest-first.
CREATE INDEX IF NOT EXISTS access_requests_open
    ON access_requests (status, created_at DESC);

-- One open request per Google account: pressing submit twice, or coming back
-- the next day because nothing happened yet, must not fill the list with
-- duplicates of the same person.
CREATE UNIQUE INDEX IF NOT EXISTS access_requests_one_open
    ON access_requests (google_sub) WHERE status = 'pending';
