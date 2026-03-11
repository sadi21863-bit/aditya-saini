import { NextRequest, NextResponse } from "next/server";

const LT_ENDPOINT = "https://api.languagetool.org/v2/check";

export async function POST(req: NextRequest) {
  try {
    const { text, language = "en-US" } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const body = new URLSearchParams();
    body.append("text", text);
    body.append("language", language);
    body.append("enabledOnly", "false");

    const ltRes = await fetch(LT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!ltRes.ok) {
      return NextResponse.json(
        { error: "LanguageTool error", details: await ltRes.text() },
        { status: ltRes.status }
      );
    }

    return NextResponse.json(await ltRes.json());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Internal error", details: message }, { status: 500 });
  }
}
