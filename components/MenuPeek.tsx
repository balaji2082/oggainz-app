import Link from "next/link";

import type { MenuDay } from "@/lib/menu";

/**
 * Tomorrow's menu, on the Today screen.
 *
 * This is the half of the menu feature a customer actually feels. The full week
 * is a page you go and look at once; "tomorrow is Tandoori with ghee podi rice"
 * is the thing that makes a subscription feel like a kitchen cooking for you
 * rather than a delivery arriving.
 *
 * Renders nothing at all when tomorrow has no published menu — an absent card
 * is better than a card apologising for being empty on a screen that already
 * has plenty to say.
 */
export default function MenuPeek({
  day,
  customerId,
  heading = "Tomorrow",
}: {
  day: MenuDay | null;
  customerId: string;
  heading?: string;
}) {
  if (!day || day.items.length === 0) return null;

  const protein = day.items.find((i) => i.key === "protein");
  const carbs = day.items.filter((i) => i.key === "carb");
  const rest = day.items.filter((i) => i.key !== "protein" && i.key !== "carb");

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--og-text-muted)]">
          {heading} on the menu
        </h2>
        <span className="text-[11px] text-[var(--og-text-muted)]">{day.label}</span>
      </div>

      <Link
        href={`/me/${customerId}/menu`}
        prefetch
        className="og-press block rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5 shadow-[var(--og-e1)]"
      >
        {protein && (
          <p className="font-display text-[18px] font-semibold leading-tight tracking-[-0.01em] text-[var(--og-heading)]">
            {protein.emoji ? `${protein.emoji} ` : ""}
            {protein.name}
          </p>
        )}

        {carbs.length > 0 && (
          <p className="mt-1.5 text-[13.5px] leading-5 text-[var(--og-text)]">
            {carbs.map((c) => `${c.label.replace(" carb", "")}: ${c.name}`).join(" · ")}
          </p>
        )}

        {rest.length > 0 && (
          <p className="mt-1 text-[12.5px] leading-5 text-[var(--og-text-muted)]">
            {rest.map((r) => r.name).join(" · ")}
          </p>
        )}

        <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--og-primary)]">
          See the full week
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
        </span>
      </Link>
    </section>
  );
}
