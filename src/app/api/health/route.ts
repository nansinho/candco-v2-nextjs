import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export async function GET() {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Redis check
  const redis = getRedis();
  if (!redis) {
    checks.redis = { status: "skipped", error: "REDIS_URL non configuré" };
  } else {
    const start = Date.now();
    try {
      await redis.ping();
      checks.redis = { status: "ok", latency: Date.now() - start };
    } catch (err) {
      checks.redis = {
        status: "error",
        latency: Date.now() - start,
        error: err instanceof Error ? err.message : "Connexion échouée",
      };
    }
  }

  const allOk = Object.values(checks).every(
    (c) => c.status === "ok" || c.status === "skipped"
  );

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
