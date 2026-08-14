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
  themeColor: "#004030",
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
          Apply the saved theme BEFORE first paint.

          This has to be a blocking inline script, and it is the one place in
          this app where that is the right answer. Doing it in a component —
          even in an effect that runs immediately — means the browser paints the
          default cream first and then repaints dark, which is a white flash in
          the face of someone opening the app at night. There is no way to read
          localStorage from the server, so the choice cannot be made in advance.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('og-theme');if(t&&t!=='classic')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">
        <ToastHost>{children}</ToastHost>
      </body>
    </html>
  );
}
