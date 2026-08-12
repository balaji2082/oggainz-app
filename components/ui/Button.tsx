"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The one button.
 *
 * Sizes start at 48px, not 44px. The spec's 44px is the accessibility floor;
 * this is a food app used one-handed, often walking, often in a hurry, and the
 * floor is not where you build.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "hero";
type Size = "md" | "lg";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--og-forest)] text-white shadow-[var(--og-e2)] hover:bg-[var(--og-primary-hover)]",
  secondary:
    "bg-[var(--og-surface)] text-[var(--og-forest)] border border-[var(--og-border)] shadow-[var(--og-e1)] hover:bg-[var(--og-surface-alt)]",
  ghost:
    "bg-transparent text-[var(--og-text-muted)] hover:bg-[var(--og-surface-alt)]",
  danger:
    "bg-[var(--og-surface)] text-[var(--og-danger)] border border-[color-mix(in_srgb,var(--og-danger)_28%,transparent)] hover:bg-[color-mix(in_srgb,var(--og-danger)_6%,transparent)]",
  // On the dark hero card, where lime finally has something to be bright on.
  hero: "bg-[var(--og-lime)] text-[var(--og-forest-shadow)] shadow-[0_6px_20px_rgba(197,232,75,0.28)] hover:brightness-105",
};

const SIZES: Record<Size, string> = {
  md: "min-h-[48px] px-5 text-[14.5px] rounded-[var(--og-r-md)]",
  lg: "min-h-[56px] px-6 text-[16px] rounded-[var(--og-r-lg)]",
};

export default function Button({
  variant = "primary",
  size = "md",
  full,
  busy,
  icon,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      // aria-busy rather than swapping the label to "Saving…": a screen reader
      // that has just read "Skip this meal" should not be told the button
      // changed its mind about what it is.
      aria-busy={busy || undefined}
      className={[
        "og-press relative inline-flex items-center justify-center gap-2",
        "font-display font-semibold tracking-[-0.01em]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        SIZES[size],
        VARIANTS[variant],
        full ? "w-full" : "",
      ].join(" ")}
    >
      {busy ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        />
      ) : (
        icon
      )}
      <span className={busy ? "opacity-70" : undefined}>{children}</span>
    </button>
  );
}
