import type { Component, Meal, Pack } from "@/lib/types";
import { componentLabel, relativeDay, shortDate } from "@/lib/format";

interface Props {
  meal: Meal | null;
  pack: Pack | undefined;
  dateISO: string;
  todayISO: string;
  kitchenOpen: boolean;
}

function Line({ c }: { c: Component }) {
  return (
    <li className="flex items-baseline gap-2 text-[15px] leading-6">
      <span aria-hidden="true" className="w-5 shrink-0 text-center">
        {c.emoji ?? "•"}
      </span>
      <span className="text-white/95">{componentLabel(c)}</span>
      {c.kind === "addon" && (
        <span className="rounded-full bg-[var(--og-lime)]/22 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[var(--og-lime)]">
          extra
        </span>
      )}
    </li>
  );
}

/**
 * The hero. This is the one thing a customer opens the app to see, so it gets
 * the brand gradient and the whole top of the screen.
 */
export default function TodayCard({
  meal,
  pack,
  dateISO,
  todayISO,
  kitchenOpen,
}: Props) {
  const when = relativeDay(dateISO, todayISO);

  if (!kitchenOpen) {
    return (
      <section className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface-alt)] p-6 text-center">
        <p className="font-display text-[17px] font-semibold text-[var(--og-forest)]">
          Kitchen closed {when.toLowerCase()}
        </p>
        <p className="mt-1.5 text-[14px] leading-6 text-[var(--og-text-muted)]">
          We cook Monday to Friday. Your meals carry forward — nothing is lost.
        </p>
      </section>
    );
  }

  if (!meal) {
    return (
      <section className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] p-6 text-center">
        <p className="font-display text-[17px] font-semibold text-[var(--og-forest)]">
          No meal {when.toLowerCase()}
        </p>
        <p className="mt-1.5 text-[14px] leading-6 text-[var(--og-text-muted)]">
          {pack?.pausedToday
            ? "Your pack is paused. Meals resume when you are ready."
            : "Nothing scheduled for this day."}
        </p>
      </section>
    );
  }

  const base = pack?.components.filter((c) => c.kind === "base") ?? [];
  const addons = pack?.components.filter((c) => c.kind === "addon") ?? [];
  const delivered = meal.status === "Delivered";
  const skipped = meal.status === "Skipped";

  return (
    <section
      className="relative overflow-hidden rounded-[var(--radius-og)] p-6 text-white shadow-[var(--og-shadow-lg)]"
      style={{ background: "var(--og-gradient-brand)" }}
    >
      {/* Soft lime bloom, purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--og-lime)" }}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--og-lime)]">
            {when} · {shortDate(dateISO)}
          </p>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
            {meal.slot}
          </span>
        </div>

        <h1 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-tight">
          {meal.planName ?? "Your meal"}
        </h1>

        {(delivered || skipped) && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">
            {delivered ? "✓ Delivered" : "Skipped — moved to the end of your pack"}
          </p>
        )}

        {base.length > 0 && (
          <ul className="mt-5 space-y-1.5">
            {base.map((c, i) => (
              <Line key={`b${i}`} c={c} />
            ))}
            {addons.map((c, i) => (
              <Line key={`a${i}`} c={c} />
            ))}
          </ul>
        )}

        {meal.dayNote && (
          <p className="mt-4 rounded-lg border-l-2 border-[var(--og-lime)] bg-black/15 px-3 py-2 text-[13px] leading-5 text-white/90">
            {meal.dayNote}
          </p>
        )}
      </div>
    </section>
  );
}
