# OG Gainz — Business Rules

**The specification for the new OG Gainz app.**

Extracted from the working Command Center (`Projects/OG-Gainz-OS`) on 31 Jul 2026 —
7,045 lines of Python, 27 tables, 101 routes, and the real data behind them.

This document is the contract. The Command Center is one *expression* of these
rules; the new app will be another. Where the two ever disagree, **this document
is what we meant**, and whichever app disagrees with it has a bug.

Every rule below is marked:

- **[LAW]** — a hard invariant. Breaking it corrupts money or meal counts.
- **[RULE]** — real business behaviour. Change only deliberately.
- **[GAP]** — the Command Center does *not* do this, and the new app should.

---

## 1. What the business is

A home cloud kitchen in Perumbakkam, Chennai. Customers buy a **pack** of meals
(20 meals monthly, 5 weekly). One meal is delivered per operating day until the
pack runs out. Meals are macro-counted — chicken, egg, carb, veggies — and sold
on protein content, not on being restaurant food.

Kitchen runs **Monday to Friday** only. Deliveries go out in two slots, **Lunch**
and **Dinner**, on a single two-wheeler route ridden by one person.

Current scale (from live data): 27 customers, 64 subscriptions all-time,
18 live, 1,043 delivered meals, 41 trials.

---

## 2. Core entities

| Entity | ID format | What it is |
|---|---|---|
| Customer | `C001` | A person. Has phone, addresses. |
| Subscription | `S001` | One pack bought once. **Not** a recurring billing object. |
| Delivery | auto int | One meal on one date. **The unit of truth for everything.** |
| Trial order | `T001` | A one-off paid sample meal, pre-conversion. |
| Plan | int | A catalog pack (Signature / Elite / Athlete …). |
| Component | int | An ingredient line (Chicken, Egg, Veggies …). |
| Invoice | `INV-001` | A bill, with a public token link. |
| Porter point | int | A handoff spot for far deliveries. |

### 2.1 [LAW] Deliveries are the single source of truth

Every count, every rupee of earned revenue, every subscription status is
**derived** from the `deliveries` table. Nothing is authoritative anywhere else.

`delivered_count`, `skipped_count`, `remaining_meals` and `status` on a
subscription are **caches**. They are recomputed from deliveries, never edited
directly. If they ever disagree with the delivery rows, the delivery rows win.

> This is the rule that made the Command Center trustworthy after the Excel
> sheet stopped adding up. Do not reintroduce a second place where a meal count
> can be stored.

### 2.1.1 [LAW] One customer can hold several packs at once

This is normal, not an edge case. In the live data **4 of the 18 active packs
belong to customers who are running two at the same time** — Rajkiran, Ashok,
Vignesh and Raj each hold two concurrently.

Reasons vary: a second pack for a family member, a meal pack plus a Protein
Shake pack, or simply topping up before the first runs out.

Consequences the new app must handle:

- The customer screen shows a **list** of packs, never a single "my subscription".
- Two packs can generate two meals on the same day, in the same or different slots.
- "Which pack does today's meal come from?" must always be answerable.
- An `Elite Meal Pack + Custom Meal Pack` style legacy name is very likely
  *one customer, two packs* recorded as one row because the app couldn't express it.

### 2.2 [LAW] A subscription is a pack, not a recurring charge

Buying "Monthly" does **not** mean billed every month. It means *20 meals, paid
once, up front*. The pack ends when 20 meals have been delivered — which might
take 4 weeks or 8, depending on pauses and skips.

This matters enormously for the new app: **do not model this as a Stripe/Razorpay
recurring subscription.** It is a prepaid meal wallet with a validity window.

---

## 3. The kitchen calendar

### 3.1 [RULE] Operating days

Default: **Mon–Fri** (`operating_weekdays = 0,1,2,3,4`). Weekends closed.

Resolution order for "is the kitchen open on date D?":

1. A **day override** for that exact date wins outright (forced open or forced closed).
2. Otherwise: weekday must be an operating weekday **and** D must not be a holiday.

A working Saturday is a day override with `is_open = 1`. A festival closure is
either a holiday row or an override with `is_open = 0`.

