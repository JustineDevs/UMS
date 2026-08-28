import { medusaRedisModules, normalizeMedusaRedisUrl } from "../../lib/redis-runtime-config";

describe("Medusa Redis runtime configuration", () => {
  it("upgrades Upstash TCP URLs to TLS", () => {
    expect(normalizeMedusaRedisUrl("redis://default:secret@cache.upstash.io:6379")).toBe(
      "rediss://default:secret@cache.upstash.io:6379",
    );
  });

  it("registers Redis event bus and distributed locking together", () => {
    expect(medusaRedisModules("rediss://cache.example:6379")).toEqual([
      {
        resolve: "@medusajs/event-bus-redis",
        options: { redisUrl: "rediss://cache.example:6379" },
      },
      {
        resolve: "@medusajs/locking-redis",
        options: { redisUrl: "rediss://cache.example:6379" },
      },
    ]);
  });

  it("does not silently configure local concurrency primitives", () => {
    expect(medusaRedisModules("")).toEqual([]);
  });
});
