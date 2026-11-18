import type { DeviceResponse } from '@/types';
import { deviceApi } from '@/services/deviceApi';
import { buildCorruptDeviceWebhook, buildDeviceWebhook } from '@/services/mock/inbound';
import { useAppStore } from '@/store/appStore';
import { ERROR_INFO, toApiError } from '@/utils/errors';
import { createId } from '@/utils/id';
import { receiveDeviceWebhook } from './responses';

const store = () => useAppStore.getState();

/** 端末の疎通確認 */
export async function checkDeviceStatus(deviceId: string) {
  const device = store().devices[deviceId];
  if (!device) return;
  const started = performance.now();
  try {
    const res = await deviceApi.getStatus(device);
    store().updateDevice(deviceId, (d) => ({
      ...d,
      lastCommunicationAt: res.checkedAt,
      history: [...d.history, { id: createId('DEVEV'), at: res.checkedAt, kind: 'heartbeat', ok: true, message: '疎通確認：応答あり' }],
    }));
    store().addLog({ category: 'device_api', level: 'success', action: '疎通確認', message: '端末から応答がありました', deviceId, userId: device.userId, endpoint: `/devices/${deviceId}/status`, method: 'GET', statusCode: 200, durationMs: Math.round(performance.now() - started) });
    store().pushToast({ tone: 'success', title: `${deviceId} は応答しました` });
  } catch (err) {
    const e = toApiError(err);
    const at = new Date().toISOString();
    store().updateDevice(deviceId, (d) => ({ ...d, history: [...d.history, { id: createId('DEVEV'), at, kind: 'error', ok: false, message: `疎通確認失敗：${ERROR_INFO[e.code].label}` }] }));
    store().addLog({ category: 'device_api', level: 'error', action: '疎通確認失敗', message: ERROR_INFO[e.code].message, deviceId, userId: device.userId, endpoint: e.endpoint, method: 'GET', statusCode: e.status });
    throw e;
  }
}

/** 端末ボタン押下を模擬（テスト用 Webhook） */
export function simulateDeviceButton(deviceId: string, button: DeviceResponse['buttonCode']) {
  return receiveDeviceWebhook(buildDeviceWebhook(deviceId, button));
}

/** 不正データ受信を模擬 */
export async function simulateCorruptPayload(deviceId: string) {
  await receiveDeviceWebhook(buildCorruptDeviceWebhook(deviceId));
  store().pushToast({ tone: 'warning', title: '不正なデータを破棄しました', message: '未定義のボタンコードを受信したため、安否回答として扱いませんでした（ログに記録）。' });
}
