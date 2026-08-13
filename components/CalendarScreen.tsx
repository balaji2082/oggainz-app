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
import PackSwitcher from "./PackSwitcher";

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

const LIVE = ["Active", "Ending Soon", "Paused"];

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

  const livePacks = useMemo(() => packs.filter((p) => LIVE.includes(p.status)), [packs]);

  /**
   * Which pack the calendar is showing.
   *
   * This used to be a single `primaryPack` picked with `find(...) ?? packs[0]`,
   * and it was wrong in a way that only shows up for a customer holding more
   * than one pack: Ashok's protein shake and his meal pack are two separate
   * subscriptions, and every day, every skip and every pause was silently
   * attributed to whichever sorted first. A customer could not skip the meal
   * they meant to skip.
   *
   * There is no correct default when someone holds two packs, so the interface
   * asks instead of guessing (the API refuses to guess for the same reason).
   */
  const [packId, setPackId] = useState<string>(() => livePacks[0]?.id ?? packs[0]?.id ?? "");
  const pack = useMemo(
    () => packs.find((p) => p.id === packId) ?? livePacks[0] ?? packs[0],
    [packs, packId, livePacks]
  );

  /** Only this pack's meals. The API tags every row with its subscription. */
  const packMeals = useMemo(
    () => (pack ? meals.filter((m) => m.packId === pack.id) : []),
    [meals, pack]
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
    const first = addDays(todayISO, -35);
    const last = addDays(todayISO, 60);

    // Start from the plain fact of whether the kitchen runs that weekday, so a
    // day with no meal and no freeze reads as closed rather than blank.
    let probe = first;
    while (probe <= last) {
      if (!isOperating(probe, operatingWeekdays)) out[probe] = { state: "closed" };
      probe = addDays(probe, 1);
    }

    // Every freeze on THIS pack — including future ones, which is what a skip
    // three weeks out is. Painted before meals so a real delivered row wins.
    for (const w of pack?.pauses ?? []) {
      let d = w.start;
      const end = w.end ?? last;
      let guard = 0;
      while (d <= end && d <= last && guard++ < 400) {
        if (d >= first && isOperating(d, operatingWeekdays)) {
          out[d] = { state: w.kind === "skip" ? "skipped" : "paused" };
        }
        d = addDays(d, 1);
      }
    }

    for (const meal of packMeals) {
      const late = deadlines[meal.date]?.late ?? meal.date < todayISO;
      let state: DayState = "scheduled";
      if (meal.status === "Delivered") state = "delivered";
      else if (meal.status === "Skipped") state = "skipped";
      else if (meal.status === "Paused") state = "paused";
      else if (pendingByDate.has(meal.date)) state = "requested";
      out[meal.date] = { state, changeable: !late, slot: meal.slot };
    }
    return out;
  }, [packMeals, pack, deadlines, todayISO, pendingByDate, operatingWeekdays]);

  const selectedMeals = openDate ? packMeals.filter((m) => m.date === openDate) : [];
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
  const operatingInRange = useMemo(() => {
    if (!start || !end) return [] as string[];
    const out: string[] = [];
    let d = start;
    let guard = 0;
    while (d <= end && guard++ < 400) {
      if (isOperating(d, operatingWeekdays)) out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [start, end, operatingWeekdays]);

  function confirmPause() {
    if (!start || !end || !pack) return;
    startTransition(async () => {
      const result = await pauseMeals(start, end, pack.id);
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
      {/* Only when there is genuinely a choice to make. */}
      {packs.length > 1 && (
        <PackSwitcher packs={packs} activeId={pack?.id ?? ""} onPick={setPackId} />
      )}

      <div className="rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5 shadow-[var(--og-e1)]">
        <Calendar days={days} todayISO={todayISO} mode="browse" onPickDay={setOpenDate} />
      </div>

      {pack && LIVE.includes(pack.status) && (
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
          {packs.length > 1 && (
            <p className="mt-2 text-center text-[12px] text-[var(--og-text-muted)]">
              This pauses {pack.planName} only.
            </p>
          )}
        </div>
      )}

      <DaySheet
        open={openDate !== null}
        onClose={() => setOpenDate(null)}
        date={openDate ?? todayISO}
        todayISO={todayISO}
        state={openDate ? days[openDate]?.state : undefined}
        meals={selectedMeals}
        pack={pack}
        deadline={selectedDeadline}
        serverNow={serverNow ?? undefined}
        feedback={openDate ? feedback[`${openDate}|${selectedMeals[0]?.slot ?? "Lunch"}`] : undefined}
        pendingRequest={selectedPending}
      />

      <Sheet
        open={pausing}
        onClose={() => {
          setPausing(false);
          setRange([null, null]);
        }}
        title="Pause a stretch"
        subtitle={
          packs.length > 1 ? `${pack?.planName} · tap your first and last day away`
                           : "Tap your first and last day away"
        }
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
