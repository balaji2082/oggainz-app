"use client";

import type { Pack } from "@/lib/types";

/**
 * Choosing which pack you are looking at.
 *
 * Only rendered when a customer holds more than one — which is not the rare
 * case it sounds like: Ashok has a protein shake subscription alongside his
 * meal pack, and before this existed the whole calendar silently showed one of
 * them with no way to tell which, and no way to reach the other.
 *
 * A row of chips rather than a dropdown: with two or three packs every option
 * is visible without a tap, and which one is selected is readable at a glance
 * instead of being hidden behind a closed control.
 */
export default function PackSwitcher({
  packs,
  activeId,
  onPick,
}: {
  packs: Pack[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="og-scroll-x -mx-5 mb-4 px-5">
      <div
        role="tablist"
        aria-label="Your packs"
        className="flex gap-2"
      >
        {packs.map((p) => {
          const on = p.id === activeId;
          const finished = p.status === "Completed" || p.status === "Expired";
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={on}
              onClick={() => onPick(p.id)}
              className={[
                "og-press shrink-0 whitespace-nowrap rounded-[var(--og-r-pill)] px-3.5 py-2",
                "text-[13px] font-semibold",
                "scroll-snap-align-start",
                on
                  ? "bg-[var(--og-forest)] text-white shadow-[var(--og-e2)]"
                  : "bg-[var(--og-surface)] text-[var(--og-text-muted)] ring-1 ring-[var(--og-border)]",
              ].join(" ")}
            >
              {p.planName}
              {/* A finished pack is still worth opening for its history, but it
                  must not look like something you can still act on. */}
              {finished && (
                <span className={on ? "ml-1.5 opacity-70" : "ml-1.5 opacity-60"}>· done</span>
              )}
              {p.status === "Paused" && (
                <span className={on ? "ml-1.5 opacity-70" : "ml-1.5 opacity-60"}>· paused</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
