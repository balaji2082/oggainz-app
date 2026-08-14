"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { skipMeal, undoSkip } from "@/app/actions/meals";
import Button from "./ui/Button";
import Countdown from "./ui/Countdown";
import Sheet from "./ui/Sheet";
import { useToast } from "./ui/Toast";

/**
 * Skipping a meal, and changing your mind.
 *
 * [LAW] docs/03 §6 — nothing here is optimistic. The button spins, the server
 * decides, and only then does the screen change. A skip that looks applied but
 * never reached the server is the worst bug this product can have: the customer
 * stops expecting food that is on its way, or expects food that isn't. That is
 * why there is no local `setSkipped(true)` anywhere in this file — the refresh
 * re-reads the truth.
 *
 * [DEVIATION] docs/05 §2 — after the deadline this offers "Message us" and says
 * only that the meal is being prepared. It does NOT offer "Request to skip
 * anyway" or promise that Balaji will confirm, which is what docs/02 §7.1 drew.
 * Balaji's instruction, 12 Aug 2026: a documented "ask and we'll cancel it" path
 * stops being an exception and becomes the expectation. The button is still
 * there and still leads somewhere — it just promises nothing.
 */

interface Props {
  date: string;
  slot: string;
  planName: string | null;
  /** Absolute IST deadline from the server. The countdown is computed from it. */
  deadline?: string;
  serverNow?: string;
  late: boolean;
  skipped: boolean;
  subscriptionId?: string;
  /** Rendered on the dark hero card rather than on cream. */
  onHero?: boolean;
  /** Opens the support sheet with this meal pre-filled. */
  onMessageUs?: () => void;
  /**
   * Fired only after the SERVER confirms, so the calendar can show the change
   * before the refetch lands. Never called optimistically (docs/03 §6).
   */
  onConfirmed?: (state: "skipped" | "scheduled") => void;
}

export default function MealActions({
  date,
  slot,
  planName,
  deadline,
  serverNow,
  late,
  skipped,
  subscriptionId,
  onHero,
  onMessageUs,
  onConfirmed,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function run(
    action: () => Promise<{ ok: boolean; message: string }>,
    becomes: "skipped" | "scheduled"
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) onConfirmed?.(becomes);
      toast(result.message, result.ok ? "good" : "bad");
      setConfirming(false);
      // Re-read rather than patch. The server may have applied something
      // slightly different from what was asked (docs/03 §5.3), and the only
      // way to be sure the screen is right is to ask it again.
      if (result.ok) router.refresh();
    });
  }

  // --- already skipped: offer the way back ---------------------------------
  if (skipped) {
    return (
      <div className={onHero ? "text-[var(--og-on-hero)]" : ""}>
        <div
          className={[
            "mb-3 flex items-start gap-2.5 rounded-[var(--og-r-md)] px-3.5 py-3",
            onHero
              ? "bg-[rgba(255,255,255,0.08)]"
              : "bg-[color-mix(in_srgb,var(--og-green)_10%,transparent)]",
          ].join(" ")}
        >
          <span className={onHero ? "text-[var(--og-lime)]" : "text-[var(--og-green)]"}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-[1px]"
                 aria-hidden="true">
              <path d="M4 12.5l5.5 5.5L20 7" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold">Skipped</p>
            {/* The promise, restated every single time (docs/02 §7.4). */}
            <p className={`text-[12.5px] leading-4 ${onHero ? "text-[var(--og-on-hero-dim)]" : "text-[var(--og-text-muted)]"}`}>
              You don&apos;t lose the meal — it moves to the end of your pack.
            </p>
          </div>
        </div>

        {!late ? (
          <Button
            variant={onHero ? "hero" : "secondary"}
            full
            busy={pending}
            onClick={() => run(() => undoSkip(date, subscriptionId), "scheduled")}
          >
            Undo skip
          </Button>
        ) : (
          <p className={`text-[12.5px] ${onHero ? "text-[var(--og-on-hero-dim)]" : "text-[var(--og-text-muted)]"}`}>
            This one is settled for the day.
          </p>
        )}

        {!late && deadline && serverNow && (
          <p className={`mt-2.5 text-center text-[12px] ${onHero ? "text-[var(--og-on-hero-dim)]" : "text-[var(--og-text-muted)]"}`}>
            Change until {deadline.slice(11, 16)} ·{" "}
            <Countdown deadline={deadline} serverNow={serverNow} />
          </p>
        )}
      </div>
    );
  }

  // --- past the deadline ----------------------------------------------------
  if (late) {
    return (
      <div className={onHero ? "text-[var(--og-on-hero)]" : ""}>
        <div
          className={[
            "mb-3 flex items-start gap-2.5 rounded-[var(--og-r-md)] px-3.5 py-3",
            onHero ? "bg-[rgba(255,255,255,0.08)]" : "bg-[var(--og-surface-alt)]",
          ].join(" ")}
        >
          <span className={onHero ? "text-[var(--og-lime)]" : "text-[var(--og-orange)]"}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-[1px]"
                 aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5V12l3 2" />
            </svg>
          </span>
          <p className="text-[13px] leading-5">This meal is already being prepared.</p>
        </div>
        {onMessageUs && (
          <Button variant={onHero ? "hero" : "secondary"} full onClick={onMessageUs}>
            Message us
          </Button>
        )}
      </div>
    );
  }

  // --- in time --------------------------------------------------------------
  return (
    <div className={onHero ? "text-[var(--og-on-hero)]" : ""}>
      <Button
        variant={onHero ? "hero" : "secondary"}
        full
        onClick={() => setConfirming(true)}
      >
        Skip this meal
      </Button>

      {deadline && serverNow && (
        <p className={`mt-2.5 text-center text-[12px] ${onHero ? "text-[var(--og-on-hero-dim)]" : "text-[var(--og-text-muted)]"}`}>
          You can change this until {deadline.slice(11, 16)} ·{" "}
          <Countdown deadline={deadline} serverNow={serverNow} />
        </p>
      )}

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Skip this meal?"
        subtitle={`${slot} · ${planName ?? "Your meal"}`}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              full
              busy={pending}
              onClick={() => run(() => skipMeal(date, subscriptionId), "skipped")}
            >
              Yes, skip it
            </Button>
          </div>
        }
      >
        <div className="rounded-[var(--og-r-md)] bg-[color-mix(in_srgb,var(--og-green)_9%,transparent)] p-4">
          <p className="text-[14px] font-semibold text-[var(--og-forest)]">
            You don&apos;t lose the meal.
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[var(--og-text-muted)]">
            It moves to the end of your pack, so your pack simply runs one day
            longer. Nothing is forfeited.
          </p>
        </div>
        {deadline && serverNow && (
          <p className="mt-4 text-[12.5px] leading-5 text-[var(--og-text-muted)]">
            You can change your mind until {deadline.slice(11, 16)} —{" "}
            <Countdown deadline={deadline} serverNow={serverNow} /> — and switch it
            back as many times as you like before then.
          </p>
        )}
      </Sheet>
    </div>
  );
}
