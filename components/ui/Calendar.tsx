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
                selected
                  ? isEdge
                    ? "rounded-[var(--og-r-sm)] bg-[var(--og-forest)] text-white shadow-[var(--og-e2)]"
                    : "bg-[color-mix(in_srgb,var(--og-green)_20%,transparent)] text-[var(--og-forest)]"
                  : "rounded-[var(--og-r-sm)]",
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
            >
              <span className={isToday ? "font-bold" : undefined}>{num}</span>

              {/* The state marker. A shape as well as a colour, always. */}
              {!selected && day.state === "closed" && (
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-[2px] w-2.5 rounded-full bg-[var(--og-border)]"
                />
              )}
              {!selected && day.state === "delivered" && (
                <span aria-hidden="true" className="mt-0.5 text-[var(--og-green)]">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5.5 5.5L20 7" />
                  </svg>
                </span>
              )}
              {!selected && day.state === "scheduled" && (
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-1.5 w-1.5 rounded-full bg-[var(--og-forest)]"
                />
              )}
              {!selected && day.state === "skipped" && (
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-[2px] w-2.5 rounded-full bg-[var(--og-orange)]"
                />
              )}
              {!selected && day.state === "paused" && (
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex gap-[2px] text-[var(--og-text-muted)]"
                >
                  <i className="block h-2 w-[2px] rounded-full bg-current" />
                  <i className="block h-2 w-[2px] rounded-full bg-current" />
                </span>
              )}
              {!selected && day.state === "requested" && (
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-1.5 w-1.5 rounded-full border border-[var(--og-orange)]"
                />
              )}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-[var(--og-text-muted)]">
        <Key swatch={<i className="h-1.5 w-1.5 rounded-full bg-[var(--og-forest)]" />} label="Coming" />
        <Key
          swatch={
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--og-green)"
                 strokeWidth="4" strokeLinecap="round"><path d="M4 12.5l5.5 5.5L20 7" /></svg>
          }
          label="Delivered"
        />
        <Key swatch={<i className="h-[2px] w-2.5 rounded-full bg-[var(--og-orange)]" />} label="Skipped" />
        <Key
          swatch={
            <span className="flex gap-[2px]">
              <i className="block h-2 w-[2px] rounded-full bg-[var(--og-text-muted)]" />
              <i className="block h-2 w-[2px] rounded-full bg-[var(--og-text-muted)]" />
            </span>
          }
          label="Paused"
        />
        <Key swatch={<i className="h-[2px] w-2.5 rounded-full bg-[var(--og-border)]" />} label="Kitchen closed" />
      </ul>
    </div>
  );
}

function Key({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="flex h-3 w-3 items-center justify-center" aria-hidden="true">
        {swatch}
      </span>
      {label}
    </li>
  );
}
