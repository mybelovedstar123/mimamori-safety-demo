import type { ApiErrorCode, Device } from '@/types';
import { apiClient } from './apiClient';

export interface EmergencySignalResult {
  accepted: boolean;
  deviceId: string;
  mode: 'emergency';
  ackAt: string;
}

type DeviceTarget = Pick<Device, 'id' | 'connection' | 'apiStatus'>;

/** モック用: 端末の擬似状態から発生させる障害を決める */
function mockErrorFor(device: DeviceTarget): ApiErrorCode | undefined {
  if (device.connection === 'offline') return 'DEVICE_OFFLINE';
  if (device.apiStatus === 'auth_error') return 'AUTH';
  if (device.apiStatus === 'timeout') return 'TIMEOUT';
  return undefined;
}

export const deviceApi = {
  /** 外部見守り端末へ緊急モード（安否確認）の合図を送る */
  sendEmergencySignal(device: DeviceTarget, eventId: string) {
    return apiClient.request<EmergencySignalResult>({
      service: 'device',
      method: 'POST',
      path: `/devices/${device.id}/emergency`,
      body: { eventId, mode: 'emergency', prompt: 'safety_check' },
      mock: { forceError: mockErrorFor(device) },
    });
  },

  /** 緊急モード解除（通常見守りへ戻す） */
  releaseEmergency(device: DeviceTarget) {
    return apiClient.request<{ accepted: boolean }>({
      service: 'device',
      method: 'POST',
      path: `/devices/${device.id}/release`,
      mock: { forceError: device.connection === 'offline' ? 'DEVICE_OFFLINE' : undefined },
    });
  },

  getStatus(device: DeviceTarget) {
    return apiClient.request<{ deviceId: string; reachable: boolean; checkedAt: string }>({
      service: 'device',
      method: 'GET',
      path: `/devices/${device.id}/status`,
      mock: { forceError: mockErrorFor(device) },
    });
  },

  healthCheck() {
    return apiClient.request<{ status: string }>({ service: 'device', method: 'GET', path: '/health' });
  },
};
