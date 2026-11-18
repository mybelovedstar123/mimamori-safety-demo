import type { ApiErrorCode, DisasterType, DispatchSummary, EmergencyEvent } from '@/types';
import { deviceApi } from '@/services/deviceApi';
import { LINE_MULTICAST_LIMIT, lineApi } from '@/services/lineApi';
import { useAppStore } from '@/store/appStore';
import { ERROR_INFO, toApiError } from '@/utils/errors';
import { createId } from '@/utils/id';
import { sleep } from '@/utils/random';

const store = () => useAppStore.getState();

export interface StartEmergencyInput {
  title: string;
  type: DisasterType;
  regionIds: string[];
  userIds: string[];
  channels: { device: boolean; line: boolean };
}

export interface CancelToken {
  cancelled: boolean;
}

const MAX_DEVICE_ATTEMPTS = 2;

/** 新しい安否確認イベントを開始（実施中のものは終了してアーカイブ） */
export function startEmergencyEvent(input: StartEmergencyInput): EmergencyEvent {
  const s = store();
  if (s.event) closeEmergencyEvent('新しい安否確認の開始に伴い終了');
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const seq = String(store().eventArchive.filter((a) => a.event.id.includes(ymd)).length + 1).padStart(2, '0');
  const event: EmergencyEvent = {
    id: `EVT-${ymd}-${seq}`,
    title: input.title,
    type: input.type,
    status: 'active',
    startedAt: now.toISOString(),
    startedBy: s.adminName,
    regionIds: input.regionIds,
    targetUserIds: input.userIds,
    channels: input.channels,
    environment: s.environment,
  };
  store().beginEvent(event);
  store().addLog({
    category: 'emergency',
    level: 'warning',
    action: '緊急モード開始',
    message: `${event.title}（対象 ${input.userIds.length}名 / ${input.regionIds.length}地区）`,
    payload: { eventId: event.id, environment: event.environment, channels: input.channels },
  });
  store().addNotification({ severity: 'info', category: 'system', title: '災害時安否確認を開始しました', message: `${event.title}（対象 ${input.userIds.length}名）`, link: '/safety' });
  return event;
}

export function closeEmergencyEvent(reason = '管理者による終了') {
  const s = store();
  if (!s.event) return;
  s.addLog({ category: 'emergency', level: 'info', action: '安否確認終了', message: `${s.event.title}: ${reason}`, payload: { eventId: s.event.id } });
  s.archiveCurrentEvent();
}

function summarize(event: EmergencyEvent): DispatchSummary {
  const { records } = store();
  const sum: DispatchSummary = {
    total: event.targetUserIds.length,
    device: { target: 0, sent: 0, failed: 0, sending: 0 },
    line: { target: 0, sent: 0, failed: 0, sending: 0 },
  };
  for (const id of event.targetUserIds) {
    const r = records[id];
    if (!r) continue;
    (['device', 'line'] as const).forEach((ch) => {
      const st = r.dispatch[ch].state;
      if (st === 'skipped' || st === 'idle') return;
      sum[ch].target += 1;
      if (st === 'sent') sum[ch].sent += 1;
      else if (st === 'failed') sum[ch].failed += 1;
      else sum[ch].sending += 1;
    });
  }
  return sum;
}

export function getDispatchSummary(): DispatchSummary | null {
  const { event } = store();
  return event ? summarize(event) : null;
}

