import type { IncomingResponse, LogCategory, ResponseSource, SafetyStatus } from '@/types';
import { mergeResponse, type MergeOutcome } from '@/domain/safety';
import { parseDevicePayload, parseLinePayload } from '@/domain/validation';
import { safetyApi } from '@/services/safetyApi';
import { useAppStore } from '@/store/appStore';
import { ApiError, ERROR_INFO, toApiError } from '@/utils/errors';
import { formatTime } from '@/utils/format';
import { createId } from '@/utils/id';
import { SOURCE_LABEL, STATUS_LABEL } from '@/utils/labels';

const store = () => useAppStore.getState();

const sourceCategory = (s: ResponseSource): LogCategory => (s === 'line' ? 'line' : s === 'device' ? 'device_api' : 'safety');

export interface IngestResult {
  outcome: MergeOutcome;
  userId: string;
}

/**
 * 回答の受信処理（全経路共通）。
 * 先着採用ルールの判定は domain/safety.ts の mergeResponse に委譲する。
 */
export async function ingestResponse(incoming: IncomingResponse): Promise<IngestResult> {
  const s = store();
  const user = s.usersById[incoming.userId];
  if (!s.event) throw new ApiError('INVALID_DATA', 'safety', '実施中の安否確認がありません');
  if (!user || !s.records[incoming.userId]) {
    throw new ApiError('INVALID_DATA', 'safety', `安否確認の対象外です（${incoming.userId}）`);
  }

  // 状態は受信時点の最新レコードに対して判定する
  const result = mergeResponse(store().records[incoming.userId], incoming);
  if (result.outcome === 'ignored') {
    s.addLog({ category: 'duplicate', level: 'info', action: '再送を無視', message: `同一回答IDの再送を検知（${incoming.id}）`, userId: user.id });
    return { outcome: 'ignored', userId: user.id };
  }
  s.updateRecord(user.id, () => result.record);

  s.addLog({
    category: sourceCategory(incoming.source),
    level: incoming.status === 'emergency' ? 'error' : incoming.status === 'needs_support' ? 'warning' : 'info',
    action: '安否回答受信',
    message: `「${STATUS_LABEL[incoming.status]}」（${SOURCE_LABEL[incoming.source]}）`,
    userId: user.id,
    deviceId: incoming.source === 'device' ? incoming.deviceId : undefined,
    payload: { responseId: incoming.id, source: incoming.source, status: incoming.status, receivedAt: incoming.receivedAt },
  });

  if (incoming.source === 'device') {
    s.updateDevice(incoming.deviceId, (d) => ({
      ...d,
      lastCommunicationAt: incoming.receivedAt,
      history: [
        ...d.history,
        { id: createId('DEVEV'), at: incoming.receivedAt, kind: 'response', ok: true, message: `安否回答: ${STATUS_LABEL[incoming.status]}（${incoming.buttonCode}）` },
      ],
    }));
  }

  const p = result.primary;
  if (result.outcome === 'adopted') {
    if (incoming.status === 'emergency') {
      s.addNotification({ severity: 'critical', category: 'emergency_response', title: '緊急回答を受信しました', message: `${user.name} から「緊急」の回答（${SOURCE_LABEL[incoming.source]}）`, userId: user.id, link: `/users/${user.id}` });
    } else if (incoming.status === 'needs_support') {
      s.addNotification({ severity: 'warning', category: 'emergency_response', title: '支援要請を受信しました', message: `${user.name} から「要支援」の回答`, userId: user.id, link: `/users/${user.id}` });
    }
  } else {
    const conflict = result.outcome === 'appended_conflict';
    s.addLog({
      category: 'duplicate',
      level: conflict ? 'warning' : 'info',
      action: '先着回答を採用',
      message: `${SOURCE_LABEL[p.source]}回答（${formatTime(p.receivedAt)}）を正式回答として維持。${SOURCE_LABEL[incoming.source]}回答（${formatTime(incoming.receivedAt)}）は追記として保存${conflict ? '／回答内容が不一致のため要確認' : ''}`,
      userId: user.id,
    });
    if (conflict) {
      s.addNotification({ severity: 'warning', category: 'duplicate', title: '重複回答の内容が一致しません', message: `${user.name}: 採用「${STATUS_LABEL[p.status]}」/ 追記「${STATUS_LABEL[incoming.status]}」`, userId: user.id, link: `/users/${user.id}` });
    }
    if (!store().simulation.highlight) {
      store().setSimulation({
        highlight: {
          userId: user.id,
          primary: { source: SOURCE_LABEL[p.source], status: STATUS_LABEL[p.status], at: p.receivedAt },
          additional: { source: SOURCE_LABEL[incoming.source], status: STATUS_LABEL[incoming.status], at: incoming.receivedAt },
        },
      });
    }
  }

  // 永続化（GAS / Spreadsheet）。失敗してもローカルの判定結果は保持し、ログで追跡する
  try {
    await safetyApi.saveResponse(s.event.id, incoming, result.outcome === 'adopted');
  } catch (err) {
    const e = toApiError(err);
    s.addLog({ category: 'system', level: 'error', action: '保存失敗', message: `回答データの保存に失敗（${ERROR_INFO[e.code].label}）。再送キューに登録しました`, userId: user.id });
  }

  return { outcome: result.outcome, userId: user.id };
}

/** 不正データ受信時の共通処理 */
function rejectInvalid(err: unknown, channel: 'line' | 'device_api') {
  const e = toApiError(err);
  store().addLog({ category: channel, level: 'error', action: '不正なデータを破棄', message: e.message, endpoint: e.endpoint, statusCode: e.status });
  if (e.code !== 'INVALID_DATA') throw e;
  return null;
}

export async function receiveLineWebhook(raw: unknown): Promise<IngestResult | null> {
  let parsed;
  try {
    parsed = parseLinePayload(raw);
  } catch (err) {
    return rejectInvalid(err, 'line');
  }
  return ingestResponse(parsed);
}

export async function receiveDeviceWebhook(raw: unknown): Promise<IngestResult | null> {
  let parsed;
  try {
    parsed = parseDevicePayload(raw, (deviceId) => store().devices[deviceId]?.userId);
  } catch (err) {
    return rejectInvalid(err, 'device_api');
  }
  return ingestResponse(parsed);
}

/** 電話確認・管理者による回答入力 */
export function recordManualResponse(userId: string, status: SafetyStatus, source: 'phone' | 'admin', memo?: string) {
  return ingestResponse({
    id: createId('RSP'),
    source,
    userId,
    status,
    receivedAt: new Date().toISOString(),
    operator: store().adminName,
    memo,
  });
}

/** 管理者判断で状態を確定（回答不一致の解消・連絡不能の確定など） */
export async function setManualStatus(userId: string, status: SafetyStatus, reason: string) {
  const s = store();
  if (!s.event) throw new ApiError('INVALID_DATA', 'safety', '実施中の安否確認がありません');
  const at = new Date().toISOString();
  s.updateRecord(userId, (r) => ({ ...r, manualStatus: { status, by: s.adminName, at, reason }, platformSynced: false }));
  s.addLog({ category: 'audit', level: 'warning', action: '状態を管理者確定', message: `「${STATUS_LABEL[status]}」に確定: ${reason}`, userId });
  try {
    await safetyApi.saveManualStatus(s.event.id, userId, status, reason);
  } catch (err) {
    const e = toApiError(err);
    s.addLog({ category: 'system', level: 'error', action: '保存失敗', message: ERROR_INFO[e.code].message, userId });
    throw e;
  }
}
