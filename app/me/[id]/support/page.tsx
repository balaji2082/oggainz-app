import { notFound } from "next/navigation";

import { PageHead } from "@/components/Bits";
import SupportScreen from "@/components/SupportScreen";
import { loadScreen } from "@/lib/screen";
import { myTickets } from "@/lib/support";

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
  const [{ data }, tickets] = await Promise.all([loadScreen(id), myTickets(id)]);
  if (!data.customer) notFound();

  return (
    <>
      <PageHead
        icon="chat"
        title="Support"
        subtitle="Anything about your pack, delivery or the food."
      />
      <SupportScreen tickets={tickets} />
    </>
  );
}
