export function normalizeMedusaRedisUrl(value: string | undefined): string {
  const configured = value?.trim() ?? "";
  if (!configured) return "";

  try {
    const url = new URL(configured);
    if (url.hostname.endsWith(".upstash.io") && url.protocol === "redis:") {
      url.protocol = "rediss:";
    }
    return url.toString();
  } catch {
    return configured;
  }
}

export function medusaRedisModules(redisUrl: string) {
  if (!redisUrl) return [] as const;

  return [
    {
      resolve: "@medusajs/event-bus-redis",
      options: { redisUrl },
    },
    {
      resolve: "@medusajs/locking-redis",
      options: { redisUrl },
    },
  ] as const;
}
