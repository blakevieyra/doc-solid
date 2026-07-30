import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4, Great_Vibes } from "next/font/google";
import "./globals.css";
import { buildSiteMetadata } from "@/lib/seo/site-metadata";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

/** Document body serif — a professional, print-grade typeface for contracts, agreements, and formal documents */
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-doc-serif",
  display: "swap",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-signature",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildSiteMetadata();

export const viewport: Viewport = {
  themeColor: "#1a2744",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable} ${greatVibes.variable}`}>
      <body>{children}</body>
    </html>
  );
}
