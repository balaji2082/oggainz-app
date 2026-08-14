"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import Icon, { type IconName } from "./ui/Icon";

/**
 * The four things a customer actually does, in a dock that floats above the
 * ground rather than a bar welded to the bottom edge.
 *
 * Two reasons this is a client component, and both are about speed:
 *
 * 1. It reads the active tab from `usePathname()` instead of a prop, so it can
 *    live in the LAYOUT. The header and this bar then survive a tab change
 *    instead of being torn down and rebuilt with every screen — which is what
 *    made moving between tabs feel like a page load in 2004.
 *
 * 2. The highlight moves the instant a finger lands, not when the server
 *    answers. Next updates the pathname optimistically, so the tap feels
 *    acknowledged even while the calendar is still fetching. Most of "the app
 *    feels slow" is the gap between tapping and seeing ANY response.
 *
 * `prefetch` is on deliberately. The four routes are the only places anyone
 * goes, the payloads are small, and every screen's data is memoised per
 * customer for a few seconds — so warming them costs almost nothing and makes
 * the second tab instant.
 */

const NAV: { key: string; label: string; href: string; icon: IconName }[] = [
  { key: "home", label: "Today", href: "", icon: "home" },
  { key: "calendar", label: "Calendar", href: "/calendar", icon: "calendar" },
  { key: "pack", label: "My pack", href: "/pack", icon: "pack" },
  { key: "support", label: "Support", href: "/support", icon: "chat" },
];

export default function TabBar({
  customerId,
  supportUnread,
}: {
  customerId: string;
  supportUnread?: boolean;
}) {
  const base = `/me/${customerId}`;
  const pathname = usePathname();

  // Exact match for Today, prefix for the rest — so /pack and a future
  // /pack/something both light the same tab.
  const activeKey =
    NAV.slice(1).find((n) => pathname.startsWith(`${base}${n.href}`))?.key ??
    (pathname === base || pathname === `${base}/` ? "home" : "");

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] px-4 pb-[calc(10px+env(safe-area-inset-bottom))]"
    >
      {/* The dock itself: a floating pill with a real blur behind it, so the
          content it covers reads as *underneath* rather than cut off. */}
      <ul className="flex items-stretch gap-1 rounded-[var(--og-r-xl)] border border-[var(--og-dock-line)] bg-[var(--og-dock)] p-1.5 shadow-[var(--og-e3)] backdrop-blur-xl">
        {NAV.map((item) => {
          const on = activeKey === item.key;
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={`${base}${item.href}`}
                prefetch
                aria-current={on ? "page" : undefined}
                className={[
                  "og-press relative flex min-h-[54px] flex-col items-center justify-center gap-[3px] rounded-[var(--og-r-lg)]",
                  on
                    ? "bg-[var(--og-dock-on)] text-[var(--og-primary)]"
                    : "text-[var(--og-text-muted)]",
                ].join(" ")}
              >
                <span className="relative">
                  <Icon name={item.icon} size={21} weight={on ? 2.1 : 1.75} />
                  {item.key === "support" && supportUnread && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-0.5 h-[7px] w-[7px] rounded-full bg-[var(--og-orange)] ring-2 ring-[var(--og-dock-ring)]"
                    />
                  )}
                </span>
                <span
                  className={
                    on
                      ? "text-[10px] font-semibold tracking-[0.01em]"
                      : "text-[10px] tracking-[0.01em]"
                  }
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
