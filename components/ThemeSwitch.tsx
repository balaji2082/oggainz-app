"use client";

import { useEffect, useState } from "react";

/**
 * Which look the app wears.
 *
 * Temporary by intent: it exists so Balaji can hold both directions side by
 * side on the phone he'll actually judge them on, instead of me deploying one,
 * waiting, and deploying the other. Once he picks, the winner becomes the
 * default and this control comes out.
 *
 * The choice is stored in localStorage rather than on his account, because it
 * is a preview of a decision, not a customer setting — nothing about it should
 * reach the database or follow him to another device.
 */

export type Theme = "classic" | "dark" | "playful";

const OPTIONS: { value: Theme; label: string; hint: string; swatch: string[] }[] = [
  {
    value: "classic",
    label: "Classic",
    hint: "Cream and forest — what you have now",
    swatch: ["#f8f5ec", "#004030", "#c5e84b"],
  },
  {
    value: "dark",
    label: "Dark",
    hint: "Near-black, lime accent — Whoop / Oura",
    swatch: ["#070f0c", "#14332a", "#c5e84b"],
  },
  {
    value: "playful",
    label: "Playful",
    hint: "Warm, round, colourful — Swiggy / Zomato",
    swatch: ["#fff8ee", "#178a49", "#e9762b"],
  },
];

export const THEME_KEY = "og-theme";

export default function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("classic");

  // Read on mount rather than during render: the server has no localStorage,
  // and reading it while rendering would make the markup differ from the HTML
  // that was sent, which React reports as a hydration error.
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY) as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  function pick(next: Theme) {
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    const root = document.documentElement;
    if (next === "classic") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }

  return (
    <section className="mb-6">
      <h2 className="mb-3 font-display text-[12.5px] font-semibold uppercase tracking-[0.13em] text-[var(--og-text-muted)]">
        Look
      </h2>
      <div className="overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
        {OPTIONS.map((o, i) => {
          const on = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              aria-pressed={on}
              className={[
                "og-press flex w-full items-center gap-3 px-4 py-3.5 text-left",
                i > 0 ? "border-t border-[var(--og-border)]" : "",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--og-border)]"
              >
                {o.swatch.map((c) => (
                  <i key={c} className="block h-full flex-1" style={{ background: c }} />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-medium text-[var(--og-text)]">
                  {o.label}
                </span>
                <span className="block text-[12px] text-[var(--og-text-muted)]">{o.hint}</span>
              </span>
              <span
                aria-hidden="true"
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  on
                    ? "bg-[var(--og-forest)] text-white"
                    : "ring-1 ring-[var(--og-border)]",
                ].join(" ")}
              >
                {on && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5.5 5.5L20 7" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
        <p className="border-t border-[var(--og-border)] px-4 py-3 text-[12px] leading-5 text(--og-text-muted) text-[var(--og-text-muted)]">
          Only you can see this while we settle on a look. It stays on this
          phone and changes nothing for customers.
        </p>
      </div>
    </section>
  );
}
