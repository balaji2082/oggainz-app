# Skip & Pause — logic and interface

The one thing customers will touch most often. It has to be obvious, forgiving,
and never leave the kitchen guessing.

Companion to [01-business-rules.md](01-business-rules.md).

---

## 1. The two actions

| | Skip | Pause |
|---|---|---|
| Scope | **One day** | **A date range** |
| Customer picks | a single date | start date → end date |
| Meaning | "not tomorrow" | "not for this stretch" |
| Meals | carries forward, never lost | carries forward, never lost |

Both are the same promise: **you don't lose the meal, you just move it.** Say
that in the interface, every time, in those words. It is the single most
reassuring fact about the product and customers will not assume it.

---

## 2. The cutoff — the one rule everything hangs on

```
For a meal on day D, the customer may act freely until

     <skip_cutoff_time>  on  D − 1        (Asia/Kolkata)

Before that moment  →  applied instantly, no approval.
After  that moment  →  becomes a support request Balaji screens.
```

That's it. One time, one rule, both actions, in both directions.

### 2.0 [LAW] The cutoff is a setting, never a hardcoded constant

```
skip_cutoff_time   default "18:00"   editable in Settings
```

`6:00 PM` is today's value, not a law of nature. It will change — with a second
kitchen shift, a bigger team, or simply because Balaji decides mornings work
better. When it changes, **one edit in Settings must change everything**:

| Must read from the setting | Not from |
|---|---|
| The countdown on the meal card | a constant in the component |
| Server-side validation of every request | a second constant in the API |
| The pause calendar's shading of past-cutoff days | anything |
| **The published Terms & Conditions** | hardcoded HTML |
| Any notification copy that names the deadline | a translation string |

> There must be exactly **one** place in the entire system that knows what time
> the cutoff is. Every other place asks it.

### 2.0.1 [LAW] Terms text is generated, not written

The customer-facing terms page must render its numbers from live settings and
the plans table — cutoff time, validity days, delivery windows, delivery-fee
bands. A human writes the *sentences*; the system fills in the *values*.

**This is not theoretical. The current terms are already wrong:**

| Terms page says | Reality |
|---|---|
| Weekly packs valid **15 days** | **14 days** (confirmed 1 Aug 2026) |
| Late skips "**cannot be accommodated**" | They can — they become a request (§3.2) |

A hardcoded value in `_terms_body.html` that nobody updated when the underlying
number changed, plus a policy line that is about to become false.

> ⚠️ **Do not "fix" the 8:00 PM delivery window.** It looks like it disagrees
> with the `shift_end` setting of 21:00, and it does not — those are two
> different clocks. See §2.0.2.

### 2.0.2 [LAW] Delivery promise ≠ staff shift end

Two separate times that must never be conflated:

| | Value | Whose time |
|---|---|---|
| **Delivery promise** | Lunch 11:00 AM–1:45 PM · **Dinner 5:30–8:00 PM** | The customer's. Published in the terms. |
| `shift_end` | **21:00** | The employee's. Return to kitchen, clean down, sign off. |

All food must be **delivered by 8:00 PM**. The hour after that is the rider
riding back, cleaning, and finishing his shift — it is payroll and rostering,
never a delivery window shown to a customer.

[RULE] **Exception: pre-agreed long/portered drops.** A few far orders — the
ones that go out via a Porter handoff — can legitimately land after 8:00 PM.
Those customers agree to it **before subscribing**, not on the night.

The app must therefore carry a per-subscription flag:

```
late_delivery_agreed : bool   default false
```

When false, an ETA past 8:00 PM on the route is a **warning to Balaji**. When
true, it is expected and silent. Without this flag the route planner would
either cry wolf on every Porter order or stay silent when a normal customer is
genuinely about to be let down.

[RULE] Show a "last updated" date on the terms, derived from the most recent
change to any value it displays.

### 2.1 [LAW] Symmetric — undo obeys the same cutoff

Whatever the customer can do before the cutoff, they can undo before the cutoff.
Skip then unskip then skip again, five times, no penalty and no message to
Balaji. Only the state at 6:00 PM matters.

After the cutoff, undoing is also a request. This is what stops "I cancelled it,
then changed my mind at 11 PM and you still didn't send food".

### 2.2 Why 6:00 PM is the current default

