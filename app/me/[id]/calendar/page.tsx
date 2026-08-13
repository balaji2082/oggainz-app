import { notFound } from "next/navigation";

import CalendarScreen from "@/components/CalendarScreen";
import Shell from "@/components/Shell";
import StaleNotice from "@/components/StaleNotice";
import { addDays } from "@/lib/format";
import { getDeadlines, todayISO } from "@/lib/data";
import { loadScreen } from "@/lib/screen";
import { myRequests } from "@/lib/writes";

/**
 * The month, and the two things a customer actually does here — skip a day,
 * pause a range. docs/02 §7.2: a real calendar, not two date fields, with
 * weekends visibly closed so pausing them never looks like an option.
 */
export default async function Calendar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const today = todayISO();
  const from = addDays(today, -35);
  const to = addDays(today, 60);

  // Postgres in one round trip, and the two Command Center calls alongside it
  // rather than after it.
  const [{ data, avatar, unread, feedback }, { serverNow, days: deadlines }, requests] =
    await Promise.all([
      loadScreen(id, [from, to]),
      getDeadlines(id, from, to),
      myRequests(id).catch(() => []),
    ]);
  if (!data.customer) notFound();

  return (
    <Shell customerId={id} active="calendar" supportUnread={unread > 0} avatar={avatar} name={data.customer.name}>
      <StaleNotice asOf={data.asOf} />
      <p className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--og-forest)]">
        Calendar
      </p>
      <p className="mb-5 mt-1 text-[14px] text-[var(--og-text-muted)]">
        Tap a day to skip it, or pause a whole stretch.
      </p>

      <CalendarScreen
        todayISO={today}
        meals={data.meals}
        packs={data.packs}
        operatingWeekdays={data.settings.operatingWeekdays}
        deadlines={deadlines}
        serverNow={serverNow}
        feedback={feedback}
        pendingRequests={requests.filter((r) => r.outcome === "pending")}
      />
    </Shell>
  );
}
