"use client";

import { useState } from "react";

import type { Deadline } from "@/lib/writes";
import type { Component, Meal, Pack } from "@/lib/types";
import { componentLabel, relativeDay, shortDate } from "@/lib/format";
import FeedbackSheet from "./FeedbackSheet";
import MealActions from "./MealActions";
import Icon from "./ui/Icon";
import Sheet from "./ui/Sheet";
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

/** One ingredient line, on the cream sheet rather than the dark card. */
function SheetLine({
  c,
}: {
  c: { name: string; qty: number; unit: string; emoji: string | null; kind: string };
}) {
  return (
    <li className="flex items-baseline gap-3 border-b border-[var(--og-border)] py-2.5 text-[15px] leading-6 last:border-0">
      <span aria-hidden="true" className="w-6 shrink-0 text-center text-[18px]">
        {c.emoji ?? "•"}
      </span>
      <span className="flex-1 text-[var(--og-text)]">{componentLabel(c as Component)}</span>
      {c.kind === "addon" && (
        <span className="rounded-[var(--og-r-pill)] bg-[color-mix(in_srgb,var(--og-orange)_16%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a44c12]">
          extra
        </span>
      )}
    </li>
  );
}

/**
 * Meals left, drawn on the dark hero.
 *
 * The shared ProgressRing in ui/Bits is built for the cream surface and reads
 * as a grey smudge on forest, so this is its own small thing rather than a
 * prop-flag on that one. Two components beat one component with a `dark`
 * boolean threaded through every colour.
 */
function HeroRing({ pack }: { pack: Pack }) {
  const size = 108;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const used = Math.min(pack.delivered, pack.mealsTotal);
  const pct = pack.mealsTotal > 0 ? used / pack.mealsTotal : 0;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${pack.remaining} of ${pack.mealsTotal} meals left`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.16)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--og-lime)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset var(--og-slow) var(--og-ease)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="og-tabular font-display text-[30px] font-bold leading-none text-[var(--og-on-hero)]">
          {pack.remaining}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--og-on-hero-dim)]">
          left
        </span>
      </div>
    </div>
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
  const [rating, setRating] = useState(false);
  const [showingContents, setShowingContents] = useState(false);
  const when = relativeDay(dateISO, todayISO);

  if (!kitchenOpen) {
    return (
      <section className="og-rise rounded-[var(--og-r-xl)] border border-[var(--og-border)] bg-[var(--og-surface-alt)] p-7 text-center">
        <p className="font-display text-[17px] font-semibold text-[var(--og-heading)]">
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
        <p className="font-display text-[17px] font-semibold text-[var(--og-heading)]">
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

          <div className="mt-3 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[27px] font-bold leading-tight tracking-[-0.02em] text-[var(--og-on-hero)]">
                {meal.planName ?? "Your meal"}
              </h1>

              {/* The contents used to be listed here in full. They are reference
                  material, not the reason the screen exists — most days you
                  already know what is in your pack, and six lines of
                  "Chicken 150g / Egg 2 pcs" pushed the one button that matters
                  below the fold. One tap away, not gone. */}
              {base.length + addons.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowingContents(true)}
                  aria-label="See what's in this meal"
                  className="og-press mt-2 inline-flex items-center gap-1.5 rounded-[var(--og-r-pill)] bg-white/12 px-3 py-1.5 text-[12px] font-semibold text-[var(--og-on-hero)]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9.5" />
                    <path d="M12 11v5.5M12 7.6v.2" />
                  </svg>
                  What&apos;s inside
                </button>
              )}
            </div>

            {/* Meals left, on the card itself. It is the number people open the
                app to check second, after "is food coming today". */}
            {pack && pack.mealsTotal > 0 && <HeroRing pack={pack} />}
          </div>

          {(delivered || skipped) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-[var(--og-r-pill)] px-3 py-1.5 text-[12px] font-semibold",
                  delivered
                    ? "bg-[color-mix(in_srgb,var(--og-lime)_20%,transparent)] text-[var(--og-lime)]"
                    : "bg-white/12 text-[var(--og-on-hero)]",
                ].join(" ")}
              >
                <Icon name={delivered ? "check" : "skip"} size={13} weight={2.6} />
                {delivered ? "Delivered" : "Skipped · carried forward"}
              </span>
            </div>
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

          {/*
            Two things were wrong here, and one of them was not cosmetic.

            The button sat on a bare `mt-5` directly under the status pill and
            the two ran into each other on a narrow phone. It is a real control
            now — a full-width bar with its own surface — so it cannot collide
            with anything, and it is obviously tappable rather than a piece of
            underlined text.

            The other: "Rate today's meal" opened the SUPPORT sheet, so anyone
            who tapped it ended up writing a message to Balaji instead of
            leaving feedback — while a whole FeedbackSheet with stars and tags
            sat unused on this screen. It opens that now.
          */}
          {delivered && (
            <button
              type="button"
              onClick={() => setRating(true)}
              className="og-press mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--og-r-md)] bg-white/12 px-4 py-3 text-[13.5px] font-semibold text-[var(--og-on-hero)]"
            >
              <Icon name="star" size={15} weight={2} />
              How was it?
            </button>
          )}
        </div>
      </section>

      <Sheet
        open={showingContents}
        onClose={() => setShowingContents(false)}
        title="What's inside"
        subtitle={meal.planName ?? pack?.planName ?? undefined}
      >
        <ul className="og-stagger space-y-1 pb-3">
          {base.map((c, i) => (
            <SheetLine key={`b${i}`} c={c} />
          ))}
          {addons.map((c, i) => (
            <SheetLine key={`a${i}`} c={c} />
          ))}
        </ul>
        {addons.length > 0 && (
          <p className="pb-2 text-[12px] leading-5 text-[var(--og-text-muted)]">
            Items marked <span className="font-semibold">extra</span> are add-ons
            on top of the standard pack.
          </p>
        )}
      </Sheet>

      <FeedbackSheet
        open={rating}
        onClose={() => setRating(false)}
        date={dateISO}
        slot={meal.slot}
        planName={meal.planName}
      />

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
