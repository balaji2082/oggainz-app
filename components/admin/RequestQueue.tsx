"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { decide } from "@/app/actions/admin";
import type { QueuedRequest } from "@/lib/writes";
import { useToast } from "../ui/Toast";

/**
 * Balaji's request queue — docs/02 §8.2.
 *
 * The whole purpose: he sees the pattern WHILE deciding, not a month later.
 * [RULE] The history is information, not a verdict — nothing here auto-declines
 * or recommends declining. Ashok might be having a genuinely chaotic month and
 * still be the best customer in the business.
 */
export default function RequestQueue({ requests }: { requests: QueuedRequest[] }) {
  if (requests.length === 0) {
    return (
      <p className="rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-4 text-[13.5px] text-[var(--og-text-muted)]">
        No requests waiting.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <Row key={r.id} r={r} />
      ))}
    </ul>
  );
}

function Row({ r }: { r: QueuedRequest }) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const what =
    r.kind === "pause"
      ? `pause ${r.startDate} → ${r.endDate}`
      : r.kind === "resume"
        ? `resume from ${r.targetDate}`
        : r.kind === "undo"
          ? `undo skip ${r.targetDate}`
          : `skip ${r.targetDate}`;

  function act(outcome: "allowed" | "declined") {
    startTransition(async () => {
      const result = await decide(r.id, outcome, reason);
      toast(result.message, result.ok ? "good" : "bad");
      if (result.ok) router.refresh();
    });
  }

  return (
    <li className="rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-4 shadow-[var(--og-e1)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[14.5px] font-semibold text-[var(--og-text)]">
            {r.customerName ?? r.customerId} · {what}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--og-text-muted)]">
            {Math.floor(r.minutesLate / 60)}h {r.minutesLate % 60}m after cutoff
          </p>
        </div>
      </div>

      {r.history.lateThisMonth > 1 && (
        <p className="mt-2 rounded-[var(--og-r-sm)] bg-[color-mix(in_srgb,var(--og-orange)_10%,transparent)] px-3 py-2 text-[12px] leading-5 text-[var(--og-orange)]">
          {r.history.lateThisMonth} late request{r.history.lateThisMonth === 1 ? "" : "s"} this month
          · {r.history.allowed} allowed · {r.history.declined} declined all time
        </p>
      )}

      {r.reason && (
        <p className="mt-2 text-[13px] italic leading-5 text-[var(--og-text-muted)]">
          &ldquo;{r.reason}&rdquo;
        </p>
      )}

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason if declining (they'll see it)"
        className="mt-3 w-full rounded-[var(--og-r-sm)] border border-[var(--og-border)] px-3 py-2 text-[13px] outline-none placeholder:text-[var(--og-text-muted)] focus:border-[var(--og-green)]"
      />

      <div className="mt-2.5 flex gap-2">
        <button
          disabled={pending}
          onClick={() => act("allowed")}
          className="og-press flex-1 rounded-[var(--og-r-sm)] bg-[var(--og-forest)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          Allow
        </button>
        <button
          disabled={pending}
          onClick={() => act("declined")}
          className="og-press flex-1 rounded-[var(--og-r-sm)] border border-[var(--og-border)] px-4 py-2.5 text-[13px] font-semibold text-[var(--og-text-muted)] disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </li>
  );
}
