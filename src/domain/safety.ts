import type {
  AdditionalResponse,
  IncomingResponse,
  SafetyRecord,
  SafetyResponse,
  SafetyStatus,
} from '@/types';

export type MergeOutcome =
  /** 最初の回答として正式採用 */
  | 'adopted'
  /** 後着の同内容回答として追記 */
  | 'appended'
  /** 後着かつ採用回答と内容が異なる（要確認） */
  | 'appended_conflict'
  /** 同一 ID の再送（冪等処理で無視） */
  | 'ignored';

export interface MergeResult {
  record: SafetyRecord;
  outcome: MergeOutcome;
  primary: SafetyResponse;
}

/**
 * 重複回答処理（先着採用ルール）
 * 1. 先に届いた回答を正式回答として採用
 * 2. 後着回答は additionalResponses に追記（元データは削除しない）
 * 3. 回答経路と時刻をすべて保持
 */
export function mergeResponse(record: SafetyRecord, incoming: IncomingResponse): MergeResult {
  const current = record.response;

  if (!current) {
    const primary: SafetyResponse = {
      responseId: incoming.id,
      userId: incoming.userId,
      status: incoming.status,
      source: incoming.source,
      receivedAt: incoming.receivedAt,
      isPrimary: true,
      additionalResponses: [],
    };
    return { record: { ...record, response: primary, platformSynced: false }, outcome: 'adopted', primary };
  }

  const alreadyKnown =
    current.responseId === incoming.id ||
    current.additionalResponses.some((a) => a.responseId === incoming.id);
  if (alreadyKnown) return { record, outcome: 'ignored', primary: current };

  const conflicts = incoming.status !== current.status;
  const additional: AdditionalResponse = {
    responseId: incoming.id,
    status: incoming.status,
    source: incoming.source,
    receivedAt: incoming.receivedAt,
    conflicts,
  };
  const primary: SafetyResponse = {
    ...current,
    additionalResponses: [...current.additionalResponses, additional],
  };
  return {
    record: { ...record, response: primary, platformSynced: false },
    outcome: conflicts ? 'appended_conflict' : 'appended',
    primary,
  };
}

/** 全チャネルの送信に失敗し、回答もない場合は「連絡不能」とみなす */
export function isUnreachable(record: SafetyRecord): boolean {
  const { device, line } = record.dispatch;
  const attempted = [device, line].filter((c) => c.state !== 'skipped' && c.state !== 'idle');
  return attempted.length > 0 && attempted.every((c) => c.state === 'failed');
}

export function getEffectiveStatus(record: SafetyRecord | undefined): SafetyStatus {
  if (!record) return 'unconfirmed';
  if (record.manualStatus) return record.manualStatus.status;
  if (record.response) return record.response.status;
  return isUnreachable(record) ? 'unreachable' : 'unconfirmed';
}

export const hasDuplicate = (record: SafetyRecord | undefined) =>
  !!record?.response && record.response.additionalResponses.length > 0;

export const hasConflict = (record: SafetyRecord | undefined) =>
  !!record?.response?.additionalResponses.some((a) => a.conflicts);

export const hasDispatchFailure = (record: SafetyRecord | undefined) =>
  record?.dispatch.device.state === 'failed' || record?.dispatch.line.state === 'failed';

/** 管理者のフォローが必要か（要支援・緊急・連絡不能・回答不一致） */
export function needsAttention(record: SafetyRecord | undefined): boolean {
  const s = getEffectiveStatus(record);
  return s === 'needs_support' || s === 'emergency' || s === 'unreachable' || hasConflict(record);
}

/** 状態の深刻度（並び替え用、大きいほど優先） */
export const STATUS_PRIORITY: Record<SafetyStatus, number> = {
  emergency: 5,
  unreachable: 4,
  needs_support: 3,
  unconfirmed: 2,
  safe: 1,
};

export function createEmptyRecord(userId: string, eventId: string): SafetyRecord {
  return {
    userId,
    eventId,
    response: null,
    dispatch: {
      device: { state: 'idle', attempts: 0 },
      line: { state: 'idle', attempts: 0 },
    },
    platformSynced: false,
  };
}
