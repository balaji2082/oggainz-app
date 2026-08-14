"use client";

import { useMemo, useState } from "react";

import Icon from "./Icon";

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

interface Tile {
  tile: string;
  text: string;
  /**
   * The mark under the numeral — fill and colour ONLY, never width.
   *
   * Width is a separate flag because the key renders the same marks at a
   * smaller size, and packing `w-3.5` in here meant the key had to override it
   * with an `!important` utility. Tailwind v4 moved that syntax from `!w-1` to
   * `w-1!`, so the prefix form silently did nothing — a bug that would have
   * shipped looking almost right. Keeping the two concerns apart means neither
   * place has to fight the other.
   */
  mark?: string;
  /** Paused spans days, so its mark spans too. */
  wide?: boolean;
}

/**
 * How each state looks — and what the redesign was fixing.
 *
 * The old grid hung a different little icon in the bottom-right CORNER of every
 * cell: a tick, two bars, a clock, each drawn at its own stroke weight. On a
 * phone that is a 10px glyph crammed into a rounded corner, and five of them in
 * one week turned the month into confetti — the eye had to READ the calendar
 * rather than see it.
 *
 * Now the tile carries the state and every state gets the SAME mark: one shape,
 * centred under the numeral, same size, same position, differing only in colour
 * and fill. The month reads as a rhythm; a single day still reads exactly when
 * you look straight at it.
 *
 * [LAW] docs/02 §7.5 — never colour alone, and this still keeps it. Delivered is
 * solid, coming is a hollow ring, skipped is solid AND strikes the numeral
 * through, paused is a wide bar (it is a stretch, not a day), waiting is a
 * hollow ring in orange, closed has no tile at all. Every state is told apart by
 * shape and fill in greyscale, not by hue.
 */
