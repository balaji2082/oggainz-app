import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentSession } from "@/lib/current-user";
import { listCustomers } from "@/lib/snapshot";

/**
 * The front door.
 *
 * [RULE] docs/03 §9.1 — the apex must greet a logged-out stranger sensibly:
 * what OG Gainz is, what the packs are, and a way to get in touch. A signed-in
 * customer goes straight to their meals instead. One address, two front doors,
 * decided by whether there is a session.
 *
 * This is what makes the app safe to put on oggainz.com. Before it existed, a
 * stranger who found the domain hit a dead end, which would have been worse
 * than the marketing site it replaced.
 */

const PACKS = [
  {
    name: "Signature",
    protein: "33g protein",
    body: "The everyday pack. Chicken, egg, a carb and veggies — balanced, filling, no fuss.",
  },
  {
    name: "Elite",
    protein: "39g protein",
    body: "More protein, fruit and yogurt on top. For anyone training seriously.",
  },
  {
    name: "Athlete",
    protein: "53g protein",
    body: "Our biggest. 150g chicken. Built for heavy training and real muscle gain.",
  },
];

export default async function Home() {
  // Already signed in? Straight to your meals — no marketing at a customer.
  const session = await currentSession();
  if (session) redirect("/me");

  // The development customer picker, which predates sign-in. Only ever reachable
  // on the laptop; a deployment shows the real landing page below.
  const showPicker =
    process.env.NODE_ENV !== "production" || Boolean(process.env.OG_ALLOW_PICKER);

  return (
    <main className="mx-auto w-full max-w-[560px] px-5 pb-16 pt-10">
      <header className="flex items-center gap-3">
        <Image
          src="/brand/icon_only_forest.svg"
          alt=""
          width={44}
          height={44}
          priority
        />
        <div>
          <p className="font-display text-[21px] font-bold leading-tight tracking-tight text-[var(--og-heading)]">
            OG Gainz
          </p>
          <p className="text-[12.5px] text-[var(--og-text-muted)]">
            High-protein meals, delivered in Chennai
          </p>
        </div>
      </header>

      <section className="mt-10">
        <h1 className="font-display text-[27px] font-semibold leading-[1.2] tracking-tight text-[var(--og-heading)]">
          Real food, weighed and cooked for your goals.
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-[var(--og-text-muted)]">
          Fresh meals from our kitchen in Perumbakkam, Monday to Friday, to your
          door. Every box has its protein, carbs and veggies measured — so you
          can stop guessing and just eat.
        </p>

        <a
          href="/api/auth/google"
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-[var(--radius-og)] border border-[var(--og-border)] bg-white px-5 py-3.5 text-[15px] font-semibold text-[#15241d] transition hover:bg-[var(--og-surface-alt)]"
        >
          <GoogleMark />
          Sign in to your meals
        </a>
        <p className="mt-2.5 text-center text-[12px] text-[var(--og-text-muted)]">
          Already a subscriber? Sign in to see today&rsquo;s delivery and what&rsquo;s left.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
          The packs
        </h2>
        <div className="space-y-3">
          {PACKS.map((p) => (
            <article
              key={p.name}
              className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] px-5 py-4"
            >
              <div className="flex items-baseline gap-2">
                <h3 className="font-display text-[16px] font-semibold text-[var(--og-heading)]">
                  {p.name}
                </h3>
                <span className="text-[12px] font-medium text-[var(--og-text-muted)]">
                  {p.protein} per meal
                </span>
              </div>
              <p className="mt-1.5 text-[13.5px] leading-5 text-[var(--og-text-muted)]">
                {p.body}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-3 px-1 text-[12px] leading-5 text-[var(--og-text-muted)]">
          Monthly and weekly packs, with add-ons if you want more of anything.
          Message us for current pricing and delivery to your area.
        </p>
      </section>

      <section className="mt-11">
        <a
          href="https://wa.me/919361798644"
          className="flex w-full items-center justify-center rounded-[var(--radius-og)] bg-[var(--og-forest)] px-5 py-3.5 text-[15px] font-semibold text-white"
        >
          Talk to us on WhatsApp
        </a>
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[12.5px] text-[var(--og-text-muted)]">
          <a href="https://www.instagram.com/_oggainz" target="_blank" rel="noopener">
            @_oggainz
          </a>
          <a href="https://oggainz.pythonanywhere.com/brochure" target="_blank" rel="noopener">
            Full menu
          </a>
          <a href="https://oggainz.pythonanywhere.com/terms" target="_blank" rel="noopener">
            Terms
          </a>
        </div>
        <p className="mt-5 text-center text-[11.5px] leading-5 text-[var(--og-text-muted)]">
          OG Gainz · Perumbakkam, Chennai · FSSAI registered
        </p>
      </section>

      {showPicker && <DevPicker />}
    </main>
  );
}

/** Laptop-only shortcut into any customer's screens, for building and testing. */
function DevPicker() {
  const customers = listCustomers();
  if (customers.length === 0) return null;
  return (
    <section className="mt-12 rounded-[var(--radius-og)] border border-dashed border-[var(--og-border)] p-4">
      <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
        Development only — open any customer
      </p>
      <div className="flex flex-wrap gap-2">
        {customers.slice(0, 40).map((c) => (
          <Link
            key={c.id}
            href={`/me/${c.id}`}
            className="rounded-full bg-[var(--og-surface-alt)] px-3 py-1.5 text-[12px] text-[var(--og-text)]"
          >
            {c.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.4-4.6 7l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
