import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "ReTokenD — self-hosted Spotify token manager";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "88px",
          background: "#0b1210",
          backgroundImage:
            "radial-gradient(65% 75% at 28% 18%, rgba(16,185,129,0.20), transparent)",
          color: "#e9ede9",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "#10b981",
            fontFamily: "monospace",
          }}
        >
          self-hosted spotify token manager
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 132, fontWeight: 700 }}>
          <span>ReToken</span>
          <span style={{ color: "#10b981", marginLeft: "-0.3em" }}>D</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            maxWidth: 900,
            fontSize: 34,
            lineHeight: 1.4,
            color: "#9aa8a1",
          }}
        >
          Manage multiple Spotify accounts in one place, and give your apps short-lived access tokens through a single secure endpoint.
        </div>
      </div>
    ),
    { ...size },
  );
}
