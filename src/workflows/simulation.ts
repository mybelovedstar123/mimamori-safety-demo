import type { ApiErrorCode, DeviceResponse, SafetyStatus, SimulationStepId } from '@/types';
import { hasConflict, hasDuplicate } from '@/domain/safety';
import { LINE_REPLY_OPTIONS } from '@/domain/validation';
import { buildCorruptDeviceWebhook, buildDeviceWebhook, buildLineWebhook } from '@/services/mock/inbound';
import { initialSimulationSteps, useAppStore } from '@/store/appStore';
import { REGIONS } from '@/data/regions';
import { ERROR_INFO } from '@/utils/errors';
import { sleep } from '@/utils/random';
import { dispatchEmergency, startEmergencyEvent, type CancelToken } from './emergency';
import { syncToPlatform } from './platform';
import { receiveDeviceWebhook, receiveLineWebhook } from './responses';
import { extractUnanswered } from './unanswered';

const store = () => useAppStore.getState();

let token: CancelToken | null = null;

class SimulationCancelled extends Error {}

const wait = async (ms: number) => {
  await sleep(ms / store().simulation.speed);
  if (token?.cancelled) throw new SimulationCancelled();
};

function randomStatus(): SafetyStatus {
  const r = Math.random();
  return r < 0.03 ? 'emergency' : r < 0.14 ? 'needs_support' : 'safe';
}

