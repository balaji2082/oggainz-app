"use client";

import { useMemo, useState } from "react";

import { longDate, shortDate } from "@/lib/format";
import type { Meal, Pack } from "@/lib/types";
import { Empty, Pill } from "./Bits";
import Sheet from "./ui/Sheet";

/**
 * The receipt: every day a pack has actually had.
 *
 * Two levels on purpose. The first is a LIST of subscriptions, current and
 * finished — because "which pack?" is the question you ask before "which day?",
 * and a row of chips across the top made the finished ones feel like a setting
 * rather than a thing you open. Tapping one opens its full record, filterable.
 *
 * "Twelve of twenty used" is a number the customer has to take on trust; this
 * is the working behind it, and it is what answers "did you actually deliver on
 * the 4th?" without anyone opening WhatsApp.
 */

interface Props {
  packs: Pack[];
  meals: (Meal & { expected?: boolean })[];
  todayISO: string;
}

type Filter = "all" | "Delivered" | "Skipped" | "Paused";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "Delivered", label: "Delivered" },
  { value: "Skipped", label: "Skipped" },
  { value: "Paused", label: "Paused" },
];

const STATE: Record<string, { label: string; dot: string; muted: boolean }> = {
  Delivered: { label: "Delivered", dot: "var(--og-green)", muted: false },
  Skipped: { label: "Skipped", dot: "var(--og-orange)", muted: true },
  Paused: { label: "Paused", dot: "var(--og-text-muted)", muted: true },
  Pending: { label: "Coming", dot: "var(--og-forest)", muted: false },
  Off: { label: "Not sent", dot: "var(--og-border)", muted: true },
};

const LIVE = ["Active", "Ending Soon", "Paused"];

export default function DeliveryHistory({ packs, meals, todayISO }: Props) {
  const [openPack, setOpenPack] = useState<Pack | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const ordered = useMemo(() => {
    // Running packs first, then the most recently started — the one you are on
    // is the one you are most likely to want.
    const rank = (p: Pack) => (LIVE.includes(p.status) ? 0 : 1);
    return [...packs].sort(
      (a, b) => rank(a) - rank(b) || (b.startDate ?? "").localeCompare(a.startDate ?? "")
    );
  }, [packs]);

  /** Past and present only — a forecast is not a record. */
  const recordFor = useMemo(() => {
    const by: Record<string, (Meal & { expected?: boolean })[]> = {};
    for (const m of meals) {
      if (!m.packId || m.expected || m.date > todayISO) continue;
      (by[m.packId] ??= []).push(m);
    }
    for (const list of Object.values(by)) list.sort((a, b) => b.date.localeCompare(a.date));
    return by;
  }, [meals, todayISO]);

  const rows = openPack ? (recordFor[openPack.id] ?? []) : [];
  const shown = filter === "all" ? rows : rows.filter((m) => m.status === filter);

  if (ordered.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-[12.5px] font-semibold uppercase tracking-[0.13em] text-[var(--og-text-muted)]">
        Order history
      </h2>

      <ul className="overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
        {ordered.map((p, i) => {
          const count = (recordFor[p.id] ?? []).length;
          const live = LIVE.includes(p.status);
          return (
            <li key={p.id} className={i > 0 ? "border-t border-[var(--og-border)]" : ""}>
              <button
                type="button"
                onClick={() => {
                  setOpenPack(p);
                  setFilter("all");
                }}
                className="og-press flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-medium text-[var(--og-text)]">
                    {p.planName}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--og-text-muted)]">
                    {p.startDate ? `From ${shortDate(p.startDate)}` : "—"} ·{" "}
                    {p.delivered} of {p.mealsTotal} delivered
                    {count > 0 ? ` · ${count} day${count === 1 ? "" : "s"} on record` : ""}
                  </p>
                </div>
                {live ? <Pill tone="good">Current</Pill> : <Pill tone="quiet">Finished</Pill>}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="var(--og-text-muted)" strokeWidth="2" strokeLinecap="round"
                     strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet
        open={openPack !== null}
        onClose={() => setOpenPack(null)}
        title={openPack?.planName ?? "Record"}
        subtitle={
          openPack
            ? `${openPack.delivered} of ${openPack.mealsTotal} delivered${
                openPack.skipped > 0 ? ` · ${openPack.skipped} skipped, carried forward` : ""
              }`
            : undefined
        }
      >
        {/* The filter Balaji asked for: see only the days food actually came. */}
        <div className="og-scroll-x -mx-1 mb-4 px-1">
          <div className="flex gap-2">
            {FILTERS.map((f) => {
              const n =
                f.value === "all"
                  ? rows.length
                  : rows.filter((m) => m.status === f.value).length;
              const on = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  aria-pressed={on}
                  disabled={n === 0 && f.value !== "all"}
                  className={[
                    "og-press shrink-0 whitespace-nowrap rounded-[var(--og-r-pill)] px-3.5 py-2 text-[12.5px] font-semibold",
                    on
                      ? "bg-[var(--og-forest)] text-white"
                      : "bg-[var(--og-surface)] text-[var(--og-text-muted)] ring-1 ring-[var(--og-border)]",
                    n === 0 && f.value !== "all" ? "opacity-40" : "",
                  ].join(" ")}
                >
                  {f.label}
                  <span className={on ? "ml-1.5 opacity-75" : "ml-1.5 opacity-60"}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {shown.length === 0 ? (
          <Empty
            title="Nothing here"
            body={
              filter === "all"
                ? "This pack has no delivery days on record yet."
                : "No days match that filter."
            }
          />
        ) : (
          <ul className="pb-3">
            {shown.map((m, i) => {
              const s = STATE[m.status] ?? STATE.Pending;
              return (
                <li
                  key={`${m.date}-${m.slot}-${i}`}
                  className="flex items-center gap-3 border-b border-[var(--og-border)] py-3 last:border-0"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s.dot }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[14px] font-medium"
                      style={{ color: s.muted ? "var(--og-text-muted)" : "var(--og-text)" }}
                    >
                      {longDate(m.date)}
                    </p>
                    <p className="text-[12px] text-[var(--og-text-muted)]">
                      {m.slot}
                      {m.dayNote ? ` · ${m.dayNote}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11.5px] font-semibold text-[var(--og-text-muted)]">
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </section>
  );
}
