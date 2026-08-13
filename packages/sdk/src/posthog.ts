import { getPostHogApiKey, getPostHogHost } from "./env/posthog.js";

export type PostHogCaptureInput = {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
};

export async function capturePostHogEvent(
  input: PostHogCaptureInput,
): Promise<void> {
  const apiKey = getPostHogApiKey();
  if (!apiKey) {
    return;
  }
  const host = getPostHogHost();
  const url = `${host.replace(/\/$/, "")}/capture/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        event: input.event,
        distinct_id: input.distinctId,
        properties: input.properties ?? {},
        timestamp: input.timestamp,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      if (process.env.NODE_ENV === "production") {
        console.warn(
          `[posthog] capture failed for ${input.event} (${res.status})`,
        );
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        `[posthog] capture error for ${input.event}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}
