import { notFound } from "next/navigation";

import PackCard from "@/components/PackCard";
import Shell from "@/components/Shell";
import StaleNotice from "@/components/StaleNotice";
import TodayCard from "@/components/TodayCard";
import {
  getCustomerData,
  isOperatingDay,
  mealsAfter,
  mealsOn,
  todayISO,
} from "@/lib/data";
import { relativeDay, shortDate } from "@/lib/format";

export default async function CustomerHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Access is checked once for every /me/[id] screen, in layout.tsx.
  const data = await getCustomerData(id);
  if (!data.customer) notFound();

  const today = todayISO();
  const packs = data.packs;
  const todays = mealsOn(data, today);
  const upcoming = mealsAfter(data, today, 5);
  const packById = new Map(packs.map((p) => [p.id, p]));
  const firstName = data.customer.name.split(" ")[0];

  return (
    <Shell customerId={id} active="home">
      <StaleNotice asOf={data.asOf} />

      <p className="font-display text-[22px] font-semibold leading-tight tracking-tight text-[var(--og-forest)]">
        Hey {firstName}
      </p>
      <p className="mb-5 mt-1 text-[14px] text-[var(--og-text-muted)]">
        {todays.length > 0
          ? "Here's what's coming today."
          : "Nothing on the way today."}
      </p>

      <div className="space-y-4">
        {todays.length > 0 ? (
          todays.map((meal) => (
            <TodayCard
              key={meal.id}
              meal={meal}
              pack={meal.packId ? packById.get(meal.packId) : undefined}
              dateISO={today}
              todayISO={today}
              kitchenOpen
            />
          ))
        ) : (
          <TodayCard
            meal={null}
            pack={packs[0]}
            dateISO={today}
            todayISO={today}
            kitchenOpen={isOperatingDay(data, today)}
          />
        )}
      </div>

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
            Coming up
          </h2>
          <ul className="overflow-hidden rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)]">
            {upcoming.map((m, i) => (
              <li
                key={`${m.id}-${m.date}-${m.slot}`}
                className={
                  i > 0
                    ? "flex items-center gap-3 border-t border-[var(--og-border)] px-4 py-3.5"
                    : "flex items-center gap-3 px-4 py-3.5"
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--og-text)]">
                    {relativeDay(m.date, today)}
                  </p>
                  <p className="truncate text-[12px] text-[var(--og-text-muted)]">
                    {shortDate(m.date)} · {m.planName ?? "Meal"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--og-surface-alt)] px-2.5 py-1 text-[11px] font-semibold text-[var(--og-text-muted)]">
                  {m.slot}
                </span>
              </li>
            ))}
          </ul>
          {upcoming.some((m) => m.expected) && (
            <p className="mt-2.5 px-1 text-[11.5px] leading-4 text-[var(--og-text-muted)]">
              Expected days, based on your remaining meals. Confirmed the evening
              before.
            </p>
          )}
        </section>
      )}

      <section className="mt-8 pb-4">
        <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
          {packs.length === 1 ? "Your pack" : "Your packs"}
        </h2>
        <div className="space-y-3">
          {packs.map((p) => (
            <PackCard key={p.id} pack={p} />
          ))}
          {packs.length === 0 && (
            <p className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5 text-[14px] text-[var(--og-text-muted)]">
              No active pack right now.
            </p>
          )}
        </div>
      </section>
    </Shell>
  );
}
