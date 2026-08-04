"""
OG Gainz Command Center — who is logged in, and what they are allowed to touch.

Until now the app was all-or-nothing: anybody who knew the password could change a
price, delete a subscription or read the revenue page. That was fine while Balaji
was the only person who ever logged in. It stopped being fine the moment a staff
member needed to mark tonight's deliveries.

The whole permission system is three small ideas:

  1. A `users` table.       One row per real person. Staff log in with their own
                            name + PIN, so every action has a name attached to it.
  2. A capability map.      `CAPS` below says what each ROLE may do, in plain words
                            ("today.mark"), not in page names.
  3. A deny-by-default gate. `ENDPOINT_CAPS` is the ONLY list of pages a non-owner
                            can reach. A page that is not on that list is refused.
                            So adding a new page to the app never accidentally
                            exposes it — a new page starts out locked, and you have
                            to come here and unlock it on purpose.

That third point is the important one. The alternative (writing "if not allowed,
block" at the top of every page) fails the day you forget one, and you never find
out until a staff member sees something they should not.

Two more rules that live here because they are easy to get wrong elsewhere:

  * MONEY IS INVISIBLE to non-owners — not greyed out, not read-only, absent. The
    kitchen screens are separate templates that never render a price at all, which
    is a much stronger promise than hiding prices on the admin pages one by one.
  * EVERY STAFF WRITE IS LOGGED to `audit_log` with the person's name.

Local mode (running on the laptop with no OG_PASSWORD set) is still wide open and
still owner — nothing about the laptop workflow changes. But a staff PIN login
works locally too, which is how you preview exactly what Subramani will see.
"""

import secrets
from functools import wraps

from flask import redirect, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

import db

# ---------------------------------------------------------------------------
# Roles and what each one may do
# ---------------------------------------------------------------------------
# Capability names are deliberately about ACTIONS, not pages, so that moving a
# button to a different screen doesn't quietly change who can press it.
CAPS = {
    # Balaji. "*" is a wildcard: everything, including anything added later.
    "owner": {"*"},

    # Evening kitchen + delivery staff. Can run tonight's service and nothing else.
    # Explicitly NOT here: any price, any revenue figure, any payment status,
    # creating/editing/pausing/deleting a subscription, the menu, the brochure,
    # settings, exports or backups.
    "kitchen": {
        "today.view",      # tonight's orders, meals remaining, address + phone
        "today.mark",      # delivered / skipped
        "today.note",      # a note against one order ("gate locked, called")
        "prep.tick",       # tick off a prep item
        "run.view",        # the live route screen while riding
        "sheet.print",     # the printed shift sheet (its only ₹ is his own petrol allowance)
    },

    # Editor friends on the social-media team (was the "team" password login).
    "content": {"content.view", "content.edit"},

    # Reserved. Phase E — coaching. Nothing uses these yet.
    "fitness": {"coaching.view", "coaching.edit", "checkin.view"},

    # Reserved. Phase B — the customer's own private link (/me/<token>).
    "client": {"me.view", "me.history", "me.pause", "me.skip"},
}

# Where each role lands after logging in, and where it is bounced back to when it
# reaches for a page it may not have.
ROLE_HOME = {
    "owner":   "today",
    "kitchen": "kitchen_home",
    "content": "content_board",
}

# Old session cookies (and the old two-password login) used these names. Anyone
# already logged in on a phone keeps working instead of being silently logged out.
LEGACY_ROLES = {"admin": "owner", "team": "content"}

# ---------------------------------------------------------------------------
# THE gate: every page a non-owner may reach, and the capability it needs.
# ---------------------------------------------------------------------------
# Anything not listed here is refused for every role except owner. When you add a
# page that staff should see, add it here — that is the only way in, on purpose.
ENDPOINT_CAPS = {
    # --- reachable by anyone who is logged in at all ---
    "logout":       "*any*",
    "static":       "*any*",
    "login":        "*any*",
    "set_lang":     "*any*",       # switching your own screen language

    # --- kitchen ---
    "kitchen_home":      "today.view",
    "kitchen_order":     "today.view",
    "kitchen_prep":      "today.view",
    "kitchen_mark":      "today.mark",
    "kitchen_note":      "today.note",
    "kitchen_prep_tick": "prep.tick",
    "kitchen_run":       "run.view",
    "kitchen_run_stop":  "run.view",
    "sheet":             "sheet.print",
    "sheet_pick":        "sheet.print",

    # --- content team (unchanged behaviour, new role name) ---
    "content_board":       "content.view",
    "content_post":        "content.view",
    "content_shoots":      "content.view",
    "content_tasks":       "content.view",
    "content_post_status": "content.edit",
    "content_post_comment": "content.edit",
    "content_task_toggle": "content.edit",
    "content_set_name":    "content.edit",
    "content_sync_api":    "*any*",     # protected by its own token, not the session
}

