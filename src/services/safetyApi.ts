import type { IncomingResponse, SafetyStatus } from '@/types';
import { apiClient } from './apiClient';

/**
 * 安否データの永続化（将来: GAS → Google Spreadsheet）。
 * 回答は経路に関係なく全件を追記保存し、削除しない。
 */
export const safetyApi = {
  saveResponse(eventId: string, response: IncomingResponse, adopted: boolean) {
    return apiClient.request<{ stored: boolean }>({
      service: 'gas',
      method: 'POST',
      path: '/safety-responses',
      body: {
        eventId,
        responseId: response.id,
        userId: response.userId,
        status: response.status,
        source: response.source,
        receivedAt: response.receivedAt,
        isPrimary: adopted,
      },
    });
  },

  saveManualStatus(eventId: string, userId: string, status: SafetyStatus, reason: string) {
    return apiClient.request<{ stored: boolean }>({
      service: 'gas',
      method: 'PUT',
      path: `/safety-records/${userId}`,
      body: { eventId, status, reason },
    });
  },

  healthCheck() {
    return apiClient.request<{ status: string }>({ service: 'gas', method: 'GET', path: '/health' });
  },
};