Prep starts 4:00 PM and packing is done by 6:15 PM. A 6:00 PM cutoff the day
before gives a full night and morning to buy for the correct headcount. It also
lands at a time people are awake and on their phone.

Recorded as the *reasoning*, so whoever changes the setting later understands
what they are trading off.

### 2.3 [RULE] Calendar day, not operating day

Monday's meal cuts off at 6:00 PM **Sunday**, even though the kitchen is shut on
Sunday. Simpler to explain, simpler to build, and errs toward the kitchen having
more notice rather than less.

### 2.4 [LAW] Cutoff is evaluated in IST, always

Never in UTC, never in the browser's timezone. A customer travelling abroad must
get the same deadline as one in Perumbakkam. Store timestamps in UTC; compute
and display the deadline in `Asia/Kolkata`.

---

## 3. What actually happens to the data

This is where skip and pause stop being the same thing.

### 3.1 Skip before the cutoff → remove the order

The kitchen hasn't bought or cooked anything. Delete the Pending delivery row,
exactly as a one-day pause would.

Nothing is cooked, nothing is wasted, the meal carries forward. Clean.

### 3.2 Skip after the cutoff → mark it Skipped

The food is already committed. The row stays and becomes `Skipped`, which is the
honest record of what happened: it was made, it wasn't delivered.

[RULE] Per §6.2 of the business rules, a `Skipped` meal **still carries forward**
— it does not consume the pack. So a late skip costs Balaji the food while the
customer keeps the meal.

> **Open decision.** That is the current policy and it is generous. The
> alternative is that a late skip consumes the meal, which is what most meal
> services do. Recommendation: keep it generous while the business is small and
> every customer matters — but make late skips *visible* to Balaji so a customer
> doing it weekly can be spoken to. Do not silently change the policy in code.

### 3.3 Pause → a date window, orders removed inside it

Creates a `subscription_pauses` row for the range and deletes still-Pending rows
inside it. The existing engine already does exactly this and it is correct.

Days inside a pause window generate **no order at all** — nothing to cook,
nothing to skip, nothing to display.

---

## 4. Partial application — the case that makes this feel good

A customer at 9 PM on Thursday asks to pause **Friday → Wednesday**.

Friday is past its cutoff. Monday, Tuesday and Wednesday are not.

**Do not reject the whole request.** Split it:

```
Fri 2 Aug   → past cutoff  → request, needs Balaji
Mon 5 Aug   → in time      → applied now
Tue 6 Aug   → in time      → applied now
Wed 7 Aug   → in time      → applied now
```

And say so plainly:

> Paused from Monday 5 August.
> **Friday's meal is already being prepared** — we've asked Balaji if it can be
> cancelled and we'll let you know.

The customer gets most of what they wanted immediately, and only the genuinely
impossible part waits. Rejecting all five days because one was late is the kind
of thing that makes people stop using an app.

---

## 5. Early resume

A customer paused until 20 August but wants meals back from the 12th.

They press **Resume**, pick a date, confirm. Same cutoff rule: resuming for the
12th must happen by 6:00 PM on the 11th.

Mechanically this trims the pause window to end the day before the resume date —
which the existing `resume_subscription()` already does correctly.

[RULE] Reversible on the same terms. Changing their mind again before the cutoff
just re-extends the window. Only the 6:00 PM state matters.

---

## 6. States

```
SCHEDULED       meal will be delivered
SKIP_APPLIED    skipped, took effect immediately (before cutoff)
SKIP_REQUESTED  after cutoff, waiting for Balaji
PAUSED          inside an applied pause window
PAUSE_REQUESTED after cutoff, waiting for Balaji
DECLINED        Balaji said no; meal is back to SCHEDULED
```

Requests are **never silently dropped**. Every request ends as applied or
declined, with a reason the customer can see.

### 6.1 [LAW] A pending request must not change the kitchen count

Until Balaji approves, the meal is still being cooked and must still appear on
the prep list and the rider sheet — flagged, but present. Removing it early is
exactly the §5.5 failure of silently dropping an order.

---

## 7. The interface

Mobile first. Thumb-reachable. Nothing important above the middle of the screen.

### 7.1 The meal card — where skipping happens

```
┌─────────────────────────────────────┐
│  TOMORROW · Fri 2 Aug         Lunch │
│                                     │
│  Elite Meal Pack                    │
│  Chicken 100g · Egg · Veggies       │
│  Carb · Fruits · Yogurt             │
│                                     │
│  ┌───────────────────────────────┐  │
│  │       Skip this meal          │  │
│  └───────────────────────────────┘  │
│                                     │
│  You can change this until          │
│  6:00 PM today · 4 hours left       │
└─────────────────────────────────────┘
```

