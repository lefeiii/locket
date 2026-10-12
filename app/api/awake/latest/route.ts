import { NextResponse } from "next/server";
import { getPublicAwakeNight } from "@/lib/awake-public";
export const dynamic = "force-dynamic";
export async function GET() {
  const data = await getPublicAwakeNight();
  return NextResponse.json(data, { status: data.unavailable ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
