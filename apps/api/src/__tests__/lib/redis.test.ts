import { describe, it, expect, vi } from 'vitest';

const mockSlidingWindow = vi.fn().mockReturnValue('sliding-window');
const MockRatelimit = vi.fn().mockImplementation(() => ({ limit: vi.fn() }));
(MockRatelimit as unknown as Record<string, unknown>)['slidingWindow'] = mockSlidingWindow;

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({ ping: vi.fn() })),
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: MockRatelimit,
}));

process.env['UPSTASH_REDIS_REST_URL'] = 'https://test.upstash.io';
process.env['UPSTASH_REDIS_REST_TOKEN'] = 'test-token';

const { redis, authRateLimiter, apiRateLimiter, reportGenerationRateLimiter } = await import('../../lib/redis');
const { Redis } = await import('@upstash/redis');

describe('redis module', () => {
  it('creates a Redis client with the configured url and token', () => {
    expect(vi.mocked(Redis)).toHaveBeenCalledWith({
      url: 'https://test.upstash.io',
      token: 'test-token',
    });
  });

  it('exports redis client', () => {
    expect(redis).toBeDefined();
  });

  it('exports authRateLimiter', () => {
    expect(authRateLimiter).toBeDefined();
  });

  it('exports apiRateLimiter', () => {
    expect(apiRateLimiter).toBeDefined();
  });

  it('exports reportGenerationRateLimiter', () => {
    expect(reportGenerationRateLimiter).toBeDefined();
  });

  it('configures rate limiters with sliding window', () => {
    expect(mockSlidingWindow).toHaveBeenCalledTimes(3);
  });
});
