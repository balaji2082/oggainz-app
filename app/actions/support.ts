"use server";

import { revalidatePath } from "next/cache";

import {
  getTicket,
  markRead,
  openTicket,
  reply,
  setStatus,
  type TicketCategory,
  type TicketStatus,
} from "@/lib/support";
import { setAvatar, clearAvatar } from "@/lib/profiles";
import { forgetScreen } from "@/lib/screen";
import { asCustomer, asOwner, explain, type ActionResult } from "./guard";

/**
 * Support, and the one piece of their own profile a customer owns.
 *
 * [LAW] docs/05 §2 — nothing in this file, and nothing that renders it, tells a
 * customer that meals can be cancelled after the deadline. A late request is
 * screened case by case and is never advertised as available. Confirmation copy
 * therefore promises a reply, not an outcome.
 */

export async function raiseTicket(input: {
  subject: string;
  category: TicketCategory;
  body: string;
  context?: Record<string, unknown>;
}): Promise<ActionResult<{ id: number }>> {
  try {
    const { customerId, accountId } = await asCustomer();
    const ticket = await openTicket({
      customerId,
      accountId,
      subject: input.subject,
      category: input.category,
      body: input.body,
      context: input.context,
    });
    forgetScreen(customerId);
    revalidatePath("/me", "layout");
    // Promises a reply, not a result. "We'll sort it out" would be a promise we
    // have not yet decided to keep.
    return {
      ok: true,
      message: "Sent. We'll get back to you here.",
      data: { id: ticket.id },
    };
  } catch (error) {
    return explain(error);
  }
}

export async function replyToTicket(ticketId: number, body: string): Promise<ActionResult> {
  try {
    const { customerId } = await asCustomer();
    // customerId is passed so a customer can only ever reply to their own
    // thread — the id in the argument proves nothing on its own.
    await reply(ticketId, "customer", body, customerId);
    forgetScreen(customerId);
    revalidatePath("/me", "layout");
    return { ok: true, message: "Sent." };
  } catch (error) {
    return explain(error);
  }
}

export async function readTicket(ticketId: number): Promise<ActionResult> {
  try {
    const { customerId } = await asCustomer();
    const ticket = await getTicket(ticketId, customerId);
    if (!ticket) return { ok: false, message: "That conversation isn't here." };
    await markRead(ticketId, "customer");
    return { ok: true, message: "", data: ticket };
  } catch (error) {
    return explain(error);
  }
}

// --- the owner's side -------------------------------------------------------

export async function ownerReply(ticketId: number, body: string): Promise<ActionResult> {
  try {
    await asOwner();
    await reply(ticketId, "owner", body);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Sent." };
  } catch (error) {
    return explain(error);
  }
}

export async function ownerSetStatus(
  ticketId: number,
  status: TicketStatus
): Promise<ActionResult> {
  try {
    await asOwner();
    await setStatus(ticketId, status);
    revalidatePath("/admin", "layout");
    return { ok: true, message: status === "resolved" ? "Marked resolved." : "Reopened." };
  } catch (error) {
    return explain(error);
  }
}

// --- the profile photo ------------------------------------------------------

/**
 * [LAW] docs/05 §3 — the customer's name, phone, address and pack are Balaji's
 * to edit and theirs only to query. The photo is the exception, and this is the
 * only write path to it.
 */
export async function updateAvatar(dataUrl: string): Promise<ActionResult> {
  try {
    const { customerId } = await asCustomer();
    await setAvatar(customerId, dataUrl);
    forgetScreen(customerId);
    revalidatePath("/me", "layout");
    return { ok: true, message: "Looking good." };
  } catch (error) {
    return explain(error);
  }
}

export async function removeAvatar(): Promise<ActionResult> {
  try {
    const { customerId } = await asCustomer();
    await clearAvatar(customerId);
    forgetScreen(customerId);
    revalidatePath("/me", "layout");
    return { ok: true, message: "Photo removed." };
  } catch (error) {
    return explain(error);
  }
}