### 3.2 [LAW] Closing a day must not leave phantom orders

Opening a day auto-creates Pending rows for every active subscription. If that
day is later closed, those still-Pending **subscription** rows must be deleted.

Never delete: Delivered rows, Skipped rows, or trial orders explicitly scheduled
for that date. Only auto-generated Pending subscription rows.

> Skipping this caused orders to keep appearing on days the kitchen was shut.

---

## 4. Plans and pricing

Live catalog as of 31 Jul 2026:

| Plan | Monthly | Weekly | Trial | Validity | Meals (mo/wk) |
|---|---|---|---|---|---|
| Signature Meal Pack | ₹3,999 | ₹1,299 | ₹249 | 40 d | 20 / 5 |
| Elite Meal Pack | ₹4,999 | ₹1,399 | ₹299 | 50 d | 20 / 5 |
| Athlete Meal Pack | ₹5,999 | ₹1,699 | ₹349 | 50 d | 20 / 5 |
| Protein Salad Box | ₹3,800 | — | ₹200 | 50 d | 20 / 5 |
| Protein Shake | ₹3,099 | — | — | 50 d | 20 / 5 |
| Custom Meal Pack | — | — | — | 50 d | 20 / 5 |
| ~~Royal Meal Pack~~ | ₹5,699 | ₹1,499 | ₹349 | 50 d | retired, kept for history |

### 4.1 [LAW] A sold subscription keeps the price it was sold at

Changing a plan's catalog price must **never** alter an existing subscription.
Price is copied onto the subscription at the moment of sale. Historic revenue
must stay reproducible.

### 4.1.1 [LAW] Every price is negotiable, per customer, per sale

The catalog is a **starting suggestion, never a constraint.** Balaji sets the
final number, and the same item legitimately costs different customers different
amounts.

This applies to all three levels:

- the **pack price** (already freely editable),
- the **add-on rate** — Ashok pays ₹50 per 50 g of chicken where the catalog
  says ₹60,
- the **final bill total**, which he can simply type.

[GAP] Today only the *total* is overridable. Add-on rates come from the catalog,
so a negotiated rate has nowhere to live — it gets absorbed into the total and
the reason disappears. Six months later nobody can reconstruct why the bill was
₹8,176.

**The new app stores the agreed rate on the subscription's add-on row**, with an
optional note. The catalog price only ever pre-fills it.

> Worked example — Ashok, `S053`, the highest-value pack in the business:
> Elite ₹4,999 + 100 g extra chicken. Charged ₹6,976 for food, ₹1,200 delivery,
> **₹8,176 total.** The chicken premium works out to ≈ ₹49 per 50 g, not the
> catalog ₹60. That negotiated rate exists only in Balaji's memory.

### 4.2 Money on a subscription

```
total_amount = subscription_price + delivery_fee
pending      = total_amount - amount_received
payment_status ∈ { Paid, Unpaid, Partial }
```

### 4.3 Delivery fee charged to the customer

> **[LAW] The customer delivery fee and the rider's ₹3/km petrol allowance are
> two completely separate things. Never derive one from the other, never show
> them in the same total, never let a change to one move the other.**
>
> The fee is revenue from the customer. The allowance is a cost paid to the
> employee. They happen to both involve distance; that is their only relationship.

Bands, by road distance from the kitchen:

| Distance | Fee charged |
|---|---|
| ≤ 5 km | **Free** |
| 5–10 km | ₹30–50 |
| 10–15 km | ₹50–75 |
| > 15 km | Not normally served. If the customer insists: ₹100–120, scaled by distance, delivered via the nearest Porter point. |

[RULE] Beyond 15 km is a judgement call, not a refusal. One or two customers are
served out there today. The app must let Balaji say yes.

### 4.4 [GAP] The fee is currently typed by hand with no guidance

`delivery_fee` is a free number on the subscription form. Nothing suggests a
value, so the bands above live only in Balaji's head.

**Decision: the new app suggests, Balaji overrides.** Once the customer's pin is
known, show the computed distance and the suggested fee inline — then let it be
edited freely, with no warning and no friction. A suggestion that fights back is
worse than no suggestion.

