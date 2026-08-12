import { notFound } from "next/navigation";

import Shell from "@/components/Shell";
import SupportScreen from "@/components/SupportScreen";
import { getCustomerData } from "@/lib/data";
import { myTickets, unreadCount } from "@/lib/support";

/**
 * The one door to a human. docs/05 §2 — nothing here ever advertises a late
 * skip as available; it only ever promises a reply.
 */
export default async function Support({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCustomerData(id);
  if (!data.customer) notFound();

  const [tickets, unread] = await Promise.all([
    myTickets(id),
    unreadCount("customer", id),
  ]);

  return (
    <Shell customerId={id} active="support" supportUnread={unread > 0}>
      <p className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--og-forest)]">
        Support
      </p>
      <p className="mb-6 mt-1 text-[14px] text-[var(--og-text-muted)]">
        Anything about your pack, delivery or the food.
      </p>
      <SupportScreen tickets={tickets} />
    </Shell>
  );
}
