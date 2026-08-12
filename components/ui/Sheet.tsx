"use client";

import { useEffect, useRef } from "react";

/**
 * A bottom sheet — where every decision in this app gets made.
 *
 * Chosen over a centred modal because a phone is held at the bottom. A dialog
 * that opens in the middle of the screen puts its buttons where the thumb
 * cannot reach, and the user has to shuffle their grip to answer a question
 * they did not ask for.
 *
 * Built on <dialog> so the browser provides the focus trap, the inert
 * background and Escape for free — all three are things hand-rolled modals get
 * subtly wrong, and getting them wrong locks a screen reader out of the page.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Shown under the title. Keep it to one line. */
  subtitle?: string;
  children: React.ReactNode;
  /** Pinned to the bottom, outside the scroll area, so it is always reachable. */
  footer?: React.ReactNode;
}

export default function Sheet({ open, onClose, title, subtitle, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // The page behind must not scroll while a sheet is up. On iOS especially,
  // a scrolling background under a modal feels like the app has come apart.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Clicking the backdrop closes. The check is on the target being the
      // dialog itself, which is the backdrop area — a click inside the panel
      // has a child as its target and must not close a half-filled form.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={[
        "m-0 max-h-[92dvh] w-full max-w-[520px] bg-transparent p-0",
        "mt-auto mb-0 ml-auto mr-auto",
        "backdrop:bg-[rgba(0,43,32,0.42)] backdrop:backdrop-blur-[2px]",
      ].join(" ")}
    >
      <div
        style={{ animation: "og-sheet-up var(--og-mid) var(--og-ease) both" }}
        className={[
          "flex max-h-[92dvh] flex-col overflow-hidden",
          "rounded-t-[var(--og-r-xl)] bg-[var(--og-bg)]",
          "shadow-[var(--og-e4)]",
          "pb-[env(safe-area-inset-bottom)]",
        ].join(" ")}
      >
        {/* The grab handle. It does not drag — it is a signal that this panel
            belongs to the bottom of the screen and can be dismissed, which is
            the convention every phone user already knows. */}
        <div className="flex justify-center pb-1 pt-3">
          <span className="h-1 w-10 rounded-full bg-[var(--og-border)]" aria-hidden="true" />
        </div>

        <header className="flex items-start gap-3 px-5 pb-3 pt-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[19px] font-semibold leading-tight tracking-[-0.02em] text-[var(--og-forest)]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-[13px] leading-5 text-[var(--og-text-muted)]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="og-press -mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--og-text-muted)] hover:bg-[var(--og-surface-alt)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
          {children}
        </div>

        {footer && (
          <div className="border-t border-[var(--og-border)] bg-[var(--og-surface)] px-5 pb-4 pt-3">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
