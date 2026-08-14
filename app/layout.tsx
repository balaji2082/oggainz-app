import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

import { ToastHost } from "@/components/ui/Toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OG Gainz",
  description: "Your meals, your macros. Eat like it matters.",
  appleWebApp: { capable: true, title: "OG Gainz", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Dark is the default, so the browser chrome starts dark too. ThemeSwitch
  // rewrites this tag when someone chooses Light, otherwise an installed PWA
  // wears a near-black app under a cream status bar.
  themeColor: "#070f0c",
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom — it is an accessibility need, not a design flaw.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} h-full`}>
      <head>
        {/*
          Apply the theme BEFORE first paint — and default it to dark.

          This has to be a blocking inline script, and it is the one place in
          this app where that is the right answer. Doing it in a component —
          even in an effect that runs immediately — means the browser paints the
          cream ground first and then repaints dark, which is a white flash in
          the face of someone opening the app at night. There is no way to read
          localStorage from the server, so the choice cannot be made in advance.

          Anything that is not the string "light" resolves to dark, which covers
          a first-time visitor, a cleared browser, AND the three old values
          ("classic", "playful", "dark") still sitting in the localStorage of
          every phone that opened the app while those existed.

          `catch` falls through to dark too: a browser refusing localStorage
          (private mode on some Android builds) must still get the default,
          not the light theme by accident.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.setAttribute('data-theme',localStorage.getItem('og-theme')==='light'?'light':'dark')}catch(e){document.documentElement.setAttribute('data-theme','dark')}`,
          }}
        />
      </head>
      <body className="min-h-full">
        <ToastHost>{children}</ToastHost>
      </body>
    </html>
  );
}
