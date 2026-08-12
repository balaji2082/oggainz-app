import { notFound } from "next/navigation";

import { Empty, SectionTitle } from "@/components/Bits";
import PackCard from "@/components/PackCard";
import Shell from "@/components/Shell";
import StaleNotice from "@/components/StaleNotice";
import TodayCard from "@/components/TodayCard";
import {
  getCustomerData,
  getDeadlines,
  isOperatingDay,
  mealsAfter,
  mealsOn,
  todayISO,
} from "@/lib/data";
import { relativeDay, shortDate } from "@/lib/format";
import { unreadCount } from "@/lib/support";

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

  // The deadline for today's meal(s) only — that's the countdown that matters
  // on this screen. docs/02 §7.5: computed by the server, never a client timer.
  const { serverNow, days: deadlineByDate } = await getDeadlines(id, today, today);
  const unread = await unreadCount("customer", id).catch(() => 0);

  return (
    <Shell customerId={id} active="home" supportUnread={unread > 0}>
      <StaleNotice asOf={data.asOf} />

      <p className="font-display text-[23px] font-semibold leading-tight tracking-[-0.02em] text-[var(--og-forest)]">
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
    </Shell>
  );
}
