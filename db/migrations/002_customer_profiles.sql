-- 002 — a cached copy of each customer's own details
--
-- DECISION, Balaji, 4 Aug 2026: the app stores name, phone and address rather
-- than fetching them every time, so a customer's screen still works when the
-- Command Center is unreachable. This overrides the original wording of
-- docs/03 §1.1 and §3, which allowed customer_id and nothing else. See the
-- dated decision note in docs/03 §3.1.
--
-- [LAW] STILL TRUE, and the reason this is a cache and not a second copy:
-- the Command Center remains the source of truth (docs/03 §1.4). Nothing here
-- is ever edited by the app or written back. Every row records WHEN it was
-- copied, so the interface can say "as of 6:42 PM" instead of quietly showing
-- last month's address. A row here is a photograph, never the original.
--
-- If this table were emptied, the app would refill it from the Command Center
-- on the next page load and nothing would be lost.

CREATE TABLE IF NOT EXISTS customer_profiles (
    customer_id text PRIMARY KEY,
    name        text,
    phone       text,
    locality    text,
    -- The address list as the Command Center returned it: label, text, pin,
    -- weekday schedule. Kept as JSON rather than its own table because the app
    -- only ever displays it — it is not the app's data to model or to edit.
    addresses   jsonb NOT NULL DEFAULT '[]'::jsonb,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    -- Where this photograph came from, so a stale row can be traced.
    source      text NOT NULL DEFAULT 'command-center'
);

-- Finding the rows most in need of a refresh.
CREATE INDEX IF NOT EXISTS profiles_stale ON customer_profiles (synced_at);
