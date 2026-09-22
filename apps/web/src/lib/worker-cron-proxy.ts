export async function proxyCronToWorker(request: Request, task: string): Promise<Response> {
  const authorization = request.headers.get("authorization")?.trim();
  const cronSecret = request.headers.get("x-cron-secret")?.trim();
  if (!authorization && !cronSecret) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return Response.json({ error: "Worker API is not configured" }, { status: 503 });
  try {
    return await fetch(`${baseUrl}/internal/cron/${encodeURIComponent(task)}`, {
      method: "GET",
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cronSecret ? { "x-cron-secret": cronSecret } : {}),
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return Response.json({ error: "Worker cron operation is unavailable" }, { status: 503 });
  }
}
