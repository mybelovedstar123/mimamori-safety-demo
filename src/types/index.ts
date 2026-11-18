// ---- 基本区分 --------------------------------------------------------------

export type Environment = 'test' | 'production';

/** 安否状態。unconfirmed = 未確認（未回答） */
export type SafetyStatus = 'unconfirmed' | 'safe' | 'needs_support' | 'emergency' | 'unreachable';

/** 回答経路 */
export type ResponseSource = 'line' | 'device' | 'phone' | 'admin';

export type ConnectionState = 'online' | 'offline' | 'warning';
export type DeviceMode = 'normal' | 'emergency' | 'maintenance';
export type DeviceApiStatus = 'connected' | 'auth_error' | 'timeout' | 'disconnected';
export type Severity = 'critical' | 'warning' | 'info';
export type DispatchState = 'idle' | 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';

export type ApiErrorCode =
  | 'TIMEOUT'
  | 'AUTH'
  | 'DEVICE_OFFLINE'
  | 'NETWORK'
  | 'INVALID_DATA'
  | 'RATE_LIMIT'
  | 'SERVER';

// ---- 地域・対象者 -------------------------------------------------------------

export interface Region {
  id: string;
  name: string;
  /** 地図描画用ポリゴン（0-1000 の SVG 座標系） */
  polygon: [number, number][];
  labelAt: [number, number];
  /** 浸水想定などデモ用ハザード区分 */
  hazard: 'flood' | 'landslide' | 'none';
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface User {
  id: string;
  name: string;
  kana: string;
  age: number;
  gender: 'male' | 'female';
  regionId: string;
  /** デモ用の架空住所 */
  address: string;
  emergencyContact: EmergencyContact;
  deviceId: string | null;
  line: { linked: boolean; displayName?: string; linkedAt?: string };
  livesAlone: boolean;
  careLevel: '自立' | '要支援1' | '要支援2' | '要介護1' | '要介護2' | '要介護3';
  /** 最終見守り（端末の生活反応など） */
  lastWatchAt: string;
  notes: string;
  /** 地図上の位置（SVG 座標系） */
  position: [number, number];
}

// ---- 見守り端末 ---------------------------------------------------------------

export interface DeviceEvent {
  id: string;
  at: string;
  kind: 'heartbeat' | 'emergency_signal' | 'response' | 'error' | 'mode_change';
  ok: boolean;
  message: string;
}

export interface Device {
  id: string;
  userId: string;
  model: string;
  firmware: string;
  connection: ConnectionState;
  apiStatus: DeviceApiStatus;
  lastCommunicationAt: string;
  battery: number;
  signal: number;
  mode: DeviceMode;
  history: DeviceEvent[];
}

// ---- 安否回答 -----------------------------------------------------------------

interface ResponseBase {
  id: string;
  userId: string;
  status: SafetyStatus;
  receivedAt: string;
}

/** LINE Webhook から届く回答 */
export interface LineResponse extends ResponseBase {
  source: 'line';
  lineMessageId: string;
  text: string;
}

/** 外部見守り端末から届く回答 */
export interface DeviceResponse extends ResponseBase {
  source: 'device';
  deviceId: string;
  buttonCode: 'BTN_SAFE' | 'BTN_HELP' | 'BTN_SOS';
}

/** 電話・管理者入力 */
export interface ManualResponse extends ResponseBase {
  source: 'phone' | 'admin';
  operator: string;
  memo?: string;
}

export type IncomingResponse = LineResponse | DeviceResponse | ManualResponse;

/** 追記として保持される後着回答 */
export interface AdditionalResponse {
  responseId: string;
  status: SafetyStatus;
  source: ResponseSource;
  receivedAt: string;
  /** 採用回答と内容が異なる */
  conflicts: boolean;
}

/** 正式採用された安否回答（先着） */
export interface SafetyResponse {
  responseId: string;
  userId: string;
  status: SafetyStatus;
  source: ResponseSource;
  receivedAt: string;
  isPrimary: true;
  additionalResponses: AdditionalResponse[];
}

export interface ChannelDispatch {
  state: DispatchState;
  attempts: number;
  lastAttemptAt?: string;
  error?: ApiErrorCode;
}

/** 安否確認イベント内の対象者ごとの状態 */
export interface SafetyRecord {
  userId: string;
  eventId: string;
  response: SafetyResponse | null;
  dispatch: { device: ChannelDispatch; line: ChannelDispatch };
  /** 管理者による状態確定（電話確認後の判断など） */
  manualStatus?: { status: SafetyStatus; by: string; at: string; reason: string };
  platformSynced: boolean;
}

// ---- 緊急モード ---------------------------------------------------------------

export type DisasterType = 'earthquake' | 'flood' | 'landslide' | 'typhoon' | 'other';

export interface EmergencyEvent {
  id: string;
  title: string;
  type: DisasterType;
  status: 'active' | 'closed';
  startedAt: string;
  closedAt?: string;
  startedBy: string;
  regionIds: string[];
  targetUserIds: string[];
  channels: { device: boolean; line: boolean };
  environment: Environment;
}

/** 終了した安否確認の結果（対象者ごと） */
export interface ArchivedEvent {
  event: EmergencyEvent;
  results: Record<string, { status: SafetyStatus; source: ResponseSource | null; at: string | null }>;
}

export interface DispatchSummary {
  total: number;
  device: { target: number; sent: number; failed: number; sending: number };
  line: { target: number; sent: number; failed: number; sending: number };
}

// ---- 通知・ログ -----------------------------------------------------------------

export type NotificationCategory =
  | 'unanswered'
  | 'api_error'
  | 'dispatch_failed'
  | 'device_offline'
  | 'emergency_response'
  | 'platform_failed'
  | 'duplicate'
  | 'system';

export interface AppNotification {
  id: string;
  at: string;
  severity: Severity;
  category: NotificationCategory;
  title: string;
  message: string;
  userId?: string;
  deviceId?: string;
  read: boolean;
  link?: string;
}

export type LogCategory =
  | 'device_api'
  | 'line'
  | 'safety'
  | 'duplicate'
  | 'platform'
  | 'emergency'
  | 'system'
  | 'audit';

export interface ApiLog {
  id: string;
  at: string;
  category: LogCategory;
  level: 'success' | 'info' | 'warning' | 'error';
  action: string;
  message: string;
  userId?: string;
  deviceId?: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT';
  statusCode?: number;
  durationMs?: number;
  /** 秘密情報はマスク済みの値のみ保持 */
  payload?: Record<string, unknown>;
}

// ---- 外部プラットフォーム ---------------------------------------------------------

export interface PlatformSync {
  id: string;
  startedAt: string;
  finishedAt?: string;
  eventId: string;
  environment: Environment;
  total: number;
  success: number;
  failed: number;
  pending: number;
  status: 'running' | 'success' | 'partial' | 'failed';
  error?: ApiErrorCode;
  trigger: 'manual' | 'simulation' | 'auto';
}

// ---- API 連携 -----------------------------------------------------------------

export type ApiServiceId = 'device' | 'line' | 'platform' | 'gas';

export interface ApiEndpointStats {
  id: ApiServiceId;
  name: string;
  provider: string;
  authStatus: 'valid' | 'expired' | 'invalid';
  lastCommunicationAt: string;
  requests: number;
  success: number;
  failed: number;
  avgResponseMs: number;
  /** 直近のレスポンスタイム（ms） */
  latencyHistory: number[];
}

// ---- シミュレーション ---------------------------------------------------------------

export type SimulationStepId =
  | 'start'
  | 'dispatch'
  | 'dispatch_success'
  | 'dispatch_failed'
  | 'line_responses'
  | 'device_responses'
  | 'duplicate'
  | 'adopt'
  | 'unanswered'
  | 'platform';

export interface SimulationStep {
  id: SimulationStepId;
  label: string;
  state: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

export interface FaultSettings {
  /** 送信ごとのタイムアウト発生率（0-1） */
  timeoutRate: number;
  /** 外部プラットフォーム送信失敗率（0-1） */
  platformFailureRate: number;
  /** ネットワーク遅延倍率 */
  latencyFactor: number;
}