# Pages that need no login at all (customer-facing or token-protected).
PUBLIC_ENDPOINTS = {"login", "static", "invoice_public", "terms", "brochure_public",
                    "content_sync_api"}


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL,          -- owner | team | client
    role        TEXT,                   -- owner | kitchen | content | fitness
    name        TEXT NOT NULL,
    phone       TEXT,
    customer_id TEXT,                   -- clients only -> customers.id
    token       TEXT UNIQUE,            -- clients: their private link (Phase B)
    pw_hash     TEXT,                   -- staff + owner: hashed PIN, never the PIN itself
    lang        TEXT DEFAULT 'en',      -- en | ta, this person's screen language
    active      INTEGER DEFAULT 1,      -- 0 = cannot log in (kept for the audit trail)
    fail_count  INTEGER DEFAULT 0,      -- wrong PINs in a row
    locked_until TEXT,                  -- guessing lockout, see check_pin()
    last_seen   TEXT,
    created_at  TEXT
);

-- Who did what. Written on every staff action, so "who marked this delivered"
-- has an answer. `who` stores the name as it was at the time, so the log stays
-- readable even if the person is renamed or deactivated later.
CREATE TABLE IF NOT EXISTS audit_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    at      TEXT,
    user_id INTEGER,
    who     TEXT,
    role    TEXT,
    action  TEXT,                       -- mark | note | prep | login | ...
    target  TEXT,                       -- 'delivery 812', 'S042'
    detail  TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
"""


# Columns added after the users table first shipped, so an existing database
# picks them up instead of needing to be rebuilt.
USER_MIGRATIONS = [("fail_count", "INTEGER DEFAULT 0"), ("locked_until", "TEXT")]


def ensure_schema(conn=None):
    own = conn is None
    c = conn or db.get_db()
    c.executescript(SCHEMA)
    existing = {r["name"] for r in c.execute("PRAGMA table_info(users)")}
    for col, decl in USER_MIGRATIONS:
        if col not in existing:
            c.execute(f"ALTER TABLE users ADD COLUMN {col} {decl}")
    c.commit()
    if own:
        c.close()


# ---------------------------------------------------------------------------
# Who is this?
# ---------------------------------------------------------------------------
def role():
    """The current role name. Local laptop mode with nobody logged in = owner."""
    r = session.get("role")
    if not r:
        return "owner"
    return LEGACY_ROLES.get(r, r)


def name():
    """Display name of whoever is logged in."""
    if session.get("name"):
        return session["name"]
    return "Balaji" if role() == "owner" else role().title()


def uid():
    return session.get("uid")


def lang():
    """This person's screen language: 'en' or 'ta'."""
    return "ta" if session.get("lang") == "ta" else "en"


def is_owner():
    return role() == "owner"


def has(cap):
    """Does the current role have this capability?"""
    allowed = CAPS.get(role(), set())
    return "*" in allowed or cap in allowed


def may(endpoint):
    """May the current role reach this page? Deny-by-default for non-owners."""
    if endpoint is None:
        return True                       # 404s and static misses: let Flask answer
    if is_owner():
        return True
    cap = ENDPOINT_CAPS.get(endpoint)
    if cap is None:
        return False                      # not on the list -> locked
    if cap == "*any*":
        return True
    return has(cap)


def home_url():
    return url_for(ROLE_HOME.get(role(), "today"))


def require(cap):
    """Decorator for a single route, when a page needs a finer check than the map.

    The endpoint map above is the main gate; this is for the odd case where one
    page holds two actions with different permissions.
    """
    def deco(fn):
        @wraps(fn)
        def inner(*a, **kw):
            if not has(cap):
                return redirect(home_url())
            return fn(*a, **kw)
        return inner
    return deco


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
def staff_list(conn, active_only=True):
    """Staff who can log in — used for the name buttons on the login screen."""
    q = ("SELECT * FROM users WHERE kind IN ('owner','team')"
         + (" AND active=1" if active_only else "")
         + " ORDER BY active DESC, name")
    return conn.execute(q).fetchall()


def get_user(conn, user_id):
    return conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()


def create_user(conn, name_, role_, pin, phone=None, lang_="en", kind="team"):
    """Add a staff member. The PIN is hashed immediately and never stored as typed."""
    cur = conn.execute(
        "INSERT INTO users(kind, role, name, phone, pw_hash, lang, active, created_at) "
        "VALUES(?,?,?,?,?,?,1,?)",
        (kind, role_, name_.strip(), (phone or "").strip() or None,
         generate_password_hash(str(pin)), lang_, db.now_iso()))
    conn.commit()
    return cur.lastrowid


