import type { PlatformSync, SafetyStatus } from '@/types';
import { getEffectiveStatus, hasDuplicate } from '@/domain/safety';
import { PLATFORM_BATCH_SIZE, platformApi, type PlatformRecord } from '@/services/platformApi';
import { useAppStore } from '@/store/appStore';
import { ERROR_INFO, toApiError } from '@/utils/errors';
import { emptyStatusCount } from '@/domain/stats';

const store = () => useAppStore.getState();

/** 前回同期以降に変更があり、まだ外部プラットフォームへ送っていない記録 */
export function getPlatformQueue(): PlatformRecord[] {
  const { event, records, usersById } = store();
  if (!event) return [];
  return event.targetUserIds
    .filter((id) => records[id] && !records[id].platformSynced)
    .map((id) => {
      const r = records[id];
      return {
        userId: id,
        regionId: usersById[id].regionId,
        status: getEffectiveStatus(r),
        source: r.response?.source ?? null,
        answeredAt: r.response?.receivedAt ?? null,
        hasAdditionalResponses: hasDuplicate(r),
      };
    });
}

export function countQueueByStatus(queue: PlatformRecord[]): Record<SafetyStatus, number> {
  const c = emptyStatusCount();
  queue.forEach((q) => (c[q.status] += 1));
  return c;
}

export async function syncToPlatform(trigger: PlatformSync['trigger']): Promise<PlatformSync | null> {
  const s = store();
  const event = s.event;
  if (!event) {
    s.pushToast({ tone: 'warning', title: '送信できません', message: '実施中の安否確認がありません。' });
    return null;
  }
  const queue = getPlatformQueue();
  if (!queue.length) {
    s.pushToast({ tone: 'info', title: '送信対象はありません', message: 'すべての安否情報は送信済みです。' });
    return null;
  }

  let sync: PlatformSync = {
    id: `SYNC-${String(s.platformSyncs.length + 1).padStart(4, '0')}`,
    startedAt: new Date().toISOString(),
    eventId: event.id,
    environment: s.environment,
    total: queue.length,
    success: 0,
    failed: 0,
    pending: queue.length,
    status: 'running',
    trigger,
  };
  s.upsertPlatformSync(sync);
  s.addLog({ category: 'platform', level: 'info', action: '送信開始', message: `安否情報 ${queue.length}件 の送信を開始（${Math.ceil(queue.length / PLATFORM_BATCH_SIZE)}バッチ）` });

  for (let i = 0; i < queue.length; i += PLATFORM_BATCH_SIZE) {
    const batch = queue.slice(i, i + PLATFORM_BATCH_SIZE);
    const started = performance.now();
    try {
      const res = await platformApi.pushRecords(event.id, batch);
      store().updateRecords(res.accepted, (r) => ({ ...r, platformSynced: true }));
      sync = { ...sync, success: sync.success + res.accepted.length, failed: sync.failed + res.rejected.length, pending: sync.pending - batch.length };
      store().addLog({ category: 'platform', level: 'success', action: '送信成功', message: `バッチ ${i / PLATFORM_BATCH_SIZE + 1}: ${res.accepted.length}件`, endpoint: '/safety-records/bulk', method: 'POST', statusCode: 200, durationMs: Math.round(performance.now() - started) });
    } catch (err) {
      const e = toApiError(err);
      sync = { ...sync, failed: sync.failed + batch.length, pending: sync.pending - batch.length, error: e.code };
      store().addLog({ category: 'platform', level: 'error', action: '送信失敗', message: `バッチ ${i / PLATFORM_BATCH_SIZE + 1}: ${batch.length}件 ${ERROR_INFO[e.code].label}`, endpoint: e.endpoint, method: 'POST', statusCode: e.status, durationMs: Math.round(performance.now() - started) });
    }
    store().upsertPlatformSync(sync);
  }

  const status: PlatformSync['status'] = sync.failed === 0 ? 'success' : sync.success === 0 ? 'failed' : 'partial';
  sync = { ...sync, status, finishedAt: new Date().toISOString() };
  store().upsertPlatformSync(sync);
  store().setLastSyncAt(sync.finishedAt!);

  if (sync.failed) {
    store().addNotification({
      severity: status === 'failed' ? 'critical' : 'warning',
      category: 'platform_failed',
      title: '外部プラットフォーム送信失敗',
      message: `${sync.total}件中 ${sync.failed}件が送信できませんでした（${sync.error ? ERROR_INFO[sync.error].label : '不明'}）`,
      link: '/platform',
    });
    store().pushToast({ tone: 'warning', title: `送信完了（失敗 ${sync.failed}件）`, message: '未送信分は再送信できます。' });
  } else {
    store().pushToast({ tone: 'success', title: '外部プラットフォームへ送信しました', message: `${sync.success}件 送信成功` });
  }
  return sync;
}
