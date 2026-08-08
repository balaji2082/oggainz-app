import { redirect } from "next/navigation";

import {
  accountForCustomer,
  createInvite,
  INVITE_DAYS,
  linkedAccounts,
  sql,
  unlinkCustomer,
} from "@/lib/accounts";
import { revalidatePath } from "next/cache";
import { fetchCustomer } from "@/lib/commandcenter";
import { currentSession } from "@/lib/current-user";
import { isOwnerEmail } from "@/lib/session";

/**
 * Balaji's page for sending a customer their sign-in link.
 *
 * WHY THIS EXISTS RATHER THAN A BUTTON IN THE COMMAND CENTER
 * -----------------------------------------------------------
 * There IS such a button (app_invites.py) and it cannot work: PythonAnywhere's
 * free tier only allows outgoing requests to sites on their allowlist, so the
 * Command Center is not permitted to call this app at all. Pressing it returns
 * "Tunnel connection failed" from their proxy.
 *
 * The connection only works in one direction — this app can reach the Command
 * Center, but not the reverse. So the invite is created from this side, where
 * the invite already lives (docs/03 §3) and no outbound call is needed.
 *
 * Owner-only, checked against OG_OWNER_EMAIL. Anyone else is sent to their own
 * meals, not shown an error — there is no reason to confirm this page exists.
 */

async function accountEmail(accountId: string): Promise<string | null> {
  if (accountId === "owner") return null;
  const rows = await sql()`SELECT email FROM accounts WHERE id = ${accountId}`;
  return (rows[0] as { email: string | null } | undefined)?.email ?? null;
}

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const session = await currentSession();
  if (!session) redirect("/");
  // Either signed in AS the owner, or signed in as a customer whose Google
  // address happens to be one of Balaji's.
  const allowed = session.owner === true || isOwnerEmail(await accountEmail(session.accountId));
  if (!allowed) redirect("/me");

  const { customer: customerId } = await searchParams;
  const linked = await linkedAccounts();

  /**
   * Remove a customer's access.
   *
   * Needed because a link binds to whoever opens it, and that is not always the
   * right person — a forwarded message, or Balaji testing with his own account,
   * and the real customer can then never sign in. Without this the mistake is
   * permanent. Re-checks ownership inside the action: a server action is a URL,
   * and the page's guard does not protect it.
   */
  async function unlink(formData: FormData) {
    "use server";
    const s = await currentSession();
    if (!s) return;
    const ok = s.owner === true || isOwnerEmail(await accountEmail(s.accountId));
    if (!ok) return;
    const cid = String(formData.get("customer_id") ?? "").trim().toUpperCase();
    if (cid) await unlinkCustomer(cid);
    revalidatePath("/admin");
  }

  let result: null | {
    ok: boolean;
    name?: string;
    phone?: string | null;
    link?: string;
    message?: string;
  } = null;

  if (customerId) {
    const cid = customerId.trim().toUpperCase();
    const existing = await accountForCustomer(cid);
    if (existing) {
      result = {
        ok: false,
        message: `${cid} already has an account. They can just sign in at app.oggainz.com — no link needed.`,
      };
    } else {
      // Look the customer up so the link is never sent to a typo.
      let name: string | undefined;
      let phone: string | null = null;
      try {
        const c = await fetchCustomer(cid);
        if (!c) {
          result = { ok: false, message: `No customer with the id ${cid}.` };
        } else {
          name = c.name;
          phone = c.phone;
        }
      } catch {
        result = {
          ok: false,
          message:
            "Couldn't reach the Command Center to check that id. It may be asleep — try again in a moment.",
        };
      }
      if (!result && name) {
        const invite = await createInvite(cid);
        const base = process.env.APP_BASE_URL ?? "https://app.oggainz.com";
        result = {
          ok: true,
          name,
          phone,
          link: `${base.replace(/\/$/, "")}/join/${invite.token}`,
        };
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-[560px] px-5 py-10">
      <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight text-[var(--og-forest)]">
        Invite a customer
      </h1>
      <p className="mt-2 text-[14px] leading-6 text-[var(--og-text-muted)]">
        Type their customer id — it&rsquo;s the C0xx under their name in the
        Command Center — and send them the link on WhatsApp.
      </p>

      <form method="get" className="mt-6 flex gap-2">
        <input
          name="customer"
          defaultValue={customerId ?? ""}
          placeholder="C001"
          autoCapitalize="characters"
          className="w-full rounded-[var(--radius-og)] border border-[var(--og-border)] bg-white px-4 py-3 text-[15px] text-[var(--og-text)] outline-none"
        />
        <button className="shrink-0 rounded-[var(--radius-og)] bg-[var(--og-forest)] px-5 py-3 text-[14px] font-semibold text-white">
          Create
        </button>
      </form>

      {result && !result.ok && (
        <p className="mt-5 rounded-[var(--radius-og)] border border-[#f0c9c4] bg-[#fdecea] px-4 py-3 text-[13.5px] leading-5 text-[#8c2f22]">
          {result.message}
        </p>
      )}

      {result?.ok && result.link && (
        <section className="mt-5 rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5">
          <p className="font-display text-[16px] font-semibold text-[var(--og-forest)]">
            Link for {result.name}
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--og-text-muted)]">
            Works once, expires in {INVITE_DAYS} days.
          </p>
          <p className="mt-3 break-all rounded-[10px] bg-[var(--og-surface-alt)] px-3 py-2.5 text-[12.5px] text-[var(--og-text)]">
            {result.link}
          </p>
          {result.phone && (
            <a
              className="mt-3 flex w-full items-center justify-center rounded-[var(--radius-og)] bg-[var(--og-forest)] px-5 py-3 text-[14px] font-semibold text-white"
              target="_blank"
              rel="noopener"
              href={`https://wa.me/${
                result.phone.replace(/\D/g, "").length === 10
                  ? "91" + result.phone.replace(/\D/g, "")
                  : result.phone.replace(/\D/g, "")
              }?text=${encodeURIComponent(
                `Hi ${result.name}, here is your OG Gainz app link. Tap it, sign in with Google, and you can see your meals, what is in each one, and how many you have left: ${result.link}`
              )}`}
            >
              Send on WhatsApp
            </a>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
          Who has access
        </h2>
        {linked.length === 0 ? (
          <p className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] p-4 text-[13.5px] text-[var(--og-text-muted)]">
            Nobody has signed in yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)]">
            {linked.map((a) => (
              <li
                key={a.customer_id}
                className="flex items-center gap-3 border-b border-[var(--og-border)] px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--og-text)]">
                    {a.customer_id}
                  </p>
                  <p className="truncate text-[12px] text-[var(--og-text-muted)]">
                    {a.email ?? "no email"}
                  </p>
                </div>
                <form action={unlink}>
                  <input type="hidden" name="customer_id" value={a.customer_id} />
                  <button className="shrink-0 rounded-full border border-[var(--og-border)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--og-text-muted)]">
                    Remove access
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 px-1 text-[11.5px] leading-4 text-[var(--og-text-muted)]">
          Removing access frees that customer to be invited again — use it if a
          link reached the wrong person. Their meals and history are untouched.
        </p>
      </section>

      <p className="mt-10 text-[12px] leading-5 text-[var(--og-text-muted)]">
        The Invite button inside the Command Center cannot work — PythonAnywhere&rsquo;s
        free plan blocks it from calling this app. Use this page instead.
      </p>
    </main>
  );
}
