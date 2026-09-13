import { getStorefrontSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getStorefrontSession();
  return Response.json(
    session
      ? { user: session.user, expires: session.expires }
      : { user: null },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
