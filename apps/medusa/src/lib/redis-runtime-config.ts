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
      resolve: "@medusajs/medusa/event-bus-redis",
      options: { redisUrl },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            id: "locking-redis",
            resolve: "@medusajs/medusa/locking-redis",
            is_default: true,
            options: { redisUrl },
          },
        ],
      },
    },
  ] as const;
}
