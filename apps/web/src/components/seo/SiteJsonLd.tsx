import { homeJsonLd } from "@/lib/seo/site-metadata";

export function SiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
    />
  );
}
