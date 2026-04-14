export interface ApiClientConfig {
  baseUrl: string;
  /** JWT access token — required for all authenticated endpoints */
  accessToken?: string;
}

/**
 * Typed API client for the FieldOps API.
 * Phase 0 stub — full implementation generated from OpenAPI spec in Phase 0.5+.
 */
export class ApiClient {
  private baseUrl: string;
  private accessToken: string | undefined;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.accessToken = config.accessToken;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include', // sends httpOnly refresh token cookie
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: { code: 'UNKNOWN', message: response.statusText },
      }));
      throw new ApiError(response.status, error.error?.code, error.error?.message);
    }

    return response.json() as Promise<T>;
  }

  get health() {
    return {
      check: () => this.request<{ status: string; timestamp: string }>('GET', '/health'),
    };
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
