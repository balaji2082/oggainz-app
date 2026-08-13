import { notFound } from "next/navigation";

import ProfileScreen from "@/components/ProfileScreen";
import Shell from "@/components/Shell";
import StaleNotice from "@/components/StaleNotice";
import { loadScreen } from "@/lib/screen";

/**
 * Your details, and the way out.
 *
 * [LAW] docs/05 §3 — name, phone, address and pack are Balaji's to edit and the
 * customer's only to query, so every field here is read-only with a visible
 * "request a change" rather than a disabled input with no explanation. The
 * photo is the one exception — see AvatarUploader.
 */
export default async function Account({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, avatar, unread } = await loadScreen(id);
  if (!data.customer) notFound();
  const customer = data.customer;
  const settings = data.settings;

  return (
    <Shell
      customerId={id}
      active="account"
      supportUnread={unread > 0}
      avatar={avatar}
      name={customer.name}
    >
      <StaleNotice asOf={data.asOf} />
      <p className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--og-forest)]">
        Profile
      </p>
      <p className="mb-6 mt-1 text-[14px] text-[var(--og-text-muted)]">
        Your details, kept in check by us.
      </p>

      <ProfileScreen
        name={customer.name}
        avatar={avatar}
        // The customer id is deliberately not here. It is our filing reference,
        // not something they need, and showing it invites "quote your ID" as a
        // step in conversations that should just start with their name.
        fields={[
          { key: "name", label: "Name", value: customer.name },
          { key: "phone", label: "Phone", value: customer.phone ?? "—" },
          // The real delivery address, not just the locality. "Perumbakkam" is
          // not enough for a customer to check we have the right door.
          ...(data.addresses.length > 0
            ? data.addresses.map((a, i) => ({
                key: `addr-${i}`,
                label: a.label ?? (data.addresses.length > 1 ? `Address ${i + 1}` : "Delivery address"),
                value: a.address,
              }))
            : [{ key: "area", label: "Area", value: customer.locality ?? "—" }]),
        ]}
      />

      <section className="mb-6">
        <h2 className="mb-3 font-display text-[12.5px] font-semibold uppercase tracking-[0.13em] text-[var(--og-text-muted)]">
          Delivery times
        </h2>
        <div className="overflow-hidden rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="w-16 shrink-0 text-[12.5px] text-[var(--og-text-muted)]">Lunch</span>
            <span className="text-[14px] text-[var(--og-text)]">{settings.lunchWindow}</span>
          </div>
          <div className="flex items-center gap-3 border-t border-[var(--og-border)] px-4 py-3.5">
            <span className="w-16 shrink-0 text-[12.5px] text-[var(--og-text-muted)]">Dinner</span>
            <span className="text-[14px] text-[var(--og-text)]">{settings.dinnerWindow}</span>
          </div>
          <p className="border-t border-[var(--og-border)] px-4 py-3 text-[12px] leading-5 text-[var(--og-text-muted)]">
            We aim for these windows. Traffic can occasionally delay a drop —
            we&rsquo;ll always tell you if that happens.
          </p>
        </div>
      </section>

      <section className="pb-4">
        <a
          href="/api/auth/logout"
          className="og-press flex w-full items-center justify-center rounded-[var(--og-r-md)] px-5 py-3.5 text-[13.5px] font-semibold text-[var(--og-text-muted)]"
        >
          Sign out
        </a>
      </section>
    </Shell>
  );
}
