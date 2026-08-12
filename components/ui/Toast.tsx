"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * What just happened, said once and briefly.
 *
 * Every message shown here comes from the SERVER's own reply — the Command
 * Center writes the wording of "Friday skipped. You don't lose the meal…" and
 * this renders it verbatim. That is deliberate (docs/03 §5.3): if the app wrote
 * its own confirmation it would eventually claim something the server did not
 * do, which on a skip is the worst bug this product can have.
 */

type Tone = "good" | "bad";
interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

const Ctx = createContext<(message: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = "good") => {
    if (!message) return;
    setItems((list) => [...list, { id: Date.now() + Math.random(), tone, message }]);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div
        // assertive, not polite: these confirm an action the person just took
        // and is waiting on. Polite would queue behind whatever else is being
        // read and arrive after they have already moved on.
        role="status"
        aria-live="assertive"
        className="pointer-events-none fixed inset-x-0 bottom-[84px] z-50 mx-auto flex max-w-[520px] flex-col items-center gap-2 px-5"
      >
        {items.map((t) => (
          <Item key={t.id} toast={t} onDone={() => setItems((l) => l.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function Item({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    // A refusal needs longer than a confirmation: "the kitchen is closed that
    // day" has to be read and understood, "Skipped" only has to be noticed.
    const id = setTimeout(onDone, toast.tone === "bad" ? 6000 : 3800);
    return () => clearTimeout(id);
  }, [toast.tone, onDone]);

  return (
    <div
      className={[
        "og-rise pointer-events-auto w-full rounded-[var(--og-r-md)] px-4 py-3",
        "text-[13.5px] leading-5 shadow-[var(--og-e3)]",
        toast.tone === "bad"
          ? "bg-[var(--og-surface)] text-[var(--og-text)] ring-1 ring-[color-mix(in_srgb,var(--og-danger)_35%,transparent)]"
          : "bg-[var(--og-forest)] text-[var(--og-on-hero)]",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={toast.tone === "bad" ? "text-[var(--og-danger)]" : "text-[var(--og-lime)]"}
        >
          {toast.tone === "bad" ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.4" strokeLinecap="round" className="mt-[1px]">
              <path d="M12 8v5M12 16.5v.5" />
              <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-[1px]">
              <path d="M4 12.5l5.5 5.5L20 7" />
            </svg>
          )}
        </span>
        <p className="min-w-0 flex-1">{toast.message}</p>
      </div>
    </div>
  );
}
