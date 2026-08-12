import type { Feedback } from "@/lib/feedback";
import { tagLabel } from "@/lib/feedback";
import { shortDate } from "@/lib/format";

/**
 * What came back about the last few weeks of food, newest first.
 *
 * Read-only by design — this is the view that turns "one person said too
 * spicy" (taste) into "six people said it this fortnight" (a recipe problem).
 */
export default function FeedbackStream({
  items,
  tally,
}: {
  items: Feedback[];
  tally: { tag: string; n: number }[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-4 text-[13.5px] text-[var(--og-text-muted)]">
        No feedback yet.
      </p>
    );
  }

  return (
    <div>
      {tally.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {tally.slice(0, 6).map((t) => (
            <span
              key={t.tag}
              className="rounded-[var(--og-r-pill)] bg-[var(--og-surface-alt)] px-3 py-1.5 text-[12px] font-semibold text-[var(--og-text-muted)]"
            >
              {tagLabel(t.tag)} · {t.n}
            </span>
          ))}
        </div>
      )}
      <ul className="space-y-2.5">
        {items.slice(0, 30).map((f) => (
          <li
            key={`${f.customerId}-${f.date}-${f.slot}`}
            className="rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-3.5 shadow-[var(--og-e1)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-[var(--og-text)]">
                {f.customerName ?? f.customerId} · {shortDate(f.date)} {f.slot}
              </p>
              {f.rating && (
                <span className="shrink-0 text-[11.5px] font-semibold text-[var(--og-orange)]">
                  {f.rating}★
                </span>
              )}
            </div>
            {f.tags.length > 0 && (
              <p className="mt-1 text-[12px] text-[var(--og-text-muted)]">
                {f.tags.map((t) => tagLabel(t)).join(" · ")}
              </p>
            )}
            {f.comment && (
              <p className="mt-1 text-[12.5px] leading-5 text-[var(--og-text)]">
                &ldquo;{f.comment}&rdquo;
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
