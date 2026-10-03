import { NextResponse } from "next/server";
import { readAdminOpenApiDocument } from "@/lib/admin-openapi-document";
import { requireStaffApiSession } from "@/lib/requireStaffSession";

export async function GET() {
  const staff = await requireStaffApiSession("content:read");
  if (!staff.ok) return staff.response;

  try {
    const { yaml } = await readAdminOpenApiDocument();
    return new NextResponse(yaml, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="uvs-openapi.yaml"',
        "Content-Type": "application/yaml; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "OpenAPI documentation is temporarily unavailable" },
      { status: 503 },
    );
  }
}
