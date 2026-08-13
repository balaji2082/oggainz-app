import { notFound } from "next/navigation";

import { Empty, Pill, ProgressRing, SectionTitle } from "@/components/Bits";
import DeliveryHistory from "@/components/DeliveryHistory";
import Shell from "@/components/Shell";
import StaleNotice from "@/components/StaleNotice";
import { componentLabel, longDate, rupees, shortDate } from "@/lib/format";
import { todayISO } from "@/lib/data";
import { loadScreen } from "@/lib/screen";
import type { Pack } from "@/lib/types";

/**
 * What is actually in the box, how much of the pack is left, and — when
 * Balaji has switched it on — how many days there are to use it.
 *
 * A customer holding two packs at once is normal, so this is a list, never a
 * single subscription.
 */
export default async function MyPack({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, avatar, unread } = await loadScreen(id);
  if (!data.customer) notFound();
  const packs = data.packs;
  const live = packs.filter(
    (p) => p.status === "Active" || p.status === "Ending Soon" || p.status === "Paused" || p.status === "Expired"
  );
  const finished = packs.filter((p) => !live.includes(p));
  const invoices = data.invoices;

  return (
    <Shell customerId={id} active="pack" supportUnread={unread > 0} avatar={avatar} name={data.customer.name}>
      <StaleNotice asOf={data.asOf} />
      <p className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--og-forest)]">
        {live.length === 1 ? "Your pack" : "Your packs"}
      </p>
      <p className="mb-6 mt-1 text-[14px] text-[var(--og-text-muted)]">
        What&rsquo;s in every meal, and how many you have left.
      </p>

      {live.length === 0 && (
        <Empty title="No active pack right now" body="Message us when you're ready to start." />
      )}

      <div className="og-stagger space-y-4">
        {live.map((p) => (
          <PackDetail key={p.id} pack={p} />
        ))}
      </div>

      <DeliveryHistory packs={packs} meals={data.meals} todayISO={todayISO()} />

      {invoices.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Invoices</SectionTitle>
          <ul className="overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
            {invoices.slice(0, 12).map((inv, i) => (
              <li
                key={inv.id}
                className={
                  i > 0
                    ? "flex items-center gap-3 border-t border-[var(--og-border)] px-4 py-3.5"
                    : "flex items-center gap-3 px-4 py-3.5"
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--og-text)]">
                    {rupees(inv.total)}
                  </p>
                  <p className="text-[12px] text-[var(--og-text-muted)]">
                    {inv.date ? shortDate(inv.date) : "—"}
                  </p>
                </div>
                <Pill tone={inv.paymentStatus === "Paid" ? "good" : "warn"}>
                  {inv.paymentStatus}
                </Pill>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finished.length > 0 && (
        <section className="mt-8 pb-4">
          <SectionTitle>Finished</SectionTitle>
          <ul className="overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
            {finished.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 border-b border-[var(--og-border)] px-4 py-3.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--og-text)]">
                    {p.planName}
                  </p>
                  <p className="text-[12px] text-[var(--og-text-muted)]">
                    {p.startDate ? `Started ${shortDate(p.startDate)}` : ""} ·{" "}
                    {p.delivered} meals delivered
                  </p>
                </div>
                <Pill tone="quiet">{p.status}</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

function PackDetail({ pack }: { pack: Pack }) {
  const base = pack.components.filter((c) => c.kind === "base");
  const addons = pack.components.filter((c) => c.kind === "addon");
  const v = pack.validity;
  const urgent = v?.enforced && v.daysLeft !== null && v.daysLeft <= 7;

  return (
    <article className="overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
      <div className="border-b border-[var(--og-border)] px-5 py-5">
        <div className="flex items-start gap-4">
          <ProgressRing done={pack.delivered} total={pack.mealsTotal} size={72} label="left" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-[17px] font-semibold leading-tight tracking-[-0.01em] text-[var(--og-forest)]">
                {pack.planName}
              </p>
              {pack.pausedToday ? (
                <Pill tone="warn">Paused</Pill>
              ) : pack.status === "Expired" ? (
                <Pill tone="warn">Expired</Pill>
              ) : pack.status === "Ending Soon" ? (
                <Pill tone="warn">Ending soon</Pill>
              ) : (
                <Pill tone="good">Active</Pill>
              )}
            </div>
            <p className="mt-0.5 text-[12.5px] text-[var(--og-text-muted)]">
              {pack.slot}
              {pack.duration ? ` · ${pack.duration}` : ""}
              {pack.startDate ? ` · from ${shortDate(pack.startDate)}` : ""}
            </p>
            <p className="mt-2.5 text-[13px] text-[var(--og-text)]">
              <span className="font-display font-bold text-[var(--og-forest)]">
                {pack.remaining}
              </span>{" "}
              of {pack.mealsTotal} meals left
            </p>
          </div>
        </div>

        {v?.enforced && v.expiresOn && (
          <div
            className={[
              "mt-4 rounded-[var(--og-r-md)] px-3.5 py-2.5 text-[12.5px] font-medium leading-5",
              pack.status === "Expired"
                ? "bg-[color-mix(in_srgb,var(--og-danger)_8%,transparent)] text-[var(--og-danger)]"
                : urgent
                  ? "bg-[color-mix(in_srgb,var(--og-orange)_9%,transparent)] text-[var(--og-orange)]"
                  : "bg-[var(--og-surface-alt)] text-[var(--og-text-muted)]",
            ].join(" ")}
          >
            {pack.status === "Expired"
              ? `This pack's window closed on ${longDate(v.expiresOn)}, with ${pack.remaining} meal${pack.remaining === 1 ? "" : "s"} still owed — message us.`
              : v.daysLeft !== null && v.daysLeft <= 0
                ? `Expires today — use it before ${longDate(v.expiresOn)} ends`
                : `${v.daysLeft} day${v.daysLeft === 1 ? "" : "s"} left to use these meals · valid until ${longDate(v.expiresOn)}`}
          </div>
        )}

        {pack.skipped > 0 && (
          <p className="mt-3 text-[12px] text-[var(--og-text-muted)]">
            {pack.skipped} skipped — those meals carry forward, never lost.
          </p>
        )}
      </div>

      <div className="px-5 py-4">
        <h3 className="mb-2.5 font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
          In every meal
        </h3>
        {base.length > 0 ? (
          <ul className="space-y-1.5">
            {base.map((c, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[14px]">
                <span className="text-[var(--og-text)]">{componentLabel(c)}</span>
                {c.protein && (
                  <span className="text-[11.5px] text-[var(--og-text-muted)]">
                    {c.protein}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[var(--og-text-muted)]">
            Message us and we&rsquo;ll confirm exactly what&rsquo;s in yours.
          </p>
        )}

        {addons.length > 0 && (
          <>
            <h3 className="mb-2.5 mt-5 font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
              Your extras
            </h3>
            <ul className="space-y-1.5">
              {addons.map((c, i) => (
                <li key={i} className="text-[14px] text-[var(--og-text)]">
                  + {componentLabel(c)}
                </li>
              ))}
            </ul>
          </>
        )}

        {pack.notes && (
          <p className="mt-4 rounded-[var(--og-r-sm)] bg-[var(--og-surface-alt)] px-3.5 py-2.5 text-[12.5px] leading-5 text-[var(--og-text-muted)]">
            {pack.notes}
          </p>
        )}
      </div>
    </article>
  );
}
