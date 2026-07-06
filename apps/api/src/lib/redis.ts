import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_S,
  REPORT_GENERATION_RATE_LIMIT_MAX,
  REPORT_GENERATION_RATE_LIMIT_WINDOW_S,
} from '@fieldops/shared';

const redisUrl = process.env['UPSTASH_REDIS_REST_URL'];
const redisToken = process.env['UPSTASH_REDIS_REST_TOKEN'];

if (!redisUrl || !redisToken) {
  throw new Error(
    'Missing Redis environment variables: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN'
  );
}

export const redis = new Redis({ url: redisUrl, token: redisToken });

/**
 * Strict rate limiter for authentication endpoints.
 * 5 attempts per 60-second sliding window per IP.
 * After exhaustion the request is rejected with 429.
 */
export const authRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(AUTH_RATE_LIMIT_MAX, `${AUTH_RATE_LIMIT_WINDOW_S}s`),
  prefix: 'fieldops:rl:auth',
  analytics: false,
});

/**
 * General API rate limiter — less strict, applied to all endpoints.
 * 120 requests per 60 seconds per IP.
 */
export const apiRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '60s'),
  prefix: 'fieldops:rl:api',
  analytics: false,
});

/**
 * Per-user rate limiter for report generation.
 * 2 reports per 60-second window per user ID.
 * Prevents abuse by authenticated users flooding the report generation endpoint.
 */
export const reportGenerationRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(REPORT_GENERATION_RATE_LIMIT_MAX, `${REPORT_GENERATION_RATE_LIMIT_WINDOW_S}s`),
  prefix: 'fieldops:rl:report-gen',
  analytics: false,
});
