import { NextResponse } from "next/server";
import { getUnifiedSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getUnifiedSession(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
