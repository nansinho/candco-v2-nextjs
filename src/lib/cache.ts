import { getRedis } from "@/lib/redis";

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get a cached value from Redis. Returns null on miss or if Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;

    const raw = await redis.get(key);
    if (!raw) return null;

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a value in Redis cache with an optional TTL (seconds).
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL
): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;

    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Silently fail — cache is not critical
  }
}

/**
 * Delete one or more keys from the cache.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis || keys.length === 0) return;

    await redis.del(...keys);
  } catch {
    // Silently fail
  }
}

/**
 * Delete all keys matching a pattern (e.g. "user:abc:*").
 * Uses SCAN to avoid blocking Redis.
 */
export async function cacheInvalidatePattern(
  pattern: string
): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;

    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // Silently fail
  }
}

// --- Cache key builders ---

export const CacheKeys = {
  /** User profile + org info for getOrganisationId() */
  userOrg: (userId: string) => `user:${userId}:org`,

  /** Full user profile for getCurrentUser() */
  userProfile: (userId: string) => `user:${userId}:profile`,

  /** User type for middleware routing (utilisateur vs extranet) */
  userType: (userId: string) => `user:${userId}:type`,

  /** All keys for a user (pattern for invalidation) */
  userAll: (userId: string) => `user:${userId}:*`,
} as const;
