"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { skipMeal, undoSkip } from "@/app/actions/meals";
import { clockLabel } from "@/lib/format";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
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
  /**
   * The button's own spinner, deliberately NOT `useTransition`'s pending flag.
   *
   * This is why skipping felt slow while undoing felt quick. `router.refresh()`
   * used to be called INSIDE `startTransition`, which keeps `pending` true until
   * the whole page has re-rendered on the server and streamed back — so the
   * spinner outlived the thing it was reporting on by a second or more. The
   * write had been confirmed; the customer was being made to watch a re-render.
   *
   * Undo felt faster for a real reason, not a random one: the Command Center's
   * undo just re-marks a row that already exists, while a skip on a future day
   * has to call `ensure_day_rows` first to generate the day. Same round trip,
   * more work at the far end — so the same extra wait hurt it more.
   */
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  async function run(
    action: () => Promise<{ ok: boolean; message: string }>,
    becomes: "skipped" | "scheduled"
  ) {
    setBusy(true);
    try {
      const result = await action();
      if (result.ok) onConfirmed?.(becomes);
      toast(result.message, result.ok ? "good" : "bad");
      setConfirming(false);
      if (!result.ok) return;

      // The spinner stops HERE — the server has confirmed, which is the only
      // moment docs/03 §6 cares about. The re-read still happens, because the
      // server may have applied something slightly different from what was
      // asked (docs/03 §5.3), but it happens QUIETLY: `onConfirmed` has already
      // painted the confirmed answer, so there is nothing for the customer to
      // wait for while the page reconciles behind them.
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
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
            busy={busy}
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
            Undo until {clockLabel(deadline)} ·{" "}
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
          Change until {clockLabel(deadline)} ·{" "}
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
              busy={busy}
              onClick={() => run(() => skipMeal(date, subscriptionId), "skipped")}
            >
              Skip it
            </Button>
          </div>
        }
      >
        {/*
          Two facts, one line each, both reassurances.

          This was three paragraphs saying the same thing three ways — "you
          don't lose the meal", then "it moves to the end of your pack, so your
          pack simply runs one day longer", then "nothing is forfeited", then a
          sentence about changing your mind as many times as you like. Nobody
          reads four sentences on a confirmation they have already decided to
          give, and length here reads as nervousness: the more the screen
          explains that nothing is lost, the more it sounds like something is.
        */}
        <ul className="space-y-2.5">
          <li className="flex items-center gap-3 rounded-[var(--og-r-md)] bg-[color-mix(in_srgb,var(--og-green)_10%,transparent)] px-4 py-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--og-green)_18%,transparent)] text-[var(--og-on-green)]">
              <Icon name="check" size={16} weight={2.6} />
            </span>
            <p className="text-[14px] font-medium text-[var(--og-text)]">
              Moves to the end of your pack.
            </p>
          </li>

          {deadline && serverNow && (
            <li className="flex items-center gap-3 rounded-[var(--og-r-md)] bg-[var(--og-surface-alt)] px-4 py-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--og-surface)] text-[var(--og-text-muted)]">
                <Icon name="clock" size={16} />
              </span>
              <p className="text-[14px] font-medium text-[var(--og-text)]">
                Undo until {clockLabel(deadline)} ·{" "}
                <span className="text-[var(--og-text-muted)]">
                  <Countdown deadline={deadline} serverNow={serverNow} /> left
                </span>
              </p>
            </li>
          )}
        </ul>
      </Sheet>
    </div>
  );
}
