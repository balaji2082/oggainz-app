import { notFound } from "next/navigation";

import { Empty, SectionTitle } from "@/components/Bits";
import PackCard from "@/components/PackCard";
import StaleNotice from "@/components/StaleNotice";
import TodayCard from "@/components/TodayCard";
import {
  getDeadlines,
  isOperatingDay,
  mealsAfter,
  mealsOn,
  todayISO,
} from "@/lib/data";
import { relativeDay, shortDate } from "@/lib/format";
import { loadScreen } from "@/lib/screen";

export default async function CustomerHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const today = todayISO();

  // Access is checked once for every /me/[id] screen, in layout.tsx.
  //
  // One Postgres round trip and one Command Center call, STARTED TOGETHER.
  // These used to run one after another — the payload, then the deadlines, then
  // the unread count, then the avatar — stacking four waits end to end on a
  // screen where none of them needs to know about the others.
  const [{ data }, { serverNow, days: deadlineByDate }] = await Promise.all([
    loadScreen(id),
    getDeadlines(id, today, today),
  ]);
  if (!data.customer) notFound();

  const packs = data.packs;
  const todays = mealsOn(data, today);
  const upcoming = mealsAfter(data, today, 5);
  const packById = new Map(packs.map((p) => [p.id, p]));
  const firstName = data.customer.name.split(" ")[0];

  return (
    <>
      <StaleNotice asOf={data.asOf} />

      {/* Home keeps its own greeting rather than the icon-chip PageHead: a name
          is warmer than a label, and this is the one screen a customer opens
          without having chosen to go anywhere. */}
      <p className="font-display text-[23px] font-semibold leading-tight tracking-[-0.02em] text-[var(--og-heading)]">
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
              deadline={deadlineByDate[meal.date]}
              serverNow={serverNow ?? undefined}
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
          <SectionTitle>Coming up</SectionTitle>
          <ul className="og-stagger overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
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
                <span className="shrink-0 rounded-[var(--og-r-pill)] bg-[var(--og-surface-alt)] px-2.5 py-1 text-[11px] font-semibold text-[var(--og-text-muted)]">
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
        <SectionTitle>{packs.length === 1 ? "Your pack" : "Your packs"}</SectionTitle>
        <div className="space-y-3">
          {packs.map((p) => (
            <PackCard key={p.id} pack={p} customerId={id} />
          ))}
          {packs.length === 0 && (
            <Empty title="No active pack right now" body="Message us when you're ready to start." />
          )}
        </div>
      </section>
    </>
  );
}
