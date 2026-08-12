"use client";

import { useState, useTransition } from "react";

import { leaveFeedback } from "@/app/actions/meals";
import Button from "./ui/Button";
import Sheet from "./ui/Sheet";
import { useToast } from "./ui/Toast";

/**
 * What did you think of this one?
 *
 * The thing Balaji actually wanted: the small adjustments people already
 * mention in passing on WhatsApp — "a bit spicy", "less oil" — captured
 * against the real meal instead of relying on him remembering a chat from
 * three weeks ago. Tags first because most people won't type; the comment box
 * is there for anyone who wants to say more.
 */

const TAGS = [
  { value: "too_spicy", label: "Too spicy" },
  { value: "bland", label: "Needs more flavour" },
  { value: "too_oily", label: "Too oily" },
  { value: "dry", label: "A bit dry" },
  { value: "portion_small", label: "Portion felt small" },
  { value: "portion_large", label: "Portion too much" },
  { value: "late", label: "Arrived late" },
  { value: "loved_it", label: "Loved it" },
  { value: "perfect_spice", label: "Spice was perfect" },
  { value: "great_portion", label: "Portion was spot on" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  slot: string;
  planName: string | null;
  initial?: { rating: number | null; tags: string[]; comment: string | null };
}

export default function FeedbackSheet({ open, onClose, date, slot, planName, initial }: Props) {
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function toggle(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  function submit() {
    startTransition(async () => {
      const result = await leaveFeedback({ date, slot, rating, tags, comment });
      toast(result.message, result.ok ? "good" : "bad");
      if (result.ok) onClose();
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="How was it?"
      subtitle={`${slot} · ${planName ?? "Your meal"}`}
      footer={
        <Button
          full
          busy={pending}
          disabled={!rating && tags.length === 0 && !comment.trim()}
          onClick={submit}
        >
          Send feedback
        </Button>
      }
    >
      <div className="mb-5 flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(rating === n ? null : n)}
            className="og-press p-1"
          >
            <svg
              width="30" height="30" viewBox="0 0 24 24"
              fill={rating !== null && n <= rating ? "var(--og-orange)" : "none"}
              stroke={rating !== null && n <= rating ? "var(--og-orange)" : "var(--og-border)"}
              strokeWidth="1.6" strokeLinejoin="round"
            >
              <path d="M12 2.5l2.9 6.2 6.6.7-4.9 4.6 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.7z" />
            </svg>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TAGS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => toggle(t.value)}
            className={[
              "og-press rounded-[var(--og-r-pill)] px-3.5 py-2 text-[13px] font-semibold",
              tags.includes(t.value)
                ? "bg-[var(--og-forest)] text-white"
                : "bg-[var(--og-surface-alt)] text-[var(--og-text-muted)]",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything else? (optional)"
        rows={3}
        className="mt-4 w-full resize-none rounded-[var(--og-r-md)] border border-[var(--og-border)] bg-[var(--og-surface)] p-3.5 text-[14px] leading-6 outline-none placeholder:text-[var(--og-text-muted)] focus:border-[var(--og-green)]"
      />
    </Sheet>
  );
}
