"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { readTicket, replyToTicket } from "@/app/actions/support";
import type { Ticket, TicketMessage } from "@/lib/support";
import Button from "./ui/Button";
import { Empty, Pill } from "./Bits";
import Sheet from "./ui/Sheet";
import SupportSheet from "./SupportSheet";
import { useToast } from "./ui/Toast";

function when(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600_000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const STATUS_TONE: Record<Ticket["status"], "info" | "good" | "quiet"> = {
  open: "info",
  answered: "good",
  resolved: "quiet",
};

export default function SupportScreen({ tickets }: { tickets: Ticket[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [thread, setThread] = useState<Ticket | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const router = useRouter();

  async function open(id: number) {
    setOpenId(id);
    const result = await readTicket(id);
    if (result.ok) setThread(result.data as Ticket);
  }

  return (
    <div>
      <div className="mb-5">
        <Button
          full
          onClick={() => setNewOpen(true)}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          }
        >
          New message
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Empty
          title="No conversations yet"
          body="Anything about your pack, delivery or the food — send us a message."
        />
      ) : (
        <ul className="og-stagger overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
          {tickets.map((t, i) => (
            <li key={t.id} className={i > 0 ? "border-t border-[var(--og-border)]" : ""}>
              <button
                type="button"
                onClick={() => open(t.id)}
                className="og-press flex w-full items-start gap-3 px-4 py-3.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-medium text-[var(--og-text)]">
                      {t.subject}
                    </p>
                    {t.unreadFor === "customer" && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--og-orange)]" aria-hidden="true" />
                    )}
                  </div>
                  {t.lastMessage && (
                    <p className="mt-0.5 truncate text-[12.5px] text-[var(--og-text-muted)]">
                      {t.lastMessage}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Pill tone={STATUS_TONE[t.status]}>
                    {t.status === "open" ? "Sent" : t.status === "answered" ? "Replied" : "Resolved"}
                  </Pill>
                  <span className="text-[11px] text-[var(--og-text-muted)]">{when(t.updatedAt)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Thread
        ticket={thread}
        open={openId !== null}
        onClose={() => {
          setOpenId(null);
          setThread(null);
          router.refresh();
        }}
      />
      <SupportSheet open={newOpen} onClose={() => { setNewOpen(false); router.refresh(); }} />
    </div>
  );
}

function Thread({
  ticket,
  open,
  onClose,
}: {
  ticket: Ticket | null;
  open: boolean;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function send() {
    if (!ticket || !body.trim()) return;
    startTransition(async () => {
      const result = await replyToTicket(ticket.id, body);
      if (result.ok) setBody("");
      else toast(result.message, "bad");
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={ticket?.subject ?? "Conversation"}
      subtitle={ticket ? (ticket.status === "resolved" ? "Resolved" : "We'll reply here") : undefined}
      footer={
        ticket && ticket.status !== "resolved" ? (
          <div className="flex items-end gap-2.5">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type a reply..."
              rows={1}
              className="max-h-24 min-h-[44px] flex-1 resize-none rounded-[var(--og-r-md)] border border-[var(--og-border)] bg-[var(--og-surface)] px-3.5 py-2.5 text-[14px] outline-none placeholder:text-[var(--og-text-muted)] focus:border-[var(--og-green)]"
            />
            <Button busy={pending} disabled={!body.trim()} onClick={send}>
              Send
            </Button>
          </div>
        ) : undefined
      }
    >
      {!ticket ? (
        <div className="og-skeleton h-32 rounded-[var(--og-r-md)]" />
      ) : (
        <ul className="space-y-3 pb-2">
          {(ticket.messages ?? []).map((m: TicketMessage) => (
            <li
              key={m.id}
              className={`flex ${m.author === "customer" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={[
                  "max-w-[82%] rounded-[var(--og-r-md)] px-3.5 py-2.5 text-[13.5px] leading-5",
                  m.author === "customer"
                    ? "bg-[var(--og-forest)] text-white"
                    : "bg-[var(--og-surface-alt)] text-[var(--og-text)]",
                ].join(" ")}
              >
                <p>{m.body}</p>
                <p
                  className={`mt-1 text-[10.5px] ${m.author === "customer" ? "text-white/60" : "text-[var(--og-text-muted)]"}`}
                >
                  {when(m.createdAt)}
                </p>
              </div>
            </li>
          ))}
          {ticket.status === "resolved" && (
            <li className="pt-2 text-center text-[12px] text-[var(--og-text-muted)]">
              Marked resolved. Send a new message any time.
            </li>
          )}
        </ul>
      )}
    </Sheet>
  );
}
