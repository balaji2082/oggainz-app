import { longDate } from "@/lib/format";
import type { QueuedRequest } from "@/lib/writes";

/**
 * What customers have actually been doing.
 *
 * Balaji's question, and a fair one: "if a client skips or pauses, how do I
 * see it?" The pending queue does not answer that — a skip made before the
 * deadline is applied automatically and never queues, which is the whole point
 * of the deadline. So it looked like nothing had happened.
 *
 * Every action is written to `skip_requests` whether it needed a decision or
 * not (docs/03 §2.2), so this is the complete record, newest first.
 */

const KIND: Record<string, string> = {
  skip: "skipped",
  pause: "paused",
  resume: "restarted",
  undo: "un-skipped",
};

const OUTCOME: Record<string, { label: string; tone: string }> = {
  auto_applied: { label: "Applied automatically", tone: "var(--og-green)" },
  allowed: { label: "You allowed it", tone: "var(--og-green)" },
  pending: { label: "Waiting on you", tone: "var(--og-orange)" },
  declined: { label: "You declined", tone: "var(--og-text-muted)" },
  partial: { label: "Partly applied", tone: "var(--og-orange)" },
};

function when(r: QueuedRequest): string {
  if (r.kind === "pause" && r.startDate && r.endDate) {
    return r.startDate === r.endDate
      ? longDate(r.startDate)
      : `${longDate(r.startDate)} → ${longDate(r.endDate)}`;
  }
  return r.targetDate ? longDate(r.targetDate) : "—";
}

export default function ActivityFeed({ activity }: { activity: QueuedRequest[] }) {
  if (activity.length === 0) {
    return (
      <p className="rounded-[var(--og-r-lg)] border border-dashed border-[var(--og-border)] px-5 py-8 text-center text-[13.5px] text-[var(--og-text-muted)]">
        Nothing yet. Every skip, pause and restart a customer makes will appear
        here — including the ones applied automatically before the deadline.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
      {activity.map((r, i) => {
        const o = OUTCOME[r.outcome] ?? OUTCOME.pending;
        return (
          <li
            key={r.id}
            className={
              i > 0
                ? "flex items-start gap-3 border-t border-[var(--og-border)] px-4 py-3"
                : "flex items-start gap-3 px-4 py-3"
            }
          >
            <span
              aria-hidden="true"
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: o.tone }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-[var(--og-text)]">
                <span className="font-semibold">
                  {r.customerName ?? r.customerId}
                </span>{" "}
                {KIND[r.kind] ?? r.kind} {when(r)}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--og-text-muted)]">
                {o.label}
                {r.minutesLate > 0 && ` · ${Math.floor(r.minutesLate / 60)}h ${r.minutesLate % 60}m after the deadline`}
                {` · ${r.requestedAt.slice(0, 16).replace("T", " ")}`}
              </p>
              {r.reason && (
                <p className="mt-1 text-[12.5px] italic text-[var(--og-text-muted)]">
                  &ldquo;{r.reason}&rdquo;
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
