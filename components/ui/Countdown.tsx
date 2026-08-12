"use client";

import { useEffect, useState } from "react";

/**
 * How long is left to change a meal.
 *
 * docs/02 §7.1 calls the countdown "the whole design" — it converts an invisible
 * rule into something people can feel, and removes every "why can't I cancel?"
 * message. So it has to be right in the awkward cases, not just the happy one.
 *
 * [LAW] docs/02 §7.5 — computed from an ABSOLUTE deadline the server supplied,
 * never from a timer started at page load. A timer counting down from 4 hours
 * keeps counting while the phone is locked and is wrong by however long the
 * screen was off. This one is a subtraction from the wall clock, so waking the
 * phone after two hours shows the truth immediately.
 *
 * The server's own clock comes with it. If the phone's clock is wrong — and on
 * a cheap Android it often is by minutes — the offset corrects for it, so the
 * countdown agrees with the server that will actually judge the request.
 */

/** Python hands back naive IST ("2026-08-14 18:00:00"). Parse it as IST. */
function istToDate(value: string): number {
  const iso = value.replace(" ", "T");
  return new Date(/[Z+]/.test(iso) ? iso : `${iso}+05:30`).getTime();
}

interface Props {
  /** IST timestamp from the Command Center. */
  deadline: string;
  /** The server's clock at the moment it answered, for skew correction. */
  serverNow: string;
  /** Rendered once the deadline has passed. */
  lateLabel?: string;
  className?: string;
}

export default function Countdown({ deadline, serverNow, lateLabel, className }: Props) {
  const target = istToDate(deadline);
  // How far the phone's clock is from the server's. Fixed at mount: it is a
  // property of the device, not something that drifts within a session.
  const [skew] = useState(() => istToDate(serverNow) - Date.now());
  const [left, setLeft] = useState(() => target - (Date.now() + skew));

  useEffect(() => {
    const tick = () => setLeft(target - (Date.now() + skew));
    tick();
    const id = setInterval(tick, 1000);
    // Coming back from a locked screen or another app: recompute at once
    // rather than waiting up to a second, which is visible as a stale value.
    const onWake = () => tick();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [target, skew]);

  if (left <= 0) {
    return lateLabel ? <span className={className}>{lateLabel}</span> : null;
  }

  const total = Math.floor(left / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  // Seconds only appear in the last hour. Watching a seconds digit tick for six
  // hours is stressful and tells nobody anything; in the last hour it is the
  // whole point.
  const text =
    hours >= 1
      ? `${hours}h ${String(minutes).padStart(2, "0")}m left`
      : `${minutes}:${String(seconds).padStart(2, "0")} left`;

  const urgent = total < 3600;

  return (
    <span
      className={`og-tabular ${className ?? ""}`}
      style={urgent ? { color: "var(--og-orange)" } : undefined}
      // Announced when it becomes urgent, silent before that — a live region
      // that reads out every second would make the screen unusable.
      aria-live={urgent ? "polite" : "off"}
    >
      {text}
    </span>
  );
}
