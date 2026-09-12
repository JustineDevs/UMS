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

  const redisOptions = {
    // Keep hosted Upstash connections on the broadly supported IPv4 route.
    family: 4,
    connectTimeout: 30_000,
    keepAlive: 10_000,
  } as const;

  return [
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: { redisUrl, redisOptions },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            id: "locking-redis",
            resolve: "@medusajs/medusa/locking-redis",
            is_default: true,
            options: { redisUrl, redisOptions },
          },
        ],
      },
    },
  ] as const;
}
