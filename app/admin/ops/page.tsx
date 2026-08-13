import Link from "next/link";
import { redirect } from "next/navigation";

import ActivityFeed from "@/components/admin/ActivityFeed";
import FeedbackStream from "@/components/admin/FeedbackStream";
import RequestQueue from "@/components/admin/RequestQueue";
import SettingsPanel from "@/components/admin/SettingsPanel";
import TicketInbox from "@/components/admin/TicketInbox";
import { sql } from "@/lib/accounts";
import { currentSession } from "@/lib/current-user";
import { recentFeedback, tagTally } from "@/lib/feedback";
import { isOwnerEmail } from "@/lib/session";
import { inbox } from "@/lib/support";
import {
  pendingRequests,
  readSettings,
  readValidityGlobal,
  recentActivity,
  validitySummary,
} from "@/lib/writes";

/**
 * Everything that needs Balaji's attention, day to day: skip/pause requests,
 * support tickets, what people said about the food, and the two settings he
 * asked to control from his phone — the deadline and pack validity.
 *
 * Kept apart from /admin (customer access) because that page is already long
 * and this is a different job — running the day, not managing sign-ins.
 */
export default async function Ops() {
  const session = await currentSession();
  if (!session) redirect("/");
  const email =
    session.accountId === "owner"
      ? null
      : ((await sql()`SELECT email FROM accounts WHERE id = ${session.accountId}`)[0] as
          | { email: string | null }
          | undefined)?.email ?? null;
  const allowed = session.owner === true || isOwnerEmail(email);
  if (!allowed) redirect("/me");

  const [requests, activity, tickets, feedback, tally, settings, validityGlobal, validityRows] =
    await Promise.all([
      pendingRequests().catch(() => []),
      recentActivity().catch(() => []),
      inbox().catch(() => []),
      recentFeedback().catch(() => []),
      tagTally().catch(() => []),
      readSettings().catch(() => ({}) as Record<string, string | null>),
      readValidityGlobal().catch(() => false),
      validitySummary().catch(() => []),
    ]);

  return (
    <main className="mx-auto w-full max-w-[560px] px-5 py-10 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--og-forest)]">
          Ops
        </h1>
        <Link href="/admin" className="text-[13px] font-semibold text-[var(--og-text-muted)]">
          Access →
        </Link>
      </div>
      <p className="mt-2 text-[14px] leading-6 text-[var(--og-text-muted)]">
        Requests, messages, feedback, and the two settings you asked for.
      </p>

      <Section title={`Requests ${requests.length > 0 ? `(${requests.length})` : ""}`}>
        <RequestQueue requests={requests} />
      </Section>

      <Section title="What customers have done">
        <ActivityFeed activity={activity} />
      </Section>

      <Section title="Settings">
        <SettingsPanel
          cutoff={settings["skip_cutoff_time"] ?? "18:00"}
          validityGlobal={validityGlobal}
          rows={validityRows}
        />
      </Section>

      <Section title={`Messages ${tickets.filter((t) => t.unreadFor === "owner").length > 0 ? `(${tickets.filter((t) => t.unreadFor === "owner").length} new)` : ""}`}>
        <TicketInbox tickets={tickets} />
      </Section>

      <Section title="What people are saying">
        <FeedbackStream items={feedback} tally={tally} />
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
