import { Bone, PageHead } from "@/components/Bits";

/**
 * Shown the instant the Calendar tab is tapped.
 *
 * This is the fix for "switching to the calendar takes three or four seconds".
 * The work behind it got faster too, but the reason it FELT broken is that
 * nothing happened at all until the server answered — the old screen just sat
 * there, so a tap looked like it had been ignored and people tapped again.
 *
 * It renders inside the layout's Shell, so the header and the tab dock are
 * already there and only the middle fills in. The month grid is drawn at its
 * real size, which means the calendar does not jump when it lands.
 */
export default function CalendarLoading() {
  return (
    <>
      <PageHead
        icon="calendar"
        title="Calendar"
        subtitle="Tap a day to skip it, or pause a whole stretch."
      />

      <div className="-mx-5 px-3">
        {/* Month header */}
        <div className="mb-3 flex items-center justify-between px-1">
          <Bone h={40} w={40} r="999px" />
          <Bone h={20} w={130} />
          <Bone h={40} w={40} r="999px" />
        </div>

        {/* Weekday letters */}
        <div className="mb-1 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-center py-2">
              <Bone h={12} w={12} r="4px" />
            </div>
          ))}
        </div>

        {/* Six weeks at the real cell height, so nothing shifts on arrival. */}
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 42 }).map((_, i) => (
            <Bone key={i} h={52} r="var(--og-r-md)" />
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-[var(--og-border)] pt-4">
        <Bone h={14} w="70%" />
      </div>
      <div className="mt-4">
        <Bone h={50} r="var(--og-r-md)" />
      </div>
    </>
  );
}
