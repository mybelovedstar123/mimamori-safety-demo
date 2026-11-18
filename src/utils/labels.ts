import type {
  ConnectionState,
  DeviceApiStatus,
  DeviceMode,
  DisasterType,
  DispatchState,
  LogCategory,
  NotificationCategory,
  ResponseSource,
  SafetyStatus,
  Severity,
} from '@/types';

export const STATUS_LABEL: Record<SafetyStatus, string> = {
  unconfirmed: '未確認',
  safe: '無事',
  needs_support: '要支援',
  emergency: '緊急',
  unreachable: '連絡不能',
};

export const SOURCE_LABEL: Record<ResponseSource, string> = {
  line: 'LINE',
  device: '外部端末',
  phone: '電話',
  admin: '管理者入力',
};

export const CONNECTION_LABEL: Record<ConnectionState, string> = {
  online: 'Online',
  offline: 'Offline',
  warning: 'Warning',
};

export const DEVICE_MODE_LABEL: Record<DeviceMode, string> = {
  normal: '通常見守り',
  emergency: '緊急モード',
  maintenance: 'メンテナンス',
};

export const API_STATUS_LABEL: Record<DeviceApiStatus, string> = {
  connected: '接続中',
  auth_error: '認証エラー',
  timeout: 'タイムアウト',
  disconnected: '切断',
};

export const DISPATCH_LABEL: Record<DispatchState, string> = {
  idle: '未送信',
  queued: '送信待ち',
  sending: '送信中',
  sent: '送信済み',
  failed: '送信失敗',
  skipped: '対象外',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

export const DISASTER_LABEL: Record<DisasterType, string> = {
  earthquake: '地震',
  flood: '大雨・洪水',
  landslide: '土砂災害',
  typhoon: '台風',
  other: 'その他',
};

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  unanswered: '未回答',
  api_error: 'APIエラー',
  dispatch_failed: '送信失敗',
  device_offline: '端末Offline',
  emergency_response: '緊急回答',
  platform_failed: '外部PF送信失敗',
  duplicate: '重複回答',
  system: 'システム',
};

export const LOG_CATEGORY_LABEL: Record<LogCategory, string> = {
  device_api: 'External Device API',
  line: 'LINE',
  safety: 'Safety Response',
  duplicate: 'Duplicate Response',
  platform: 'External Platform',
  emergency: 'Emergency Mode',
  system: 'System',
  audit: 'Audit',
};
