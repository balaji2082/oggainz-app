"use client";

import { useMemo, useState } from "react";

/**
 * The month, and the two things you can do to it.
 *
 * docs/02 §7.2 is explicit that this must be a real calendar and not two date
 * fields, and that weekends must render muted and unselectable — "the customer
 * must be able to see that pausing Sat–Sun is pointless. That single visual
 * saves a support conversation every week."
 *
 * Weeks start on Monday. The kitchen runs Mon–Fri, so a Monday-first grid puts
 * the working week in one block and the closed days together at the end, which
 * is what makes the shading legible at a glance instead of a scatter.
 *
 * [LAW] docs/02 §7.5 — never colour alone. Every state carries a shape, a dot or
 * a label as well, because a green square and a grey square are the same square
 * to a red-green colourblind customer, and roughly one man in twelve is.
 */

export type DayState =
  | "delivered"   // it happened
  | "scheduled"   // it is coming
  | "skipped"     // they took it off
  | "paused"      // inside a freeze window
  | "requested"   // asked for, waiting on Balaji
  | "closed"      // kitchen shut — weekend or holiday
  | "none";       // nothing planned

export interface CalendarDay {
  state: DayState;
  /** False once the deadline has passed — the day can be seen but not changed. */
  changeable?: boolean;
  slot?: string;
}

