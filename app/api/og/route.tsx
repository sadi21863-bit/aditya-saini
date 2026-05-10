import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title  = searchParams.get("title")  ?? "IdeaConnect";
  const handle = searchParams.get("handle") ?? "";
  const room   = searchParams.get("room")   ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "60px",
          background: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "8px",
            background: "#0d9488", display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 700, fontSize: 18,
          }}>I</div>
          <span style={{ color: "#94a3b8", fontSize: 20, fontWeight: 600 }}>
            IdeaConnect
          </span>
        </div>

        {/* Title */}
        <div style={{
          fontSize: title.length > 60 ? 36 : 48,
          fontWeight: 700,
          color: "white",
          lineHeight: 1.2,
          maxWidth: "80%",
        }}>
          {title}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: "16px", color: "#64748b", fontSize: 18 }}>
          {handle && <span>@{handle}</span>}
          {room && handle && <span>·</span>}
          {room && <span>#{room}</span>}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
