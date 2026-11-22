export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: { database: boolean; redis: boolean };
}

export interface ApiResponse<T> { data: T; meta?: Record<string, unknown>; }