The countdown is the whole design. It converts an invisible rule into something
people can feel, and it removes every "why can't I cancel?" message.

**After skipping, before cutoff:**

```
┌─────────────────────────────────────┐
│  TOMORROW · Fri 2 Aug         Lunch │
│                                     │
│  ✓  Skipped                         │
│     This meal moves to the end of   │
│     your pack — you don't lose it.  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │        Undo skip              │  │
│  └───────────────────────────────┘  │
│                                     │
│  Change until 6:00 PM · 4 hrs left  │
└─────────────────────────────────────┘
```

**After the cutoff:**

```
┌─────────────────────────────────────┐
│  TOMORROW · Fri 2 Aug         Lunch │
│                                     │
│  Elite Meal Pack                    │
│                                     │
│  ⏱  Tomorrow's meal is already      │
│     being prepared.                 │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Request to skip anyway      │  │
│  └───────────────────────────────┘  │
│                                     │
│  Balaji will confirm. Usually fast. │
└─────────────────────────────────────┘
```

The button is never hidden and never greyed out. Late requests are allowed —
they just carry an honest expectation.

### 7.2 Pause — a real calendar, not two date fields

```
┌─────────────────────────────────────┐
│  ‹        August 2026            ›  │
│                                     │
│  M   T   W   T   F   S   S          │
│              1  ·2· ·3·             │
│  4   5   6   7   8  ·9· ·10·        │
│ 11  12  13  14  15 ·16· ·17·        │
│ 18  19  20  21  22 ·23· ·24·        │
│ 25  26  27  28  29 ·30· ·31·        │
│                                     │
│  ·N· weekend — kitchen closed       │
│                                     │
│  Tap your first and last day away   │
└─────────────────────────────────────┘
```

Selected range fills solid in OG Gainz green. Weekends and holidays render
muted and unselectable — **the customer must be able to see that pausing Sat–Sun
is pointless.** That single visual saves a support conversation every week.

Below the calendar, the honest summary:

```
┌─────────────────────────────────────┐
│  Mon 11 Aug  →  Fri 15 Aug          │
│                                     │
│  5 meals paused                     │
│  They move to the end of your pack  │
│                                     │
│  Your pack now runs to 12 Sept      │
│                                     │
│  ┌───────────────────────────────┐  │
│  │        Confirm pause          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**"Your pack now runs to 12 Sept" is the most important line on the screen.**
It answers the question every customer actually has — *am I losing meals?* —
before they have to ask it.

### 7.3 While paused

```
┌─────────────────────────────────────┐
│  ⏸  Paused                          │
│     11 Aug  →  15 Aug               │
│                                     │
│  Next meal: Monday 18 August        │
│                                     │
│  ┌───────────────────────────────┐  │
│  │      Start meals earlier      │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │        Change dates           │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

"Start meals earlier" is the early-resume flow — a date picker limited to days
inside the current window, with the same cutoff countdown.

### 7.4 Copy rules

Use these words. They are load-bearing.

| Don't say | Say |
|---|---|
| Cancel | Skip |
| Suspend / deactivate | Pause |
| Your subscription | Your pack |
| Forfeited | *(never — meals never expire on a skip)* |
| Request submitted | Balaji will confirm — usually fast |

Every skip and pause confirmation states the carry-forward promise. Repetition
is correct here; this is the fact that builds trust.

### 7.5 Accessibility and reality

- Tap targets ≥ 44 px. Thumbs, one-handed, often walking.
- Never rely on colour alone — a paused day shows an icon and text, not just green.
- The countdown must survive the screen being locked and reopened — compute from
  a server-supplied deadline, never from a client-side timer started at load.
- **Assume the connection drops mid-tap.** Every action is idempotent and
  confirmed by the server before the UI claims success. A skip that looks applied
  but never reached the server is the worst possible bug here.

---

## 8. Balaji's side — the request queue

A late skip is a **support request**, not an automatic grant. It gets screened.

### 8.1 Every request is recorded, forever

