/**
 * Where a failed sign-in lands.
 *
 * The wording is friendly and deliberately imprecise about which check failed.
 * "Expired", "already used" and "never existed" all read the same to someone
 * guessing tokens, which is the point.
 */

const MESSAGES: Record<string, { title: string; body: string }> = {
  cancelled: {
    title: "Sign-in cancelled",
    body: "No problem — nothing has changed. Open your link again whenever you're ready.",
  },
  invite: {
    title: "This link can't be used",
    body: "It may have expired, or already been used. Message us on WhatsApp and we'll send a fresh one.",
  },
  unknown: {
    title: "No account yet",
    body: "That Google account isn't linked to an OG Gainz subscription. Open the invite link we sent you on WhatsApp, or message us and we'll send one.",
  },
  expired: {
    title: "That took too long",
    body: "Sign-in has to finish within a few minutes. Please try again.",
  },
  mismatch: {
    title: "Something didn't add up",
    body: "The sign-in couldn't be verified, so we stopped it. Please try again from your original link.",
  },
  google: {
    title: "Google couldn't confirm that",
    body: "Something went wrong talking to Google. Please try again in a moment.",
  },
  incomplete: {
    title: "Sign-in didn't finish",
    body: "Please try again from your original link.",
  },
};

const FALLBACK = {
  title: "Something went wrong",
  body: "Please try again, or message us on WhatsApp and we'll sort it out.",
};

export default async function JoinError({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const { title, body } = MESSAGES[reason ?? ""] ?? FALLBACK;

  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-10">
      <div className="w-full max-w-[380px]">
        <h1 className="mb-2 font-display text-[24px] font-semibold leading-tight tracking-tight text-[var(--og-forest)]">
          {title}
        </h1>
        <p className="text-[14px] leading-6 text-[var(--og-text-muted)]">{body}</p>
        <a
          href="https://wa.me/919361798644"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-og)] bg-[var(--og-forest)] px-5 py-3 text-[14px] font-semibold text-white"
        >
          Message us on WhatsApp
        </a>
      </div>
    </main>
  );
}
