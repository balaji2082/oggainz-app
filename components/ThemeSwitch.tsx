"use client";

import { useSyncExternalStore } from "react";

import Icon, { type IconName } from "./ui/Icon";

/**
 * Which background the app wears — a customer setting now, not a preview.
 *
 * It began as a private A/B so Balaji could hold three directions side by side
 * on the phone he'd actually judge them on. He picked two of them, so the third
 * (Playful) is gone and the remaining pair became a real preference anyone can
 * change: Dark by default, Light for people who want it.
 *
 * DARK IS THE DEFAULT, and that has one consequence worth knowing: the server
 * cannot read localStorage, so the HTML always leaves the server light and the
 * blocking script in layout.tsx flips it before first paint. That script — not
 * this component — is what decides the default. Changing it here alone would
 * give every new customer a white flash on their first open.
 *
 * Still localStorage rather than the database: it is a property of the phone
 * you are holding, not of your subscription, and it must apply before any
 * network call has finished.
 */

export type Theme = "dark" | "light";

const OPTIONS: { value: Theme; label: string; hint: string; icon: IconName }[] = [
  {
    value: "dark",
    label: "Dark",
    hint: "Near-black and lime. Easier at night.",
    icon: "moon",
  },
  {
    value: "light",
    label: "Light",
    hint: "Cream and forest. Brighter in daylight.",
    icon: "sun",
  },
];

export const THEME_KEY = "og-theme";

/**
 * The `<html data-theme>` attribute is the source of truth, not a copy of it.
 *
 * The boot script has already resolved the theme before this component exists,
 * so reading React state back out of localStorage on mount would be a second
 * answer to a settled question — and it renders the wrong segment for one frame
 * on every visit to Profile.
 *
 * `useSyncExternalStore` is the tool for exactly this: a value that lives
 * outside React, with an explicit server snapshot. The server has no document,
 * so it answers "dark" — which IS the default, so the markup React sends and
 * the markup it hydrates agree.
 */
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export default function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);

  function pick(next: Theme) {
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(THEME_KEY, next);
    listeners.forEach((fn) => fn());

    // The browser's own chrome — the status bar on an installed PWA, the
    // address bar on Android — takes its colour from this tag. Leaving it on
    // the forest green meant a dark app wearing a green hat.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "dark" ? "#070f0c" : "#f8f5ec");
  }

  return (
    <div className="overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--og-chip)] text-[var(--og-primary)]">
          <Icon name="sparkle" size={15} />
        </span>
        <div>
          <p className="text-[14px] font-medium text-[var(--og-text)]">Background</p>
          <p className="text-[12px] text-[var(--og-text-muted)]">
            Stays on this phone.
          </p>
        </div>
      </div>

      {/* A segmented control, not a list of radio rows. Two options that are
          both immediately visible on screen deserve one tap, and a segment that
          slides makes the change feel like the app responding rather than a
          form being filled in. */}
      <div
        role="radiogroup"
        aria-label="Background"
        className="relative m-3 mt-1 grid grid-cols-2 gap-1 rounded-[var(--og-r-md)] bg-[var(--og-surface-alt)] p-1"
      >
        {OPTIONS.map((o) => {
          const on = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(o.value)}
              className={[
                "og-press relative flex items-center justify-center gap-2 rounded-[var(--og-r-sm)] px-3 py-3 text-[13.5px] font-semibold",
                on
                  ? "bg-[var(--og-surface)] text-[var(--og-primary)] shadow-[var(--og-e2)]"
                  : "text-[var(--og-text-muted)]",
              ].join(" ")}
            >
              <Icon name={o.icon} size={16} weight={on ? 2 : 1.75} />
              {o.label}
            </button>
          );
        })}
      </div>

      <p className="px-4 pb-4 text-[12px] leading-5 text-[var(--og-text-muted)]">
        {OPTIONS.find((o) => o.value === theme)?.hint}
      </p>
    </div>
  );
}
