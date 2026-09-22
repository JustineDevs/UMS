import { NextResponse } from "next/server";
import { healthResponseSchema } from "@/lib/admin-api-contracts";

export function GET() {
  return NextResponse.json(healthResponseSchema.parse({
    service: "storefront",
    status: "ok",
    timestamp: new Date().toISOString(),
  }));
}