/** 1台の端末へ送信（タイムアウト等は自動再試行） */
async function sendToDevice(userId: string, eventId: string): Promise<ApiErrorCode | null> {
  const s = store();
  const user = s.usersById[userId];
  if (!user?.deviceId) return null;
  let lastError: ApiErrorCode | null = null;
  for (let attempt = 1; attempt <= MAX_DEVICE_ATTEMPTS; attempt++) {
    const device = store().devices[user.deviceId];
    store().updateRecord(userId, (r) => ({
      ...r,
      dispatch: { ...r.dispatch, device: { ...r.dispatch.device, state: 'sending', attempts: r.dispatch.device.attempts + 1, lastAttemptAt: new Date().toISOString(), error: undefined } },
    }));
    const started = performance.now();
    try {
      await deviceApi.sendEmergencySignal(device, eventId);
      const at = new Date().toISOString();
      store().updateRecord(userId, (r) => ({ ...r, dispatch: { ...r.dispatch, device: { ...r.dispatch.device, state: 'sent' } } }));
      store().updateDevice(device.id, (d) => ({
        ...d,
        mode: 'emergency',
        lastCommunicationAt: at,
        history: [...d.history, { id: createId('DEVEV'), at, kind: 'emergency_signal', ok: true, message: '緊急モード信号を受信（安否確認ボタン点灯）' }],
      }));
      store().addLog({ category: 'device_api', level: 'success', action: '送信成功', message: '緊急モード信号を送信', userId, deviceId: device.id, endpoint: `/devices/${device.id}/emergency`, method: 'POST', statusCode: 202, durationMs: Math.round(performance.now() - started) });
      return null;
    } catch (err) {
      const e = toApiError(err);
      lastError = e.code;
      const willRetry = ERROR_INFO[e.code].retryable && e.code !== 'DEVICE_OFFLINE' && attempt < MAX_DEVICE_ATTEMPTS;
      store().addLog({
        category: 'device_api',
        level: willRetry ? 'warning' : 'error',
        action: willRetry ? '再試行' : '送信失敗',
        message: `${ERROR_INFO[e.code].label}${willRetry ? '（自動再試行します）' : ''}`,
        userId,
        deviceId: device.id,
        endpoint: e.endpoint,
        method: 'POST',
        statusCode: e.status,
        durationMs: Math.round(performance.now() - started),
      });
      if (!willRetry) break;
      await sleep(300);
    }
  }
  if (lastError) {
    const code = lastError;
    const at = new Date().toISOString();
    store().updateRecord(userId, (r) => ({ ...r, dispatch: { ...r.dispatch, device: { ...r.dispatch.device, state: 'failed', error: code } } }));
    store().updateDevice(user.deviceId, (d) => ({
      ...d,
      history: [...d.history, { id: createId('DEVEV'), at, kind: 'error', ok: false, message: `緊急モード信号 送信失敗: ${ERROR_INFO[code].label}` }],
    }));
    store().addNotification({
      severity: code === 'AUTH' ? 'critical' : 'warning',
      category: code === 'AUTH' ? 'api_error' : 'dispatch_failed',
      title: '外部端末への送信に失敗しました',
      message: `${user.name}（${user.deviceId}）: ${ERROR_INFO[code].label}`,
      userId,
      deviceId: user.deviceId,
      link: `/devices/${user.deviceId}`,
    }, { toast: false }); // 結果は送信完了時のサマリートーストで通知
  }
  return lastError;
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>, token?: CancelToken) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length && !token?.cancelled) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/** LINE 一斉送信 */
async function dispatchLine(event: EmergencyEvent, userIds: string[]) {
  for (let i = 0; i < userIds.length; i += LINE_MULTICAST_LIMIT) {
    const chunk = userIds.slice(i, i + LINE_MULTICAST_LIMIT);
    store().updateRecords(chunk, (r) => ({ ...r, dispatch: { ...r.dispatch, line: { state: 'sending', attempts: r.dispatch.line.attempts + 1, lastAttemptAt: new Date().toISOString() } } }));
    try {
      const res = await lineApi.multicastSafetyCheck(chunk, event.id, event.title);
      store().updateRecords(res.accepted, (r) => ({ ...r, dispatch: { ...r.dispatch, line: { ...r.dispatch.line, state: 'sent' } } }));
      const rejected = res.rejected.map((x) => x.userId);
      store().updateRecords(rejected, (r) => ({ ...r, dispatch: { ...r.dispatch, line: { ...r.dispatch.line, state: 'failed', error: 'INVALID_DATA' } } }));
      store().addLog({ category: 'line', level: rejected.length ? 'warning' : 'success', action: '一斉送信', message: `安否確認メッセージを送信（成功 ${res.accepted.length}名${rejected.length ? ` / 拒否 ${rejected.length}名` : ''}）`, endpoint: '/messages/multicast', method: 'POST', statusCode: 200, payload: { requestId: res.requestId, count: chunk.length } });
    } catch (err) {
      const e = toApiError(err);
      store().updateRecords(chunk, (r) => ({ ...r, dispatch: { ...r.dispatch, line: { ...r.dispatch.line, state: 'failed', error: e.code } } }));
      store().addLog({ category: 'line', level: 'error', action: '一斉送信失敗', message: ERROR_INFO[e.code].message, endpoint: e.endpoint, statusCode: e.status });
      store().addNotification({ severity: 'critical', category: 'api_error', title: 'LINE一斉送信に失敗しました', message: `${chunk.length}名: ${ERROR_INFO[e.code].label}`, link: '/line' });
    }
  }
}

