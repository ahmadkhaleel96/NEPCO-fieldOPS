/** JWT access token TTL in seconds */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

/** JWT refresh token TTL in seconds */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** Geofence radius around asset for "ready to scan" prompt (metres) */
export const SITE_GEOFENCE_RADIUS_M = 200;

/** GPS polling interval while moving (seconds) */
export const GPS_INTERVAL_MOVING_S = 15;

/** GPS polling interval once site tag has been scanned (seconds) */
export const GPS_INTERVAL_STATIONARY_S = 60;

/** GPS batch size before sending to server */
export const GPS_BATCH_SIZE = 10;

/** Rate limit: max auth attempts per window */
export const AUTH_RATE_LIMIT_MAX = 5;

/** Rate limit: window duration in seconds */
export const AUTH_RATE_LIMIT_WINDOW_S = 60;

/** Report retention in years */
export const REPORT_RETENTION_YEARS = 7;

/** Maximum photo size in bytes (10 MB) */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Permit number format prefix */
export const PERMIT_NUMBER_PREFIX = 'WP';

/** Safety report number format prefix */
export const SAFETY_REPORT_PREFIX = 'SAF';

/** Maximum request body size in bytes (1 MB) */
export const MAX_REQUEST_BODY_BYTES = 1 * 1024 * 1024;

/** Report generation rate limit per user: max requests in window */
export const REPORT_GENERATION_RATE_LIMIT_MAX = 2;

/** Report generation rate limit per user: window duration in seconds */
export const REPORT_GENERATION_RATE_LIMIT_WINDOW_S = 60;
