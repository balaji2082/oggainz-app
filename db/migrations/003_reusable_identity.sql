-- 003 — a disabled account must not block the person behind it
--
-- Migration 001 made `customer_id` unique only among ACTIVE accounts, so a
-- customer whose access was removed could be invited again. It did not do the
-- same for `email` and `google_sub`, which stayed unique across every row
-- including disabled ones.
--
-- The gap shows up the moment access is moved: disable Balaji's account on C018,
-- invite him on C010, and his sign-in is refused — not because anything is
-- wrong, but because the dead row still owns his Google identity. Found on
-- 7 Aug 2026 doing exactly that.
--
-- [LAW] docs/03 §4 still holds: one ACTIVE account per customer, and one active
-- account per identity. "Active" is the word that matters in both. A disabled
-- row is history, and history must not veto the present.

-- These are constraints, not plain indexes, so they need dropping by name.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_email_key;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_google_sub_key;

-- NULL is excluded as well: an account created by Google sign-in has no email
-- if Google never confirmed one, and several such rows must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_active
    ON accounts (email) WHERE NOT disabled AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_google_active
    ON accounts (google_sub) WHERE NOT disabled AND google_sub IS NOT NULL;
