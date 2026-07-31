import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
