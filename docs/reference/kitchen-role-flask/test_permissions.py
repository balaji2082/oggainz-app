"""
Permission tests — what each role can and cannot reach.

Run it any time you change roles, add a page, or before deploying:

    python test_permissions.py

It copies oggainz.db to a throwaway file FIRST and points the app at the copy, so
it can never write to your real data. It refuses to run if that copy fails.

Why this file exists: the rest of the app is checked by looking at it. A
permission boundary can't be — a page that leaks a price looks completely normal.
The important test in here is section 3: every page a staff login must NOT reach.
When you add a page, add it to the right list below and run this again.
"""

import os
import re
import shutil
import sys
import tempfile

APP_DIR = os.path.dirname(os.path.abspath(__file__))
LIVE_DB = os.path.join(APP_DIR, "oggainz.db")

# --- point the app at a throwaway copy BEFORE importing anything of ours ---
_tmp = os.path.join(tempfile.gettempdir(), "oggainz_permtest.db")
for _suffix in ("", "-wal", "-shm"):
    try:
        os.remove(_tmp + _suffix)
    except OSError:
        pass
if os.path.exists(LIVE_DB):
    shutil.copyfile(LIVE_DB, _tmp)
os.environ["OG_DB_PATH"] = _tmp
os.environ.setdefault("OG_PASSWORD", "test-owner-pw")
os.environ.setdefault("OG_TEAM_PASSWORD", "test-team-pw")
os.environ.setdefault("OG_SECRET_KEY", "test-secret")

sys.path.insert(0, APP_DIR)
import db                                                      # noqa: E402

if os.path.abspath(db.DB_PATH) == os.path.abspath(LIVE_DB):
    sys.exit("REFUSING TO RUN: the app is pointed at the live database.")

import app as A                                                # noqa: E402
import auth                                                    # noqa: E402

FAILS, N = [], 0


def check(label, cond, extra=""):
    global N
    N += 1
    if cond:
        print(f"  ok   {label}")
    else:
        print(f"  FAIL {label} {extra}")
        FAILS.append(label)


def blocked(resp, home):
    """A refused page bounces the person back to their own home screen."""
    return resp.status_code in (302, 308) and home in resp.headers.get("Location", "")


A.app.config["TESTING"] = True
today = A.date.today().strftime("%Y-%m-%d")

# --- fixtures -------------------------------------------------------------
c = db.get_db()
auth.ensure_schema(c)
c.execute("DELETE FROM users WHERE name = 'PermTestStaff'")
c.commit()
KID = auth.create_user(c, "PermTestStaff", "kitchen", "4321", lang_="ta")
rows = A.core.deliveries_for_day(c, today)
if not rows:
    c.execute("INSERT INTO deliveries(date,name,meal_type,status,created_at) "
              "VALUES(?,?,?,?,?)", (today, "Perm Test", "Dinner", "Pending", db.now_iso()))
    c.commit()
    rows = A.core.deliveries_for_day(c, today)
DID, SLOT = rows[0]["id"], (rows[0]["meal_type"] or "Lunch")
c.execute("INSERT INTO deliveries(date,name,meal_type,status,created_at) "
          "VALUES('2026-01-02','Perm Old Row','Dinner','Pending',?)", (db.now_iso(),))
c.commit()
OLD = c.execute("SELECT id FROM deliveries WHERE name='Perm Old Row'").fetchone()["id"]
sub = c.execute("SELECT id FROM subscriptions LIMIT 1").fetchone()
SUB = sub["id"] if sub else None
c.close()

print("\n== 1. signing in ==")
k = A.app.test_client()
check("the login page offers the staff name", b"PermTestStaff" in k.get("/login").data)
check("a wrong PIN is refused",
      b"Wrong PIN" in k.post("/login", data={"staff": KID, "pin": "0000"}).data)
r = k.post("/login", data={"staff": KID, "pin": "4321"})
check("the right PIN signs in and lands on the kitchen screen",
      r.status_code == 302 and r.headers["Location"].endswith("/k"),
      r.headers.get("Location"))

print("\n== 2. the kitchen CAN reach its own screens ==")
for path in ["/k", f"/k?slot={SLOT}", "/k/prep", "/k/run", f"/k/order/{DID}",
             f"/sheet/{today}/{SLOT}"]:
    check(f"GET {path}", k.get(path).status_code == 200)

print("\n== 3. the kitchen CANNOT reach anything else ==")
# Add every new admin page here. Deny-by-default means a page you forget is
# blocked anyway — this list is what proves it stays that way.
for path in ["/today", "/subscriptions", "/customers", "/revenue", "/settings",
             "/crm", "/invoices", "/menu", "/brochure/edit", "/staff", "/audit",
             "/export", "/pins", "/porter-points", "/deliveries", "/trials",
             "/agent", "/notifications", "/more", "/routes",
             "/subscriptions/review", "/content"]:
    check(f"GET {path} is refused", blocked(k.get(path), "/k"))
check("POST /backup is refused", blocked(k.post("/backup"), "/k"))

print("\n== 4. the kitchen CANNOT write through an admin route ==")
posts = [(f"/api/delivery/{DID}/mark", {"status": "Delivered"}),
         ("/api/prep/tick", {"key": "x", "on": "1"}),
         ("/day/toggle", {"d": today, "action": "close"}),
         ("/settings/threshold", {"threshold": "5"})]
