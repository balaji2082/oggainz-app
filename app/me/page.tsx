import { redirect } from "next/navigation";

import { currentSession } from "@/lib/current-user";

/**
 * The signed-in customer's home.
 *
 * [LAW] docs/03 §5.1 — the customer id comes from the signed session cookie,
 * never from the URL. /me/[id] alongside this is the development picker that
 * predates sign-in; this route is the real one, and it cannot be pointed at
 * somebody else's data by editing the address bar.
 */
export default async function Me() {
  const session = await currentSession();
  if (!session) redirect("/");

  // The existing customer screen renders from the id it is given. Handing it
  // the id from the session keeps one copy of that UI while sign-in beds in;
  // the two routes converge once the screen reads through the API rather than
  // the local snapshot.
  redirect(`/me/${session.customerId}`);
}
