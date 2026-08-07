import { notFound } from "next/navigation";

import Shell from "@/components/Shell";
import { rupees, shortDate } from "@/lib/format";
import StaleNotice from "@/components/StaleNotice";
import { getCustomerData } from "@/lib/data";

/**
 * Your details, your bills, and the way out.
 *
 * Nothing here is editable yet — writes are step 6. Anything a customer wants
 * changed goes through WhatsApp for now, which is where it already goes.
 */
export default async function Account({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCustomerData(id);
  if (!data.customer) notFound();

  const customer = data.customer;
  const invoices = data.invoices;
  const settings = data.settings;

  return (
    <Shell customerId={id} active="account">
      <StaleNotice asOf={data.asOf} />
      <p className="font-display text-[22px] font-semibold leading-tight tracking-tight text-[var(--og-forest)]">
        Account
      </p>
      <p className="mb-6 mt-1 text-[14px] text-[var(--og-text-muted)]">
        Your details and your bills.
      </p>

      <Card title="You">
        <Line label="Name" value={customer.name} />
        <Line label="Phone" value={customer.phone ?? "—"} />
        <Line label="Area" value={customer.locality ?? "—"} />
        <p className="px-4 pb-4 pt-1 text-[12px] leading-5 text-[var(--og-text-muted)]">
          Need any of this changed? Message us and we&rsquo;ll update it.
        </p>
      </Card>

      <Card title="Delivery times">
        <Line label="Lunch" value={settings.lunchWindow} />
        <Line label="Dinner" value={settings.dinnerWindow} />
        <p className="px-4 pb-4 pt-1 text-[12px] leading-5 text-[var(--og-text-muted)]">
          We aim for these windows. Traffic and weather can occasionally delay a
          drop — we&rsquo;ll always tell you if that happens.
        </p>
      </Card>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
          Bills
        </h2>
        {invoices.length > 0 ? (
          <ul className="overflow-hidden rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)]">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 border-b border-[var(--og-border)] px-4 py-3.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--og-text)]">
                    {inv.id}
                  </p>
                  <p className="text-[12px] text-[var(--og-text-muted)]">
                    {inv.date ? shortDate(inv.date) : "—"} · {rupees(inv.total)}
                  </p>
                </div>
                {inv.token && (
                  <a
                    href={`https://oggainz.pythonanywhere.com/i/${inv.token}`}
                    target="_blank"
                    rel="noopener"
                    className="shrink-0 rounded-full bg-[var(--og-surface-alt)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--og-text)]"
                  >
                    View
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] p-5 text-[14px] text-[var(--og-text-muted)]">
            No bills yet.
          </p>
        )}
      </section>

      <section className="pb-4">
        <a
          href="https://wa.me/919361798644"
          className="mb-3 flex w-full items-center justify-center rounded-[var(--radius-og)] bg-[var(--og-forest)] px-5 py-3.5 text-[14px] font-semibold text-white"
        >
          Message us on WhatsApp
        </a>
        <a
          href="/api/auth/logout"
          className="flex w-full items-center justify-center rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] px-5 py-3.5 text-[14px] font-semibold text-[var(--og-text-muted)]"
        >
          Sign out
        </a>
      </section>
    </Shell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--og-text-muted)]">
        {title}
      </h2>
      <div className="overflow-hidden rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)]">
        {children}
      </div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-[var(--og-border)] px-4 py-3.5 last:border-b-0">
      <span className="w-20 shrink-0 text-[12.5px] text-[var(--og-text-muted)]">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-[14px] text-[var(--og-text)]">{value}</span>
    </div>
  );
}
