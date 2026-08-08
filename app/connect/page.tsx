import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { createRequest, pendingFor } from "@/lib/requests";
import { currentSession } from "@/lib/current-user";
import { readPending, PENDING_COOKIE } from "@/lib/pending";

/**
 * "We don't recognise you yet — who are you?"
 *
 * Reached after signing in with Google when no account matches. Two very
 * different people land here and the page must serve both without making
 * either feel like the wrong sort of visitor:
 *
 *   a subscriber whose Google account is not linked yet
 *   somebody who just found OG Gainz and is curious
 *
 * Before this existed both were told "No account yet", which reads like the app
 * is broken and sends a paying customer to WhatsApp to complain.
 *
 * Neither path grants access on its own. A person's Google identity is proven
 * by this point; the claim "I am that customer" is not, and Balaji settles it.
 */
export default async function Connect() {
  // Already a customer? Nothing to ask.
  const session = await currentSession();
  if (session?.customerId) redirect("/me");
  if (session?.owner) redirect("/admin");

  const pending = await readPending((await cookies()).get(PENDING_COOKIE)?.value);
  if (!pending) redirect("/");

  const already = await pendingFor(pending.sub);

  async function submit(formData: FormData) {
    "use server";
    const who = await readPending((await cookies()).get(PENDING_COOKIE)?.value);
    if (!who) redirect("/");
    const phone = String(formData.get("phone") ?? "").trim();
    const kind = String(formData.get("kind") ?? "") === "new" ? "new" : "subscriber";
    const goal = String(formData.get("goal") ?? "").trim() || null;
    if (phone.replace(/\D/g, "").length < 10) redirect("/connect?e=phone");
    await createRequest({
      googleSub: who.sub,
      email: who.email,
      displayName: who.name,
      phone,
      kind,
      goal,
    });
    redirect("/connect");
  }

  if (already) {
    return (
      <Frame title="Thanks — we're on it">
        <p className="text-[14px] leading-6 text-[var(--og-text-muted)]">
          {already.kind === "subscriber"
            ? "We're matching your number to your subscription. It's usually quick — we'll message you on WhatsApp the moment it's ready, and then this page becomes your meal tracker."
            : "Thanks for your interest. We'll message you on WhatsApp to talk through the packs and what suits your goal."}
        </p>
        <a
          href="https://wa.me/919361798644"
          className="mt-6 flex w-full items-center justify-center rounded-[var(--radius-og)] bg-[var(--og-forest)] px-5 py-3.5 text-[14px] font-semibold text-white"
        >
          Message us now
        </a>
      </Frame>
    );
  }

  return (
    <Frame title={`Hi ${(pending.name ?? "there").split(" ")[0]}`}>
      <p className="mb-7 text-[14px] leading-6 text-[var(--og-text-muted)]">
        We don&rsquo;t recognise this Google account yet. Tell us which you are
        and we&rsquo;ll get you sorted.
      </p>

      <form action={submit} className="space-y-6">
        <fieldset>
          <legend className="mb-2.5 text-[13px] font-semibold text-[var(--og-text)]">
            Are you already getting our meals?
          </legend>
          <div className="space-y-2.5">
            <Choice
              value="subscriber"
              defaultChecked
              title="Yes, I'm a subscriber"
              body="We'll match your number to your subscription and open up your meals."
            />
            <Choice
              value="new"
              title="No, I'd like to start"
              body="Tell us what you're after and we'll talk you through the packs."
            />
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-[13px] font-semibold text-[var(--og-text)]"
          >
            Your WhatsApp number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            required
            placeholder="98765 43210"
            className="w-full rounded-[var(--radius-og)] border border-[var(--og-border)] bg-white px-4 py-3 text-[15px] text-[var(--og-text)] outline-none"
          />
          <p className="mt-1.5 text-[12px] leading-5 text-[var(--og-text-muted)]">
            The number we already deliver to, if you&rsquo;re a subscriber.
          </p>
        </div>

        <div>
          <label
            htmlFor="goal"
            className="mb-1.5 block text-[13px] font-semibold text-[var(--og-text)]"
          >
            Anything we should know? <span className="font-normal">(optional)</span>
          </label>
          <input
            id="goal"
            name="goal"
            placeholder="Fat loss, muscle gain, just looking…"
            className="w-full rounded-[var(--radius-og)] border border-[var(--og-border)] bg-white px-4 py-3 text-[15px] text-[var(--og-text)] outline-none"
          />
        </div>

        <button className="flex w-full items-center justify-center rounded-[var(--radius-og)] bg-[var(--og-forest)] px-5 py-3.5 text-[15px] font-semibold text-white">
          Send
        </button>
      </form>

      <p className="mt-6 text-[12px] leading-5 text-[var(--og-text-muted)]">
        We check every request by hand — it&rsquo;s how we make sure nobody else
        can see your meals or your address.
      </p>
    </Frame>
  );
}

function Choice({
  value,
  title,
  body,
  defaultChecked,
}: {
  value: string;
  title: string;
  body: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-[var(--radius-og)] border border-[var(--og-border)] bg-[var(--og-surface)] px-4 py-3.5 has-[:checked]:border-[var(--og-forest)] has-[:checked]:bg-[var(--og-surface-alt)]">
      <input
        type="radio"
        name="kind"
        value={value}
        defaultChecked={defaultChecked}
        className="mt-1 accent-[var(--og-forest)]"
      />
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold text-[var(--og-text)]">
          {title}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-5 text-[var(--og-text-muted)]">
          {body}
        </span>
      </span>
    </label>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[440px] px-5 py-12">
      <h1 className="mb-2 font-display text-[24px] font-semibold leading-tight tracking-tight text-[var(--og-forest)]">
        {title}
      </h1>
      {children}
    </main>
  );
}
