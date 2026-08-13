import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// The source asset is intentionally served through the admin origin so the
// admin app does not depend on the storefront's public directory.
export const runtime = "nodejs";

function hashSeed(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

export async function GET(request: Request) {
  try {
    const directory = path.join(
      process.cwd(),
      "..",
      "..",
      "public",
      "avatar",
      "Flat Assets",
      "Flat Assets",
      "Templates",
      "Bust",
    );
    const files = (await readdir(directory))
      .filter((file) => /\.(png|svg)$/i.test(file))
      .sort();
    if (files.length === 0) return NextResponse.json({ error: "Avatar unavailable" }, { status: 404 });
    const seed = new URL(request.url).searchParams.get("seed")?.trim() || "staff";
    const fileName = files[hashSeed(seed) % files.length];
    const file = await readFile(path.join(directory, fileName));
    const contentType = fileName.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png";
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Avatar unavailable" }, { status: 404 });
  }
}
