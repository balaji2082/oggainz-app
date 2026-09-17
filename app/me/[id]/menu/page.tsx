import { Card, Empty, PageHead } from "@/components/Bits";
import MenuPrintButton from "@/components/MenuPrintButton";
import { fetchUpcomingMenu, type MenuDay, type MenuWeek } from "@/lib/menu";
import { todayISO } from "@/lib/data";

/**
 * The tentative weekly menu.
 *
 * Everything a customer sees here was chosen and published in the Command
 * Center. Nothing is inferred, and an unplanned day is absent rather than
 * guessed — see the [LAW] note in lib/menu.ts.
 *
 * No customer data is read on this screen at all: the menu is the same for
 * everyone, so there is no `loadScreen` call and nothing here can be wrong for
 * one person and right for another.
 */

export const metadata = { title: "This week's menu" };

function DayCard({ day, today }: { day: MenuDay; today: string }) {
  const isToday = day.date === today;
  const isPast = day.date < today;

  return (
    <Card
      className={[
        "og-menu-day",
        isPast ? "opacity-55" : "",
        isToday ? "ring-2 ring-[var(--og-primary)]" : "",
      ].join(" ")}
    >
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-[var(--og-heading)]">
          {day.weekday}
        </h3>
        <span className="text-[12px] text-[var(--og-text-muted)]">{day.label}</span>
        {isToday && (
          <span className="ml-auto rounded-[var(--og-r-pill)] bg-[var(--og-chip)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--og-primary)]">
            Today
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {day.items.map((item, i) => (
          <li key={`${item.key}-${i}`} className="flex gap-3">
            <span className="w-[86px] shrink-0 pt-[3px] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--og-text-muted)]">
              {item.label}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={
                  item.key === "protein"
                    ? "text-[15px] font-semibold text-[var(--og-heading)]"
                    : "text-[14px] text-[var(--og-heading)]"
                }
              >
                {item.emoji ? `${item.emoji} ` : ""}
                {item.name}
              </span>
              {item.desc && (
                <span className="mt-0.5 block text-[12px] leading-4 text-[var(--og-text-muted)]">
                  {item.desc}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WeekBlock({
  week,
  today,
  heading,
}: {
  week: MenuWeek;
  today: string;
  heading: string;
}) {
  if (week.days.length === 0) return null;
  return (
    <section className="mb-7">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--og-text-muted)]">
        {heading}
      </h2>
      {week.note && (
        <p className="mb-3 rounded-[var(--og-r-md)] border-l-[3px] border-[var(--og-lime)] bg-[var(--og-chip)] px-4 py-3 text-[13px] leading-5 text-[var(--og-heading)]">
          {week.note}
        </p>
      )}
      <div className="space-y-3">
        {week.days.map((day) => (
          <DayCard key={day.date} day={day} today={today} />
        ))}
      </div>
    </section>
  );
}

export default async function MenuScreen() {
  const today = todayISO();
  const weeks = await fetchUpcomingMenu(today);
  const [thisWeek, nextWeek] = weeks;
  const hasAny =
    (thisWeek?.days.length ?? 0) > 0 || (nextWeek?.days.length ?? 0) > 0;

  return (
    <>
      <div className="og-menu-head">
        <PageHead
          icon="calendar"
          title="This week's menu"
          subtitle="What's going in the box, day by day."
        />
      </div>

      {!hasAny ? (
        <Empty
          title="The menu isn't up yet"
          body="Balaji publishes the week's menu before it starts. Check back shortly — or message us and we'll tell you what's cooking."
        />
      ) : (
        <>
          <div className="og-menu-print-only mb-5 hidden">
            <p className="font-display text-[20px] font-semibold text-[var(--og-heading)]">
              OG Gainz — this week&rsquo;s menu
            </p>
          </div>

          {thisWeek && (
            <WeekBlock week={thisWeek} today={today} heading="This week" />
          )}
          {nextWeek && (
            <WeekBlock week={nextWeek} today={today} heading="Next week" />
          )}

          {/* The "tentative" wording, as agreed: present and honest, but quiet —
              a full-width warning banner would undercut the menu above it. */}
          <p className="og-menu-fine mb-4 text-center text-[12px] leading-5 text-[var(--og-text-muted)]">
            Menu is tentative and may change slightly with market availability.
            Not keen on a day&rsquo;s carb? Ask us — sweet potato is always ready.
          </p>

          <MenuPrintButton />
        </>
      )}
    </>
  );
}
