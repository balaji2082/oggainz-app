import { redirect } from "next/navigation";

import Shell from "@/components/Shell";
import { currentSession } from "@/lib/current-user";
import { loadScreen } from "@/lib/screen";

/**
 * Guards every customer screen at once — and now frames them too.
 *
 * [LAW] docs/03 §5.1 — a customer id in the URL proves nothing; it is typed by
 * the browser. In a real deployment the session decides whose data this is, and
 * asking for someone else's simply returns you to your own.
 *
 * Living in the layout rather than in each page means a page added later is
 * covered without anyone having to remember — the same deny-by-default thinking
 * as the Command Center's permission map.
 *
 * The Shell moved here for speed. A layout is rendered once and kept across
 * navigations inside it, so the header and the tab dock no longer die and come
 * back on every tab change; only the content between them is replaced. The
 * `loadScreen` call costs nothing extra — it is the same memoised promise the
 * page awaits, so the two share one round trip rather than making two.
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

  // The chrome must render even when the Command Center is unreachable — a
  // customer stuck behind a broken header cannot even reach Support to tell us.
  const chrome = await loadScreen(id).catch(() => null);

  return (
    <Shell
      customerId={id}
      supportUnread={(chrome?.unread ?? 0) > 0}
      avatar={chrome?.avatar ?? null}
      name={chrome?.data.customer?.name}
    >
      {children}
    </Shell>
  );
}