/** 外部端末・LINE へ緊急モードの合図を送信 */
export async function dispatchEmergency(
  event: EmergencyEvent,
  opts: { concurrency?: number; token?: CancelToken } = {},
): Promise<DispatchSummary> {
  const s = store();
  s.setDispatchRun({ running: true, eventId: event.id, startedAt: new Date().toISOString(), finishedAt: undefined });

  const deviceTargets: string[] = [];
  const lineTargets: string[] = [];
  s.updateRecords(event.targetUserIds, (r) => {
    const u = s.usersById[r.userId];
    const dev = event.channels.device && !!u.deviceId;
    const line = event.channels.line && u.line.linked;
    if (dev) deviceTargets.push(r.userId);
    if (line) lineTargets.push(r.userId);
    return {
      ...r,
      dispatch: {
        device: { state: dev ? 'queued' : 'skipped', attempts: 0 },
        line: { state: line ? 'queued' : 'skipped', attempts: 0 },
      },
    };
  });
  s.addLog({ category: 'emergency', level: 'info', action: '送信開始', message: `外部端末 ${deviceTargets.length}台 / LINE ${lineTargets.length}名 へ送信を開始`, payload: { eventId: event.id } });

  await Promise.all([
    lineTargets.length ? dispatchLine(event, lineTargets) : Promise.resolve(),
    runPool(deviceTargets, opts.concurrency ?? 12, async (userId) => {
      await sendToDevice(userId, event.id);
    }, opts.token),
  ]);

  const summary = summarize(event);
  const failed = summary.device.failed + summary.line.failed;
  store().setDispatchRun({ running: false, finishedAt: new Date().toISOString() });
  store().addLog({
    category: 'emergency',
    level: failed ? 'warning' : 'success',
    action: '送信完了',
    message: `${summary.total}名中 ${summary.device.sent}台へ送信済み（端末失敗 ${summary.device.failed}件）/ LINE ${summary.line.sent}名へ送信済み`,
  });
  store().pushToast({
    tone: failed ? 'warning' : 'success',
    title: `${summary.total}名中 ${summary.device.sent}台へ送信済み`,
    message: failed ? `送信失敗 ${failed}件。「安否確認 > 送信失敗」から再送信できます。` : 'すべての端末へ送信しました。',
  });
  return summary;
}

/** 送信失敗した端末へ再送信 */
export async function resendDevice(userId: string) {
  const { event } = store();
  if (!event) return null;
  store().addLog({ category: 'device_api', level: 'info', action: '再送信', message: '管理者が再送信を実行', userId });
  const err = await sendToDevice(userId, event.id);
  store().pushToast(
    err
      ? { tone: 'error', title: '再送信に失敗しました', message: `${ERROR_INFO[err].label}: ${ERROR_INFO[err].hint}` }
      : { tone: 'success', title: '再送信しました', message: '外部端末が緊急モード信号を受信しました。' },
  );
  return err;
}

export async function resendAllFailed() {
  const { event, records } = store();
  if (!event) return;
  const failed = event.targetUserIds.filter((id) => records[id]?.dispatch.device.state === 'failed');
  await runPool(failed, 8, async (id) => {
    await sendToDevice(id, event.id);
  });
  const remain = event.targetUserIds.filter((id) => store().records[id]?.dispatch.device.state === 'failed').length;
  store().pushToast({ tone: remain ? 'warning' : 'success', title: `${failed.length}件を再送信しました`, message: remain ? `${remain}件は引き続き失敗しています。` : undefined });
}
