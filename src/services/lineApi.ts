import { apiClient } from './apiClient';

export interface MulticastResult {
  requestId: string;
  accepted: string[];
  rejected: { userId: string; reason: string }[];
}

/** LINE Messaging API の上限に合わせた一括送信単位 */
export const LINE_MULTICAST_LIMIT = 500;

export const lineApi = {
  /** 安否確認メッセージ（クイックリプライ付き）を一斉送信 */
  multicastSafetyCheck(userIds: string[], eventId: string, title: string) {
    return apiClient.request<MulticastResult>({
      service: 'line',
      method: 'POST',
      path: '/messages/multicast',
      body: {
        to: userIds,
        eventId,
        messages: [
          {
            type: 'text',
            text: `【${title}】ご無事ですか？下のボタンで教えてください。`,
            quickReply: ['無事です', '支援が必要です', '緊急・助けて'],
          },
        ],
      },
    });
  },

  healthCheck() {
    return apiClient.request<{ status: string }>({ service: 'line', method: 'GET', path: '/health' });
  },
};
