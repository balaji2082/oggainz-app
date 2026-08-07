-- 004 — cache the whole customer payload, not just addresses
--
-- 002 cached addresses. Now that every screen reads through the Command Center
-- API rather than a local file, the same protection has to cover packs, meals,
-- invoices and the customer's own details.
--
-- Why this matters more than it sounds: the Command Center runs on a free
-- PythonAnywhere worker, which sleeps and wakes slowly. Without a cache, a
-- customer opening the app while it is asleep sees an error instead of their
-- meals. With one, they see their meals and a note saying how old the reading is.
--
-- [LAW] docs/03 §1.4 — this is still a photograph. Written only from the
-- Command Center, never edited by the app, no write path back, every row stamped
-- with when it was taken. Emptying this table loses nothing.

ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS payload jsonb;
