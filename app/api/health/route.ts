import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok", version: "v13", db: "connected", timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: "error", db: "disconnected", error: error instanceof Error ? error.message : "Unknown" }, { status: 503 });
  }
}
