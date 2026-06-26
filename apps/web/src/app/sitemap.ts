import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL.replace(/\/$/, "");
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/documents`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
  ];
}