---

## 5. The menu engine

### 5.1 Components

An editable catalog of ingredient lines, each with a unit (`g`, `pcs`,
`serving`), a step size, a default quantity, an add-on price, and protein
content. Examples: Chicken (50 g steps, ₹60 per 50 g, 11 g protein per 50 g),
Egg (1 pc, ₹20, 6 g protein), Paneer (100 g, ₹100, 16 g protein).

### 5.2 Three layers of composition

```
plan_components          →  what a standard pack contains  (the recipe)
subscription_components  →  what THIS subscriber gets      (base + addon)
component_rules          →  standing weekday tweaks        ("paneer on Tue/Fri")
```

Standard recipes:

- **Signature** = 100 g chicken + 1 egg + veggies + carb
- **Elite** = Signature + fruits + yogurt
- **Athlete** = 150 g chicken + 2 eggs + veggies + carb + fruits + yogurt

### 5.2.1 [LAW] The pack is the base; everything else is an add-on

There are only ever a handful of packs, and **the pack name is fixed**. Every
variation a customer wants — more chicken, an extra egg, two salad boxes — is an
**add-on row**, never a change to the pack's name.

The correct way to express "Ashok wants the Athlete pack with extra chicken":

```
plan          = Athlete Meal Pack          ← chosen from a list, never typed
add-on        = Chicken, 2 × 50 g          ← structured row, priced automatically
```

**not** `plan_name = "Athlete Meal Pack + 100g Chicken"`.

[RULE] **Add-ons are counted in the component's own step, not in free units.**
Chicken moves in 50 g steps, so 100 g extra is *two* add-on units at ₹60 each.
Paneer moves in 100 g steps, eggs in single pieces. Quantity add-ons work the
same way — "Protein Salad Box × 2" is one pack plus one add-on unit.

This is already how the subscription form works today. The messy names in the
data predate it — see §13.1.

### 5.3 [RULE] Rules apply per day, in order

For a given date, resolve a subscription's items as:

1. Start from its saved composition (base + add-ons).
2. Apply each active rule whose date range and weekday set cover that date:
   - `swap`  → remove the *from* component, add the *to* component
   - `add`   → add the *to* component
   - `remove`→ remove the *from* component

### 5.4 [LAW] The prep list is pure arithmetic, never AI

The kitchen quantity list is deterministic maths over the tables above. An LLM
may *explain* the prep list; it must never *compute* it. A hallucinated 200 g of
chicken is a real customer with a wrong meal.

Counts every order that must be **cooked** — Pending and Delivered. Skipped is
excluded.

### 5.5 [LAW] Never silently drop an order from the prep list

If an order cannot be decomposed into components, it goes into `unmapped` and is
displayed with a warning. It must not vanish. Somebody still has to cook it.

---

## 6. Subscription lifecycle

### 6.1 Status is computed, never set by hand

```
if a pause window covers today          →  Paused
elif scheduled and delivered >= scheduled →  Completed
elif 0 < remaining <= 2                 →  Ending Soon
else                                    →  Active
```

`remaining = max(scheduled - delivered, 0)`

### 6.2 [LAW] Skips carry forward — they do not consume a meal

Only **Delivered** decrements the pack. A skipped day is not a lost meal; it
pushes the end date out. The customer paid for 20 meals and gets 20 meals.

### 6.3 [LAW] Never plan more meals than the pack owes

Pending rows on the books, on *any* date, count against `remaining`. Browsing
future days must not stack up extra orders for a nearly-finished pack.

When `remaining <= 0`, every still-Pending row for that subscription is deleted
immediately — past, present and future.

> This is what fixed the duplicate-order bug. Unmarking an old day flips a
> finished pack back to Active, which regenerates day rows; re-marking it must
> make those extra rows disappear on their own.

### 6.4 [RULE] Late registration backfills

Registering a pack with a start date in the past creates the missing Pending
rows from the start date up to today, so forgotten days surface immediately
under *Unmarked past orders* instead of hiding until someone browses that date.

Backfill skips non-operating days, pause windows, and never exceeds the pack size.