def set_pin(conn, user_id, pin):
    """Set a new PIN. Also clears any guessing lockout — the point of Balaji
    resetting it is that the person can get straight back in."""
    conn.execute("UPDATE users SET pw_hash=?, fail_count=0, locked_until=NULL WHERE id=?",
                 (generate_password_hash(str(pin)), user_id))
    conn.commit()


def set_active(conn, user_id, on):
    """Deactivate rather than delete — the audit log must keep pointing at a real row."""
    conn.execute("UPDATE users SET active=? WHERE id=?", (1 if on else 0, user_id))
    conn.commit()


def set_lang(conn, user_id, lang_):
    lang_ = "ta" if lang_ == "ta" else "en"
    if user_id:
        conn.execute("UPDATE users SET lang=? WHERE id=?", (lang_, user_id))
        conn.commit()
    session["lang"] = lang_


# A short PIN is the right trade-off for a phone in a kitchen, but the login page
# is on the public internet, and 4 digits is only 10,000 guesses. So after this
# many wrong PINs in a row the account stops accepting any PIN for a while — which
# turns a minutes-long brute force into a multi-week one. A real person who has
# forgotten theirs just waits, or asks Balaji to set a new one.
MAX_PIN_TRIES = 5
LOCKOUT_MINUTES = 15


def locked_for(conn, user_id):
    """Minutes remaining on a guessing lockout, or 0."""
    from datetime import datetime
    u = get_user(conn, user_id)
    if not u or not u["locked_until"]:
        return 0
    try:
        until = datetime.strptime(u["locked_until"], "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        return 0
    left = (until - datetime.now()).total_seconds()
    return max(0, int(left // 60) + 1) if left > 0 else 0


def check_pin(conn, user_id, pin):
    """True if this PIN belongs to this active, unlocked user."""
    from datetime import datetime, timedelta
    u = get_user(conn, user_id)
    if not u or not u["active"] or not u["pw_hash"]:
        return False
    if locked_for(conn, user_id):
        return False
    if check_password_hash(u["pw_hash"], str(pin)):
        conn.execute("UPDATE users SET fail_count=0, locked_until=NULL WHERE id=?",
                     (user_id,))
        conn.commit()
        return True
    fails = (u["fail_count"] or 0) + 1
    until = None
    if fails >= MAX_PIN_TRIES:
        until = (datetime.now() + timedelta(minutes=LOCKOUT_MINUTES)
                 ).strftime("%Y-%m-%d %H:%M:%S")
        fails = 0                      # start the count again after the lockout
    conn.execute("UPDATE users SET fail_count=?, locked_until=? WHERE id=?",
                 (fails, until, user_id))
    conn.commit()
    if until:
        log(conn, "login.locked", f"user {user_id}",
            f"{MAX_PIN_TRIES} wrong PINs — locked {LOCKOUT_MINUTES} min")
    return False


def sign_in(conn, user):
    """Put a real user row into the session."""
    session.permanent = True
    session["authed"] = True
    session["uid"] = user["id"]
    session["role"] = user["role"] or "kitchen"
    session["name"] = user["name"]
    session["lang"] = user["lang"] or "en"
    conn.execute("UPDATE users SET last_seen=? WHERE id=?", (db.now_iso(), user["id"]))
    conn.commit()
    log(conn, "login", f"user {user['id']}", user["name"])


def sign_in_role(role_, display=None):
    """Password login with no user row behind it (Balaji's own password, and the
    shared content-team password). Kept so nothing about the existing logins breaks."""
    session.permanent = True
    session["authed"] = True
    session["uid"] = None
    session["role"] = role_
    session["name"] = display or ("Balaji" if role_ == "owner" else role_.title())


def new_token():
    """An unguessable string for a client's private link (Phase B)."""
    return secrets.token_urlsafe(16)


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------
def log(conn, action, target=None, detail=None):
    """Record one action against whoever is logged in.

    Called on every staff write. Never raises — a failure to write the log must
    not stop the delivery from being marked.
    """
    try:
        conn.execute(
            "INSERT INTO audit_log(at, user_id, who, role, action, target, detail) "
            "VALUES(?,?,?,?,?,?,?)",
            (db.now_iso(), uid(), name(), role(), action,
             str(target) if target is not None else None,
             str(detail) if detail is not None else None))
        conn.commit()
    except Exception:
        pass


def recent(conn, limit=200, user_id=None):
    q = "SELECT * FROM audit_log"
    args = []
    if user_id:
        q += " WHERE user_id=?"
        args.append(user_id)
    q += " ORDER BY id DESC LIMIT ?"
    args.append(limit)
    return conn.execute(q, args).fetchall()
