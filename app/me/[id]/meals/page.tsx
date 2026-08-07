import { notFound } from "next/navigation";

import Shell from "@/components/Shell";
import { addDays, longDate, relativeDay, shortDate } from "@/lib/format";
import { getCustomer, getMeals, getUpcoming, todayISO } from "@/lib/snapshot";
import type { Meal } from "@/lib/types";

/**
 * Every meal, past and coming.
 *
 * The question this answers is "did Friday's meal actually arrive?", so
 * delivered and skipped days are shown plainly rather than tidied away. Nothing
 * here is computed by the app — statuses and counts come from the Command
 * Center, which is the only thing that decides what a meal did.
 */
export default async function Meals({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = getCustomer(id);
  if (!customer) notFound();

  const today = todayISO();
  // Ninety days back is more than a full monthly pack, so a customer can always
  // see the whole of the pack they are on.
  const past = getMeals(id, addDays(today, -90), addDays(today, -1))
    .slice()
    .reverse();
  const todays = getMeals(id, today, today);
  const upcoming = getUpcoming(id, 14);

  return (
    <Shell customerId={id} active="meals">
      <p className="font-display text-[22px] font-semibold leading-tight tracking-tight text-[var(--og-forest)]">
        Your meals
      </p>
      <p className="mb-6 mt-1 text-[14px] text-[var(--og-text-muted)]">
        Everything delivered, skipped and still to come.
      </p>

      {todays.length > 0 && (
        <Section title="Today">
          {todays.map((m) => (
            <Row key={m.id} meal={m} today={today} />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Coming up">
          {upcoming.map((m) => (
            <Row key={`u-${m.id}-${m.date}`} meal={m} today={today} />
          ))}
          <li className="px-4 py-3">
            <p className="text-[11.5px] leading-4 text-[var(--og-text-muted)]">
              Expected days, based on the meals you have left. Confirmed the
              evening before.
            </p>
          </li>
        </Section>
      )}

      {past.length > 0 ? (
        <Section title="Already delivered">
          {past.map((m) => (
            <Row key={m.id} meal={m} today={today} />
          ))}
        </Section>
      ) : (
        <p className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5 text-[14px] text-[var(--og-text-muted)]">
          Nothing delivered yet.
        </p>
      )}
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
        {title}
      </h2>
      <ul className="overflow-hidden rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)]">
        {children}
      </ul>
    </section>
  );
}

const TONE: Record<string, { label: string; className: string }> = {
  Delivered: { label: "Delivered", className: "bg-[#e6f4ea] text-[#1a7f43]" },
  Skipped: { label: "Skipped", className: "bg-[#fdecea] text-[#b13325]" },
  Pending: { label: "On the way", className: "bg-[var(--og-surface-alt)] text-[var(--og-text-muted)]" },
  Off: { label: "No delivery", className: "bg-[var(--og-surface-alt)] text-[var(--og-text-muted)]" },
};

function Row({ meal, today }: { meal: Meal & { expected?: boolean }; today: string }) {
  const tone = meal.expected
    ? { label: "Expected", className: "bg-[var(--og-surface-alt)] text-[var(--og-text-muted)]" }
    : TONE[meal.status] ?? TONE.Pending;

  return (
    <li className="flex items-center gap-3 border-b border-[var(--og-border)] px-4 py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-[var(--og-text)]">
          {relativeDay(meal.date, today)}
          <span className="ml-2 text-[12px] font-normal text-[var(--og-text-muted)]">
            {meal.slot}
          </span>
        </p>
        <p className="truncate text-[12px] text-[var(--og-text-muted)]">
          {shortDate(meal.date)} · {meal.planName ?? "Meal"}
        </p>
        {meal.dayNote && (
          <p className="mt-1 text-[12px] leading-4 text-[var(--og-text-muted)]">
            {meal.dayNote}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.className}`}
        title={longDate(meal.date)}
      >
        {tone.label}
      </span>
    </li>
  );
}
