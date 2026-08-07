/**
 * Shown when the Command Center could not be reached and the screen is holding
 * an older reading.
 *
 * [LAW] docs/03 §6 — a stale read is never presented as current. This is the
 * component that keeps that promise, and it is deliberately visible rather than
 * a subtle grey line: a customer deciding whether to expect food needs to know
 * they are looking at something from two hours ago.
 */
export default function StaleNotice({ asOf }: { asOf: Date | string | null }) {
  if (!asOf) return null;
  const when = new Date(asOf);
  const time = when.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const today = new Date().toDateString() === when.toDateString();

  return (
    <div className="mb-5 rounded-[var(--radius-og)] border border-[#f0d9a8] bg-[#fff8e8] px-4 py-3">
      <p className="text-[13px] leading-5 text-[#7a5a12]">
        <strong>Showing what we last knew at {time}</strong>
        {today ? "" : ` on ${when.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}.
        We can&rsquo;t reach the kitchen right now, so this may have changed.
      </p>
    </div>
  );
}