if SUB:
    posts += [(f"/subscriptions/{SUB}/delete", {}),
              (f"/subscriptions/{SUB}/payment", {"amount_received": "1"})]
for path, data in posts:
    check(f"POST {path} is refused", blocked(k.post(path, data=data), "/k"))

print("\n== 5. no money reaches a kitchen screen ==")
money = re.compile(r"₹|\bprice\b|\brevenue\b|amount_received|payment_status|total_amount",
                   re.I)
for path in ["/k", "/k/prep", "/k/run", f"/k/order/{DID}"]:
    hits = money.findall(k.get(path).get_data(as_text=True))
    check(f"{path} contains nothing about money", not hits, hits[:5])

print("\n== 6. kitchen writes work, and carry a name ==")
r = k.post(f"/k/order/{DID}/mark", data={"status": "Delivered"},
           headers={"X-Requested-With": "fetch"})
check("marking delivered works", r.status_code == 200 and r.get_json().get("ok"))
c = db.get_db()
check("the delivery really changed",
      c.execute("SELECT status FROM deliveries WHERE id=?", (DID,)).fetchone()[0] == "Delivered")
a = c.execute("SELECT * FROM audit_log WHERE action='mark' ORDER BY id DESC LIMIT 1").fetchone()
check("the audit log names the person",
      a and a["who"] == "PermTestStaff" and a["role"] == "kitchen")
c.close()
check("a note saves", k.post(f"/k/order/{DID}/note", data={"note": "gate locked"},
                            headers={"X-Requested-With": "fetch"}).get_json().get("note"))
check("a prep tick saves",
      k.post("/k/prep/tick", data={"key": f"{SLOT}|Chicken", "on": "1"},
             headers={"X-Requested-With": "fetch"}).get_json().get("on") is True)

print("\n== 7. the kitchen cannot change any day but today ==")
check("marking an older day is refused",
      k.post(f"/k/order/{OLD}/mark", data={"status": "Delivered"}).status_code == 404)
c = db.get_db()
check("that older row is untouched",
      c.execute("SELECT status FROM deliveries WHERE id=?", (OLD,)).fetchone()[0] == "Pending")
c.close()

print("\n== 8. language follows the person ==")
check("Tamil renders for a Tamil account", "ஆர்டர்" in k.get("/k").get_data(as_text=True))
k.get("/k/lang?lang=en")
check("the toggle switches to English", "Orders" in k.get("/k").get_data(as_text=True))
c = db.get_db()
check("the choice is saved on the account",
      c.execute("SELECT lang FROM users WHERE id=?", (KID,)).fetchone()[0] == "en")
c.close()

print("\n== 9. the owner is unaffected ==")
o = A.app.test_client()
check("the owner password still works",
      o.post("/login", data={"password": "test-owner-pw"}).status_code == 302)
for path in ["/today", "/subscriptions", "/customers", "/revenue", "/settings",
             "/crm", "/invoices", "/menu", "/trials", "/deliveries", "/more",
             "/pins", "/porter-points", "/routes", "/content", "/staff", "/audit",
             "/k", "/notifications", "/agent", "/subscriptions/review",
             f"/sheet/{today}/{SLOT}"]:
    check(f"owner GET {path}", o.get(path).status_code == 200)
check("the owner still sees money on Today", "₹" in o.get("/today").get_data(as_text=True))

print("\n== 10. the content team is unchanged ==")
e = A.app.test_client()
r = e.post("/login", data={"password": "test-team-pw"})
check("the team password reaches the board", "/content" in r.headers.get("Location", ""))
check("the board opens", e.get("/content").status_code == 200)
check("Today is refused", blocked(e.get("/today"), "/content"))
check("revenue is refused", blocked(e.get("/revenue"), "/content"))
check("the kitchen is refused", e.get("/k").status_code in (302, 308))

print("\n== 11. phones already logged in keep working ==")
for cookie_role, page, ok_code in [("admin", "/revenue", 200), ("team", "/content", 200)]:
    t = A.app.test_client()
    with t.session_transaction() as s:
        s["authed"] = True
        s["role"] = cookie_role
    check(f"an old '{cookie_role}' cookie still works", t.get(page).status_code == ok_code)

print("\n== 12. removing access, and guessing ==")
c = db.get_db()
auth.set_active(c, KID, False)
c.close()
check("a deactivated person cannot sign in",
      b"Wrong PIN" in A.app.test_client().post(
          "/login", data={"staff": KID, "pin": "4321"}).data)
c = db.get_db()
auth.set_active(c, KID, True)
check("their history survives being deactivated",
      c.execute("SELECT COUNT(*) FROM audit_log WHERE user_id=?", (KID,)).fetchone()[0] > 0)
c.close()

bf = A.app.test_client()
for _ in range(auth.MAX_PIN_TRIES):
    bf.post("/login", data={"staff": KID, "pin": "0000"})
c = db.get_db()
check("repeated wrong PINs lock the account", auth.locked_for(c, KID) > 0)
check("even the correct PIN is refused while locked", not auth.check_pin(c, KID, "4321"))
auth.set_pin(c, KID, "4321")
check("resetting the PIN clears the lock", auth.locked_for(c, KID) == 0)
c.close()

print(f"\n{N - len(FAILS)}/{N} checks passed")
if FAILS:
    print("FAILURES:")
    for f in FAILS:
        print("  -", f)
    sys.exit(1)
print("ALL GREEN")
