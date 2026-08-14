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
import { approveRequest, closeRequest, pendingRequests } from "@/lib/requests";
import { fetchCustomer, searchCustomers, type CustomerMatch } from "@/lib/commandcenter";
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
  const requests = await pendingRequests();

  // Turn "someone with this number wants in" into "this is Ashok, C001, one
  // active pack". Looked up here rather than left for Balaji to go and find,
  // because the whole point of approving is that he recognises the person.
  const matches = new Map<string, CustomerMatch[]>();
  await Promise.all(
    requests.map(async (r) => {
      matches.set(r.id, await searchCustomers(r.phone));
    })
  );

  /**
   * Remove a customer's access.
   *
   * Needed because a link binds to whoever opens it, and that is not always the
   * right person — a forwarded message, or Balaji testing with his own account,
   * and the real customer can then never sign in. Without this the mistake is
   * permanent. Re-checks ownership inside the action: a server action is a URL,
   * and the page's guard does not protect it.
   */
  /** Shared guard: a server action is a URL, so each one re-checks. */
  async function assertOwner() {
    "use server";
    const s = await currentSession();
    if (!s) return false;
    return s.owner === true || isOwnerEmail(await accountEmail(s.accountId));
  }

  async function decide(formData: FormData) {
    "use server";
    if (!(await assertOwner())) return;
    const id = String(formData.get("id") ?? "");
    const action = String(formData.get("action") ?? "");
    if (!id) return;
    if (action === "approve") {
      await approveRequest(id, String(formData.get("customer_id") ?? ""));
    } else if (action === "decline") {
      await closeRequest(id, "declined");
    } else if (action === "handled") {
      await closeRequest(id, "handled");
    }
    revalidatePath("/admin");
  }

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight text-[var(--og-heading)]">
          Invite a customer
        </h1>
        <a href="/admin/ops" className="text-[13px] font-semibold text-[var(--og-text-muted)]">
          Ops →
        </a>
      </div>
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
          <p className="font-display text-[16px] font-semibold text-[var(--og-heading)]">
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
          Waiting for you {requests.length > 0 && `(${requests.length})`}
        </h2>
        {requests.length === 0 ? (
          <p className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] p-4 text-[13.5px] text-[var(--og-text-muted)]">
            Nobody waiting.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li
                key={r.id}
                className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] p-4"
              >
                <p className="text-[15px] font-semibold text-[var(--og-text)]">
                  {r.display_name ?? "Someone"}{" "}
                  <span className="text-[12px] font-normal text-[var(--og-text-muted)]">
                    {r.kind === "subscriber" ? "· says they subscribe" : "· wants to start"}
                  </span>
                </p>
                <p className="mt-0.5 text-[12.5px] text-[var(--og-text-muted)]">
                  {r.phone} · {r.email ?? "no email"}
                  {r.goal ? ` · ${r.goal}` : ""}
                </p>

                {r.kind === "subscriber" && (
                  <MatchNote found={matches.get(r.id) ?? []} phone={r.phone} />
                )}

                {r.kind === "subscriber" ? (
                  <form action={decide} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      name="customer_id"
                      placeholder="C001"
                      autoCapitalize="characters"
                      // Pre-filled when exactly one customer has that number.
                      // More than one, or none, and it stays empty on purpose:
                      // a guess here links the wrong person to somebody's meals.
                      defaultValue={
                        (matches.get(r.id) ?? []).length === 1
                          ? matches.get(r.id)![0].id
                          : ""
                      }
                      className="w-28 rounded-[10px] border border-[var(--og-border)] bg-white px-3 py-2 text-[13px]"
                    />
                    <button
                      name="action"
                      value="approve"
                      className="rounded-[10px] bg-[var(--og-forest)] px-4 py-2 text-[13px] font-semibold text-white"
                    >
                      Approve
                    </button>
                    <button
                      name="action"
                      value="decline"
                      className="rounded-[10px] border border-[var(--og-border)] px-4 py-2 text-[13px] font-semibold text-[var(--og-text-muted)]"
                    >
                      Decline
                    </button>
                  </form>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      target="_blank"
                      rel="noopener"
                      href={`https://wa.me/91${r.phone}`}
                      className="rounded-[10px] bg-[var(--og-forest)] px-4 py-2 text-[13px] font-semibold text-white"
                    >
                      WhatsApp them
                    </a>
                    <form action={decide}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        name="action"
                        value="handled"
                        className="rounded-[10px] border border-[var(--og-border)] px-4 py-2 text-[13px] font-semibold text-[var(--og-text-muted)]"
                      >
                        Mark handled
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 px-1 text-[11.5px] leading-4 text-[var(--og-text-muted)]">
          Approving links that Google account to the customer id you type — check
          the number matches the person before you do.
        </p>
      </section>

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

/**
 * What the phone number turned up.
 *
 * Says plainly when nothing matched, because that is the interesting case: the
 * number they typed is not one we deliver to, so either they mistyped it or
 * they are not the customer they say they are. Either way it is worth pausing
 * over rather than approving on autopilot.
 */
function MatchNote({ found, phone }: { found: CustomerMatch[]; phone: string }) {
  if (found.length === 0) {
    return (
      <p className="mt-2 rounded-[10px] bg-[#fdecea] px-3 py-2 text-[12.5px] leading-5 text-[#8c2f22]">
        No customer has the number {phone}. Check with them before approving.
      </p>
    );
  }
  return (
    <div className="mt-2 rounded-[10px] bg-[var(--og-surface-alt)] px-3 py-2 text-[12.5px] leading-5 text-[var(--og-text)]">
      {found.length === 1 ? "That number belongs to " : "More than one match — pick one: "}
      {found.map((m, i) => (
        <span key={m.id}>
          {i > 0 && ", "}
          <strong>{m.name}</strong> ({m.id}
          {m.active_packs > 0
            ? `, ${m.active_packs} active pack${m.active_packs === 1 ? "" : "s"}`
            : ", no active pack"}
          )
        </span>
      ))}
      {found.length === 1 ? " — filled in below." : ""}
    </div>
  );
}
