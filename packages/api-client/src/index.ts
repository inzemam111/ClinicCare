import type { ApiResponse, HealthStatus } from '@cliniccare/shared-types';

export class ClinicCareApiClient {
  constructor(private readonly baseUrl: string) {}
  async health(): Promise<HealthStatus> {
    const response = await fetch(`${this.baseUrl}/health`);
    const body = (await response.json()) as ApiResponse<HealthStatus>;
    return body.data;
  }
}
