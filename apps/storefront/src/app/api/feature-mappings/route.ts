import { buildPublicPlatformFeatureMappingMetadata } from "@universal-music-store/platform-data";

export async function GET() {
  return Response.json({ data: buildPublicPlatformFeatureMappingMetadata() }, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