interface Props {
  days: Record<string, CalendarDay>;
  todayISO: string;
  mode?: "browse" | "range";
  /** [start, end] — end is null while the first tap is waiting for a second. */
  range?: [string | null, string | null];
  onRangeChange?: (range: [string | null, string | null]) => void;
  onPickDay?: (date: string) => void;
  /** Nothing before this can be selected in range mode. */
  minISO?: string;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * What happened on a day, as a small piece of iconography.
 *
 * Each one is a real shape rather than a coloured dot, because the states mean
 * genuinely different things and a row of identical dots in four colours forces
 * the customer back to the key every time. A filled bowl reads as "food came",
 * an outlined one as "food is coming", and neither needs explaining twice.
 */
function Marker({ state }: { state: DayState }) {
  if (state === "delivered") {
    // A full bowl with a tick — the meal arrived.
    return (
      <span aria-hidden="true" className="mt-[3px] text-[var(--og-green)]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M3.5 10.5h17a8.5 8.5 0 0 1-17 0z" fill="currentColor" />
          <path d="M8.5 13.6l2.2 2.2 4.6-4.6" stroke="var(--og-cream)" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "scheduled") {
    // The same bowl, empty — the meal is on its way.
    return (
      <span aria-hidden="true" className="mt-[3px] text-[var(--og-forest)]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 10.5h17a8.5 8.5 0 0 1-17 0z" />
        </svg>
      </span>
    );
  }
  if (state === "skipped") {
    // Deliberately taken off — a bowl crossed through.
    return (
      <span aria-hidden="true" className="mt-[3px] text-[var(--og-orange)]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 10.5h17a8.5 8.5 0 0 1-17 0z" opacity="0.45" />
          <path d="M4.5 19.5L19.5 4.5" />
        </svg>
      </span>
    );
  }
  if (state === "paused") {
    return (
      <span aria-hidden="true" className="mt-[3px] text-[var(--og-text-muted)]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6.5" y="5" width="3.6" height="14" rx="1.6" />
          <rect x="13.9" y="5" width="3.6" height="14" rx="1.6" />
        </svg>
      </span>
    );
  }
  if (state === "requested") {
    // Waiting on Balaji — a clock, not a verdict.
    return (
      <span aria-hidden="true" className="mt-[3px] text-[var(--og-orange)]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5.2l3.2 1.9" />
        </svg>
      </span>
    );
  }
  if (state === "closed") {
    return (
      <span
        aria-hidden="true"
        className="mt-[5px] block h-[2.5px] w-3 rounded-full bg-[var(--og-border)]"
      />
    );
  }
  return null;
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Monday-first index: Mon=0 … Sun=6. */
function mondayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

export default function Calendar({
  days,
  todayISO,
  mode = "browse",
  range,
  onRangeChange,
  onPickDay,
  minISO,
}: Props) {
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayISO.split("-").map(Number);
    return new Date(y, m - 1, 1);
  });

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = mondayIndex(first);
    const cells: (string | null)[] = Array(lead).fill(null);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      cells.push(iso(new Date(cursor.getFullYear(), cursor.getMonth(), d)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const [start, end] = range ?? [null, null];
  const min = minISO ?? todayISO;

  function inRange(date: string) {
    if (!start) return false;
    if (!end) return date === start;
    return date >= start && date <= end;
  }

  function selectable(date: string, day: CalendarDay) {
    if (mode !== "range") return true;
    // A closed day cannot be paused because there is nothing to pause. Saying so
    // by making it untappable is cheaper than a message explaining it.
    return day.state !== "closed" && date >= min;
  }

  function handle(date: string, day: CalendarDay) {
    if (mode === "browse") {
      onPickDay?.(date);
      return;
    }
    if (!selectable(date, day) || !onRangeChange) return;
    // First tap sets the start. Second tap completes it — and a tap before the
    // start is treated as a new start rather than an error, because that is what
    // someone correcting themselves means by it.
    if (!start || (start && end)) onRangeChange([date, null]);
    else if (date < start) onRangeChange([date, null]);
    else onRangeChange([start, date]);
  }

  const monthLabel = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="og-press flex h-10 w-10 items-center justify-center rounded-full text-[var(--og-forest)] hover:bg-[var(--og-surface-alt)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <p
          aria-live="polite"
          className="font-display text-[15.5px] font-semibold tracking-[-0.01em] text-[var(--og-forest)]"
        >
          {monthLabel}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="og-press flex h-10 w-10 items-center justify-center rounded-full text-[var(--og-forest)] hover:bg-[var(--og-surface-alt)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--og-text-muted)]"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;

          const day = days[date] ?? { state: "none" as DayState };
          const isToday = date === todayISO;
          const past = date < todayISO;
          const selected = mode === "range" && inRange(date);
          const isEdge = date === start || date === end;
          const disabled = mode === "range" && !selectable(date, day);
          const num = Number(date.slice(8, 10));

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => handle(date, day)}
              aria-label={`${num} ${monthLabel}${
                day.state === "closed" ? ", kitchen closed" : `, ${day.state}`
              }`}
              aria-pressed={mode === "range" ? selected : undefined}
              className={[
                "og-press relative flex aspect-square min-h-[42px] flex-col items-center justify-center",
                "text-[14px] font-medium",
                // The selected range wears the same forest→green gradient as the
                // Today hero, so the two screens read as one product rather than
                // two. Only the ends are rounded, which is what makes a run of
                // days look like one continuous stretch instead of seven chips.
                selected
                  ? isEdge
                    ? "text-white shadow-[var(--og-e2)]"
                    : "bg-[color-mix(in_srgb,var(--og-green)_18%,transparent)] text-[var(--og-forest)]"
                  : "rounded-[var(--og-r-sm)]",
                selected && isEdge && date === start && date === end ? "rounded-[var(--og-r-sm)]" : "",
                selected && isEdge && date === start && date !== end
                  ? "rounded-l-[var(--og-r-sm)]" : "",
                selected && isEdge && date === end && date !== start
                  ? "rounded-r-[var(--og-r-sm)]" : "",
                !selected && day.state === "closed"
                  ? "text-[color-mix(in_srgb,var(--og-text-muted)_55%,transparent)]"
                  : "",
                !selected && past && day.state !== "closed" ? "text-[var(--og-text-muted)]" : "",
                !selected && !past && day.state !== "closed" ? "text-[var(--og-text)]" : "",
                disabled ? "cursor-default" : "",
                !selected && !disabled ? "hover:bg-[var(--og-surface-alt)]" : "",
                isToday && !selected
                  ? "ring-1 ring-inset ring-[var(--og-forest)] rounded-[var(--og-r-sm)]"
                  : "",
              ].join(" ")}
              style={
                selected && isEdge ? { background: "var(--og-gradient-brand)" } : undefined
              }
            >
              <span className={isToday ? "font-bold" : undefined}>{num}</span>
              {!selected && <Marker state={day.state} />}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--og-border)] pt-3.5 text-[11.5px] text-[var(--og-text-muted)]">
        <Key state="scheduled" label="Coming" />
        <Key state="delivered" label="Delivered" />
        <Key state="skipped" label="Skipped" />
        <Key state="paused" label="Paused" />
        <Key state="closed" label="Kitchen closed" />
      </ul>
    </div>
  );
}

/** The key reuses the exact marker from the grid, so they can never drift. */
function Key({ state, label }: { state: DayState; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="flex h-3.5 w-3.5 items-center justify-center [&>span]:mt-0" aria-hidden="true">
        <Marker state={state} />
      </span>
      {label}
    </li>
  );
}
