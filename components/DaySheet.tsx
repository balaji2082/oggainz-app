"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { resumeMeals } from "@/app/actions/meals";
import type { Feedback } from "@/lib/feedback";
import { longDate, relativeDay } from "@/lib/format";
import type { Meal, Pack } from "@/lib/types";
import type { Deadline, SkipRequest } from "@/lib/writes";
import type { DayState } from "./ui/Calendar";
import Button from "./ui/Button";
import Sheet from "./ui/Sheet";
import { useToast } from "./ui/Toast";
import MealActions from "./MealActions";
import FeedbackSheet from "./FeedbackSheet";
import SupportSheet from "./SupportSheet";

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  todayISO: string;
  state?: DayState;
  meals: (Meal & { expected?: boolean })[];
  pack?: Pack;
  deadline?: Deadline;
  serverNow?: string;
  feedback?: Feedback;
  pendingRequest?: SkipRequest;
  /** A state the server has just confirmed, ahead of the payload catching up. */
  confirmedState?: DayState;
  onConfirmed?: (date: string, state: DayState) => void;
  /**
   * The server has APPLIED a resume from this date.
   *
   * Separate from `onConfirmed` because a resume is never one day: the engine
   * clears every freeze from that date onward (core.resume_subscription), so
   * the calendar has a whole stretch to repaint, not a cell.
   */
  onResumed?: (fromDate: string) => void;
}

const TAG_LABEL: Record<string, string> = {
  too_spicy: "Too spicy", bland: "Needs more flavour", too_oily: "Too oily", dry: "A bit dry",
  portion_small: "Portion felt small", portion_large: "Portion too much", late: "Arrived late",
  loved_it: "Loved it", perfect_spice: "Spice was perfect", great_portion: "Portion was spot on",
};

