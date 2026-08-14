import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "storefront",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
