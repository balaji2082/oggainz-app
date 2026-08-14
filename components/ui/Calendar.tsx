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
  /**
   * `full` gives the grid the whole screen: taller cells, bigger numerals,
   * bigger markers. The compact grid was legible but cramped — 42px cells with
   * a 9px icon under a 14px numeral is a lot of meaning in very little space,
   * and it read as clumsy rather than dense.
   */
  size?: "compact" | "full";
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * How each state looks.
 *
 * The month reads as a heat-map: the TILE carries the meaning and the numeral
 * stays the biggest thing in the cell. The previous version stacked a small
 * icon underneath the numeral inside a 42px box, and that is what made the grid
 * feel cramped — two things competing for the same middle.
 *
 * [LAW] docs/02 §7.5 — never colour alone. Delivered carries a tick, skipped
 * strikes the numeral through, paused carries bars, a request carries a clock,
 * and a closed day has no tile at all. Every state survives greyscale.
 */
const Tick = (big: boolean) => (
  <svg width={big ? 11 : 9} height={big ? 11 : 9} viewBox="0 0 24 24" fill="none"
       stroke="var(--og-green)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5.5 5.5L20 7" />
  </svg>
);

const Bars = (big: boolean) => (
  <svg width={big ? 9 : 7} height={big ? 9 : 7} viewBox="0 0 24 24" fill="var(--og-text-muted)">
    <rect x="5" y="3" width="5.5" height="18" rx="2.4" />
    <rect x="13.5" y="3" width="5.5" height="18" rx="2.4" />
  </svg>
);

const Clock = (big: boolean) => (
  <svg width={big ? 11 : 9} height={big ? 11 : 9} viewBox="0 0 24 24" fill="none"
       stroke="var(--og-orange)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 1.9" />
  </svg>
);

interface Tile {
  tile: string;
  text: string;
  badge?: (big: boolean) => React.ReactNode;
}

const TILE: Record<DayState, Tile> = {
  delivered: {
    tile: "bg-[color-mix(in_srgb,var(--og-green)_15%,transparent)]",
    text: "text-[var(--og-on-green)]",
    badge: Tick,
  },
  scheduled: {
    tile: "bg-[var(--og-surface)] ring-1 ring-inset ring-[var(--og-border)]",
    text: "text-[var(--og-text)]",
  },
  skipped: {
    tile: "bg-[color-mix(in_srgb,var(--og-orange)_13%,transparent)]",
    text: "text-[var(--og-on-orange)]",
  },
  paused: {
    tile: "bg-[var(--og-surface-alt)]",
    text: "text-[var(--og-text-muted)]",
    badge: Bars,
  },
  requested: {
    tile: "bg-[color-mix(in_srgb,var(--og-orange)_9%,transparent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--og-orange)_35%,transparent)]",
    text: "text-[var(--og-on-orange)]",
    badge: Clock,
  },
  // A closed day gets no tile at all. That is the clearest way to say there is
  // nothing here — quieter than any shade of grey.
  closed: {
    tile: "bg-transparent",
    text: "text-[color-mix(in_srgb,var(--og-text-muted)_45%,transparent)]",
  },
  none: {
    tile: "bg-transparent",
    text: "text-[color-mix(in_srgb,var(--og-text-muted)_60%,transparent)]",
  },
};

const LABEL: Record<DayState, string> = {
  delivered: "delivered",
  scheduled: "meal coming",
  skipped: "skipped",
  paused: "paused",
  requested: "waiting on us",
  closed: "kitchen closed",
  none: "nothing scheduled",
};

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
  size = "compact",
}: Props) {
  const full = size === "full";
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
          className={`font-display font-semibold tracking-[-0.01em] text-[var(--og-forest)] ${full ? "text-[18px]" : "text-[15.5px]"}`}
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

      <div className={`mb-1 grid grid-cols-7 ${full ? "gap-1.5" : "gap-1"}`}>
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={`text-center font-semibold uppercase tracking-[0.08em] text-[var(--og-text-muted)] ${full ? "py-2 text-[12px]" : "py-1 text-[11px]"}`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${full ? "gap-1.5" : "gap-1"}`}>
        {grid.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;

          const day = days[date] ?? { state: "none" as DayState };
          const isToday = date === todayISO;
          const selected = mode === "range" && inRange(date);
          const isEdge = date === start || date === end;
          const disabled = mode === "range" && !selectable(date, day);
          const num = Number(date.slice(8, 10));
          const t = TILE[day.state];

          // Range selection overrides the day's own colour: while you are
          // choosing a stretch, what matters is the stretch.
          const roundedEdge =
            date === start && date === end
              ? "rounded-[var(--og-r-md)]"
              : date === start
                ? "rounded-l-[var(--og-r-md)]"
                : date === end
                  ? "rounded-r-[var(--og-r-md)]"
                  : "";

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => handle(date, day)}
              aria-label={`${num} ${monthLabel}, ${LABEL[day.state]}`}
              aria-pressed={mode === "range" ? selected : undefined}
              className={[
                "og-press relative flex aspect-square items-center justify-center",
                full ? "min-h-[52px]" : "min-h-[40px]",
                selected
                  ? isEdge
                    ? `text-white shadow-[var(--og-e2)] ${roundedEdge}`
                    : "bg-[color-mix(in_srgb,var(--og-green)_16%,transparent)] text-[var(--og-forest)]"
                  : `rounded-[var(--og-r-md)] ${t.tile}`,
                disabled ? "cursor-default opacity-70" : "",
                !selected && !disabled && day.state !== "closed"
                  ? "hover:brightness-[0.97]"
                  : "",
              ].join(" ")}
              style={selected && isEdge ? { background: "var(--og-gradient-brand)" } : undefined}
            >
              {/* Today is a ring around the tile, not a colour — so it can sit
                  on top of any state without arguing with it. */}
              {isToday && !selected && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[var(--og-r-md)] ring-2 ring-[var(--og-primary)]"
                />
              )}

              <span
                className={[
                  full ? "text-[16px]" : "text-[13.5px]",
                  isToday && !selected ? "font-bold" : "font-medium",
                  selected ? "" : t.text,
                  // A struck numeral says "not happening" without needing a key.
                  day.state === "skipped" && !selected ? "line-through decoration-[1.5px]" : "",
                ].join(" ")}
              >
                {num}
              </span>

              {/* A small corner badge rather than an icon stacked underneath.
                  Underneath, it competed with the numeral for the middle of a
                  40px box and made the whole grid feel cramped. */}
              {!selected && t.badge && (
                <span
                  aria-hidden="true"
                  className={`absolute ${full ? "bottom-1 right-1" : "bottom-0.5 right-0.5"}`}
                >
                  {t.badge(full)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2.5 border-t border-[var(--og-border)] pt-4 text-[11.5px] text-[var(--og-text-muted)]">
        <Key state="scheduled" label="Coming" />
        <Key state="delivered" label="Delivered" />
        <Key state="skipped" label="Skipped" />
        <Key state="paused" label="Paused" />
        <Key state="closed" label="Kitchen closed" />
      </ul>
    </div>
  );
}

/** A miniature of the real tile, so the key and the grid can never drift. */
function Key({ state, label }: { state: DayState; label: string }) {
  const t = TILE[state];
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded-[5px] ${t.tile}`}
      >
        <span className={`text-[8px] font-bold ${t.text} ${state === "skipped" ? "line-through" : ""}`}>
          {state === "closed" ? "" : "1"}
        </span>
      </span>
      {label}
    </li>
  );
}