```
skip_requests
  id, subscription_id, customer_id
  kind            skip | pause | resume | undo
  target_date     (or start_date + end_date for a pause)
  requested_at    timestamp
  minutes_late    how far past the cutoff — the screening signal
  reason          optional, from the customer
  outcome         allowed | declined | auto_applied
  decided_at, decided_by, decline_reason
```

`minutes_late` is stored, not recomputed. If the cutoff setting changes later,
history must still say how late the request was **against the rule in force at
the time**.

### 8.2 The queue shows history at the point of decision

The whole purpose: Balaji sees the pattern *while deciding*, not a month later.

```
┌─────────────────────────────────────┐
│  2 requests need you                │
│                                     │
│  Ashok · skip tomorrow (Lunch)      │
│  9:12 PM — 3h 12m after cutoff      │
│                                     │
│  ⚠  4th late request this month     │
│     3 allowed · 0 declined          │
│                                     │
│  "Sudden office dinner"             │
│                                     │
│      [ Allow ]      [ Decline ]     │
│      ─────────────────────────      │
│      view all of Ashok's requests   │
│                                     │
│─────────────────────────────────────│
│  Teena · pause 11–15 Aug            │
│  7:40 PM — 1h 40m after cutoff      │
│                                     │
│  ✓  First late request              │
│                                     │
│      [ Allow ]      [ Decline ]     │
└─────────────────────────────────────┘
```

[RULE] The badge is **information, not a verdict.** The app never auto-declines
and never recommends declining. Ashok might have a genuinely chaotic month, and
he is the highest-value customer in the business. Balaji decides; the app just
makes sure he decides *knowing*.

### 8.3 Declining

Declining asks for a one-line reason, which the customer sees:

> Sorry — tomorrow's meal is already cooked and packed. It'll be delivered as
> planned. If you can't take it, message us and we'll sort something out.

[LAW] A declined request leaves the meal `SCHEDULED` and the kitchen count
unchanged. Nothing silently disappears (§6.1).

### 8.4 Per-customer request history

On the customer's own admin page:

```
Late requests   4 this month · 11 all time
Allowed 9 · Declined 2
Average lateness  2h 40m

  1 Aug   skip Sat 2 Aug      3h 12m late   allowed
 28 Jul   skip Tue 29 Jul     4h 05m late   allowed
 24 Jul   pause 25–26 Jul     1h 30m late   declined
```

This is what "screen out the repeating one" needs to look like — a plain record,
visible before the conversation, so a chat about it starts from facts.

### 8.5 [RULE] Balaji has no cutoff

He can skip, pause, resume or reverse anything, for anyone, on any date, with no
deadline and no request. The cutoff is a customer-facing rule and never a
constraint on the owner.

### 8.6 Notifications

- Request arrives after cutoff → push to Balaji immediately.
- Approved or declined → push to the customer immediately.
- Nothing else pushes. An app that notifies too much gets its notifications
  turned off, and then the one that matters is missed too.

---

## 9. Settings this feature owns

All editable, all with the change reflected everywhere including the terms (§2.0.1).

| Setting | Default | Controls |
|---|---|---|
| `skip_cutoff_time` | `18:00` | The deadline, everywhere |
| `skip_cutoff_applies_to` | `calendar_day` | Previous calendar day vs previous operating day (§2.3) |
| `late_requests_allowed` | `true` | If off, the late path disappears entirely and the terms say so |
| `pause_max_days` | *(none)* | Optional cap on a single pause window |
| `freeze_eligible_plans` | `Elite, Athlete` | Which packs may pause at all (§7.1 of doc 01) |

[RULE] Changing any of these takes effect on **future** requests only. A request
already in the queue is judged by the rule that applied when it was made.

---

## 10. Build order

1. `skip_cutoff_time` setting + IST calculation, with tests either side of the
   boundary — and a test that *changing the setting* moves the boundary.
2. Skip before cutoff (remove row) and undo.
3. Skip after cutoff → request queue → allow/decline, with history recorded.
4. Repeat-request badge in the queue (§8.2).
5. Pause calendar with weekend/holiday shading.
6. Partial application splitting (§4).
7. Early resume.
8. Terms page generated from settings (§2.0.1).
9. Push notifications.

Steps 1–4 cover the large majority of real use, including the screening Balaji
asked for.

---

## 11. Still open

- **Late-skip policy** (§3.2) — keep generous, or consume the meal? Recommend
  keeping it generous and making the pattern visible, which §8.2 now does.
- Should `pause_max_days` have a value at all, or stay unlimited?
