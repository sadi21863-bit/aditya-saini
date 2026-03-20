import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const title = searchParams.get("title") ?? "Untitled Idea";
    const category = searchParams.get("category") ?? "General";
    const author = searchParams.get("author") ?? "Anonymous";
    const handle = searchParams.get("handle") ?? "";
    const tier = searchParams.get("tier") ?? "dreamer";
    const flair = searchParams.get("flair") ?? "";
    const sparks = searchParams.get("sparks") ?? "0";
    const views = searchParams.get("views") ?? "0";

    const TIER_COLOR: Record<string, string> = {
        dreamer: "#94a3b8",
        visionary: "#2dd4bf",
        architect: "#a78bfa",
        oracle: "#fbbf24",
        master: "#c084fc",
        genesis_legend: "#f59e0b",
    };

    const FLAIR_LABEL: Record<string, string> = {
        research: "🔬 Research",
        concept: "💡 Concept",
        ready: "✅ Ready",
        cofound: "🤝 Co-found",
        built: "🚀 Built",
    };

    const tierColor = TIER_COLOR[tier] ?? "#94a3b8";
    const flairLabel = flair ? FLAIR_LABEL[flair] : null;

    return new ImageResponse(
        (
            <div
                style={{
                    width: "1200px",
                    height: "630px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: "linear-gradient(135deg, #0f172a 0%, #0f1f1e 100%)",
                    padding: "64px",
                    fontFamily: "sans-serif",
                }}
            >
                {/* Top bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                            style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                background: "#0d9488",
                            }}
                        />
                        <span style={{ color: "#0d9488", fontSize: "18px", fontWeight: 800, letterSpacing: "3px" }}>
                            IDEACONNECT
                        </span>
                    </div>
                    <span
                        style={{
                            color: "#334155",
                            fontSize: "14px",
                            background: "#1e293b",
                            padding: "6px 16px",
                            borderRadius: "999px",
                            border: "1px solid #334155",
                        }}
                    >
                        Genesis Registry
                    </span>
                </div>

                {/* Middle — title */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, justifyContent: "center" }}>

                    {/* Category + Flair row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span
                            style={{
                                color: "#0d9488",
                                fontSize: "13px",
                                fontWeight: 700,
                                letterSpacing: "3px",
                                textTransform: "uppercase",
                            }}
                        >
                            {category}
                        </span>
                        {flairLabel && (
                            <span
                                style={{
                                    color: "#cbd5e1",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    background: "#1e293b",
                                    padding: "4px 12px",
                                    borderRadius: "999px",
                                    border: "1px solid #334155",
                                }}
                            >
                                {flairLabel}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <div
                        style={{
                            color: "#ffffff",
                            fontSize: title.length > 60 ? "44px" : "56px",
                            fontWeight: 900,
                            lineHeight: 1.15,
                            maxWidth: "900px",
                        }}
                    >
                        {title}
                    </div>
                </div>

                {/* Bottom bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                    {/* Author */}
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div
                            style={{
                                width: "44px",
                                height: "44px",
                                borderRadius: "50%",
                                background: "#1e293b",
                                border: `2px solid ${tierColor}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: tierColor,
                                fontSize: "18px",
                                fontWeight: 800,
                            }}
                        >
                            {author[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ color: "#ffffff", fontSize: "16px", fontWeight: 700 }}>
                                {author}
                            </span>
                            {handle && (
                                <span style={{ color: "#64748b", fontSize: "13px" }}>
                                    @{handle} · <span style={{ color: tierColor }}>{tier}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "18px" }}>✦</span>
                            <span style={{ color: "#94a3b8", fontSize: "16px", fontWeight: 600 }}>
                                {sparks} sparks
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "18px" }}>👁</span>
                            <span style={{ color: "#94a3b8", fontSize: "16px", fontWeight: 600 }}>
                                {views} views
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        }
    );
}