const TILE: Record<DayState, Tile> = {
  delivered: {
    tile: "bg-[color-mix(in_srgb,var(--og-green)_16%,transparent)]",
    text: "text-[var(--og-on-green)]",
    mark: "bg-[var(--og-green)]",
  },
  scheduled: {
    // A hairline, not a filled card. Most of a month is scheduled days, and
    // giving each one its own surface made the grid a wall of buttons.
    tile: "ring-1 ring-inset ring-[var(--og-border)]",
    text: "text-[var(--og-text)]",
    mark: "ring-[1.5px] ring-inset ring-[var(--og-text-muted)] opacity-60",
  },
  skipped: {
    tile: "bg-[color-mix(in_srgb,var(--og-orange)_15%,transparent)]",
    text: "text-[var(--og-on-orange)]",
    mark: "bg-[var(--og-orange)]",
  },
  paused: {
    tile: "bg-[var(--og-surface-alt)]",
    text: "text-[var(--og-text-muted)]",
    mark: "bg-[var(--og-text-muted)] opacity-70",
    wide: true,
  },
  requested: {
    tile: "bg-[color-mix(in_srgb,var(--og-orange)_10%,transparent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--og-orange)_40%,transparent)]",
    text: "text-[var(--og-on-orange)]",
    mark: "ring-[1.5px] ring-inset ring-[var(--og-orange)]",
  },
  // A closed day gets no tile at all. That is the clearest way to say there is
  // nothing here — quieter than any shade of grey.
  closed: {
    tile: "bg-transparent",
    text: "text-[color-mix(in_srgb,var(--og-text-muted)_42%,transparent)]",
  },
  none: {
    tile: "bg-transparent",
    text: "text-[color-mix(in_srgb,var(--og-text-muted)_55%,transparent)]",
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

  const [todayYear, todayMonth] = [
    Number(todayISO.slice(0, 4)),
    Number(todayISO.slice(5, 7)) - 1,
  ];
  const showingToday =
    cursor.getFullYear() === todayYear && cursor.getMonth() === todayMonth;

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
      <div className="mb-3 flex items-center justify-between gap-2">
        {/* Month and year on two lines, left-aligned. Centred between two arrows
            it read as a widget; left-aligned with the year quiet underneath it
            reads as a heading, which is what it is. */}
        <div className="min-w-0">
          <p
            aria-live="polite"
            className={`font-display font-semibold leading-none tracking-[-0.02em] text-[var(--og-heading)] ${full ? "text-[20px]" : "text-[16px]"}`}
          >
            {cursor.toLocaleString("en-IN", { month: "long" })}
          </p>
          <p className="og-tabular mt-1 text-[12px] font-medium leading-none text-[var(--og-text-muted)]">
            {cursor.getFullYear()}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {/* Only when you have wandered off — a "Today" button on the month you
              are already looking at is a button that does nothing. */}
          {!showingToday && (
            <button
              type="button"
              onClick={() => setCursor(new Date(todayYear, todayMonth, 1))}
              className="og-press mr-1 rounded-[var(--og-r-pill)] bg-[var(--og-chip)] px-3 py-1.5 text-[12px] font-semibold text-[var(--og-primary)]"
            >
              Today
            </button>
          )}
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="og-press flex h-9 w-9 items-center justify-center rounded-full bg-[var(--og-surface-alt)] text-[var(--og-heading)]"
          >
            <Icon name="chevronLeft" size={17} weight={2.1} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="og-press flex h-9 w-9 items-center justify-center rounded-full bg-[var(--og-surface-alt)] text-[var(--og-heading)]"
          >
            <Icon name="chevronRight" size={17} weight={2.1} />
          </button>
        </div>
      </div>

      <div className={`mb-1.5 grid grid-cols-7 ${full ? "gap-1.5" : "gap-1"}`}>
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={[
              "text-center font-semibold uppercase tracking-[0.1em]",
              // Sat and Sun dimmer still: the kitchen is shut, and the header
              // saying so before you even reach the grid saves a second look.
              i >= 5 ? "text-[color-mix(in_srgb,var(--og-text-muted)_50%,transparent)]" : "text-[var(--og-text-muted)]",
              full ? "py-1.5 text-[11px]" : "py-1 text-[10.5px]",
            ].join(" ")}
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
                    : "bg-[color-mix(in_srgb,var(--og-green)_16%,transparent)] text-[var(--og-heading)]"
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

              {/* Numeral and mark stacked on one centre line, nudged up so the
                  pair sits optically centred rather than the numeral alone. */}
              <span className="flex flex-col items-center justify-center gap-[3px]">
                <span
                  className={[
                    "og-tabular leading-none",
                    full ? "text-[16px]" : "text-[13.5px]",
                    isToday && !selected ? "font-bold" : "font-medium",
                    selected ? "" : t.text,
                    // A struck numeral says "not happening" without needing a key.
                    day.state === "skipped" && !selected ? "line-through decoration-[1.5px]" : "",
                  ].join(" ")}
                >
                  {num}
                </span>

                {/* Always rendered, even where there is no mark — an empty box
                    of the same height keeps every numeral on the same baseline.
                    Without it, a delivered day's numeral sat 4px higher than a
                    closed one and the whole grid rippled. */}
                <span
                  aria-hidden="true"
                  className={
                    !selected && t.mark
                      ? `block h-1.5 rounded-full ${t.wide ? "w-3.5" : "w-1.5"} ${t.mark}`
                      : "block h-1.5 w-1.5"
                  }
                />
              </span>
            </button>
          );
        })}
      </div>

      {/* The key, as a quiet card rather than five items floating on the page.
          It is reference material — it should be findable, not loud. */}
      <ul className="mt-5 flex flex-wrap gap-x-3.5 gap-y-2.5 rounded-[var(--og-r-md)] bg-[var(--og-surface-alt)] px-3.5 py-3 text-[11.5px] text-[var(--og-text-muted)]">
        <Key state="scheduled" label="Coming" />
        <Key state="delivered" label="Delivered" />
        <Key state="skipped" label="Skipped" />
        <Key state="paused" label="Paused" />
        <Key state="closed" label="Closed" />
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
        className={`flex h-[18px] w-[18px] flex-col items-center justify-center gap-[2px] rounded-[6px] ${t.tile}`}
      >
        <span
          className={`text-[8px] font-bold leading-none ${t.text} ${state === "skipped" ? "line-through" : ""}`}
        >
          {state === "closed" ? "" : "1"}
        </span>
        {t.mark && (
          <span
            className={`block h-[3px] rounded-full ${t.wide ? "w-2.5" : "w-1"} ${t.mark}`}
          />
        )}
      </span>
      {label}
    </li>
  );
}
