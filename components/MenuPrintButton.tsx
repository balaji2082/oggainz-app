"use client";

/**
 * "Save as PDF" for the weekly menu.
 *
 * There is no PDF library here on purpose. Every phone browser can already turn
 * a page into a PDF through its own print dialog — Share → Print → Save as PDF
 * on iOS, the same through the ⋮ menu on Android — and a print stylesheet gets
 * a better-looking result than a generated file, because it keeps the real
 * fonts and lays out to the paper.
 *
 * The same trick the Command Center's invoice and brochure pages have always
 * used, which also means no new dependency has to survive on the free tier.
 */
export default function MenuPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="og-press og-menu-noprint mb-2 flex w-full items-center justify-center gap-2 rounded-[var(--og-r-lg)] border border-[var(--og-border)] bg-[var(--og-surface)] px-5 py-3.5 text-[14px] font-semibold text-[var(--og-heading)] shadow-[var(--og-e1)]"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      Save as PDF
    </button>
  );
}
