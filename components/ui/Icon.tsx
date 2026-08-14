/**
 * One icon set, one grid, one weight.
 *
 * Before this, every icon in the app was an inline `<svg>` written where it was
 * needed — which is how the calendar ended up with a 2.6 stroke clock next to a
 * 4.5 stroke tick next to a filled pause bar, all on different optical sizes.
 * Individually each looked fine; together they read as clip-art, and that is
 * most of what separates an app that feels considered from one that feels
 * assembled.
 *
 * The rules, so anything added later still matches:
 *   · 24×24 grid, drawn to the edges of a 20px optical square
 *   · stroke only, 1.75 default (2.1 when a tab is active — weight, not colour)
 *   · round caps and joins, no filled shapes except where a dot IS the meaning
 *   · `currentColor` always, so an icon inherits the text it sits beside
 *
 * Deliberately not an icon library: lucide-react is ~40KB for the twenty glyphs
 * this app uses, on a phone opened over Indian mobile data.
 */

export type IconName =
  | "home"
  | "calendar"
  | "pack"
  | "chat"
  | "user"
  | "sun"
  | "moon"
  | "check"
  | "clock"
  | "pause"
  | "play"
  | "skip"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "star"
  | "sparkle"
  | "bell"
  | "logout"
  | "shield"
  | "truck"
  | "flame"
  | "close";

interface Props {
  name: IconName;
  size?: number;
  /** Stroke weight. Bump it rather than the colour to show emphasis. */
  weight?: number;
  className?: string;
  /** Set only when the icon is the ONLY thing carrying the meaning. */
  label?: string;
}

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3.6 10.6 12 3.8l8.4 6.8" />
      <path d="M5.8 9.4V19a1.2 1.2 0 0 0 1.2 1.2h10a1.2 1.2 0 0 0 1.2-1.2V9.4" />
      <path d="M9.8 20.2v-5.4h4.4v5.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.2" y="5" width="17.6" height="15.4" rx="3.4" />
      <path d="M3.2 9.8h17.6M8.2 3.2v3.6M15.8 3.2v3.6" />
    </>
  ),
  // A meal box seen slightly from above, not a shipping carton: the lid seam
  // and the band are what make it read as "your pack" rather than "delivery".
  pack: (
    <>
      <path d="M3.6 8.2 12 4l8.4 4.2v7.6L12 20l-8.4-4.2z" />
      <path d="M3.6 8.2 12 12.4l8.4-4.2M12 12.4V20" />
      <path d="M7.8 6.1l8.4 4.2" />
    </>
  ),
  chat: (
    <>
      <path d="M20.4 12.2c0 3.9-3.8 7-8.4 7a9.6 9.6 0 0 1-2.5-.33L4.6 20.4l1.2-3.5A6.6 6.6 0 0 1 3.6 12.2c0-3.9 3.8-7 8.4-7s8.4 3.1 8.4 7Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.7" />
      <path d="M4.8 20c.9-3.9 3.8-5.9 7.2-5.9s6.3 2 7.2 5.9" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.3M12 19.1v2.3M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.6 12h2.3M19.1 12h2.3M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
    </>
  ),
  moon: <path d="M20.2 14.4A8.6 8.6 0 0 1 9.6 3.8a8.6 8.6 0 1 0 10.6 10.6Z" />,
  check: <path d="M4.6 12.6 9.6 17.8 19.4 6.8" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 6.9v5.4l3.4 2" />
    </>
  ),
  pause: (
    <>
      <path d="M9.4 4.6v14.8M14.6 4.6v14.8" />
    </>
  ),
  play: <path d="M8 4.8 19 12 8 19.2z" />,
  skip: (
    <>
      <path d="M5.4 5.4 13 12l-7.6 6.6z" />
      <path d="M17.6 5.2v13.6" />
    </>
  ),
  chevronLeft: <path d="M14.8 5.2 8 12l6.8 6.8" />,
  chevronRight: <path d="M9.2 5.2 16 12l-6.8 6.8" />,
  chevronDown: <path d="M5.2 9.2 12 16l6.8-6.8" />,
  star: <path d="M12 3.4l2.7 5.7 6.1.65-4.55 4.25 1.2 6.1L12 17.1l-5.45 3-1.2-6.1L.8 9.75l6.1-.65z" />,
  sparkle: (
    <>
      <path d="M12 3.6l1.9 4.9 4.9 1.9-4.9 1.9-1.9 4.9-1.9-4.9-4.9-1.9 4.9-1.9z" />
      <path d="M18.4 16.2l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 16.4V11a6 6 0 1 0-12 0v5.4L4.4 18.6h15.2z" />
      <path d="M10 21.2h4" />
    </>
  ),
  logout: (
    <>
      <path d="M14.6 7.6V5.4a1.6 1.6 0 0 0-1.6-1.6H5.8a1.6 1.6 0 0 0-1.6 1.6v13.2a1.6 1.6 0 0 0 1.6 1.6H13a1.6 1.6 0 0 0 1.6-1.6v-2.2" />
      <path d="M10 12h9.8M16.6 8.8 19.8 12l-3.2 3.2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.4 19.4 6v6c0 4.2-3 7.3-7.4 8.6C7.6 19.3 4.6 16.2 4.6 12V6z" />
      <path d="M9.2 12.2 11.3 14.3 15 10.4" />
    </>
  ),
  truck: (
    <>
      <path d="M2.8 7.4h10.6v9.2H2.8zM13.4 10.6h3.9l2.9 3v3h-6.8z" />
      <circle cx="7" cy="18.4" r="1.9" />
      <circle cx="17" cy="18.4" r="1.9" />
    </>
  ),
  flame: (
    <path d="M12 3.2c.7 3 3.3 4 4.8 6.5a6 6 0 1 1-10.4 0C8.4 6.6 10.6 6.9 12 3.2Z" />
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
};

export default function Icon({
  name,
  size = 20,
  weight = 1.75,
  className = "",
  label,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[name]}
    </svg>
  );
}
