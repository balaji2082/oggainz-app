/**
 * The small pieces. Server components — none of them need state.
 */

import Icon, { type IconName } from "./ui/Icon";

// --- page chrome -------------------------------------------------------------

/**
 * Every screen opens the same way: an icon chip, a title, a line of plain
 * English underneath.
 *
 * It was four near-identical blocks of markup with four slightly different type
 * sizes — 22px here, 23px there, one with `mb-5` and one with `mb-6`. Nobody
 * notices any single one of those, and everybody notices the result, which is a
 * set of screens that feel like they were built at different times.
 */
export function PageHead({
  icon,
  title,
  subtitle,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-3.5">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--og-r-md)] bg-[var(--og-chip)] text-[var(--og-primary)] ring-1 ring-[var(--og-chip-line)]"
      >
        <Icon name={icon} size={21} weight={1.9} />
      </span>
      <div className="min-w-0">
        <h1 className="font-display text-[21px] font-semibold leading-tight tracking-[-0.02em] text-[var(--og-heading)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[13.5px] leading-5 text-[var(--og-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// --- loading -----------------------------------------------------------------

/**
 * The shape of what is coming, not a spinner.
 *
 * A spinner says "wait"; a skeleton says "your calendar is arriving, and this
 * is where it will be". On a screen that takes a second or two over mobile data
 * that difference is most of what the wait feels like.
 */
export function Bone({
  h = 16,
  w = "100%",
  r = "var(--og-r-sm)",
  className = "",
}: {
  h?: number;
  w?: number | string;
  r?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`og-skeleton ${className}`}
      style={{ height: h, width: w, borderRadius: r }}
    />
  );
}

// --- status ------------------------------------------------------------------

type Tone = "neutral" | "good" | "warn" | "info" | "quiet";

const TONES: Record<Tone, string> = {
  neutral: "bg-[var(--og-surface-alt)] text-[var(--og-text-muted)]",
  good: "bg-[color-mix(in_srgb,var(--og-green)_14%,transparent)] text-[var(--og-on-green)]",
  warn: "bg-[color-mix(in_srgb,var(--og-orange)_16%,transparent)] text-[var(--og-on-orange)]",
  info: "bg-[color-mix(in_srgb,var(--og-forest)_10%,transparent)] text-[var(--og-heading)]",
  quiet: "bg-transparent text-[var(--og-text-muted)] ring-1 ring-[var(--og-border)]",
};

export function Pill({
  children,
  tone = "neutral",
  icon,
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--og-r-pill)] px-2.5 py-1 text-[11.5px] font-semibold ${TONES[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

// --- progress ----------------------------------------------------------------

/**
 * Meals used out of meals bought.
 *
 * A ring rather than a bar because it sits beside a number and a bar next to a
 * number is two ways of saying the same thing competing for the same space.
 */
export function ProgressRing({
  done,
  total,
  size = 68,
  label,
}: {
  done: number;
  total: number;
  size?: number;
  label?: string;
}) {
  const safeTotal = Math.max(total, 1);
  const pct = Math.min(Math.max(done / safeTotal, 0), 1);
  const stroke = size >= 60 ? 6 : 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--og-border)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--og-green)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset var(--og-slow) var(--og-ease)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="og-tabular font-display text-[16px] font-bold leading-none text-[var(--og-heading)]">
          {Math.max(total - done, 0)}
        </span>
        {label && (
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--og-text-muted)]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// --- identity ----------------------------------------------------------------

export function Avatar({
  src,
  name,
  size = 44,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  // Initials from the first and last word — "Balaji Navaneethan" is BN, and a
  // single-word name is just its first letter rather than a doubled one.
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${words[0][0]}${words[words.length - 1][0]}`
      : (words[0]?.[0] ?? "?");

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: src ? undefined : "var(--og-gradient-brand)",
      }}
    >
      {src ? (
        // A data URL from our own database, sized by the browser before upload.
        // next/image would proxy it through the optimiser for no benefit.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <span
          className="font-display font-semibold uppercase text-white"
          style={{ fontSize: size * 0.36 }}
        >
          {initials}
        </span>
      )}
    </span>
  );
}

// --- structure ---------------------------------------------------------------

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[12.5px] font-semibold uppercase tracking-[0.13em] text-[var(--og-text-muted)]">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Card({
  children,
  padded = true,
  className = "",
}: {
  children: React.ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] shadow-[var(--og-e1)] ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * An empty state that says what to do, not just that there is nothing.
 * "No orders yet" is a dead end; "Your meals will show up here" is a promise.
 */
export function Empty({
  title,
  body,
  icon,
}: {
  title: string;
  body?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--og-r-lg)] border border-dashed border-[var(--og-border)] px-5 py-10 text-center">
      {icon && <div className="mb-3 flex justify-center text-[var(--og-border)]">{icon}</div>}
      <p className="font-display text-[15px] font-semibold text-[var(--og-heading)]">{title}</p>
      {body && (
        <p className="mx-auto mt-1.5 max-w-[38ch] text-[13px] leading-5 text-[var(--og-text-muted)]">
          {body}
        </p>
      )}
    </div>
  );
}