export default function DaySheet({
  open,
  onClose,
  date,
  todayISO,
  state,
  meals,
  pack,
  deadline,
  serverNow,
  feedback,
  pendingRequest,
  confirmedState,
  onConfirmed,
  onResumed,
}: Props) {
  const [rating, setRating] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [resuming, startResume] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const meal = meals[0];
  const when = relativeDay(date, todayISO);
  const future = date >= todayISO;

  function doResume() {
    startResume(async () => {
      const result = await resumeMeals(date, pack?.id);
      toast(result.message, result.ok ? "good" : "bad");
      if (!result.ok) return;

      // Tell the calendar the stretch is over BEFORE closing.
      //
      // Without this the toast said "meals restart on Tuesday" while every
      // paused day kept its pips until a manual reload — the write had landed,
      // but the screen was still drawing the pre-resume payload. `router.refresh()`
      // alone cannot fix it: the cached copy is refreshed AFTER the response is
      // sent (app/actions/meals.ts: resync), so the re-render that follows still
      // holds the old freeze.
      //
      // Only when the server APPLIED it. A late resume comes back as `requested`
      // and nothing has changed yet — repainting that would be the app claiming
      // a decision Balaji has not made (docs/03 §6).
      if (result.data?.outcome === "applied") onResumed?.(date);

      onClose();
      router.refresh();
    });
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={when} subtitle={longDate(date)}>
        {/* Waiting on Balaji. */}
        {pendingRequest && (
          <div className="mb-4 rounded-[var(--og-r-md)] bg-[color-mix(in_srgb,var(--og-orange)_10%,transparent)] p-4">
            <p className="text-[13.5px] font-semibold text-[var(--og-heading)]">
              We&apos;ve passed this on
            </p>
            <p className="mt-1 text-[12.5px] leading-5 text-[var(--og-text-muted)]">
              {pendingRequest.kind === "pause" ? "Your pause request" : "Your skip request"} for
              this day is waiting on us — we&apos;ll let you know.
            </p>
          </div>
        )}

        {/* Inside a freeze. The API now reports these days explicitly, so this
            no longer depends on there being no meal row — a paused day has one. */}
        {!pendingRequest && (state === "paused" || meal?.status === "Paused") && (
          <div>
            <div className="mb-4 flex items-center gap-2.5 rounded-[var(--og-r-md)] bg-[var(--og-surface-alt)] px-3.5 py-3">
              <span className="flex gap-[3px] text-[var(--og-text-muted)]" aria-hidden="true">
                <i className="block h-3 w-[3px] rounded-full bg-current" />
                <i className="block h-3 w-[3px] rounded-full bg-current" />
              </span>
              <p className="text-[13.5px] text-[var(--og-text)]">
                Your pack is paused this day.
              </p>
            </div>
            {future && (
              <Button variant="secondary" full busy={resuming} onClick={doResume}>
                Start meals from {when.toLowerCase() === "today" ? "today" : when}
              </Button>
            )}
          </div>
        )}

        {/* Kitchen closed — nothing to do. */}
        {!pendingRequest && state === "closed" && (
          <p className="text-[13.5px] leading-5 text-[var(--og-text-muted)]">
            The kitchen doesn&apos;t run this day.
          </p>
        )}

        {/* A real meal on this date. A paused day is handled above — it is a
            stretch the customer chose, not a meal with actions on it. */}
        {!pendingRequest && meal && meal.status !== "Paused" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-display text-[15px] font-semibold text-[var(--og-heading)]">
                  {meal.planName ?? pack?.planName ?? "Your meal"}
                </p>
                <p className="text-[12.5px] text-[var(--og-text-muted)]">{meal.slot}</p>
              </div>
            </div>

            {meal.dayNote && (
              <p className="mb-4 rounded-[var(--og-r-md)] bg-[var(--og-surface-alt)] px-3.5 py-2.5 text-[13px] leading-5 text-[var(--og-text)]">
                {meal.dayNote}
              </p>
            )}

            {meal.status === "Delivered" ? (
              <div>
                <div className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-[var(--og-green)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12.5l5.5 5.5L20 7" />
                  </svg>
                  Delivered
                </div>
                {feedback && (feedback.rating || feedback.tags.length > 0 || feedback.comment) ? (
                  <div className="rounded-[var(--og-r-md)] border border-[var(--og-border)] p-3.5">
                    {feedback.rating && (
                      <div className="mb-1.5 flex gap-0.5" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <svg key={n} width="14" height="14" viewBox="0 0 24 24"
                               fill={n <= feedback.rating! ? "var(--og-orange)" : "none"}
                               stroke="var(--og-orange)" strokeWidth="1.6">
                            <path d="M12 2.5l2.9 6.2 6.6.7-4.9 4.6 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.7z" />
                          </svg>
                        ))}
                      </div>
                    )}
                    {feedback.tags.length > 0 && (
                      <p className="text-[12.5px] text-[var(--og-text-muted)]">
                        {feedback.tags.map((t) => TAG_LABEL[t] ?? t).join(" · ")}
                      </p>
                    )}
                    {feedback.comment && (
                      <p className="mt-1.5 text-[13px] leading-5 text-[var(--og-text)]">
                        &ldquo;{feedback.comment}&rdquo;
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setRating(true)}
                      className="og-press mt-2.5 text-[12.5px] font-semibold text-[var(--og-heading)] underline underline-offset-2"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <Button variant="secondary" full onClick={() => setRating(true)}>
                    Rate this meal
                  </Button>
                )}
              </div>
            ) : (
              <MealActions
                date={date}
                slot={meal.slot}
                planName={meal.planName}
                deadline={deadline?.deadline}
                serverNow={serverNow}
                late={deadline?.late ?? date < todayISO}
                skipped={confirmedState ? confirmedState === "skipped" : meal.status === "Skipped"}
                // The meal's OWN pack, never the one the screen happens to be
                // showing. These are the same thing today because the calendar
                // filters by pack — but binding a write to the container rather
                // than to the row is exactly how the wrong pack got skipped.
                subscriptionId={meal.packId ?? pack?.id ?? undefined}
                onMessageUs={() => setMessaging(true)}
                onConfirmed={(state) => onConfirmed?.(date, state)}
              />
            )}
          </div>
        )}

        {/* No meal row yet, but a real future delivery day — the row hasn't
            been generated (only happens the evening before), not that nothing
            is coming. Skip/pause still works: it just creates the pause window
            the generator will honour once it runs. */}
        {!pendingRequest && !meal && state !== "closed" && state !== "paused" && pack && (
          <MealActions
            date={date}
            slot={pack.slot}
            planName={pack.planName}
            deadline={deadline?.deadline}
            serverNow={serverNow}
            late={deadline?.late ?? date < todayISO}
            skipped={confirmedState === "skipped"}
            subscriptionId={pack.id}
            onMessageUs={() => setMessaging(true)}
            onConfirmed={(state) => onConfirmed?.(date, state)}
          />
        )}
      </Sheet>

      {meal && (
        <FeedbackSheet
          open={rating}
          onClose={() => setRating(false)}
          date={date}
          slot={meal.slot}
          planName={meal.planName}
          initial={feedback ? { rating: feedback.rating, tags: feedback.tags, comment: feedback.comment } : undefined}
        />
      )}

      <SupportSheet
        open={messaging}
        onClose={() => setMessaging(false)}
        prefill={{
          category: "delivery",
          subject: `${when}, ${longDate(date)}`,
          context: { date, slot: meal?.slot ?? pack?.slot, packId: pack?.id },
        }}
      />
    </>
  );
}
