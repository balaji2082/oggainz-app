import type { Pack } from "@/lib/types";
import { longDate } from "@/lib/format";

/**
 * Meals remaining, shown as a bar. The carry-forward promise is repeated here
 * deliberately (docs/02 §7.4) — it is the fact that builds trust and customers
 * do not assume it.
 */
export default function PackCard({ pack }: { pack: Pack }) {
  const total = pack.mealsTotal || 1;
  const done = Math.min(pack.delivered, total);
  const pct = Math.round((done / total) * 100);

  return (
    <article className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5 shadow-[var(--og-shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[16px] font-semibold leading-tight text-[var(--og-forest)]">
            {pack.planName}
          </h3>
          <p className="mt-0.5 text-[12px] text-[var(--og-text-muted)]">
            {pack.duration ?? "Pack"} · {pack.slot}
            {pack.startDate ? ` · from ${longDate(pack.startDate)}` : ""}
          </p>
        </div>
        {pack.pausedToday ? (
          <span className="shrink-0 rounded-full bg-[var(--og-orange)]/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--og-orange)]">
            Paused
          </span>
        ) : pack.status === "Ending Soon" ? (
          <span className="shrink-0 rounded-full bg-[var(--og-orange)]/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--og-orange)]">
            Ending soon
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-[var(--og-green)]/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--og-green)]">
            Active
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-[30px] font-bold leading-none text-[var(--og-forest)]">
          {pack.remaining}
        </span>
        <span className="text-[13px] text-[var(--og-text-muted)]">
          meal{pack.remaining === 1 ? "" : "s"} left of {pack.mealsTotal}
        </span>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--og-mist)]"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${done} of ${total} meals delivered`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: "var(--og-gradient-brand)" }}
        />
      </div>

      {pack.skipped > 0 && (
        <p className="mt-3 text-[12px] leading-5 text-[var(--og-text-muted)]">
          {pack.skipped} skipped {pack.skipped === 1 ? "meal has" : "meals have"}{" "}
          moved to the end of your pack — you don&rsquo;t lose them.
        </p>
      )}
    </article>
  );
}
