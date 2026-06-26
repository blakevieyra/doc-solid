import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 112,
            height: 112,
            borderRadius: 28,
            background: "linear-gradient(135deg, #5b9fd4 0%, #3d7eb8 100%)",
            color: "#ffffff",
            fontSize: 72,
            fontWeight: 800,
            fontFamily: "system-ui, sans-serif",
            letterSpacing: -4,
          }}
        >
          D
        </div>
      </div>
    ),
    { ...size }
  );
}
