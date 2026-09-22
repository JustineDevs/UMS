import { NextResponse } from "next/server";
import { getUnifiedSession } from "@/lib/auth";
import { authSessionResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = authSessionResponseSchema.parse(await getUnifiedSession());
  return NextResponse.json(session, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
