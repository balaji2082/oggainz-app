import { redirect } from "next/navigation";

import { currentSession } from "@/lib/current-user";

/**
 * Guards every customer screen at once.
 *
 * [LAW] docs/03 §5.1 — a customer id in the URL proves nothing; it is typed by
 * the browser. In a real deployment the session decides whose data this is, and
 * asking for someone else's simply returns you to your own.
 *
 * Living in the layout rather than in each page means a page added later is
 * covered without anyone having to remember — the same deny-by-default thinking
 * as the Command Center's permission map.
 */
export default async function CustomerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The development picker (guarded the same way as `/`) may still pass any id.
  if (process.env.NODE_ENV === "production" && !process.env.OG_ALLOW_PICKER) {
    const session = await currentSession();
    if (!session) redirect("/");
    if (session.customerId !== id) redirect(`/me/${session.customerId}`);
  }

  return <>{children}</>;
}
