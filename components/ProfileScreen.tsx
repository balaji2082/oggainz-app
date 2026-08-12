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
  const [request, setRequest] = useState<{ label: string; value: string } | null>(null);

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
                ? "flex items-center gap-3 border-t border-[var(--og-border)] px-4 py-3.5"
                : "flex items-center gap-3 px-4 py-3.5"
            }
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] text-[var(--og-text-muted)]">{f.label}</p>
              <p className="mt-0.5 text-[14.5px] text-[var(--og-text)]">{f.value}</p>
            </div>
            <button
              type="button"
              onClick={() => setRequest({ label: f.label, value: f.value })}
              className="og-press shrink-0 rounded-[var(--og-r-pill)] bg-[var(--og-surface-alt)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--og-text-muted)]"
            >
              Request a change
            </button>
          </div>
        ))}
        <p className="border-t border-[var(--og-border)] px-4 py-3 text-[12px] leading-5 text-[var(--og-text-muted)]">
          We keep these ourselves so deliveries and invoices always match.
        </p>
      </Card>

      <SupportSheet
        open={request !== null}
        onClose={() => setRequest(null)}
        prefill={
          request
            ? {
                category: "details",
                subject: `Change ${request.label.toLowerCase()}`,
                context: { field: request.label, current: request.value },
              }
            : undefined
        }
      />
    </>
  );
}
