import Image from "next/image";
import Link from "next/link";

import { Avatar } from "./Bits";

interface ShellProps {
  customerId: string;
  active: "home" | "calendar" | "pack" | "support" | "account";
  children: React.ReactNode;
  /** Unread support replies — a red dot on the tab, nothing louder. */
  supportUnread?: boolean;
  /** The customer's own photo, for the header. */
  avatar?: string | null;
  name?: string;
}

/**
 * Four tabs, not five.
 *
 * Profile moved out of the bar and up to the avatar in the top-right: it is the
 * tab people open least, the header had empty space doing nothing, and the
 * top-right corner is where everyone already looks for their own account. The
 * four that remain are the four things a customer actually does.
 */
const NAV = [
  { key: "home", label: "Today", href: "" },
  { key: "calendar", label: "Calendar", href: "/calendar" },
  { key: "pack", label: "My pack", href: "/pack" },
  { key: "support", label: "Support", href: "/support" },
] as const;

function NavIcon({ name, on }: { name: string; on: boolean }) {
  const stroke = on ? "var(--og-forest)" : "var(--og-text-muted)";
  const common = {
    width: 21,
    height: 21,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: on ? 2.2 : 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "home")
    return (
      <svg {...common} aria-hidden="true">
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10.5V20h12v-9.5" />
      </svg>
    );
  if (name === "calendar")
    return (
      <svg {...common} aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="16" rx="3" />
        <path d="M3 9.5h18M8 3v3M16 3v3" />
        {on && <circle cx="8.5" cy="14" r="1.2" fill={stroke} stroke="none" />}
      </svg>
    );
  if (name === "pack")
    return (
      <svg {...common} aria-hidden="true">
        <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" />
        <path d="M4 8.5 12 13l8-4.5M12 13v7" />
      </svg>
    );
  if (name === "support")
    return (
      <svg {...common} aria-hidden="true">
        <path d="M4 5.5h16v11H9l-4 3.5v-3.5H4z" />
      </svg>
    );
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.7 3.6-5.5 7-5.5s6.2 1.8 7 5.5" />
    </svg>
  );
}

export default function Shell({
  customerId,
  active,
  children,
  supportUnread,
  avatar,
  name,
}: ShellProps) {
  const base = `/me/${customerId}`;
  const onAccount = active === "account";
  return (
    <div className="mx-auto w-full max-w-[520px]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--og-border)] bg-[var(--og-bg)]/92 px-5 py-3 backdrop-blur-md">
        {/* The stacked lockup, at a size that reads as a brand rather than a
            favicon. It carries the wordmark itself, so the separate "OG Gainz"
            text beside it was saying the same thing twice. */}
        <Link href={base} aria-label="OG Gainz — home" className="og-press shrink-0">
          <Image
            src="/brand/stacked_forest.svg"
            alt="OG Gainz"
            width={104}
            height={40}
            priority
            className="h-[40px] w-auto"
          />
        </Link>

        <Link
          href={`${base}/account`}
          aria-label="Your profile"
          aria-current={onAccount ? "page" : undefined}
          className={[
            "og-press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            onAccount ? "ring-2 ring-[var(--og-forest)] ring-offset-2 ring-offset-[var(--og-bg)]" : "",
          ].join(" ")}
        >
          <Avatar src={avatar} name={name ?? "You"} size={38} />
        </Link>
      </header>

      <main className="px-5 pt-5">{children}</main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] border-t border-[var(--og-border)] bg-[var(--og-surface)]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,43,32,0.06)] backdrop-blur-md"
      >
        <ul className="flex">
          {NAV.map((item) => {
            const on = active === item.key;
            return (
              <li key={item.key} className="flex-1">
                <Link
                  href={`${base}${item.href}`}
                  aria-current={on ? "page" : undefined}
                  className="og-press relative flex min-h-[60px] flex-col items-center justify-center gap-1 pt-2"
                >
                  <span className="relative">
                    <NavIcon name={item.key} on={on} />
                    {item.key === "support" && supportUnread && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--og-orange)] ring-2 ring-[var(--og-surface)]"
                      />
                    )}
                  </span>
                  <span
                    className={
                      on
                        ? "text-[10.5px] font-semibold text-[var(--og-forest)]"
                        : "text-[10.5px] text-[var(--og-text-muted)]"
                    }
                  >
                    {item.label}
                  </span>
                  {on && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 h-[2.5px] w-8 rounded-full bg-[var(--og-forest)]"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
