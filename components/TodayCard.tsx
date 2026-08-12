"use client";

import { useState } from "react";

import type { Deadline } from "@/lib/writes";
import type { Component, Meal, Pack } from "@/lib/types";
import { componentLabel, relativeDay, shortDate } from "@/lib/format";
import MealActions from "./MealActions";
import SupportSheet from "./SupportSheet";

interface Props {
  meal: Meal | null;
  pack: Pack | undefined;
  dateISO: string;
  todayISO: string;
  kitchenOpen: boolean;
  deadline?: Deadline;
  serverNow?: string;
}

function Line({ c }: { c: { name: string; qty: number; unit: string; emoji: string | null; kind: string } }) {
  return (
    <li className="flex items-baseline gap-2.5 text-[15px] leading-6 og-rise">
      <span aria-hidden="true" className="w-5 shrink-0 text-center text-[17px]">
        {c.emoji ?? "•"}
      </span>
      <span className="text-[var(--og-on-hero)]">{componentLabel(c as Component)}</span>
      {c.kind === "addon" && (
        <span className="rounded-[var(--og-r-pill)] bg-[color-mix(in_srgb,var(--og-lime)_22%,transparent)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[var(--og-lime)]">
          extra
        </span>
      )}
    </li>
  );
}

/**
 * The hero. This is the one thing a customer opens the app to see, so it gets
 * the whole top of the screen, the dark surface (docs/05 §0 — forest is the
 * brand's most confident colour and is wasted as a text colour), and the only
 * action that actually matters today.
 */
export default function TodayCard({
  meal,
  pack,
  dateISO,
  todayISO,
  kitchenOpen,
  deadline,
  serverNow,
}: Props) {
  const [messaging, setMessaging] = useState(false);
  const when = relativeDay(dateISO, todayISO);

  if (!kitchenOpen) {
    return (
      <section className="og-rise rounded-[var(--og-r-xl)] border border-[var(--og-border)] bg-[var(--og-surface-alt)] p-7 text-center">
        <p className="font-display text-[17px] font-semibold text-[var(--og-forest)]">
          Kitchen closed {when.toLowerCase()}
        </p>
        <p className="mt-1.5 text-[14px] leading-6 text-[var(--og-text-muted)]">
          We cook Monday to Friday. Your meals carry forward — nothing is lost.
        </p>
      </section>
    );
  }

  if (!meal) {
    return (
      <section className="og-rise rounded-[var(--og-r-xl)] border border-[var(--og-border)] bg-[var(--og-surface)] p-7 text-center shadow-[var(--og-e1)]">
        <p className="font-display text-[17px] font-semibold text-[var(--og-forest)]">
          No meal {when.toLowerCase()}
        </p>
        <p className="mt-1.5 text-[14px] leading-6 text-[var(--og-text-muted)]">
          {pack?.pausedToday
            ? "Your pack is paused. Meals resume when you are ready."
            : "Nothing scheduled for this day."}
        </p>
      </section>
    );
  }

  const base = pack?.components.filter((c) => c.kind === "base") ?? [];
  const addons = pack?.components.filter((c) => c.kind === "addon") ?? [];
  const delivered = meal.status === "Delivered";
  const skipped = meal.status === "Skipped";

  return (
    <>
      <section
        className="og-rise relative overflow-hidden rounded-[var(--og-r-xl)] p-6 shadow-[var(--og-e3)]"
        style={{ background: "var(--og-hero)" }}
      >
        {/* Soft lime bloom — the one flourish, kept to a single card. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -top-24 h-64 w-64 rounded-full opacity-[0.16] blur-3xl"
          style={{ background: "var(--og-lime)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full opacity-[0.10] blur-3xl"
          style={{ background: "var(--og-green-light)" }}
        />

        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--og-lime)]">
              {when} · {shortDate(dateISO)}
            </p>
            <span className="rounded-[var(--og-r-pill)] bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--og-on-hero)]">
              {meal.slot}
            </span>
          </div>

          <h1 className="mt-3 font-display text-[27px] font-bold leading-tight tracking-[-0.02em] text-[var(--og-on-hero)]">
            {meal.planName ?? "Your meal"}
          </h1>

          {(delivered || skipped) && (
            <p
              className={[
                "mt-2.5 inline-flex items-center gap-1.5 rounded-[var(--og-r-pill)] px-3 py-1.5 text-[12px] font-semibold",
                delivered
                  ? "bg-[color-mix(in_srgb,var(--og-lime)_20%,transparent)] text-[var(--og-lime)]"
                  : "bg-white/12 text-[var(--og-on-hero)]",
              ].join(" ")}
            >
              {delivered ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12.5l5.5 5.5L20 7" />
                  </svg>
                  Delivered
                </>
              ) : (
                "Skipped — moved to the end of your pack"
              )}
            </p>
          )}

          {base.length > 0 && (
            <ul className="og-stagger mt-6 space-y-2">
              {base.map((c, i) => (
                <Line key={`b${i}`} c={c} />
              ))}
              {addons.map((c, i) => (
                <Line key={`a${i}`} c={c} />
              ))}
            </ul>
          )}

          {meal.dayNote && (
            <p className="mt-4 rounded-[var(--og-r-md)] border-l-2 border-[var(--og-lime)] bg-black/15 px-3.5 py-2.5 text-[13px] leading-5 text-[var(--og-on-hero-dim)]">
              {meal.dayNote}
            </p>
          )}

          {!delivered && (
            <div className="mt-6">
              <MealActions
                date={dateISO}
                slot={meal.slot}
                planName={meal.planName}
                deadline={deadline?.deadline}
                serverNow={serverNow}
                late={deadline?.late ?? false}
                skipped={skipped}
                subscriptionId={pack?.id}
                onHero
                onMessageUs={() => setMessaging(true)}
              />
            </div>
          )}

          {delivered && (
            <button
              type="button"
              onClick={() => setMessaging(true)}
              className="og-press mt-5 text-[12.5px] font-semibold text-[var(--og-on-hero-dim)] underline decoration-white/25 underline-offset-4"
            >
              Something off with this one?
            </button>
          )}
        </div>
      </section>

      <SupportSheet
        open={messaging}
        onClose={() => setMessaging(false)}
        prefill={{
          category: "delivery",
          subject: `${when}, ${shortDate(dateISO)} · ${meal.slot}`,
          context: { date: dateISO, slot: meal.slot, packId: pack?.id },
        }}
      />
    </>
  );
}
