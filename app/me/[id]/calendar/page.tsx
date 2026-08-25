import { notFound } from "next/navigation";

import CalendarScreen from "@/components/CalendarScreen";
import { PageHead } from "@/components/Bits";
import StaleNotice from "@/components/StaleNotice";
import { addDays } from "@/lib/format";
import { getDeadlines, getMyRequests, todayISO } from "@/lib/data";
import { loadScreen } from "@/lib/screen";

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

  /**
   * Deadlines are asked for over 15 days, not 96.
   *
   * This was the calendar tab's three-to-four seconds. The Command Center
   * computes and serialises one deadline per day in the window, and the screen
   * was asking it for ninety-six of them on every visit — ninety-five of which
   * it could not use. A deadline only says something the app doesn't already
   * know for days that are ABOUT to lock: everything before today is past its
   * deadline by definition, and everything past next week is comfortably inside
   * it. CalendarScreen already falls back to `date < today` for anything
   * outside this window, so the answers are identical.
   *
   * [LAW] docs/03 §5.3 is untouched by this — the SERVER still decides whether
   * a write was in time. This window only controls what the screen draws.
   */
  const dlTo = addDays(today, 14);

  // Postgres in one round trip, and the two Command Center calls alongside it
  // rather than after it.
  const [{ data, feedback }, { serverNow, days: deadlines }, requests] =
    await Promise.all([
      loadScreen(id, [from, to]),
      getDeadlines(id, today, dlTo),
      getMyRequests(id),
    ]);
  if (!data.customer) notFound();

  return (
    <>
      <StaleNotice asOf={data.asOf} />
      <PageHead
        icon="calendar"
        title="Calendar"
        subtitle="Tap a day to skip it, or pause a whole stretch."
      />

      <CalendarScreen
        todayISO={today}
        meals={data.meals}
        packs={data.packs}
        operatingWeekdays={data.settings.operatingWeekdays}
        freezeEligiblePlans={data.settings.freezeEligiblePlans}
        deadlines={deadlines}
        serverNow={serverNow}
        feedback={feedback}
        pendingRequests={requests.filter((r) => r.outcome === "pending")}
      />
    </>
  );
}
