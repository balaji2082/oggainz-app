# The landing page — recovered spec of www.oggainz.com

Balaji's instruction, 25 Aug 2026: the app's front page must BE the current
website's homepage, so `oggainz.com` can point at the app without a stranger
landing on a sign-in wall (docs/03 §9.1).

The old MERN source is no longer in the workspace. This spec was recovered from
the live site's own JavaScript bundle (`/assets/index-*.js`) and stylesheet, so
the copy and section order below are the REAL ones, character for character —
not a reconstruction from memory. What the bundle cannot give is exact visual
layout: spacing, image placement and card shapes still need screenshots or a
judgement call.

## Palette (from the live stylesheet, by frequency)

| token | hex | use |
|---|---|---|
| primary | `#014d3b` | deep forest, most-used colour on the page |
| primary-dark | `#013b2c` / `#011f17` | headers, footer |
| mid | `#0b6b53` | gradients |
| accent | `#f28c28` | the orange — CTAs, the second half of the headline |
| cream | `#f8f5ef` | page ground |

Note these are NOT the app's current tokens: the app uses `#004030` forest and
`#e9762b` orange. Close, deliberately different. The site's `#014d3b`/`#f28c28`
win on this page because matching it is the point.

Fonts: **Georgia serif** for headings, **Inter** for body.

## Sections, in page order

1. **Hero** — badge with a pulsing dot: "Performance Nutrition System".
   Headline: **"Nutrition Built"** then **"for Performance."** in `#f28c28`
   with a `linear-gradient(90deg,#f28c28,transparent)` underline.
   Sub: "High-protein meals, cooked fresh and delivered daily — designed to
   help you train better and stay consistent."
   Process line: "Choose → We Cook → We Deliver → You Perform"
   CTA + "Takes under 60 seconds • Pause or cancel anytime".
   Image with badge "Fat Loss · Muscle · Recomp".

2. **This Is a System** — "Because results come from systems — not motivation."
   / "Not a diet. Not motivation. A repeatable performance framework."
   Five cards:
   - Built for Real Goals — "Meals engineered for fat loss, muscle gain, or recomposition — not generic dieting."
   - Protein-Forward by Design — "35–50g protein per meal so your nutrition actually supports training."
   - Zero Missed Days — "Fresh meals delivered daily, so consistency is never optional."
   - You Stay in Control — "Pause, skip, or extend anytime — without breaking progress."
   - Progress You Can Track — "Macro-aware plans that make results measurable, not guesswork."

3. **Featured Meal Plans** — "Curated nutrition solutions engineered for peak
   performance and results." Carousel + "Explore All Meal Plans".
   **This is where prices go** (Balaji, 25 Aug): Signature ₹4,000 /
   Elite ₹5,000 / Athlete ₹6,000, per Pricing-v2.

4. **How It Works** — "A clean flow from goal → plan → delivery — without friction."
   1. Choose a Meal Plan — "Select Weight Loss, Muscle Gain, Balanced Fitness, or Trial."
   2. Customize Protein & Add-ons — "Tailor macros and extras to match your training week."
   3. Subscribe or Buy Once — "Lock in consistency or test the system with a trial."
   4. Get Daily Fresh Delivery — "A reliable kitchen-to-door timeline you can count on."

5. **Build your own** — "Customise your meal as per your goals" / "Build meals
   your way — choose ingredients, portions, and nutrition."
   Choose your protein source · Adjust portions & macros · Add custom
   ingredients · Track nutrition in real-time.

6. **Controls that keep you consistent** — "A system that adapts to real life —
   while protecting your long-term results."
   Pause ("Take breaks without resetting your plan.") · Skip ("Busy day? Skip
   without losing control.") · Auto-extend end date ("Skipped days extend your
   schedule automatically.") · Admin-verified schedules · Daily Delivery Timeline.

7. **Personalized Guidance** — "Not sure what plan fits you?" / "Talk to our
   nutrition expert and get matched in minutes. Free consultation with
   personalized meal recommendations." Badges: Free & No Commitment · Expert
   Nutritionists. CTA "Book a Free Consultation".

8. **Real Stories, Real Results** — "Loved by lifters and professionals" /
   "Short transformation stories from real routines."
   - "I finally stopped guessing my macros. OG Gainz made my cut consistent — and effortless."
   - "The subscription controls are a game-changer. I can pause and skip without losing my plan."
   - "Protein targets, delivery reliability, clean taste. It feels like a nutrition system — not a food app."

9. **Trust bar** — "Clean kitchens. Verified nutrition. Fresh ingredients.
   Secure payments." with: clean prep standards · certified nutritionists ·
   plans built with performance in mind · quality inputs.

10. **FAQ** — "Can I skip a day?", "Is there a trial?", "Are meals fresh or
    frozen?", "Can I customize my meals?", "Can I pause my subscription?",
    "How is the protein content calculated?"

## Things this page CLAIMS that the app must not break

Several of these are promises the Command Center already keeps, and the wording
should not drift from what the app actually does:

- "Pause, skip, or extend anytime" — but `freeze_eligible_plans` currently
  limits PAUSE to Elite and Athlete. Either the copy narrows or the setting
  widens; the page must not promise what the API refuses.
- "Skipped days extend your schedule automatically" — true, that is
  carry-forward, and it is the one promise docs/02 §7.4 protects.
- "Is there a trial?" — trials exist in the Command Center.
- Wallet credits and Razorpay payments are MERN-only features. The new app has
  no wallet and no payments. Any copy about credits must come out.
