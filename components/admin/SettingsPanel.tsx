"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setPackValidity, toggleValidityGlobal, updateSettings } from "@/app/actions/admin";
import type { ValidityRow } from "@/lib/writes";
import { useToast } from "../ui/Toast";

/**
 * The two things Balaji asked to control from his phone, 12 Aug 2026: the skip
 * deadline, and pack validity — a global switch plus a per-customer override
 * that always wins over it.
 */
export default function SettingsPanel({
  cutoff,
  validityGlobal,
  rows,
}: {
  cutoff: string;
  validityGlobal: boolean;
  rows: ValidityRow[];
}) {
  return (
    <div className="space-y-5">
      <CutoffCard cutoff={cutoff} />
      <ValidityCard enabled={validityGlobal} rows={rows} />
    </div>
  );
}

function CutoffCard({ cutoff }: { cutoff: string }) {
  const [value, setValue] = useState(cutoff);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const result = await updateSettings({ skip_cutoff_time: value });
      toast(result.message, result.ok ? "good" : "bad");
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-4 shadow-[var(--og-e1)]">
      <p className="font-display text-[14.5px] font-semibold text-[var(--og-heading)]">
        Skip deadline
      </p>
      <p className="mt-1 text-[12.5px] leading-5 text-[var(--og-text-muted)]">
        The one clock everything reads from — the countdown, every request, and
        the terms page.
      </p>
      <div className="mt-3 flex items-center gap-2.5">
        <input
          type="time"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-[var(--og-r-sm)] border border-[var(--og-border)] px-3 py-2 text-[14px] outline-none focus:border-[var(--og-green)]"
        />
        <button
          disabled={pending || value === cutoff}
          onClick={save}
          className="og-press rounded-[var(--og-r-sm)] bg-[var(--og-forest)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function ValidityCard({ enabled, rows }: { enabled: boolean; rows: ValidityRow[] }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function flip() {
    startTransition(async () => {
      const result = await toggleValidityGlobal(!enabled);
      toast(result.message, result.ok ? "good" : "bad");
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-4 shadow-[var(--og-e1)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[14.5px] font-semibold text-[var(--og-heading)]">
            Pack validity
          </p>
          <p className="mt-1 text-[12.5px] leading-5 text-[var(--og-text-muted)]">
            Off by default. On, every pack without its own decision expires on
            schedule — anything you&rsquo;ve set for one customer stays as you
            left it.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={flip}
          aria-pressed={enabled}
          aria-label="Toggle pack validity globally"
          className={`og-press relative h-7 w-12 shrink-0 rounded-[var(--og-r-pill)] transition-colors ${
            enabled ? "bg-[var(--og-green)]" : "bg-[var(--og-border)]"
          }`}
        >
          <span
            className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-[var(--og-e1)] transition-transform"
            style={{ transform: enabled ? "translateX(21px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      {rows.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-[var(--og-border)] pt-4">
          {rows
            .filter((r) => r.enforced || r.override)
            .map((r) => (
              <PackRow key={r.subscriptionId} row={r} />
            ))}
          {rows.filter((r) => r.enforced || r.override).length === 0 && (
            <p className="text-[12.5px] text-[var(--og-text-muted)]">
              No pack has its own decision yet.
            </p>
          )}
        </ul>
      )}

      <details className="mt-4 border-t border-[var(--og-border)] pt-3">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-[var(--og-heading)]">
          Set for one customer
        </summary>
        <PackEditor rows={rows} />
      </details>
    </div>
  );
}

function PackRow({ row }: { row: ValidityRow }) {
  return (
    <li className="flex items-center justify-between gap-2 text-[13px]">
      <span className="min-w-0 truncate text-[var(--og-text)]">
        {row.customerName ?? row.customerId} · {row.plan}
      </span>
      <span
        className={`shrink-0 text-[11.5px] font-semibold ${row.expired ? "text-[var(--og-danger)]" : "text-[var(--og-text-muted)]"}`}
      >
        {row.expired
          ? "Expired"
          : row.enforced
            ? `${row.daysLeft ?? "?"}d left`
            : "off"}
      </span>
    </li>
  );
}

function PackEditor({ rows }: { rows: ValidityRow[] }) {
  const [subId, setSubId] = useState("");
  const [override, setOverride] = useState<"on" | "off" | "">("");
  const [date, setDate] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function save() {
    if (!subId || !override) return;
    startTransition(async () => {
      const result = await setPackValidity(subId, override, { expiresOn: date || undefined });
      toast(result.message, result.ok ? "good" : "bad");
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2.5">
      <select
        value={subId}
        onChange={(e) => setSubId(e.target.value)}
        className="w-full rounded-[var(--og-r-sm)] border border-[var(--og-border)] px-3 py-2 text-[13px] outline-none"
      >
        <option value="">Pick a pack…</option>
        {rows.map((r) => (
          <option key={r.subscriptionId} value={r.subscriptionId}>
            {r.customerName ?? r.customerId} · {r.plan} ({r.subscriptionId})
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        {(["on", "off"] as const).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOverride(o)}
            className={`og-press flex-1 rounded-[var(--og-r-sm)] px-3 py-2 text-[12.5px] font-semibold ${
              override === o
                ? "bg-[var(--og-forest)] text-white"
                : "bg-[var(--og-surface-alt)] text-[var(--og-text-muted)]"
            }`}
          >
            {o === "on" ? "Validity on" : "Validity off"}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        placeholder="Expires on (optional)"
        className="w-full rounded-[var(--og-r-sm)] border border-[var(--og-border)] px-3 py-2 text-[13px] outline-none"
      />
      <button
        disabled={pending || !subId || !override}
        onClick={save}
        className="og-press w-full rounded-[var(--og-r-sm)] bg-[var(--og-forest)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        Save for this pack
      </button>
    </div>
  );
}
