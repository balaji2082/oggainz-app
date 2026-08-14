"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ownerReply, ownerSetStatus } from "@/app/actions/support";
import type { Ticket } from "@/lib/support";
import { useToast } from "../ui/Toast";

export default function TicketInbox({ tickets }: { tickets: Ticket[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = tickets.find((t) => t.id === openId);

  if (tickets.length === 0) {
    return (
      <p className="rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-4 text-[13.5px] text-[var(--og-text-muted)]">
        Nothing waiting.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((t) => (
        <div
          key={t.id}
          role="button"
          tabIndex={0}
          onClick={() => setOpenId(openId === t.id ? null : t.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpenId(openId === t.id ? null : t.id);
          }}
          className="og-press w-full rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] p-4 text-left shadow-[var(--og-e1)]"
        >
          <div className="flex items-center gap-2">
            {t.unreadFor === "owner" && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--og-orange)]" />
            )}
            <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--og-text)]">
              {t.customerId} · {t.subject}
            </p>
            <span className="shrink-0 text-[11px] text-[var(--og-text-muted)]">{t.status}</span>
          </div>
          {t.lastMessage && (
            <p className="mt-1 truncate text-[12.5px] text-[var(--og-text-muted)]">
              {t.lastMessage}
            </p>
          )}
          {open?.id === t.id && <Thread ticket={t} />}
        </div>
      ))}
    </div>
  );
}

function Thread({ ticket }: { ticket: Ticket }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function reply(e: React.MouseEvent) {
    e.stopPropagation();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await ownerReply(ticket.id, body);
      toast(result.message, result.ok ? "good" : "bad");
      if (result.ok) {
        setBody("");
        router.refresh();
      }
    });
  }

  function resolve(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const result = await ownerSetStatus(ticket.id, "resolved");
      toast(result.message, result.ok ? "good" : "bad");
      if (result.ok) router.refresh();
    });
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="mt-3 border-t border-[var(--og-border)] pt-3">
      {ticket.context && (
        <pre className="mb-2 whitespace-pre-wrap rounded-[var(--og-r-sm)] bg-[var(--og-surface-alt)] px-2.5 py-2 text-[11px] text-[var(--og-text-muted)]">
          {JSON.stringify(ticket.context)}
        </pre>
      )}
      <ul className="max-h-48 space-y-2 overflow-y-auto">
        {(ticket.messages ?? []).map((m) => (
          <li key={m.id} className="text-[12.5px]">
            <span className="font-semibold text-[var(--og-heading)]">
              {m.author === "owner" ? "You: " : "Them: "}
            </span>
            {m.body}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Reply..."
          className="flex-1 rounded-[var(--og-r-sm)] border border-[var(--og-border)] px-3 py-2 text-[13px] outline-none"
        />
        <button
          disabled={pending || !body.trim()}
          onClick={reply}
          className="og-press rounded-[var(--og-r-sm)] bg-[var(--og-forest)] px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
        {ticket.status !== "resolved" && (
          <button
            disabled={pending}
            onClick={resolve}
            className="og-press rounded-[var(--og-r-sm)] border border-[var(--og-border)] px-3 py-2 text-[12.5px] font-semibold text-[var(--og-text-muted)] disabled:opacity-50"
          >
            Resolve
          </button>
        )}
      </div>
    </div>
  );
}
