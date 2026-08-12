import "server-only";

import { sql } from "./accounts";

/**
 * Support tickets — the one place a customer can reach a human.
 *
 * Lives in the app's Postgres, not the Command Center (docs/05 §4). A ticket
 * thread holds no meal and no rupee, so it fails neither half of the docs/03
 * §1.1 test, and putting it here means Balaji works it from the same `/admin`
 * he already signs into on his phone.
 *
 * [LAW] docs/05 §2 — no copy in this file, or in anything that renders it, tells
 * a customer that meals can be cancelled after the deadline. Late requests are
 * screened case by case and are never advertised as available. The categories
 * below are deliberately about *what is wrong*, not *what we will do about it*.
 */

export type TicketCategory =
  | "subscription"
  | "delivery"
  | "billing"
  | "meal"
  | "details"
  | "other";

export type TicketStatus = "open" | "answered" | "resolved";

export const CATEGORIES: { value: TicketCategory; label: string; hint: string }[] = [
  { value: "subscription", label: "My pack", hint: "Dates, meals, pausing" },
  { value: "delivery", label: "Delivery", hint: "Address, timing, the rider" },
  { value: "meal", label: "The food", hint: "Something wasn't right" },
  { value: "billing", label: "Payment", hint: "Invoices and amounts" },
  { value: "details", label: "My details", hint: "Name, phone, address" },
  { value: "other", label: "Something else", hint: "" },
];

export interface TicketMessage {
  id: number;
  author: "customer" | "owner";
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: number;
  customerId: string;
  customerName?: string | null;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  context: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  unreadFor: "owner" | "customer" | "none";
  messages?: TicketMessage[];
  /** Cheap preview for a list, so rendering one does not need every message. */
  lastMessage?: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function shape(r: any): Ticket {
  return {
    id: Number(r.id),
    customerId: String(r.customer_id),
    subject: String(r.subject),
    category: r.category,
    status: r.status,
    context: r.context ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    unreadFor: r.unread_for,
    lastMessage: r.last_message ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const MAX_SUBJECT = 120;
const MAX_BODY = 4000;

/**
 * Open a ticket.
 *
 * `context` is what the ticket was raised FROM — a meal date, or the profile
 * field being queried. It is what turns "please change my address" into
 * something answerable without a second message asking which one.
 */
export async function openTicket(input: {
  customerId: string;
  accountId?: string | null;
  subject: string;
  category: TicketCategory;
  body: string;
  context?: Record<string, unknown>;
}): Promise<Ticket> {
  const subject = input.subject.trim().slice(0, MAX_SUBJECT) || "Support request";
  const body = input.body.trim().slice(0, MAX_BODY);
  if (!body) throw new Error("a ticket needs a message");

  const rows = await sql()`
    INSERT INTO support_tickets (customer_id, account_id, subject, category, context, unread_for)
    VALUES (${input.customerId}, ${input.accountId ?? null}, ${subject},
            ${input.category}, ${JSON.stringify(input.context ?? null)}::jsonb, 'owner')
    RETURNING *
  `;
  const ticket = shape(rows[0]);
  await sql()`
    INSERT INTO ticket_messages (ticket_id, author, body)
    VALUES (${ticket.id}, 'customer', ${body})
  `;
  return ticket;
}

/** Add a message to an existing thread, from either side. */
export async function reply(
  ticketId: number,
  author: "customer" | "owner",
  body: string,
  /** Guards the customer path: a customer may only reply to their own ticket. */
  customerId?: string
): Promise<void> {
  const text = body.trim().slice(0, MAX_BODY);
  if (!text) throw new Error("an empty reply is not a reply");

  const owned = customerId
    ? await sql()`SELECT 1 FROM support_tickets WHERE id = ${ticketId} AND customer_id = ${customerId}`
    : await sql()`SELECT 1 FROM support_tickets WHERE id = ${ticketId}`;
  if (owned.length === 0) throw new Error("no such ticket");

  await sql()`
    INSERT INTO ticket_messages (ticket_id, author, body)
    VALUES (${ticketId}, ${author}, ${text})
  `;
  // A reply from either side reopens the conversation and hands the unread flag
  // to the other person. One column drives both badges, so they cannot disagree
  // about whose turn it is.
  await sql()`
    UPDATE support_tickets
       SET updated_at = now(),
           status     = ${author === "owner" ? "answered" : "open"},
           unread_for = ${author === "owner" ? "customer" : "owner"}
     WHERE id = ${ticketId}
  `;
}

export async function myTickets(customerId: string): Promise<Ticket[]> {
  const rows = await sql()`
    SELECT t.*, (
      SELECT body FROM ticket_messages m
       WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1
    ) AS last_message
    FROM support_tickets t
    WHERE t.customer_id = ${customerId}
    ORDER BY t.updated_at DESC
    LIMIT 50
  `;
  return rows.map(shape);
}

export async function getTicket(
  ticketId: number,
  /** Omit for the owner; pass it for a customer, so one cannot read another's. */
  customerId?: string
): Promise<Ticket | null> {
  const rows = customerId
    ? await sql()`SELECT * FROM support_tickets WHERE id = ${ticketId} AND customer_id = ${customerId}`
    : await sql()`SELECT * FROM support_tickets WHERE id = ${ticketId}`;
  if (rows.length === 0) return null;

  const messages = await sql()`
    SELECT id, author, body, created_at FROM ticket_messages
     WHERE ticket_id = ${ticketId} ORDER BY created_at
  `;
  return {
    ...shape(rows[0]),
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    messages: messages.map((m: any) => ({
      id: Number(m.id),
      author: m.author,
      body: String(m.body),
      createdAt: new Date(m.created_at).toISOString(),
    })),
  };
}

/** Mark the thread read by whoever just opened it — never by the other side. */
export async function markRead(ticketId: number, reader: "owner" | "customer"): Promise<void> {
  await sql()`
    UPDATE support_tickets SET unread_for = 'none'
     WHERE id = ${ticketId} AND unread_for = ${reader}
  `;
}

export async function setStatus(ticketId: number, status: TicketStatus): Promise<void> {
  await sql()`
    UPDATE support_tickets
       SET status = ${status}, updated_at = now(),
           unread_for = ${status === "resolved" ? "customer" : "owner"}
     WHERE id = ${ticketId}
  `;
}

/** Balaji's inbox: unresolved first, then most recently touched. */
export async function inbox(): Promise<Ticket[]> {
  const rows = await sql()`
    SELECT t.*, (
      SELECT body FROM ticket_messages m
       WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1
    ) AS last_message
    FROM support_tickets t
    ORDER BY (t.status = 'resolved'), t.updated_at DESC
    LIMIT 100
  `;
  return rows.map(shape);
}

/** How many threads are waiting on the person asking. Drives the nav badge. */
export async function unreadCount(who: "owner" | "customer", customerId?: string): Promise<number> {
  const rows =
    who === "owner"
      ? await sql()`SELECT COUNT(*)::int AS n FROM support_tickets WHERE unread_for = 'owner'`
      : await sql()`SELECT COUNT(*)::int AS n FROM support_tickets
                     WHERE unread_for = 'customer' AND customer_id = ${customerId ?? ""}`;
  return Number(rows[0]?.n ?? 0);
}
