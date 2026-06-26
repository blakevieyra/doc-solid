import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://docsolid.app";

export const SITE_NAME = "DocSolid";

export const SITE_TITLE = "DocSolid — Documents & Forms for Business";

/** Primary meta description — key features for search & social previews */
export const SITE_DESCRIPTION =
  "143+ business document templates with profile auto-fill, logo letterhead, e-signatures, PDF export & print, document packets, team sharing, security scan & redaction, email & share links, and cloud sync with offline access. Free to start — Pro for unlimited docs and clean PDFs.";

export const SITE_KEYWORDS = [
  "business documents",
  "document templates",
  "invoice generator",
  "PDF forms",
  "e-signature",
  "document management",
  "team document sharing",
  "document packets",
  "security scan",
  "redaction",
  "cloud sync",
  "DocSolid",
];

export function buildSiteMetadata(overrides?: Partial<Metadata>): Metadata {
  const url = SITE_URL.replace(/\/$/, "");

  return {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    keywords: SITE_KEYWORDS,
    applicationName: SITE_NAME,
    manifest: "/manifest.json",
    metadataBase: new URL(url),
    alternates: { canonical: "/" },
    icons: {
      icon: [{ url: "/icon", type: "image/png", sizes: "512x512" }],
      apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
      shortcut: ["/icon"],
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: SITE_NAME,
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_TITLE }],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: ["/opengraph-image"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    ...overrides,
  };
}

export const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL.replace(/\/$/, ""),
  description: SITE_DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "143+ professional document templates",
    "Profile auto-fill with logo and letterhead",
    "Print and PDF export",
    "E-signatures and signature requests",
    "Document packets",
    "Team sharing and collaboration",
    "Security scan and redaction",
    "Cloud sync with offline access",
    "Email and share links",
  ],
};
