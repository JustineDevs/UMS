import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/requireStaffSession";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedError } from "@/lib/staff-api-response";

// The source asset is intentionally served through the admin origin so the
// The unified web app serves this admin asset without coupling it to a separate storefront runtime.
export const runtime = "nodejs";

const avatarFilesPromise = readdir(
  path.join(
    process.cwd(),
    "..",
    "..",
    "public",
    "avatar",
    "Flat Assets",
    "Flat Assets",
    "Templates",
    "Bust",
  ),
).then((files) => files.filter((file) => /\.(png|svg)$/i.test(file)).sort());

function hashSeed(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const auth = await requireStaffApiSession("content:read");
  if (!auth.ok) return auth.response;
  try {
    const directory = path.join(process.cwd(), "..", "..", "public", "avatar", "Flat Assets", "Flat Assets", "Templates", "Bust");
    const files = await avatarFilesPromise;
    if (files.length === 0) return correlatedError(correlationId, 404, "Avatar unavailable", "NOT_FOUND");
    const seed = new URL(request.url).searchParams.get("seed")?.trim() || "staff";
    const fileName = files[hashSeed(seed) % files.length];
    const file = await readFile(path.join(directory, fileName));
    const contentType = fileName.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png";
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "x-request-id": correlationId,
      },
    });
  } catch {
    return correlatedError(correlationId, 404, "Avatar unavailable", "NOT_FOUND");
  }
}
