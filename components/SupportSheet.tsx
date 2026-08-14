"use client";

import { useState, useTransition } from "react";

import { raiseTicket } from "@/app/actions/support";
import Button from "./ui/Button";
import Sheet from "./ui/Sheet";
import { useToast } from "./ui/Toast";

/**
 * "Message us" — the one door to a human, from anywhere in the app.
 *
 * [LAW] docs/05 §2 — this is the component that would advertise a late skip if
 * anything did, so it deliberately never does. The confirmation promises a
 * reply, never an outcome, and the categories describe what's wrong rather than
 * what will happen about it.
 */

const CATEGORIES = [
  { value: "subscription", label: "My pack" },
  { value: "delivery", label: "Delivery" },
  { value: "meal", label: "The food" },
  { value: "billing", label: "Payment" },
  { value: "details", label: "My details" },
  { value: "other", label: "Something else" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the subject and carries structured context with the ticket. */
  prefill?: {
    category: (typeof CATEGORIES)[number]["value"];
    subject: string;
    context?: Record<string, unknown>;
  };
}

export default function SupportSheet({ open, onClose, prefill }: Props) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>(
    prefill?.category ?? "subscription"
  );
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await raiseTicket({
        subject: prefill?.subject ?? CATEGORIES.find((c) => c.value === category)!.label,
        category,
        body,
        context: prefill?.context,
      });
      toast(result.message, result.ok ? "good" : "bad");
      if (result.ok) {
        setBody("");
        onClose();
      }
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Message us"
      subtitle="We read every message ourselves."
      footer={
        <Button full busy={pending} disabled={!body.trim()} onClick={submit}>
          Send
        </Button>
      }
    >
      {!prefill && (
        <div className="og-scroll-x -mx-1 mb-4 flex gap-2 px-1 pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={[
                "og-press shrink-0 scroll-snap-align-start rounded-[var(--og-r-pill)] px-3.5 py-2 text-[13px] font-semibold",
                category === c.value
                  ? "bg-[var(--og-forest)] text-white"
                  : "bg-[var(--og-surface-alt)] text-[var(--og-text-muted)]",
              ].join(" ")}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {prefill && (
        <div className="mb-4 rounded-[var(--og-r-md)] bg-[var(--og-surface-alt)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--og-heading)]">
          {prefill.subject}
        </div>
      )}

      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Tell us what's up..."
        rows={5}
        className="w-full resize-none rounded-[var(--og-r-md)] border border-[var(--og-border)] bg-[var(--og-surface)] p-3.5 text-[14.5px] leading-6 text-[var(--og-text)] outline-none placeholder:text-[var(--og-text-muted)] focus:border-[var(--og-green)]"
      />
      <p className="mt-3 text-[12px] leading-5 text-[var(--og-text-muted)]">
        We&apos;ll reply right here — you&apos;ll see it under Support.
      </p>
    </Sheet>
  );
}
