import Link from "next/link";

import type { Pack } from "@/lib/types";
import { longDate } from "@/lib/format";
import { Pill, ProgressRing } from "./Bits";

/**
 * Meals remaining, and — when Balaji has switched it on for this pack — how
 * many days are left to use them (docs/01 §7.2, docs/05 §1.1). Off by default,
 * and an unenforced pack shows no countdown, exactly as the [LAW] requires.
 */
export default function PackCard({ pack, customerId }: { pack: Pack; customerId: string }) {
  const v = pack.validity;
  const urgent = v?.enforced && v.daysLeft !== null && v.daysLeft <= 7;

  return (
    <Link
      href={`/me/${customerId}/pack?id=${encodeURIComponent(pack.id)}`}
      className="og-press block rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5 shadow-[var(--og-e1)] hover:shadow-[var(--og-e2)]"
    >
      <div className="flex items-start gap-4">
        <ProgressRing done={pack.delivered} total={pack.mealsTotal} label="left" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[16px] font-semibold leading-tight tracking-[-0.01em] text-[var(--og-forest)]">
              {pack.planName}
            </h3>
            {pack.pausedToday ? (
              <Pill tone="warn">Paused</Pill>
            ) : pack.status === "Expired" ? (
              <Pill tone="warn">Expired</Pill>
            ) : pack.status === "Ending Soon" ? (
              <Pill tone="warn">Ending soon</Pill>
            ) : pack.status === "Completed" ? (
              <Pill tone="quiet">Completed</Pill>
            ) : (
              <Pill tone="good">Active</Pill>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--og-text-muted)]">
            {pack.duration ?? "Pack"} · {pack.slot}
            {pack.startDate ? ` · from ${longDate(pack.startDate)}` : ""}
          </p>

          <p className="mt-2 text-[13px] text-[var(--og-text)]">
            <span className="font-display font-bold text-[var(--og-forest)]">
              {pack.remaining}
            </span>{" "}
            meal{pack.remaining === 1 ? "" : "s"} left of {pack.mealsTotal}
          </p>

          {v?.enforced && v.expiresOn && (
            <p
              className={`mt-1 text-[12px] font-medium ${urgent ? "text-[var(--og-orange)]" : "text-[var(--og-text-muted)]"}`}
            >
              {pack.status === "Expired"
                ? `Expired ${longDate(v.expiresOn)} — message us about your remaining meals`
                : v.daysLeft !== null && v.daysLeft <= 0
                  ? `Expires today, ${longDate(v.expiresOn)}`
                  : `${v.daysLeft} day${v.daysLeft === 1 ? "" : "s"} left to use · valid until ${longDate(v.expiresOn)}`}
            </p>
          )}

          {pack.skipped > 0 && (
            <p className="mt-1.5 text-[12px] leading-4 text-[var(--og-text-muted)]">
              {pack.skipped} skipped — moved to the end of your pack.
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
