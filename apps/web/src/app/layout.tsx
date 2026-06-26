import type { Metadata, Viewport } from "next";
import "./globals.css";
import { buildSiteMetadata } from "@/lib/seo/site-metadata";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
