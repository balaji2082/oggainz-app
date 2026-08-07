import { notFound } from "next/navigation";

import Shell from "@/components/Shell";
import { componentLabel, shortDate } from "@/lib/format";
import { getCustomer, getPacks } from "@/lib/snapshot";
import type { Pack } from "@/lib/types";

/**
 * What is actually in the box, and how much of the pack is left.
 *
 * A customer holding two packs at once is normal — four of the live ones work
 * that way — so this is a list, never a single subscription.
 */
export default async function MyPack({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = getCustomer(id);
  if (!customer) notFound();

  const packs = getPacks(id);
  const live = packs.filter((p) => p.status === "Active" || p.status === "Ending Soon");
  const finished = packs.filter((p) => !live.includes(p));

  return (
    <Shell customerId={id} active="pack">
      <p className="font-display text-[22px] font-semibold leading-tight tracking-tight text-[var(--og-forest)]">
        {live.length === 1 ? "Your pack" : "Your packs"}
      </p>
      <p className="mb-6 mt-1 text-[14px] text-[var(--og-text-muted)]">
        What&rsquo;s in every meal, and how many you have left.
      </p>

      {live.length === 0 && (
        <p className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5 text-[14px] text-[var(--og-text-muted)]">
          No active pack right now. Message us on WhatsApp to start one.
        </p>
      )}

      <div className="space-y-4">
        {live.map((p) => (
          <PackDetail key={p.id} pack={p} />
        ))}
      </div>

      {finished.length > 0 && (
        <section className="mt-8 pb-4">
          <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
            Finished
          </h2>
          <ul className="overflow-hidden rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)]">
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
                <span className="shrink-0 rounded-full bg-[var(--og-surface-alt)] px-2.5 py-1 text-[11px] font-semibold text-[var(--og-text-muted)]">
                  {p.status}
                </span>
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
  // Progress is drawn from counts the Command Center computed. The app never
  // works out how many meals someone has left.
  const used = pack.delivered;
  const percent = pack.mealsTotal > 0 ? Math.round((used / pack.mealsTotal) * 100) : 0;

  return (
    <article className="overflow-hidden rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)]">
      <div className="border-b border-[var(--og-border)] px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[17px] font-semibold leading-tight text-[var(--og-forest)]">
              {pack.planName}
            </p>
            <p className="mt-0.5 text-[12.5px] text-[var(--og-text-muted)]">
              {pack.slot}
              {pack.duration ? ` · ${pack.duration}` : ""}
              {pack.startDate ? ` · from ${shortDate(pack.startDate)}` : ""}
            </p>
          </div>
          {pack.pausedToday && (
            <span className="shrink-0 rounded-full bg-[#fff4e5] px-2.5 py-1 text-[11px] font-semibold text-[#a15c00]">
              Paused
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[26px] font-semibold leading-none text-[var(--og-forest)]">
              {pack.remaining}
              <span className="ml-1.5 text-[13px] font-normal text-[var(--og-text-muted)]">
                meals left
              </span>
            </p>
            <p className="text-[12px] text-[var(--og-text-muted)]">
              {used} of {pack.mealsTotal} used
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--og-surface-alt)]">
            <div
              className="h-full rounded-full bg-[var(--og-lime)]"
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
          {pack.skipped > 0 && (
            <p className="mt-2 text-[12px] text-[var(--og-text-muted)]">
              {pack.skipped} skipped — those meals carry forward, never lost.
            </p>
          )}
        </div>
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
            Ask us on WhatsApp and we&rsquo;ll confirm exactly what&rsquo;s in yours.
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
          <p className="mt-4 rounded-[10px] bg-[var(--og-surface-alt)] px-3.5 py-2.5 text-[12.5px] leading-5 text-[var(--og-text-muted)]">
            {pack.notes}
          </p>
        )}
      </div>
    </article>
  );
}
