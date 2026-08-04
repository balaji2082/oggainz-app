# Reference — staff roles and the kitchen screen, as built in Flask

**This is not part of the app. Nothing here runs, and nothing here should be
ported line by line.** It is a working prototype kept for its design decisions,
to be read when the kitchen and admin screens are built for real — which is late
in the build order, after the engine port (see [../../04-parity-and-cutover.md](../../04-parity-and-cutover.md) §7).

## What it is

Built 3 Aug 2026, the day Subramani started as evening kitchen and delivery
assistant. It gives staff their own login and a small phone screen for the shift,
inside the Flask Command Center. It was tested (88 checks, all passing) and then
**reverted**, because [04 §0](../../04-parity-and-cutover.md) is a [LAW] that the
Command Center is never altered, and this altered six of its files.

`command-center-edits.patch` is exactly what was reverted. It is kept so the
work is recoverable, not because it should be re-applied.

## The five decisions worth keeping

**1. Staff get their own screens, not the admin screens with prices hidden.**
The Command Center shows money in about forty places. Hiding it with a
conditional on each one works until somebody adds a forty-first and does not know
the rule. `kitchen_*.html` never render a price at all, so a price cannot leak
from them — and a test asserts no `₹`, "price", "revenue", `payment_status` or
`total_amount` appears in the rendered HTML of any kitchen screen. Prefer the
version of this that cannot go wrong over the version somebody has to remember.

**2. Permissions deny by default.** `auth.py` holds two maps: `CAPS` (role →
what it may do, in verbs like `today.mark`) and `ENDPOINT_CAPS` (the only list of
pages a non-owner may reach). Anything not on the list is refused. A page added
next month is therefore locked until someone unlocks it deliberately, which is
the opposite of the usual failure where a new page is public because nobody
remembered to guard it.

**3. Named logins, not a shared password.** Staff sign in with their own name
and PIN against a `users` table, so `audit_log` can answer "who marked Ashok
delivered at 8:14". A shared kitchen password can only ever say "the kitchen".
Five wrong PINs locks the account for 15 minutes — the login page is on the
public internet and four digits is only 10,000 guesses.

**4. Language belongs to the person, not the browser.** `users.lang`, toggled
in-app, in English or Tamil. The wording lives in one place next to the printed
sheet's wording, because the two must agree. Kitchen-screen wording is written
for a phone in one hand ("tap"), the sheet's for A4 and a pen ("tick") — same
language, different register, so they are separate string sets.

**5. Staff can only ever act on today.** Marking any other date returns 404.
Correcting last week is Balaji's job, not something a staff member can change
days later.

## What the screens are

| | |
|---|---|
| `/k` | tonight's orders — tap ✓ delivered or skipped |
| `/k/order/<id>` | one order: contents, address, map, call, WhatsApp, meals left, a note |
| `/k/prep` | batch prep quantities, tapped off line by line |
| `/k/run` | the riding order with ETAs, one tap per stop, whole route in Maps |
| `/staff`, `/audit` | Balaji's side: add a person, reset a PIN, remove access, read the log |

## One bug worth remembering

`menu._finish()` returns `notes` as an **already-joined string**. Piping it
through a template `join` splits it character by character — "200g with sauce
topping" rendered as `2 · 0 · 0 · g · ...` on the prep list.

## When this gets built for real

The parity checklist in [04 §4](../../04-parity-and-cutover.md) lists what the
kitchen screens must cover. Roles are not in the current data model
([03 §3](../../03-data-model.md)) — that has `accounts` for customers only, so
staff accounts need designing when the time comes. The capability-map shape here
is a reasonable starting point; the Flask code is not.
