import type { DeviceResponse, LineResponse, SafetyStatus } from '@/types';
import { ApiError } from '@/utils/errors';

const BUTTON_TO_STATUS: Record<DeviceResponse['buttonCode'], SafetyStatus> = {
  BTN_SAFE: 'safe',
  BTN_HELP: 'needs_support',
  BTN_SOS: 'emergency',
};

/** LINE のクイックリプライ文言 → 安否状態 */
const LINE_KEYWORDS: [RegExp, SafetyStatus][] = [
  [/緊急|SOS|助けて/, 'emergency'],
  [/支援|手助け|困って|けが|怪我/, 'needs_support'],
  [/無事|大丈夫|問題なし/, 'safe'],
];

export const LINE_REPLY_OPTIONS = ['無事です', '支援が必要です', '緊急・助けて'] as const;
export const DEVICE_BUTTONS: { code: DeviceResponse['buttonCode']; label: string }[] = [
  { code: 'BTN_SAFE', label: '無事ボタン' },
  { code: 'BTN_HELP', label: '支援要請ボタン' },
  { code: 'BTN_SOS', label: 'SOSボタン' },
];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

function parseTimestamp(ts: unknown, endpoint: string): string {
  const d = typeof ts === 'number' || typeof ts === 'string' ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) throw new ApiError('INVALID_DATA', endpoint, 'timestamp が不正です');
  return d.toISOString();
}

/** 外部端末からの生 payload を検証して型付き回答に変換 */
export function parseDevicePayload(
  raw: unknown,
  resolveUserId: (deviceId: string) => string | undefined,
): DeviceResponse {
  const ep = 'device-webhook';
  if (!isObj(raw)) throw new ApiError('INVALID_DATA', ep, 'payload がオブジェクトではありません');
  const deviceId = raw.device_id;
  const button = raw.button;
  if (typeof deviceId !== 'string' || !/^DEV-\d{4}$/.test(deviceId)) {
    throw new ApiError('INVALID_DATA', ep, 'device_id が不正です');
  }
  if (typeof button !== 'string' || !(button in BUTTON_TO_STATUS)) {
    throw new ApiError('INVALID_DATA', ep, `未定義のボタンコード: ${String(button)}`);
  }
  const userId = resolveUserId(deviceId);
  if (!userId) throw new ApiError('INVALID_DATA', ep, '利用者が紐付いていない端末です');
  const code = button as DeviceResponse['buttonCode'];
  return {
    id: String(raw.event_id ?? `${deviceId}-${String(raw.ts)}`),
    source: 'device',
    deviceId,
    userId,
    buttonCode: code,
    status: BUTTON_TO_STATUS[code],
    receivedAt: parseTimestamp(raw.ts, ep),
  };
}

/** LINE Webhook（デモ用に簡略化）を検証して型付き回答に変換 */
export function parseLinePayload(raw: unknown): LineResponse {
  const ep = 'line-webhook';
  if (!isObj(raw) || !Array.isArray(raw.events) || !isObj(raw.events[0])) {
    throw new ApiError('INVALID_DATA', ep, 'events が存在しません');
  }
  const ev = raw.events[0] as Record<string, unknown>;
  const message = isObj(ev.message) ? ev.message : null;
  const text = message?.text;
  const userRef = ev.userRef;
  if (typeof text !== 'string' || typeof userRef !== 'string') {
    throw new ApiError('INVALID_DATA', ep, 'message.text または userRef がありません');
  }
  const status = LINE_KEYWORDS.find(([re]) => re.test(text))?.[1];
  if (!status) throw new ApiError('INVALID_DATA', ep, `安否を判定できない文言: 「${text}」`);
  return {
    id: String(message?.id ?? ev.webhookEventId),
    source: 'line',
    lineMessageId: String(message?.id ?? ''),
    userId: userRef,
    text,
    status,
    receivedAt: parseTimestamp(ev.timestamp, ep),
  };
}
