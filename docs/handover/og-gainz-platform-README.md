> ## ⚠️ Preserved artifact — the code this describes is missing
>
> This is the README of **`og-gainz-platform`**, copied here on 21 October 2026
> because it is the only surviving description of that app. **The code it
> describes is not in any repository** — see
> [07 — The missing code](07-THE-MISSING-CODE.md).
>
> So read it as a specification, not as instructions. The commands below will not
> run, the demo accounts do not exist anywhere you can reach, and its links to
> `docs/ARCHITECTURE.md` and `prisma/schema.prisma` point at files that are part
> of what is missing.
>
> If the laptop copy is recovered, this is the document to judge it against. If
> it is not, this is what a rebuild would be built from.

---

# OG GAINZ — Platform

The official customer platform for **OG GAINZ**: premium, macro-counted, high-protein meal
subscriptions delivered fresh across Chennai every weekday.

Built with Next.js 16 (App Router), TypeScript, Tailwind v4, Prisma, Auth.js, Zustand and
Framer Motion — on the real OG Gainz business model (Jun 2026 pricing, delivery zones,
weekday kitchen, freeze rules).

---

## Quick start (2 minutes)

```bash
npm install          # also runs prisma generate
npm run db:push      # creates the dev SQLite database
npm run db:seed      # real catalog + demo accounts
npm run dev          # http://localhost:3000
```

**Demo accounts**

| Role | Email | Password |
|---|---|---|
| Customer (with live subscription) | `demo@oggainz.in` | `oggainz-demo` |
| Admin | `admin@oggainz.in` | `oggainz-admin` |

The demo customer has an Elite plan mid-flight — deliveries, calendar, wallet and
notifications are all populated so every screen renders alive.

---

## What's inside

| Area | Route | Highlights |
|---|---|---|
| Landing | `/` | Hero, how-it-works, rotation, plans (from DB), testimonials, FAQ |
| Menu | `/menu`, `/menu/[slug]` | Category filters, macros, reviews, similar meals |
| **Meal Builder** | `/builder` | 9-step wizard, live macros + price (same engine server validates with) |
| Cart | `/cart` | Server-authoritative pricing, coupons, wallet, address + zone fees |
| Checkout | `/checkout/*` | Idempotent orders, mock gateway (dev) / Razorpay-ready (prod) |
| Auth | `/login`, `/register` | Email+password, referral codes, ₹100 welcome credits; Google-ready |
| Dashboard | `/dashboard/*` | Overview, subscriptions + delivery calendar + skip/freeze, orders, wallet, nutrition, referrals, support, settings |
| Admin | `/admin/*` | KPIs, kitchen production plan + delivery flow, orders (manual reconcile), freeze approvals, customers (credits/ban), catalog toggles, ticket replies |

## Business rules encoded (the real ones)

- **Packs:** Signature ₹4,000 · Elite ₹5,000 · Athlete ₹6,000 — 20 servings, 30/50/50-day
  validity, freezes on Elite/Athlete only. Honest protein ladder 33/39/53g (chicken weighed raw).
- **Kitchen:** Mon–Fri only. Weekend days are never scheduled and never consume servings.
- **Servings:** consumed **only** on `delivered`. Skips (before the 9 AM cutoff) and freezes
  re-append delivery days at the tail and extend validity.
- **Delivery zones:** 0–4km free · 5–9km ₹30 · 11–15km ₹60–75 · border zones negotiated ·
  beyond 12km → waitlist. Fee = zone rate × number of deliveries.
- **Wallet:** 1 credit = ₹1, no cash refunds. Signup bonus ₹100, referral reward ₹200.
- **Money path:** ONE `status` field per order + append-only `OrderEvent` history, and
  `confirmOrderPaid()` is atomic + idempotent across the browser callback, the webhook and
  admin manual reconcile. (This is the exact failure mode that broke the legacy app.)

All tunable numbers live in the `Setting` table — not in code.

## Commands

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run db:push    # sync schema → database
npm run db:seed    # idempotent seed (safe to re-run)
npm run db:studio  # browse/edit data in Prisma Studio
```

## Going to production

1. **Database** — change `provider` to `"postgresql"` in [prisma/schema.prisma](prisma/schema.prisma)
   and point `DATABASE_URL` at Postgres (schema is enum/Json-free, so it ports 1:1).
   `docker-compose.yml` ships a ready Postgres.
2. **Payments** — set `PAYMENT_PROVIDER=razorpay` + the three Razorpay keys in `.env`.
   Point the Razorpay webhook at `/api/payments/razorpay/webhook`.
3. **Google login** — add `GOOGLE_CLIENT_ID/SECRET`; the provider activates automatically.
4. **Deploy** — Vercel (app) + Supabase/Railway (Postgres), or `docker compose up --build`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.
