import { redirect } from "next/navigation";

import { accountForCustomer, createInvite, INVITE_DAYS, sql } from "@/lib/accounts";
import { fetchCustomer } from "@/lib/commandcenter";
import { currentSession } from "@/lib/current-user";

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

function isOwner(email: string | null | undefined): boolean {
  const owner = process.env.OG_OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner;
}

async function ownerEmail(accountId: string): Promise<string | null> {
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
  const email = await ownerEmail(session.accountId);
  if (!isOwner(email)) redirect("/me");

  const { customer: customerId } = await searchParams;

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

      <p className="mt-10 text-[12px] leading-5 text-[var(--og-text-muted)]">
        The Invite button inside the Command Center cannot work — PythonAnywhere&rsquo;s
        free plan blocks it from calling this app. Use this page instead.
      </p>
    </main>
  );
}
