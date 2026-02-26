import "server-only";

interface FixedWindowBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}

const fixedWindowBuckets = new Map<string, FixedWindowBucket>();
const MAX_BUCKETS = 5000;

function cleanupExpiredBuckets(now: number) {
  if (fixedWindowBuckets.size <= MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of fixedWindowBuckets.entries()) {
    if (bucket.resetAt <= now) {
      fixedWindowBuckets.delete(key);
    }
  }
}

export function consumeFixedWindowRateLimit(params: {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitDecision {
  const { namespace, key, limit, windowMs } = params;
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const bucketKey = `${namespace}:${key}`;
  const current = fixedWindowBuckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    fixedWindowBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.max(0, limit - 1),
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  current.count += 1;
  fixedWindowBuckets.set(bucketKey, current);

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, limit - current.count),
  };
}
