import Image from "next/image";
import Link from "next/link";

import { listCustomers } from "@/lib/snapshot";

/**
 * TEMPORARY: a customer picker so the app can be viewed against real snapshot
 * data before sign-in exists.
 *
 * This page is replaced by the real landing page + Google / magic-link sign-in
 * (docs/03 §4). The guard below stops it ever being reachable in production.
 */
export default function Home() {
  if (process.env.NODE_ENV === "production" && !process.env.OG_ALLOW_PICKER) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[520px] items-center justify-center p-8 text-center">
        <p className="text-[15px] text-[var(--og-text-muted)]">
          Sign-in is not built yet.
        </p>
      </main>
    );
  }

  const customers = listCustomers();

  return (
    <main className="mx-auto w-full max-w-[520px] px-5 py-10">
      <div className="flex items-center gap-3">
        <Image
          src="/brand/icon_only_forest.svg"
          alt=""
          width={40}
          height={40}
          priority
        />
        <div>
          <p className="font-display text-[20px] font-bold leading-tight tracking-tight text-[var(--og-forest)]">
            OG Gainz
          </p>
          <p className="text-[12px] text-[var(--og-text-muted)]">
            Eat like it matters.
          </p>
        </div>
      </div>

      <div className="mt-7 rounded-[var(--radius-og)] border border-dashed border-[var(--og-orange)]/45 bg-[var(--og-orange)]/8 p-4">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--og-orange)]">
          Preview mode
        </p>
        <p className="mt-1 text-[13px] leading-5 text-[var(--og-text-muted)]">
          Sign-in isn&rsquo;t built yet. Pick a customer to see the app with real
          data from the Command Center snapshot.
        </p>
      </div>

      <ul className="mt-6 overflow-hidden rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)]">
        {customers.map((c, i) => (
          <li key={c.id}>
            <Link
              href={`/me/${c.id}`}
              className={
                i > 0
                  ? "flex min-h-[56px] items-center gap-3 border-t border-[var(--og-border)] px-4 py-3"
                  : "flex min-h-[56px] items-center gap-3 px-4 py-3"
              }
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--og-forest)] text-[13px] font-semibold text-white"
              >
                {c.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-[var(--og-text)]">
                  {c.name}
                </span>
                <span className="block truncate text-[12px] text-[var(--og-text-muted)]">
                  {c.id}
                  {c.locality ? ` · ${c.locality}` : ""}
                </span>
              </span>
              <span aria-hidden="true" className="text-[var(--og-text-muted)]">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {customers.length === 0 && (
        <p className="mt-6 text-[14px] text-[var(--og-text-muted)]">
          No snapshot data. Run <code>node scripts/snapshot.mjs</code>.
        </p>
      )}
    </main>
  );
}
