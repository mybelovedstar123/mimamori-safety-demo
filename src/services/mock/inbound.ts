import type { DeviceResponse } from '@/types';

/**
 * 外部から届く Webhook の生 payload をモック生成する。
 * 実運用では端末メーカー / LINE プラットフォームから HTTP で届く。
 */

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(++seq).toString(36)}`;

export function buildDeviceWebhook(deviceId: string, button: DeviceResponse['buttonCode']) {
  return { event_id: nextId('dev'), device_id: deviceId, button, ts: Date.now(), battery: 80 };
}

/** ファームウェア不具合などで不正な値が届くケース */
export function buildCorruptDeviceWebhook(deviceId: string) {
  return { event_id: nextId('dev'), device_id: deviceId, button: 'BTN_0x1F', ts: Date.now() };
}

export function buildLineWebhook(userId: string, text: string) {
  return {
    destination: 'Uxxxxxxxx',
    events: [
      {
        type: 'message',
        webhookEventId: nextId('line'),
        timestamp: Date.now(),
        userRef: userId,
        message: { id: nextId('msg'), type: 'text', text },
      },
    ],
  };
}
