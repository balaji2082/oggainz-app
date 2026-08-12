"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { pauseMeals } from "@/app/actions/meals";
import type { Feedback } from "@/lib/feedback";
import { addDays, shortDate } from "@/lib/format";
import type { Meal, Pack } from "@/lib/types";
import type { Deadline, SkipRequest } from "@/lib/writes";
import Button from "./ui/Button";
import Calendar, { type CalendarDay, type DayState } from "./ui/Calendar";
import Sheet from "./ui/Sheet";
import { useToast } from "./ui/Toast";
import DaySheet from "./DaySheet";

interface Props {
  todayISO: string;
  meals: (Meal & { expected?: boolean })[];
  packs: Pack[];
  operatingWeekdays: number[];
  deadlines: Record<string, Deadline>;
  serverNow: string | null;
  feedback: Record<string, Feedback>;
  pendingRequests: SkipRequest[];
}

/** Mon=0 … Sun=6, matching how the Command Center counts weekdays. */
function isOperating(dateISO: string, operatingWeekdays: number[]): boolean {
  const weekday = (new Date(`${dateISO}T00:00:00`).getDay() + 6) % 7;
  return operatingWeekdays.includes(weekday);
}

export default function CalendarScreen({
  todayISO,
  meals,
  packs,
  operatingWeekdays,
  deadlines,
  serverNow,
  feedback,
  pendingRequests,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [pausing, setPausing] = useState(false);
  const [range, setRange] = useState<[string | null, string | null]>([null, null]);
  const [pending, startTransition] = useTransition();

  const primaryPack = useMemo(
    () =>
      packs.find((p) => p.status === "Active" || p.status === "Ending Soon" || p.status === "Paused") ??
      packs[0],
    [packs]
  );

  const pendingByDate = useMemo(() => {
    const s = new Set<string>();
    for (const r of pendingRequests) {
      if (r.targetDate) s.add(r.targetDate);
      if (r.startDate && r.endDate) {
        let d = r.startDate;
        let guard = 0;
        while (d <= r.endDate && guard++ < 400) {
          s.add(d);
          d = addDays(d, 1);
        }
      }
    }
    return s;
  }, [pendingRequests]);

  const days = useMemo(() => {
    const out: Record<string, CalendarDay> = {};
    const pause = primaryPack?.pause;

    // Every day the calendar can show starts from the plain fact of whether the
    // kitchen runs that weekday — set first so a real event below can override
    // it, but a day with no meal row and no pause still reads as closed rather
    // than blank.
    let probe = addDays(todayISO, -35);
    const last = addDays(todayISO, 60);
    while (probe <= last) {
      if (!isOperating(probe, operatingWeekdays)) out[probe] = { state: "closed" };
      probe = addDays(probe, 1);
    }

    for (const meal of meals) {
      const late = deadlines[meal.date]?.late ?? meal.date < todayISO;
      let state: DayState = "scheduled";
      if (meal.status === "Delivered") state = "delivered";
      else if (meal.status === "Skipped") state = "skipped";
      else if (pendingByDate.has(meal.date)) state = "requested";
      else if (
        pause &&
        meal.date >= pause.start &&
        (!pause.end || meal.date <= pause.end)
      )
        state = "paused";
      out[meal.date] = { state, changeable: !late, slot: meal.slot };
    }
    // Days inside a pause window with no meal row at all still need to render
    // as paused, not blank — that IS the point of a pause (no order generates).
    if (pause) {
      let d = pause.start;
      const end = pause.end ?? todayISO;
      let guard = 0;
      while (d <= end && guard++ < 400) {
        if (isOperating(d, operatingWeekdays)) out[d] = { state: "paused" };
        d = addDays(d, 1);
      }
    }
    return out;
  }, [meals, primaryPack, deadlines, todayISO, pendingByDate, operatingWeekdays]);

  const selectedMeals = openDate ? meals.filter((m) => m.date === openDate) : [];
  const selectedDeadline = openDate ? deadlines[openDate] : undefined;
  const selectedPending = openDate
    ? pendingRequests.find(
        (r) =>
          r.targetDate === openDate ||
          (r.startDate && r.endDate && openDate >= r.startDate && openDate <= r.endDate)
      )
    : undefined;

  // --- pause range summary ---------------------------------------------------
  const [start, end] = range;
  const rangeDates = useMemo(() => {
    if (!start || !end) return [] as string[];
    const out: string[] = [];
    let d = start;
    let guard = 0;
    while (d <= end && guard++ < 400) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [start, end]);
  const operatingInRange = useMemo(
    () => rangeDates.filter((d) => isOperating(d, operatingWeekdays)),
    [rangeDates, operatingWeekdays]
  );

  function confirmPause() {
    if (!start || !end || !primaryPack) return;
    startTransition(async () => {
      const result = await pauseMeals(start, end, primaryPack.id);
      toast(result.message, result.ok ? "good" : "bad");
      if (result.ok) {
        setPausing(false);
        setRange([null, null]);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5 shadow-[var(--og-e1)]">
        <Calendar days={days} todayISO={todayISO} mode="browse" onPickDay={setOpenDate} />
      </div>

      {primaryPack && (
        <div className="mt-4">
          <Button
            variant="secondary"
            full
            onClick={() => setPausing(true)}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="4" y="5" width="16" height="16" rx="3" />
                <path d="M8 3v4M16 3v4M4 10h16" />
              </svg>
            }
          >
            Pause a stretch
          </Button>
        </div>
      )}

      {/* One day, tapped from the calendar. */}
      <DaySheet
        open={openDate !== null}
        onClose={() => setOpenDate(null)}
        date={openDate ?? todayISO}
        todayISO={todayISO}
        state={openDate ? days[openDate]?.state : undefined}
        meals={selectedMeals}
        pack={primaryPack}
        deadline={selectedDeadline}
        serverNow={serverNow ?? undefined}
        feedback={openDate ? feedback[`${openDate}|${selectedMeals[0]?.slot ?? "Lunch"}`] : undefined}
        pendingRequest={selectedPending}
      />

      {/* Pausing a range. */}
      <Sheet
        open={pausing}
        onClose={() => {
          setPausing(false);
          setRange([null, null]);
        }}
        title="Pause a stretch"
        subtitle="Tap your first and last day away"
        footer={
          start && end ? (
            <Button full busy={pending} onClick={confirmPause}>
              Confirm pause
            </Button>
          ) : undefined
        }
      >
        <Calendar
          days={days}
          todayISO={todayISO}
          mode="range"
          range={range}
          onRangeChange={setRange}
          minISO={todayISO}
        />

        {start && (
          <div className="og-rise mt-5 rounded-[var(--og-r-md)] bg-[color-mix(in_srgb,var(--og-green)_9%,transparent)] p-4">
            <p className="font-display text-[15px] font-semibold text-[var(--og-forest)]">
              {shortDate(start)} {end ? `→ ${shortDate(end)}` : ""}
            </p>
            {end && (
              <>
                <p className="mt-1 text-[13px] text-[var(--og-text-muted)]">
                  {operatingInRange.length} meal{operatingInRange.length === 1 ? "" : "s"} paused
                  · they move to the end of your pack
                </p>
                {deadlines[start]?.late && (
                  <p className="mt-2 text-[12px] font-medium text-[var(--og-orange)]">
                    Some of these days are already being prepared — we&apos;ll pass
                    those on and apply the rest right away.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {!start && (
          <p className="mt-4 text-[12.5px] leading-5 text-[var(--og-text-muted)]">
            Weekends and holidays are shown closed — pausing them doesn&apos;t save
            a meal, so they can&apos;t be picked.
          </p>
        )}
      </Sheet>
    </div>
  );
}
