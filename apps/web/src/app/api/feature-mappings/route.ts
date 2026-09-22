import { buildPublicPlatformFeatureMappingMetadata } from "@universal-music-store/platform-data";
import { publicFeatureMappingsResponseSchema } from "@/lib/admin-api-contracts";

export async function GET() {
  return Response.json(publicFeatureMappingsResponseSchema.parse({ data: buildPublicPlatformFeatureMappingMetadata() }), {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
