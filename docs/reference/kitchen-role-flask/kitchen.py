"""
OG Gainz Command Center — the kitchen screens (what the evening staff actually use).

This is a SEPARATE, small app-within-the-app rather than the admin pages with the
prices hidden. That is a deliberate choice:

    the admin screens show money in about forty places. Hiding it with an
    `{% if %}` on each one works right up until the day somebody adds a
    forty-first and doesn't know the rule. These templates simply never render a
    price, so a price cannot leak from them. There is nothing to remember.

What the shift needs, and nothing else:

    /k                     tonight's orders — tap to mark delivered or skipped
    /k/order/<id>          one order: address, phone, what goes in the box, a note
    /k/prep                the batch prep list, with tick-offs
    /k/run/<date>/<slot>   the riding order, ticked off stop by stop on the road

Every write goes through `auth.log()`, so "who marked Ashok delivered at 8:14"
has an answer. The staff member only ever sees TODAY: no browsing back through
history, no other dates, no way to alter a finished day.

Language is per person (`users.lang`), because the sheet is already printed in
Tamil for the same reason — the ingredient line and the address are read under
time pressure, and that is not the moment to be translating in your head.
"""

from datetime import date, datetime

from flask import jsonify, redirect, render_template, request, url_for, abort

import auth
import core
import db
import menu
import ops
import sheet_i18n


def _today():
    """The kitchen screens are always TODAY. Never a date from the URL."""
    return date.today().strftime("%Y-%m-%d")


def _default_slot():
    """Lunch before 2 PM, Dinner after — so the shift opens on the right list."""
    return "Dinner" if datetime.now().hour >= 14 else "Lunch"


def _slot_arg(default=None):
    s = (request.args.get("slot") or "").lower()
    if s.startswith("d"):
        return "Dinner"
    if s.startswith("l"):
        return "Lunch"
    return default or _default_slot()


def _rows_for(c, d, slot):
    """This slot's orders, in the order they will be ridden where that is known."""
    rows = [r for r in core.deliveries_for_day(c, d)
            if (r["meal_type"] or "Lunch") == slot]
    return rows


def _counts(rows):
    return {
        "total":     len(rows),
        "pending":   sum(1 for r in rows if r["status"] == "Pending"),
        "delivered": sum(1 for r in rows if r["status"] == "Delivered"),
        "skipped":   sum(1 for r in rows if r["status"] == "Skipped"),
    }


def _wants_json():
    return request.headers.get("X-Requested-With") == "fetch"


