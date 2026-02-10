import Redis from "ioredis";

let redis: Redis | null = null;

/**
 * Get the Redis client singleton.
 * Returns null if REDIS_URL is not configured (graceful degradation).
 */
export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redis.connect().catch(() => {
      // Silently fail — app works without Redis
    });
  }

  return redis;
}
