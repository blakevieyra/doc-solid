import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #1a2744 0%, #2a4a6e 100%)",
          borderRadius: 112,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 96,
            top: 112,
            width: 88,
            height: 112,
            borderRadius: 12,
            background: "rgba(91, 159, 212, 0.35)",
            border: "4px solid rgba(255,255,255,0.25)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 112,
            top: 136,
            width: 56,
            height: 8,
            borderRadius: 4,
            background: "rgba(255,255,255,0.55)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 112,
            top: 156,
            width: 40,
            height: 8,
            borderRadius: 4,
            background: "rgba(255,255,255,0.4)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 220,
            height: 220,
            marginRight: 48,
            borderRadius: 48,
            background: "linear-gradient(135deg, #5b9fd4 0%, #3d7eb8 100%)",
            color: "#ffffff",
            fontSize: 148,
            fontWeight: 800,
            fontFamily: "system-ui, sans-serif",
            letterSpacing: -8,
            boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          }}
        >
          D
        </div>
      </div>
    ),
    { ...size }
  );
}
