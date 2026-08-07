import { openInvite } from "@/lib/accounts";

/**
 * The link Balaji sends on WhatsApp: oggainz.com/join/<token>
 *
 * Shows one button. The token is checked before the page renders, so a dead
 * link says so immediately rather than after a trip to Google and back.
 */
export default async function Join({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await openInvite(token);

  if (!invite) {
    return (
      <Frame title="This link has expired">
        <p className="text-[14px] leading-6 text-[var(--og-text-muted)]">
          Invite links last seven days and can only be used once. Message us on
          WhatsApp and we&rsquo;ll send you a fresh one.
        </p>
      </Frame>
    );
  }

  return (
    <Frame title="Welcome to OG Gainz">
      <p className="mb-6 text-[14px] leading-6 text-[var(--og-text-muted)]">
        Sign in once and this becomes your meal tracker — what&rsquo;s coming
        today, how many meals you have left, and your delivery details.
      </p>
      <a
        href={`/api/auth/google?invite=${encodeURIComponent(token)}`}
        className="flex w-full items-center justify-center gap-3 rounded-[var(--radius-og)] border border-[var(--og-border)] bg-white px-5 py-3.5 text-[15px] font-semibold text-[#15241d] transition hover:bg-[var(--og-surface-alt)]"
      >
        <GoogleMark />
        Continue with Google
      </a>
      <p className="mt-5 text-[12px] leading-5 text-[var(--og-text-muted)]">
        We only ever see your name and email address — never your password.
      </p>
    </Frame>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-10">
      <div className="w-full max-w-[380px]">
        <h1 className="mb-2 font-display text-[24px] font-semibold leading-tight tracking-tight text-[var(--og-forest)]">
          {title}
        </h1>
        {children}
      </div>
    </main>
  );
}

/** Google's mark, inlined — the CSP blocks remote images and it never changes. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.4-4.6 7l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