# ---------------------------------------------------------------------------
def register(app):
    """Wire the kitchen screens into the app (called once from app.py)."""

    @app.context_processor
    def _kitchen_globals():
        # Only what these templates need. Deliberately does NOT include the
        # headline stats the admin pages use — those are all money.
        if auth.role() == "owner" and not str(request.path).startswith("/k"):
            return {}
        lang = auth.lang()
        return {"K": sheet_i18n.ui(lang), "k_lang": lang,
                "k_name": auth.name(), "k_role": auth.role(),
                "k_dir": sheet_i18n.ui(lang)["dir"]}

    # -- orders -------------------------------------------------------------
    @app.route("/k")
    def kitchen_home():
        d = _today()
        slot = _slot_arg()
        c = db.get_db()
        core.refresh_pause_statuses(c)
        rows = _rows_for(c, d, slot)
        operating = core.is_operating_day(c, d)
        # Both slots' counts, so the tabs can show how much is left in each.
        other = "Lunch" if slot == "Dinner" else "Dinner"
        other_rows = _rows_for(c, d, other)
        c.close()
        return render_template(
            "kitchen_today.html", d=d, slot=slot, rows=rows, operating=operating,
            counts=_counts(rows), other=other, other_counts=_counts(other_rows),
            day_label=datetime.strptime(d, "%Y-%m-%d").strftime("%A, %d %b"))

    @app.route("/k/order/<int:did>")
    def kitchen_order(did):
        d = _today()
        c = db.get_db()
        row = None
        for r in core.deliveries_for_day(c, d):
            if r["id"] == did:
                row = r
                break
        if row is None:
            c.close()
            abort(404)                      # not today's order: not his to see
        items, label = menu.order_items(c, row, d)
        lang = auth.lang()
        items = [{"name": sheet_i18n.component_name(i["name"], lang),
                  "qty": menu.fmt_qty(i["qty"], i["unit"]),
                  "note": i.get("note")} for i in items]
        addr = None
        if row["customer_id"]:
            addr = ops.resolve_address(c, row["customer_id"], d, row["address_id"],
                                       slot=(row["meal_type"] or "Lunch"))
        c.close()
        address = (addr["address"] if addr else None) or row["address"] or ""
        lat = (addr["lat"] if addr else None) if addr else row["lat"]
        lng = (addr["lng"] if addr else None) if addr else row["lng"]
        map_url = (f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
                   if lat is not None and lng is not None else None)
        return render_template(
            "kitchen_order.html", r=row, d=d, items=items, label=label or "Meal",
            address=address, map_note=(addr["map_note"] if addr else row["map_note"]),
            address_label=(addr["label"] if addr else None), map_url=map_url,
            back_slot=(row["meal_type"] or "Lunch"))

    # -- writes -------------------------------------------------------------
    @app.route("/k/order/<int:did>/mark", methods=["POST"])
    def kitchen_mark(did):
        status = request.form.get("status", "Delivered")
        if status not in ("Delivered", "Skipped", "Pending"):
            abort(400)
        d = _today()
        c = db.get_db()
        row = c.execute("SELECT * FROM deliveries WHERE id=?", (did,)).fetchone()
        # Today's rows only. Yesterday's mistakes are Balaji's to correct, not
        # something a staff member can quietly change days later.
        if not row or row["date"] != d:
            c.close()
            abort(404)
        core.mark_delivery(c, did, status)
        auth.log(c, "mark", f"delivery {did}",
                 f"{row['name']} · {row['meal_type']} · {row['status']} → {status}")
        rows = _rows_for(c, d, row["meal_type"] or "Lunch")
        c.close()
        if _wants_json():
            return jsonify({"ok": True, "status": status, **_counts(rows)})
        return redirect(request.referrer or url_for("kitchen_home"))

    @app.route("/k/order/<int:did>/note", methods=["POST"])
    def kitchen_note(did):
        d = _today()
        c = db.get_db()
        row = c.execute("SELECT * FROM deliveries WHERE id=?", (did,)).fetchone()
        if not row or row["date"] != d:
            c.close()
            abort(404)
        note = core.set_delivery_note(c, did, request.form.get("note", ""))
        auth.log(c, "note", f"delivery {did}", f"{row['name']}: {note or '(cleared)'}")
        c.close()
        if _wants_json():
            return jsonify({"ok": True, "note": note or ""})
        return redirect(url_for("kitchen_order", did=did))

    # -- prep ---------------------------------------------------------------
    @app.route("/k/prep")
    def kitchen_prep():
        d = _today()
        slot = _slot_arg()
        c = db.get_db()
        rows = core.deliveries_for_day(c, d)
        prep = menu.prep_for_day(c, d, rows=rows)
        ticks = {r["key"] for r in c.execute(
            "SELECT key FROM prep_ticks WHERE date=?", (d,))}
        c.close()
        lang = auth.lang()
        block = prep["dinner" if slot == "Dinner" else "lunch"]
        comps = [{"name": sheet_i18n.component_name(x["name"], lang),
                  "raw": x["name"], "emoji": x["emoji"], "display": x["display"],
                  "breakdown": x["breakdown"], "notes": x["notes"]}
                 for x in block["components"]]
        return render_template(
            "kitchen_prep.html", d=d, slot=slot, comps=comps, packs=block["packs"],
            meals=block["meals"], ticks=ticks, unmapped=prep["unmapped"],
            other=("Lunch" if slot == "Dinner" else "Dinner"))

    @app.route("/k/prep/tick", methods=["POST"])
    def kitchen_prep_tick():
        d = _today()
        key = (request.form.get("key") or "").strip()
        on = request.form.get("on") == "1"
        if not key:
            return jsonify({"ok": False})
        c = db.get_db()
        if on:
            c.execute("INSERT OR IGNORE INTO prep_ticks(date,key) VALUES(?,?)", (d, key))
        else:
            c.execute("DELETE FROM prep_ticks WHERE date=? AND key=?", (d, key))
        c.commit()
        auth.log(c, "prep", key, "ticked" if on else "un-ticked")
        c.close()
        return jsonify({"ok": True, "on": on})

    # -- the run ------------------------------------------------------------
    @app.route("/k/run")
    def kitchen_run():
        """The riding order, on the phone, ticked off stop by stop.

        Same route builder as the printed sheet, so paper and phone can never
        disagree about the order of the stops or which orders go by Porter.
        """
        d = _today()
        slot = _slot_arg()
        batch = request.args.get("batch", type=int)
        c = db.get_db()
        rows = core.deliveries_for_day(c, d)
        route = ops.build_route(c, d, slot, rows=rows, batch=batch)
        batches = []
        for b in ops.batch_rows(c, d, slot):
            n = c.execute(
                "SELECT COUNT(*) n FROM deliveries WHERE date=? AND meal_type=? "
                "AND batch_no=? AND status IN ('Pending','Delivered')",
                (d, slot, b["batch_no"])).fetchone()["n"]
            if n:
                b["n"] = n
                batches.append(b)
        # Status per delivery id, so a stop already handed over shows as done.
        status = {r["id"]: r["status"] for r in rows}
        c.close()
        return render_template(
            "kitchen_run.html", d=d, slot=slot, route=route, status=status,
            batch=batch, batches=batches,
            other=("Lunch" if slot == "Dinner" else "Dinner"))

    # -- own settings -------------------------------------------------------
    @app.route("/k/lang", methods=["POST", "GET"])
    def set_lang():
        """Switch your own screen language. Saved on your account, not the browser."""
        want = request.values.get("lang") or ("ta" if auth.lang() == "en" else "en")
        c = db.get_db()
        auth.set_lang(c, auth.uid(), want)
        c.close()
        back = request.values.get("back") or ""
        if not back.startswith("/") or back.startswith("//"):
            back = url_for("kitchen_home")
        return redirect(back)
