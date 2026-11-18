import type { ResponseSource, SafetyStatus } from '@/types';
import { apiClient } from './apiClient';

/** 外部プラットフォームへ送る項目は必要最小限（氏名・住所は送らない） */
export interface PlatformRecord {
  userId: string;
  regionId: string;
  status: SafetyStatus;
  source: ResponseSource | null;
  answeredAt: string | null;
  hasAdditionalResponses: boolean;
}

export const PLATFORM_BATCH_SIZE = 50;

export const platformApi = {
  pushRecords(eventId: string, records: PlatformRecord[]) {
    return apiClient.request<{ accepted: string[]; rejected: string[] }>({
      service: 'platform',
      method: 'POST',
      path: '/safety-records/bulk',
      body: { eventId, records },
    });
  },

  healthCheck() {
    return apiClient.request<{ status: string }>({ service: 'platform', method: 'GET', path: '/health' });
  },
};
