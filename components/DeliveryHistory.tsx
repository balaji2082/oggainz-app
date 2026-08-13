"use client";

import { useMemo, useState } from "react";

import { longDate, shortDate } from "@/lib/format";
import type { Meal, Pack } from "@/lib/types";
import { Empty } from "./Bits";
import PackSwitcher from "./PackSwitcher";

/**
 * Every day this pack has actually had, one row each.
 *
 * The receipt. "Twelve of twenty used" is a number a customer has to trust;
 * this is the working behind it, and it is the screen that answers "did you
 * actually deliver on the 4th?" without anyone having to open WhatsApp.
 *
 * Switchable across every pack the customer has ever held, finished ones
 * included — a completed pack's history is exactly the history most worth
 * keeping, and it was previously unreachable once the pack ended.
 */

interface Props {
  packs: Pack[];
  meals: (Meal & { expected?: boolean })[];
  todayISO: string;
}

const STATE: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  Delivered: { label: "Delivered", dot: "var(--og-green)", text: "var(--og-text)" },
  Skipped: { label: "Skipped", dot: "var(--og-orange)", text: "var(--og-text-muted)" },
  Paused: { label: "Paused", dot: "var(--og-text-muted)", text: "var(--og-text-muted)" },
  Pending: { label: "Coming", dot: "var(--og-forest)", text: "var(--og-text)" },
  Off: { label: "Not sent", dot: "var(--og-border)", text: "var(--og-text-muted)" },
};

export default function DeliveryHistory({ packs, meals, todayISO }: Props) {
  const ordered = useMemo(() => {
    // Live packs first, then most recent — the one you are most likely to want
    // is the one you are on, and the one you just finished after that.
    const rank = (p: Pack) =>
      p.status === "Completed" || p.status === "Expired" ? 1 : 0;
    return [...packs].sort(
      (a, b) => rank(a) - rank(b) || (b.startDate ?? "").localeCompare(a.startDate ?? "")
    );
  }, [packs]);

  const [packId, setPackId] = useState(() => ordered[0]?.id ?? "");
  const pack = ordered.find((p) => p.id === packId) ?? ordered[0];
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    if (!pack) return [];
    return meals
      .filter((m) => m.packId === pack.id && m.date <= todayISO && !m.expected)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [meals, pack, todayISO]);

  const shown = showAll ? rows : rows.slice(0, 10);

  if (ordered.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-[12.5px] font-semibold uppercase tracking-[0.13em] text-[var(--og-text-muted)]">
        Delivery record
      </h2>

      {ordered.length > 1 && (
        <PackSwitcher packs={ordered} activeId={pack?.id ?? ""} onPick={(id) => {
          setPackId(id);
          setShowAll(false);
        }} />
      )}

      {rows.length === 0 ? (
        <Empty
          title="Nothing yet"
          body="Every delivered, skipped and paused day will be listed here."
        />
      ) : (
        <>
          <ul className="overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
            {shown.map((m, i) => {
              const s = STATE[m.status] ?? STATE.Pending;
              return (
                <li
                  key={`${m.date}-${m.slot}-${i}`}
                  className={
                    i > 0
                      ? "flex items-center gap-3 border-t border-[var(--og-border)] px-4 py-3"
                      : "flex items-center gap-3 px-4 py-3"
                  }
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s.dot }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium" style={{ color: s.text }}>
                      {longDate(m.date)}
                    </p>
                    <p className="text-[12px] text-[var(--og-text-muted)]">
                      {m.slot}
                      {m.planName ? ` · ${m.planName}` : ""}
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

          {rows.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="og-press mt-3 w-full rounded-[var(--og-r-md)] border border-[var(--og-border)] bg-[var(--og-surface)] px-4 py-3 text-[13px] font-semibold text-[var(--og-forest)]"
            >
              {showAll ? "Show less" : `Show all ${rows.length} days`}
            </button>
          )}

          <p className="mt-2.5 px-1 text-[11.5px] text-[var(--og-text-muted)]">
            {pack?.delivered ?? 0} delivered
            {(pack?.skipped ?? 0) > 0 ? ` · ${pack?.skipped} skipped, carried forward` : ""}
            {pack?.startDate ? ` · since ${shortDate(pack.startDate)}` : ""}
          </p>
        </>
      )}
    </section>
  );
}