### 6.5 [LAW] Deleting a subscription renumbers the rest

IDs stay a gap-free `S001, S002, …` run. All child rows — deliveries, pauses,
slot moves, components, rules — move in lock-step so no meal history is orphaned.
Invoices survive as financial history with a nulled link.

---

## 7. Pause / freeze

A subscription can be frozen for one or more **date ranges**. While a window
covers a day: no order is generated and no meal is consumed.

- `end_date = NULL` → open-ended, frozen until manually resumed.
- A window with an end date **stays on file after it ends.** This is what stops
  the previously-paused days re-appearing as Pending, and keeps the freeze
  auditable.
- A fixed-length freeze flips back to Active **on its own** once the dates pass.

**Resuming** from a date trims the covering window to end the day before, and
deletes any window that hadn't started yet. Fully-past windows are left as history.

### 7.1 [RULE] Freeze is an Elite / Athlete privilege

Freeze is available on **Elite and Athlete packs only**. Signature does not get it.

[GAP] The Command Center allows freezing any pack. The new app enforces the
restriction — but see §7.3 on how to roll it out.

### 7.2 Validity

Every pack expires. Meals not taken by the validity date are gone.

| Pack | Meals | Validity |
|---|---|---|
| Signature (monthly) | 20 | **40 days** |
| Elite (monthly) | 20 | **50 days** |
| Athlete (monthly) | 20 | **50 days** |
| Any weekly | 5 | **14 days** |

[RULE] **Kitchen-closed days extend validity automatically.** Government
holidays, festival closures and any day the kitchen chose not to run do not burn
the customer's clock. This is a published promise in the brochure — it must hold.

### 7.2.0 [LAW] Validity is opt-in per subscription, not a global switch

Most current packs were sold either with validity explicitly waived, or with
validity never mentioned at all. One customer only wants meals on the days he
works from home; that was agreed up front and is honoured.

Therefore validity must be modelled as a **per-subscription setting**, not a
property computed from the plan:

```
enforce_validity : bool   default OFF for every existing pack
expires_on       : date   only meaningful when enforce_validity is ON
```

- Turning it on is Balaji's decision, one subscription at a time.
- A pack with it off **never expires** and shows no countdown to the customer.
- Extending `expires_on` is a plain date edit, always available, no confirmation
  dialog and no reason required.
- Record who changed it and when, so a disputed expiry can be traced.

> A global "enforce validity" flag would be the wrong shape. Every one of these
> agreements was a promise made in a WhatsApp conversation, and the software must
> not quietly break promises Balaji already made.

### 7.2.1 [GAP] Validity is currently decorative

`validity_days` exists on the plans table and is printed in the brochure and the
customer terms — but **no code anywhere enforces it.** There is no expiry date on
a subscription, no `Expired` status, and no check before generating an order. A
pack from March would still generate meals today.

The new app needs:

- an `expires_on` date stored **on the subscription** (computed at sale from the
  plan's validity, then freely editable),
- automatic extension for each kitchen-closed day inside the window,
- an `Expired` status, and orders that stop generating past it,
- a visible "expires in N days" on the customer's own screen.

### 7.3 [RULE] Enforce new rules forward, never retroactively

Freeze restrictions and validity expiry apply to **new subscriptions from the
switch-over date**. Existing customers are moved across one at a time, by
conversation, not by a migration script.

> Every new rule in this document ships in "applies to new packs only" mode first.

**Measured 1 Aug 2026:** of 18 live packs, exactly **one** is already past its
validity — `S031` Vignesh, Signature, started 11 Jun, 51 days old against a
40-day validity, with **14 meals still owed** (≈ ₹2,800 of food).

Every other live pack is comfortably inside its window, and the ones with the
most meals left are also the newest. So switching validity on is far less
disruptive than feared — it is one conversation, not a cliff. It still ships
forward-only, and S031 gets settled by hand.

---

## 8. Slot moves (Lunch ↔ Dinner)

A temporary slot change for a date range — "dinner instead of lunch next week".

[RULE] A covering slot move wins over the subscription's standing slot.

[LAW] When a slot move changes, re-point **today's row and every future row**,
whatever their status — so the change shows on the current day immediately even
if today's order was already marked. Genuinely past Delivered/Skipped rows keep
the slot they were actually delivered in.

---

## 9. Generating the day's orders

For an operating day, ensure one Pending row exists for every subscription that:

- is Active, Ending Soon, **or Paused** (per-day pause is checked individually,
  so a finished freeze resumes automatically),
- has `remaining_meals > 0`,
- has started (`start_date <= day`),
- is not frozen on that specific day,
- has no row for that day already,
- and has fewer Pending rows on the books than it has meals remaining.

Trials are added separately and may land on **any** day, including non-operating
ones.

### 9.1 Self-healing

Before generating, delete any Pending row on that day whose subscription now
owes nothing. These are leftovers from past-day corrections and must never show
as today's orders.

---

## 10. Revenue — two different questions

This is the single most confusable area. The Command Center deliberately keeps
two separate answers, and the new app must too.

### 10.1 "Revenue" = what was **sold**

```
revenue(month) = subscriptions booked that month + trial sales that month
```

Dated by `booking_date`, falling back to `start_date`. This is the real money
that came in. **This is what Balaji means by revenue.**

### 10.2 "Earned" = what was **delivered**

Each delivered meal is valued individually:

```
subscription meal  →  food = pack_price / meals_in_pack
                      delivery = delivery_fee / meals_in_pack
trial meal         →  trial_amount / number of meals it was delivered over
```

[LAW] Per-meal values are **rounded to whole rupees**, so line items always add
up to the day total shown on screen.

This is an **estimate** used for day and week views. It answers "what did we
actually earn on Tuesday" — not "what did we sell".

### 10.3 [LAW] Never mix the two in one number

A day view showing earned meals must not be added to a month view showing booked
packs. Label them distinctly, always.

---

## 11. Delivery operations

### 11.1 Kitchen

`A2A Nahar Sugam, Gandhi Nagar, Society Road, Arasankalani, Perumbakkam,
Chennai 600131` — pin `12.892437, 80.204187` (plus code `V6R3+XM Chennai`),
confirmed.

### 11.2 [LAW] The route ends at the kitchen

Distance is what the rider's allowance is paid on, and he genuinely rides home.
A route ending at the last customer under-pays him every single day.

### 11.3 [RULE] Order by zone band, not nearest-neighbour

```
hyperlocal cluster → near band → porter handoff → mid band → back to kitchen
```

Clearing the 2–3 hyperlocal drops first closes half the orders in ten minutes
and lightens the bag before the long legs. A naive shortest-path interleaves
them and is worse in practice.

### 11.4 Zone bands (road km from kitchen)

| Zone | Road km |
|---|---|
| Hyperlocal | ≤ 2 |
| Near | ≤ 6 |
| Mid | ≤ 12 |
| Long | > 12 |

Rider delivers himself at ≤ 10 km **and** on a corridor he is already riding.
Beyond 12 km, consider a Porter handoff.

> ⚠️ **These are routing zones, not pricing bands.** They exist to order the
> route and decide rider-vs-Porter. The customer's delivery fee uses a
> *different* set of thresholds — 5 / 10 / 15 km — defined in §4.3. The two
> tables are independent and are allowed to disagree. Do not merge them.

### 11.5 Corridors

| Code | Covers |
|---|---|
| `Local` | Within Perumbakkam |
| `OMR-N` | Sholinganallur, Karapakkam, Thoraipakkam, Perungudi, Adyar, Guindy |
| `West` | Medavakkam, Pallikaranai, Velachery, Tambaram, Chromepet |
| `OMR-S` | Navalur, Siruseri, Padur, Kelambakkam, Thalambur |

A stop is "on corridor" when the rider already has another stop on that corridor
that evening — so carrying this one costs him nothing extra.

### 11.6 Porter handoff

The rider carries a far order to a maintained **porter point** on a corridor he
is genuinely riding, and a Porter is booked from *there* instead of from the
kitchen. The paid Porter leg gets much shorter.

[RULE] A handoff is only offered at a point on a corridor he is actually riding.
A detour to reach one costs more rider time than the Porter fare it saves — in
that case book Porter direct from the kitchen and accept the cost.

### 11.7 Rider allowance

**₹3 per km**, per the signed terms letter. Paid on `actual_km` (rider-corrected
at close-out), never on the estimate.

### 11.7.1 [LAW] Two clocks — the delivery promise and the staff shift

Never conflate these. They look similar and mean completely different things.

| | Value | Whose clock |
|---|---|---|
| **Delivery promise** (customer-facing, in the terms) | Lunch 11:00 AM–1:45 PM · **Dinner 5:30–8:00 PM** | The customer's |
| `shift_end` (rostering) | **21:00** | The employee's |

**All food must be delivered by 8:00 PM.** The hour after is the rider returning
to the kitchen, cleaning down and signing off. It is a payroll and rostering
number and must never be shown to a customer as a delivery window.

[RULE] **Exception — pre-agreed late drops.** A small number of far orders,
typically the Porter-handoff ones, legitimately arrive after 8:00 PM. Those
customers agree to it **before subscribing**, never on the night.

[GAP] Nothing records that agreement today. The new app needs
`late_delivery_agreed` on the subscription: when false, an ETA past 8:00 PM is a
warning to Balaji; when true, it is expected and silent.

### 11.7.2 Other operating times

Prep starts 16:00, packing done 18:15, rider departs 18:40. Average speed
20 km/h (Chennai evening traffic), 2.5 minutes parked per drop.

### 11.8 [LAW] Never silently drop an unpinned order

An order with no map pin still has to be cooked, packed and delivered. It comes
back flagged and is printed with a warning rather than vanishing from the sheet.

### 11.8.1 [LAW] Two ways to set a pin, and the admin pin always wins

Both paths must exist:

1. **The customer drops their own pin** during signup or from their address
   screen. This is how the pin data problem (§13.2) gets solved permanently.
2. **Balaji can move any pin by hand**, at any time, from the admin side.

Customers regularly drop the marker on the wrong building, or on the office
tower rather than the gate. When an admin correction and a customer pin
disagree, **the admin pin is authoritative** until the customer edits it again.

Record which of the two set the current pin and when, so a wrong delivery can be
traced to the right cause.

### 11.9 Distance providers

An ordered fallback chain — Google Routes → OpenRouteService → self-hosted OSRM
→ straight-line × 1.7. Currently `ors`.

[LAW] Every provider fails soft. A routing outage must never block the sheet.
When falling back to the multiplier, the number must be **labelled an estimate**.

---

## 12. Invoices

`INV-001` upward, each with an unguessable `token` powering a public
`/i/<token>` link — no login needed, so it can be sent on WhatsApp. Items are a
JSON list of `{desc, qty, unit, amount}`.

---

## 13. Data problems the new app must fix

These are real, present in live data today, and are the strongest argument for
rebuilding rather than patching.

### 13.1 Legacy plan names have add-ons buried inside them

**This is historical, not carelessness.** The structured add-on builder was only
added to the subscription form in the 14 Jul 2026 menu-engine work. Before that
the app had no way to record "and 100 g extra chicken", so the only place to put
it was the plan name. The names below are the scar tissue from that gap.

15 distinct `plan_name` strings exist for what should be ~6 plans:

```
Elite Meal Pack                    (15)
Signature Meal Pack                (12)
Custom Meal Pack                    (9)
Elite Meal pack + 1 egg             (3)   ← add-on typed into the name
Elite Meal Pack + 100g Chicken      (2)   ← add-on typed into the name
Custom meal pack                    (2)   ← casing drift
Protein Salad Box * 2 qty           (1)   ← quantity typed into the name
Elite meal pack + 100g chicken      (1)   ← same thing, third spelling
Elite Meal pack +  Custom Meal pack (1)   ← not parseable at all
```

**Why this is expensive:** the prep list can only count what is in
`subscription_components`. An add-on typed into the *name* is invisible to the
kitchen — so that extra 100 g of chicken is silently missing from the prep
quantities **every single day**, and the pack is under-priced against its
recipe.

**[GAP] In the new app, plan is a foreign key and add-ons are structured rows.
Free-text plan names must be impossible to create.**

### 13.2 Almost nothing is pinned

27 of 28 customer addresses have no zone and no corridor. The whole routing,
porter and allowance engine is built and correct — and starved of input.

**[GAP] Pin capture must be part of customer onboarding, not an optional
afterthought.** In the new app the customer drops their own pin at signup, which
solves this permanently and for free.

### 13.3 The delivery fee bands exist only in Balaji's head

The bands in §4.3 are real policy and are quoted to customers at booking, but no
software knows them. `delivery_fee` is an empty number box. Nothing computes the
distance, nothing proposes a figure, and nothing notices when a 12 km customer
is charged the same as a 3 km one.

**[GAP] The new app should show the distance and a suggested fee next to that
box** — a suggestion only, freely overridden (§4.4). It depends on §13.2 being
fixed first: without a pin there is no distance to price from.

### 13.4 Validity is promised but never enforced

See §7.2.1. Customers are told 40 or 50 days in the brochure and in the terms;
no code has ever checked it.

---

## 14. What the new app must preserve

If the new app gets nothing else right, it must get these right:

1. Deliveries are the only source of meal truth. (§2.1)
2. Skips carry forward; only delivery consumes a meal. (§6.2)
3. Never plan more meals than the pack owes. (§6.3)
4. A sold pack keeps its sold price forever. (§4.1)
5. Sold revenue and delivered revenue are never mixed. (§10.3)
6. The prep list is arithmetic, and never drops an order. (§5.4, §5.5)
7. The route ends at the kitchen. (§11.2)
8. Unpinned orders are flagged, never dropped. (§11.8)
9. The pack name is fixed; every variation is a structured add-on. (§5.2.1)
10. Customer delivery fee and rider petrol allowance are unrelated. (§4.3)
11. Balaji can override any suggestion the app makes — pin, fee, validity.

---

## 15. Scope — decided 31 Jul 2026

### 15.1 What v1 is

**Customers can only view and manage the pack they already have.** No buying, no
payment gateway, no checkout.

A customer in v1 can:

- see their pack, what's in it, and how many meals are left
- see today's meal and its delivery status
- drop or correct their delivery pin (§11.8.1)
- see their invoices
- request a pause / skip *(request — Balaji still confirms)*

A customer in v1 **cannot**: buy a pack, buy add-ons, or pay online. Those
arrive in a later version, along with Razorpay.

> This makes v1 dramatically smaller and safer. No money flows through code that
> hasn't earned trust yet, and it fits the free-tier budget exactly.

### 15.2 Decisions taken

| Question | Decision |
|---|---|
| Customers buy in-app? | **No, not in v1.** Manage-only. Payments come later. |
| Freeze restricted to Elite/Athlete? | **Yes**, enforced — for new packs first (§7.3). |
| Validity enforced? | **Per subscription, opt-in.** Off by default; Balaji switches it on and can extend any date (§7.2.0). |
| Weekly validity | **14 days.** |
| Prices fixed by catalog? | **No.** Every price is negotiable per customer, including add-on rates (§4.1.1). |
| Delivery fee auto-set? | **No — suggest only.** Balaji always overrides (§4.4). |
| Past 12–15 km? | **Don't refuse.** Serve it, price it higher, route via Porter (§4.3). |
| Customer sets own pin? | **Yes**, and Balaji can override any pin (§11.8.1). |
| Skip/pause auto-apply? | **Yes, before 6 PM the day before.** After that it's a request Balaji approves. Reversible on the same terms — see [02-skip-and-pause.md](02-skip-and-pause.md). |
| Trials in the customer app? | **No.** Admin-only for now. |

### 15.3 Still open

- Late-skip policy: a skip after the cutoff currently costs Balaji the food
  *and* carries the meal forward. Keep it generous, or consume the meal?
- Maximum pause length, or a cap per pack?

---

*Source: `Projects/OG-Gainz-OS` @ commit `c425ae7`. Data figures from the
laptop copy of `oggainz.db`, ~1 week stale as of 31 Jul 2026.*
