import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo/site-metadata";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = SITE_TITLE;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #eff6ff 0%, #f8f9fb 45%, #ffffff 100%)",
          color: "#1a2744",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #5b9fd4 0%, #3d7eb8 100%)",
              color: "#fff",
              fontSize: 56,
              fontWeight: 800,
            }}
          >
            D
          </div>
          <div style={{ fontSize: 56, fontWeight: 800 }}>DocSolid</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 980 }}>
          <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.15 }}>
            Documents & forms for your business
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.45, color: "#475569" }}>{SITE_DESCRIPTION}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
