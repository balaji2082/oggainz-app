import Image from "next/image";
import Link from "next/link";

import { Avatar } from "./Bits";
import TabBar from "./TabBar";

interface ShellProps {
  customerId: string;
  children: React.ReactNode;
  /** Unread support replies — a dot on the tab, nothing louder. */
  supportUnread?: boolean;
  /** The customer's own photo, for the header. */
  avatar?: string | null;
  name?: string;
}

/**
 * The frame every customer screen sits inside.
 *
 * It lives in `app/me/[id]/layout.tsx` now, not in each page. That move is the
 * single biggest thing done for perceived speed: the header and the tab dock
 * are rendered once and then STAY, so changing tabs swaps the content inside a
 * frame that never blinks. Before, every tab change tore down the whole screen
 * — logo, avatar, nav and all — and rebuilt it after the server answered, which
 * is why the calendar's three seconds felt like the app had frozen rather than
 * like one section loading.
 *
 * It also means `loading.tsx` can do its job: a skeleton now appears INSIDE the
 * frame immediately, instead of replacing the entire app with a blank page.
 *
 * `active` is gone as a prop — TabBar reads the route itself, which is both one
 * less thing for a new screen to remember and what lets the highlight move the
 * instant a finger lands.
 */
export default function Shell({
  customerId,
  children,
  supportUnread,
  avatar,
  name,
}: ShellProps) {
  const base = `/me/${customerId}`;
  return (
    <div className="mx-auto w-full max-w-[520px]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--og-border)] bg-[var(--og-bg)]/85 px-5 py-2.5 backdrop-blur-xl">
        {/* The stacked lockup, at a size that reads as a brand rather than a
            favicon. It carries the wordmark itself, so the separate "OG Gainz"
            text beside it was saying the same thing twice. */}
        <Link href={base} aria-label="OG Gainz — home" className="og-press shrink-0">
          <Image
            src="/brand/stacked_forest.svg"
            alt="OG Gainz"
            width={190}
            height={74}
            priority
            className="og-logo h-[58px] w-auto"
          />
        </Link>

        <Link
          href={`${base}/account`}
          prefetch
          aria-label="Your profile"
          className="og-press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          {/* A hairline ring rather than a heavy outline: it reads as a
              considered edge on the photo instead of a selection state. */}
          <span
            aria-hidden="true"
            className="absolute inset-[3px] rounded-full ring-1 ring-[var(--og-border)]"
          />
          <Avatar src={avatar} name={name ?? "You"} size={38} />
        </Link>
      </header>

      <main className="px-5 pt-5">{children}</main>

      <TabBar customerId={customerId} supportUnread={supportUnread} />
    </div>
  );
}
