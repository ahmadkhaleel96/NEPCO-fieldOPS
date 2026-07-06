import { describe, it, expect } from 'vitest';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  SITE_GEOFENCE_RADIUS_M,
  GPS_INTERVAL_MOVING_S,
  GPS_INTERVAL_STATIONARY_S,
  GPS_BATCH_SIZE,
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_S as _AUTH_RATE_LIMIT_WINDOW_S,
  REPORT_RETENTION_YEARS,
  MAX_PHOTO_BYTES,
  PERMIT_NUMBER_PREFIX,
  SAFETY_REPORT_PREFIX,
} from '../constants';

describe('Security constants', () => {
  it('access token TTL is exactly 15 minutes', () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
  });

  it('refresh token TTL is exactly 7 days', () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it('access token TTL is much shorter than refresh token TTL', () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBeLessThan(REFRESH_TOKEN_TTL_SECONDS);
  });

  it('auth rate limit is 5 attempts', () => {
    expect(AUTH_RATE_LIMIT_MAX).toBe(5);
  });
});

describe('GPS constants', () => {
  it('geofence radius is 200 metres', () => {
    expect(SITE_GEOFENCE_RADIUS_M).toBe(200);
  });

  it('moving interval is shorter than stationary interval', () => {
    expect(GPS_INTERVAL_MOVING_S).toBeLessThan(GPS_INTERVAL_STATIONARY_S);
  });

  it('batch size is a positive integer', () => {
    expect(GPS_BATCH_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(GPS_BATCH_SIZE)).toBe(true);
  });
});

describe('Report constants', () => {
  it('report retention is 7 years', () => {
    expect(REPORT_RETENTION_YEARS).toBe(7);
  });

  it('max photo size is 10 MB', () => {
    expect(MAX_PHOTO_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe('Format prefixes', () => {
  it('permit number prefix is WP', () => {
    expect(PERMIT_NUMBER_PREFIX).toBe('WP');
  });

  it('safety report prefix is SAF', () => {
    expect(SAFETY_REPORT_PREFIX).toBe('SAF');
  });
});
