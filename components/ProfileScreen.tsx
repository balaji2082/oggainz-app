"use client";

import { useState } from "react";

import AvatarUploader from "./AvatarUploader";
import { Card } from "./Bits";
import SupportSheet from "./SupportSheet";

/**
 * Identity, kept in check.
 *
 * [LAW] docs/05 §3 — every field here is read-only with a visible reason, never
 * a disabled input with no explanation. "Request a change" is the one action,
 * and it opens the same support thread everything else does — there is no
 * separate, quieter path that could go unanswered.
 */

interface Props {
  name: string;
  avatar: string | null;
  fields: { label: string; value: string; key: string }[];
}

export default function ProfileScreen({ name, avatar, fields }: Props) {
  const [requesting, setRequesting] = useState(false);

  return (
    <>
      <Card className="mb-6">
        <div className="mb-1">
          <AvatarUploader name={name} src={avatar} />
        </div>
      </Card>

      <Card padded={false} className="mb-6 overflow-hidden">
        {fields.map((f, i) => (
          <div
            key={f.key}
            className={
              i > 0
                ? "border-t border-[var(--og-border)] px-4 py-3.5"
                : "px-4 py-3.5"
            }
          >
            <p className="text-[11.5px] text-[var(--og-text-muted)]">{f.label}</p>
            <p className="mt-0.5 text-[14.5px] text-[var(--og-text)]">{f.value}</p>
          </div>
        ))}

        {/* One button for the whole card, not one per row.
            Three identical "Request a change" buttons stacked down the side
            read as three different things you might do, when they all open the
            same conversation — and they crowded out the values, which are what
            the customer came to check. */}
        <div className="border-t border-[var(--og-border)] px-4 py-3.5">
          <p className="mb-3 text-[12px] leading-5 text-[var(--og-text-muted)]">
            We keep these ourselves so deliveries and invoices always match.
          </p>
          <button
            type="button"
            onClick={() => setRequesting(true)}
            className="og-press w-full rounded-[var(--og-r-md)] bg-[var(--og-surface-alt)] px-4 py-3 text-[13px] font-semibold text-[var(--og-forest)]"
          >
            Request a change
          </button>
        </div>
      </Card>

      <SupportSheet
        open={requesting}
        onClose={() => setRequesting(false)}
        prefill={{
          category: "details",
          subject: "Change my details",
          // The current values ride along, so Balaji can see what they are
          // asking to change FROM without going and looking it up.
          context: Object.fromEntries(fields.map((f) => [f.label, f.value])),
        }}
      />
    </>
  );
}