const STATUS_TO_LINE: Record<SafetyStatus, string> = {
  safe: LINE_REPLY_OPTIONS[0],
  needs_support: LINE_REPLY_OPTIONS[1],
  emergency: LINE_REPLY_OPTIONS[2],
  unconfirmed: LINE_REPLY_OPTIONS[0],
  unreachable: LINE_REPLY_OPTIONS[0],
};
const STATUS_TO_BUTTON: Record<SafetyStatus, DeviceResponse['buttonCode']> = {
  safe: 'BTN_SAFE',
  needs_support: 'BTN_HELP',
  emergency: 'BTN_SOS',
  unconfirmed: 'BTN_SAFE',
  unreachable: 'BTN_SAFE',
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function step(id: SimulationStepId, fn: () => Promise<string>) {
  if (token?.cancelled) throw new SimulationCancelled();
  store().setSimulationStep(id, { state: 'running', detail: undefined });
  try {
    const detail = await fn();
    store().setSimulationStep(id, { state: 'done', detail });
  } catch (err) {
    store().setSimulationStep(id, { state: 'error', detail: err instanceof SimulationCancelled ? '中断しました' : String(err) });
    throw err;
  }
}

/** 受信処理は到着順に同期で判定されるため、永続化の完了は待たずに次の回答を流す */
const settle = (promises: Promise<unknown>[]) => Promise.allSettled(promises);

/**
 * 災害発生シミュレーション
 * 緊急モード開始 → 送信 → 成功/失敗 → LINE回答 → 端末回答 → 重複検知 → 先着採用 → 未回答抽出 → 外部PF送信
 */
export async function runDisasterSimulation() {
  if (store().simulation.running) return;
  token = { cancelled: false };
  store().setSimulation({ visible: true, running: true, steps: initialSimulationSteps(), highlight: undefined, startedAt: new Date().toISOString(), finishedAt: undefined });
  store().addLog({ category: 'system', level: 'info', action: 'シミュレーション開始', message: '災害発生シミュレーションを開始しました（モック環境）' });

  try {
    let eventId = '';
    await step('start', async () => {
      const users = store().users;
      const ev = startEmergencyEvent({
        title: '震度6弱の地震発生（訓練シミュレーション）',
        type: 'earthquake',
        regionIds: REGIONS.map((r) => r.id),
        userIds: users.map((u) => u.id),
        channels: { device: true, line: true },
      });
      eventId = ev.id;
      await wait(900);
      return `${ev.id}／対象 ${users.length}名・全${REGIONS.length}地区`;
    });

    let summary = { total: 0, device: { target: 0, sent: 0, failed: 0, sending: 0 }, line: { target: 0, sent: 0, failed: 0, sending: 0 } };
    await step('dispatch', async () => {
      const ev = store().event!;
      summary = await dispatchEmergency(ev, { concurrency: 16, token: token! });
      if (token?.cancelled) throw new SimulationCancelled();
      return `外部端末 ${summary.device.target}台／LINE ${summary.line.target}名へ送信`;
    });

    await step('dispatch_success', async () => {
      await wait(600);
      return `${summary.total}名中 ${summary.device.sent}台へ送信済み（LINE ${summary.line.sent}名）`;
    });

    await step('dispatch_failed', async () => {
      await wait(600);
      const { records, event } = store();
      const counts = new Map<ApiErrorCode, number>();
      event!.targetUserIds.forEach((id) => {
        const err = records[id].dispatch.device.state === 'failed' ? records[id].dispatch.device.error : undefined;
        if (err) counts.set(err, (counts.get(err) ?? 0) + 1);
      });
      const parts = [...counts.entries()].map(([c, n]) => `${ERROR_INFO[c].label} ${n}`).join('／');
      return `${summary.device.failed}件 送信失敗${parts ? `（${parts}）` : ''}`;
    });

    const lineAnswered = new Map<string, SafetyStatus>();
    await step('line_responses', async () => {
      const { records, event } = store();
      const candidates = shuffle(event!.targetUserIds.filter((id) => records[id].dispatch.line.state === 'sent'));
      const responders = candidates.slice(0, Math.round(candidates.length * 0.55));
      const pending: Promise<unknown>[] = [];
      for (const [i, userId] of responders.entries()) {
        const status = randomStatus();
        lineAnswered.set(userId, status);
        pending.push(receiveLineWebhook(buildLineWebhook(userId, STATUS_TO_LINE[status])).catch(() => null));
        if (i === Math.floor(responders.length / 2)) {
          // 判定できない文言（不正データ）
          pending.push(receiveLineWebhook(buildLineWebhook(responders[0], 'スタンプ送信')).catch(() => null));
        }
        await wait(45);
      }
      await settle(pending);
      return `${responders.length}件受信（判定不能メッセージ 1件を破棄）`;
    });

    await step('device_responses', async () => {
      const { records, event, usersById } = store();
      const sentIds = event!.targetUserIds.filter((id) => records[id].dispatch.device.state === 'sent');
      const responders = shuffle(
        sentIds.filter((id) => (lineAnswered.has(id) ? Math.random() < 0.4 : Math.random() < 0.72)),
      );
      const pending: Promise<unknown>[] = [];
      for (const [i, userId] of responders.entries()) {
        const lineStatus = lineAnswered.get(userId);
        const status = lineStatus ? (Math.random() < 0.12 ? (lineStatus === 'safe' ? 'needs_support' : 'safe') : lineStatus) : randomStatus();
        const deviceId = usersById[userId].deviceId!;
        pending.push(receiveDeviceWebhook(buildDeviceWebhook(deviceId, STATUS_TO_BUTTON[status])).catch(() => null));
        if (i === 10) pending.push(receiveDeviceWebhook(buildCorruptDeviceWebhook(deviceId)).catch(() => null));
        await wait(40);
      }
      // 端末で先に回答した方が、後から LINE でも回答するケース
      const lateLine = responders.filter((id) => !lineAnswered.has(id) && usersById[id].line.linked).slice(0, 6);
      for (const userId of lateLine) {
        pending.push(receiveLineWebhook(buildLineWebhook(userId, LINE_REPLY_OPTIONS[0])).catch(() => null));
        await wait(120);
      }
      await settle(pending);
      return `${responders.length}件受信（うちLINE回答済み ${responders.filter((id) => lineAnswered.has(id)).length}名／不正データ 1件を破棄）`;
    });

    await step('duplicate', async () => {
      await wait(900);
      const { records, event } = store();
      const dup = event!.targetUserIds.filter((id) => hasDuplicate(records[id])).length;
      const conflict = event!.targetUserIds.filter((id) => hasConflict(records[id])).length;
      return `重複回答 ${dup}名を検知（回答内容の不一致 ${conflict}名は要確認）`;
    });

    await step('adopt', async () => {
      await wait(900);
      const { records, event } = store();
      const dups = event!.targetUserIds.filter((id) => hasDuplicate(records[id]));
      const byLine = dups.filter((id) => records[id].response?.source === 'line').length;
      const extra = dups.reduce((n, id) => n + (records[id].response?.additionalResponses.length ?? 0), 0);
      store().addLog({ category: 'duplicate', level: 'info', action: '先着回答を採用', message: `重複 ${dups.length}名: LINE先着 ${byLine}名／端末先着 ${dups.length - byLine}名を正式回答に採用。後着 ${extra}件は追記として保持（削除なし）` });
      return `正式回答: LINE先着 ${byLine}名／端末先着 ${dups.length - byLine}名・追記 ${extra}件を保持`;
    });

    await step('unanswered', async () => {
      await wait(700);
      const ids = extractUnanswered();
      return `未回答 ${ids.length}名を抽出し、通知を作成`;
    });

    await step('platform', async () => {
      const res = await syncToPlatform('simulation');
      if (!res) return '送信対象なし';
      return `${res.total}件中 ${res.success}件 送信成功${res.failed ? `／${res.failed}件 失敗` : ''}`;
    });

    store().addLog({ category: 'system', level: 'success', action: 'シミュレーション完了', message: `${eventId}: 一連の業務フローを完了しました` });
    store().pushToast({ tone: 'success', title: 'シミュレーションが完了しました', message: 'ダッシュボード・ログで結果を確認できます。' });
  } catch (err) {
    if (err instanceof SimulationCancelled) {
      store().addLog({ category: 'system', level: 'warning', action: 'シミュレーション中断', message: '管理者がシミュレーションを中断しました' });
    } else {
      store().addLog({ category: 'system', level: 'error', action: 'シミュレーション異常終了', message: String(err) });
      store().pushToast({ tone: 'error', title: 'シミュレーションでエラーが発生しました', message: String(err) });
    }
  } finally {
    store().setSimulation({ running: false, finishedAt: new Date().toISOString() });
    token = null;
  }
}

export function cancelSimulation() {
  if (token) token.cancelled = true;
}
