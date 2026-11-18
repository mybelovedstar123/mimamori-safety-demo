import type {
  ApiEndpointStats,
  ApiErrorCode,
  ApiLog,
  ApiServiceId,
  AppNotification,
  ArchivedEvent,
  Device,
  DeviceEvent,
  EmergencyEvent,
  PlatformSync,
  ResponseSource,
  SafetyRecord,
  SafetyStatus,
  User,
} from '@/types';
import { createEmptyRecord } from '@/domain/safety';
import { createRng, type Rng } from '@/utils/random';
import { randomPointIn } from '@/utils/geometry';
import { ERROR_INFO } from '@/utils/errors';
import { SOURCE_LABEL, STATUS_LABEL } from '@/utils/labels';
import { CITY_NAME, REGIONS, regionName } from './regions';
import {
  CONTACT_GIVEN,
  CONTACT_RELATIONS,
  FAMILY_NAMES,
  FEMALE_NAMES,
  MALE_NAMES,
  NOTES,
  TOWN_BY_REGION,
} from './names';

export const USER_COUNT = 248;
export const ADMIN_NAME = '防災課 管理者';

const REGION_WEIGHTS = [0.11, 0.12, 0.11, 0.12, 0.14, 0.15, 0.11, 0.14];

export interface SeedState {
  users: User[];
  devices: Record<string, Device>;
  event: EmergencyEvent;
  records: Record<string, SafetyRecord>;
  notifications: AppNotification[];
  logs: ApiLog[];
  platformSyncs: PlatformSync[];
  apiStats: Record<ApiServiceId, ApiEndpointStats>;
  lastSyncAt: string;
  eventArchive: ArchivedEvent[];
}

const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000;

function pickRegion(rng: Rng): string {
  let r = rng.next();
  for (let i = 0; i < REGIONS.length; i++) {
    r -= REGION_WEIGHTS[i];
    if (r <= 0) return REGIONS[i].id;
  }
  return REGIONS[REGIONS.length - 1].id;
}

function buildUsers(rng: Rng, now: number): User[] {
  const users: User[] = [];
  let deviceSeq = 0;
  for (let i = 0; i < USER_COUNT; i++) {
    const id = `USER-${1001 + i}`;
    const gender = rng.chance(0.58) ? 'female' : 'male';
    let [family, familyKana] = rng.pick(FAMILY_NAMES);
    let [given, givenKana] = rng.pick(gender === 'female' ? FEMALE_NAMES : MALE_NAMES);
    // 要件記載の例に合わせた固定データ
    if (i === 0) [family, familyKana, given, givenKana] = ['山田', 'やまだ', '太郎', 'たろう'];
    if (i === 1) [family, familyKana, given, givenKana] = ['佐藤', 'さとう', '花子', 'はなこ'];
    const fixedGender = i === 0 ? 'male' : i === 1 ? 'female' : gender;
    const regionId = pickRegion(rng);
    const region = REGIONS.find((r) => r.id === regionId)!;
    const noChannel = i % 83 === 50; // 通知手段なし（電話のみ）の少数ケース
    const hasDevice = !noChannel && (i < 2 || i === 23 || rng.chance(0.94));
    const lineLinked = !noChannel && (i === 23 || rng.chance(0.62));
    users.push({
      id,
      name: `${family} ${given}`,
      kana: `${familyKana} ${givenKana}`,
      age: rng.int(68, 97),
      gender: fixedGender,
      regionId,
      address: `${CITY_NAME}${TOWN_BY_REGION[regionId]}${rng.int(1, 5)}丁目${rng.int(1, 28)}-${rng.int(1, 15)}`,
      emergencyContact: {
        name: `${family} ${rng.pick(CONTACT_GIVEN)}`,
        relation: rng.pick(CONTACT_RELATIONS),
        phone: `090-0${rng.int(100, 999)}-${String(rng.int(0, 9999)).padStart(4, '0')}`,
      },
      deviceId: hasDevice ? `DEV-${String(++deviceSeq).padStart(4, '0')}` : null,
      line: lineLinked
        ? { linked: true, displayName: `${given}（${region.name}）`, linkedAt: iso(now - rng.int(20, 400) * 24 * 60 * MIN) }
        : { linked: false },
      livesAlone: rng.chance(0.55),
      careLevel: rng.pick(['自立', '自立', '自立', '要支援1', '要支援2', '要介護1', '要介護2', '要介護3'] as const),
      lastWatchAt: iso(now - rng.int(2, 170) * MIN),
      notes: rng.pick(NOTES),
      position: randomPointIn(region.polygon, rng),
    });
  }
  return users;
}

function buildDevices(rng: Rng, users: User[], now: number): Record<string, Device> {
  const devices: Record<string, Device> = {};
  const owners = users.filter((u) => u.deviceId);
  // 意図的な障害端末（index は端末の並び順）
  const offline = new Set([4, 17, 38, 61, 88, 112, 140, 171, 203]);
  const warning = new Set([9, 27, 73, 99, 150, 188, 215]);
  const authError = new Set([52, 164]);
  const timeoutDev = new Set([27, 99, 215]);

  owners.forEach((u, idx) => {
    const id = u.deviceId!;
    const isOffline = offline.has(idx);
    const isWarning = warning.has(idx);
    const lastComm = isOffline ? now - rng.int(180, 1800) * MIN : now - rng.int(0, 9) * MIN - rng.int(0, 59) * 1000;
    const history: DeviceEvent[] = [];
    for (let h = 5; h >= 1; h--) {
      const at = lastComm - h * 30 * MIN;
      history.push({ id: `${id}-hb-${h}`, at: iso(at), kind: 'heartbeat', ok: true, message: '定期通信（生活反応あり）' });
    }
    if (isOffline) {
      history.push({ id: `${id}-err-0`, at: iso(lastComm + 10 * MIN), kind: 'error', ok: false, message: '定期通信が途絶えました（応答なし）' });
    }
    devices[id] = {
      id,
      userId: u.id,
      model: idx % 3 === 0 ? 'MB-310 Lite' : 'MB-300',
      firmware: idx % 5 === 0 ? '2.3.1' : '2.4.0',
      connection: isOffline ? 'offline' : isWarning ? 'warning' : 'online',
      apiStatus: isOffline ? 'disconnected' : authError.has(idx) ? 'auth_error' : timeoutDev.has(idx) ? 'timeout' : 'connected',
      lastCommunicationAt: iso(lastComm),
      battery: isWarning ? rng.int(6, 18) : rng.int(42, 100),
      signal: isWarning ? 1 : rng.int(2, 5),
      mode: 'normal',
      history,
    };
    if (isOffline) u.lastWatchAt = iso(lastComm);
  });
  return devices;
}

interface PlannedResponse {
  userId: string;
  status: SafetyStatus;
  source: ResponseSource;
  at: number;
  extra?: { source: ResponseSource; status: SafetyStatus; at: number };
}

export function createSeedState(now: number = Date.now(), seed = 20261115): SeedState {
  const rng = createRng(seed);
  const users = buildUsers(rng, now);
  const devices = buildDevices(rng, users, now);
  const start = now - 42 * MIN;
  const d = new Date(start);
  const eventId = `EVT-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-01`;

  const event: EmergencyEvent = {
    id: eventId,
    title: '大雨・洪水警報に伴う安否確認',
    type: 'flood',
    status: 'active',
    startedAt: iso(start),
    startedBy: ADMIN_NAME,
    regionIds: REGIONS.map((r) => r.id),
    targetUserIds: users.map((u) => u.id),
    channels: { device: true, line: true },
    environment: 'test',
  };

  const logs: ApiLog[] = [];
  const notifications: AppNotification[] = [];
  const records: Record<string, SafetyRecord> = {};
  let logSeq = 0;
  let ntfSeq = 0;
  const log = (l: Omit<ApiLog, 'id'>) => logs.push({ id: `LOG-S${++logSeq}`, ...l });
  const notify = (n: Omit<AppNotification, 'id'>) => notifications.push({ id: `NTF-S${++ntfSeq}`, ...n });

  log({ at: iso(start), category: 'emergency', level: 'warning', action: '緊急モード開始', message: `${event.title}（浸水想定区域から段階的に送信）`, payload: { eventId } });

  // 段階送信: 浸水想定区域 → 土砂災害警戒区域（+12分）→ その他（+20分、警報範囲拡大）
  const waveOffset = (regionId: string) => {
    const hazard = REGIONS.find((r) => r.id === regionId)!.hazard;
    return hazard === 'flood' ? 0 : hazard === 'landslide' ? 12 * MIN : 20 * MIN;
  };
  log({ at: iso(start + 12 * MIN), category: 'emergency', level: 'warning', action: '対象地域拡大', message: '土砂災害警戒情報の発表に伴い、山手地区を対象に追加' });
  log({ at: iso(start + 20 * MIN), category: 'emergency', level: 'warning', action: '対象地域拡大', message: '警報範囲の拡大に伴い、全地区を対象に追加' });

  // ---- 送信フェーズ
  const planned: PlannedResponse[] = [];
  users.forEach((u, i) => {
    const rec = createEmptyRecord(u.id, eventId);
    const wave = start + waveOffset(u.regionId);
    const sentAt = wave + 20_000 + i * 180;
    const remainMin = (now - sentAt) / MIN;
    if (u.deviceId) {
      const dev = devices[u.deviceId];
      let error: ApiErrorCode | undefined;
      if (dev.connection === 'offline') error = 'DEVICE_OFFLINE';
      else if (dev.apiStatus === 'auth_error') error = 'AUTH';
      else if (dev.apiStatus === 'timeout') error = 'TIMEOUT';
      rec.dispatch.device = error
        ? { state: 'failed', attempts: error === 'TIMEOUT' ? 3 : 1, lastAttemptAt: iso(sentAt), error }
        : { state: 'sent', attempts: 1, lastAttemptAt: iso(sentAt) };
      log({
        at: iso(sentAt),
        category: 'device_api',
        level: error ? 'error' : 'success',
        action: error ? '送信失敗' : '送信成功',
        message: error ? `緊急モード信号の送信に失敗（${ERROR_INFO[error].label}）` : '緊急モード信号を送信',
        userId: u.id,
        deviceId: u.deviceId,
        endpoint: `/devices/${u.deviceId}/emergency`,
        method: 'POST',
        statusCode: error ? ERROR_INFO[error].status : 202,
        durationMs: error === 'TIMEOUT' ? 10000 : rng.int(120, 640),
      });
      if (error) {
        dev.history.push({ id: `${dev.id}-sig`, at: iso(sentAt), kind: 'error', ok: false, message: `緊急モード信号 送信失敗: ${ERROR_INFO[error].label}` });
        notify({
          at: iso(sentAt),
          severity: error === 'AUTH' ? 'critical' : 'warning',
          category: error === 'AUTH' ? 'api_error' : 'dispatch_failed',
          title: '外部端末への送信に失敗しました',
          message: `${u.name}（${u.deviceId}）: ${ERROR_INFO[error].label}`,
          userId: u.id,
          deviceId: u.deviceId,
          read: rng.chance(0.4),
          link: `/devices/${u.deviceId}`,
        });
      } else {
        dev.mode = 'emergency';
        dev.history.push({ id: `${dev.id}-sig`, at: iso(sentAt), kind: 'emergency_signal', ok: true, message: '緊急モード信号を受信（安否確認ボタン点灯）' });
      }
    } else {
      rec.dispatch.device = { state: 'skipped', attempts: 0 };
    }
    rec.dispatch.line = u.line.linked
      ? { state: 'sent', attempts: 1, lastAttemptAt: iso(wave + 15_000) }
      : { state: 'skipped', attempts: 0 };
    records[u.id] = rec;

    // ---- 回答計画
    if (i < 2) return; // 山田 太郎 / 佐藤 花子 は未回答
    const devOk = rec.dispatch.device.state === 'sent';
    const lineOk = rec.dispatch.line.state === 'sent';
    const at = sentAt + (1 + Math.pow(rng.next(), 1.8) * (remainMin - 3)) * MIN;
    if (i === 23) {
      planned.push({ userId: u.id, status: 'safe', source: 'line', at: sentAt + 8 * MIN, extra: { source: 'device', status: 'safe', at: sentAt + 8 * MIN + 98_000 } });
      return;
    }
    if (!devOk && !lineOk) {
      if (rng.chance(0.4)) planned.push({ userId: u.id, status: rng.chance(0.7) ? 'safe' : 'needs_support', source: 'phone', at: sentAt + rng.int(5, Math.max(6, Math.floor(remainMin) - 2)) * MIN });
      return;
    }
    const r = rng.next();
    if (r < 0.1) return; // 未回答
    const status: SafetyStatus = r < 0.16 ? 'needs_support' : r < 0.175 ? 'emergency' : 'safe';
    let source: ResponseSource = devOk && lineOk ? (rng.chance(0.5) ? 'line' : 'device') : devOk ? 'device' : 'line';
    if (rng.chance(0.03)) source = 'phone';
    const p: PlannedResponse = { userId: u.id, status, source, at };
    if (devOk && lineOk && source !== 'phone' && rng.chance(0.3)) {
      const conflict = rng.chance(0.15);
      p.extra = {
        source: source === 'line' ? 'device' : 'line',
        status: conflict ? (status === 'safe' ? 'needs_support' : 'safe') : status,
        at: at + rng.int(20, 300) * 1000,
      };
    }
    planned.push(p);
  });

  for (const offset of [0, 12 * MIN, 20 * MIN]) {
    const n = users.filter((u) => u.line.linked && waveOffset(u.regionId) === offset).length;
    log({ at: iso(start + offset + 15_000), category: 'line', level: 'success', action: '一斉送信', message: `安否確認メッセージを送信（${n}名）`, endpoint: '/messages/multicast', method: 'POST', statusCode: 200, durationMs: 380 + n });
  }

  // ---- 回答反映
  let respSeq = 0;
  for (const p of planned) {
    const u = users.find((x) => x.id === p.userId)!;
    const primaryAt = Math.min(p.at, now - MIN);
    const responseId = `RSP-S${++respSeq}`;
    records[u.id].response = {
      responseId,
      userId: u.id,
      status: p.status,
      source: p.source,
      receivedAt: iso(primaryAt),
      isPrimary: true,
      additionalResponses: [],
    };
    log({
      at: iso(primaryAt),
      category: p.source === 'line' ? 'line' : p.source === 'device' ? 'device_api' : 'safety',
      level: p.status === 'emergency' ? 'error' : p.status === 'needs_support' ? 'warning' : 'info',
      action: '安否回答受信',
      message: `「${statusText(p.status)}」（${sourceText(p.source)}）`,
      userId: u.id,
      deviceId: p.source === 'device' ? u.deviceId ?? undefined : undefined,
    });
    if (p.source === 'device' && u.deviceId) {
      devices[u.deviceId].history.push({ id: `${u.deviceId}-rsp`, at: iso(primaryAt), kind: 'response', ok: true, message: `安否回答: ${statusText(p.status)}` });
    }
    if (p.extra) {
      const extraAt = Math.min(p.extra.at, now - 20_000);
      const conflicts = p.extra.status !== p.status;
      records[u.id].response!.additionalResponses.push({
        responseId: `RSP-S${++respSeq}`,
        status: p.extra.status,
        source: p.extra.source,
        receivedAt: iso(Math.max(extraAt, primaryAt + 5000)),
        conflicts,
      });
      log({ at: iso(Math.max(extraAt, primaryAt + 5000)), category: p.extra.source === 'line' ? 'line' : 'device_api', level: 'info', action: '安否回答受信', message: `「${statusText(p.extra.status)}」（${sourceText(p.extra.source)}）`, userId: u.id });
      log({
        at: iso(Math.max(extraAt, primaryAt + 5000) + 400),
        category: 'duplicate',
        level: conflicts ? 'warning' : 'info',
        action: '先着回答を採用',
        message: `${sourceText(p.source)}回答を正式回答として登録、${sourceText(p.extra.source)}回答は追記として保存${conflicts ? '（回答内容が不一致）' : ''}`,
        userId: u.id,
      });
      if (conflicts) {
        notify({ at: iso(extraAt), severity: 'warning', category: 'duplicate', title: '重複回答の内容が一致しません', message: `${u.name}: 採用「${statusText(p.status)}」/ 追記「${statusText(p.extra.status)}」`, userId: u.id, read: false, link: `/users/${u.id}` });
      }
    }
    if (p.status === 'emergency') {
      notify({ at: iso(primaryAt), severity: 'critical', category: 'emergency_response', title: '緊急回答を受信しました', message: `${u.name}（${regionName(u.regionId)}）から「緊急」の回答`, userId: u.id, read: false, link: `/users/${u.id}` });
    }
  }

  // 全送信失敗で電話も通じない一部の方を管理者が「連絡不能」に確定
  users
    .filter((u) => !records[u.id].response && records[u.id].dispatch.device.state === 'failed' && !u.line.linked)
    .slice(0, 3)
    .forEach((u) => {
      records[u.id].manualStatus = { status: 'unreachable', by: ADMIN_NAME, at: iso(start + 34 * MIN), reason: '電話2回不通。地区の民生委員へ訪問依頼済み。' };
    });

  // ---- 端末Offline・未回答の通知
  Object.values(devices)
    .filter((dv) => dv.connection === 'offline')
    .forEach((dv) => {
      notify({ at: dv.history[dv.history.length - 1].at, severity: 'warning', category: 'device_offline', title: '見守り端末がOfflineです', message: `${dv.id} の定期通信が途絶えています`, deviceId: dv.id, userId: dv.userId, read: true, link: `/devices/${dv.id}` });
    });
  const unanswered = users.filter((u) => !records[u.id].response && !records[u.id].manualStatus).length;
  notify({ at: iso(start + 30 * MIN), severity: 'warning', category: 'unanswered', title: '未回答者がいます（30分経過）', message: `発信から30分経過時点で ${unanswered}名 が未回答です`, read: false, link: '/safety?tab=unanswered' });

  // ---- 外部プラットフォーム同期履歴
  const sync1At = start + 15 * MIN;
  const sync2At = start + 30 * MIN;
  const answeredBy = (t: number) => planned.filter((p) => Math.min(p.at, now - MIN) <= t);
  const s1 = answeredBy(sync1At).length;
  const s2 = answeredBy(sync2At).length;
  const failedIds = new Set(answeredBy(sync2At).slice(-3).map((p) => p.userId));
  answeredBy(sync2At).forEach((p) => {
    if (!failedIds.has(p.userId)) records[p.userId].platformSynced = true;
  });
  const platformSyncs: PlatformSync[] = [
    { id: 'SYNC-0002', startedAt: iso(sync2At), finishedAt: iso(sync2At + 4200), eventId, environment: 'test', total: s2, success: s2 - 3, failed: 3, pending: 0, status: 'partial', error: 'TIMEOUT', trigger: 'auto' },
    { id: 'SYNC-0001', startedAt: iso(sync1At), finishedAt: iso(sync1At + 3100), eventId, environment: 'test', total: s1, success: s1, failed: 0, pending: 0, status: 'success', trigger: 'auto' },
  ];
  log({ at: iso(sync1At), category: 'platform', level: 'success', action: '送信成功', message: `安否情報 ${s1}件 を外部プラットフォームへ送信`, endpoint: '/safety-records/bulk', method: 'POST', statusCode: 200, durationMs: 3100 });
  log({ at: iso(sync2At), category: 'platform', level: 'warning', action: '一部送信失敗', message: `${s2}件中 3件 が API Timeout`, endpoint: '/safety-records/bulk', method: 'POST', statusCode: 504, durationMs: 4200 });
  notify({ at: iso(sync2At + 4200), severity: 'warning', category: 'platform_failed', title: '外部プラットフォーム送信失敗', message: '3件の安否情報が送信できませんでした（API Timeout）', read: false, link: '/platform' });

  log({ at: iso(start - 6 * 60 * MIN), category: 'system', level: 'info', action: 'システム起動', message: 'モックAPIに接続しました（テスト環境）' });

  logs.sort((a, b) => b.at.localeCompare(a.at));
  notifications.sort((a, b) => b.at.localeCompare(a.at));

  return {
    users,
    devices,
    event,
    records,
    notifications,
    logs,
    platformSyncs,
    apiStats: buildApiStats(rng, now),
    lastSyncAt: iso(sync2At + 4200),
    eventArchive: buildArchive(rng, users, now),
  };
}

/** 過去に実施した安否確認（訓練含む）の結果 */
function buildArchive(rng: Rng, users: User[], now: number): ArchivedEvent[] {
  const past: { title: string; type: EmergencyEvent['type']; daysAgo: number }[] = [
    { title: '台風接近に伴う安否確認', type: 'typhoon', daysAgo: 52 },
    { title: '総合防災訓練（安否確認訓練）', type: 'other', daysAgo: 75 },
  ];
  return past.map((p, idx) => {
    const startedAt = now - p.daysAgo * 24 * 60 * MIN;
    const results: ArchivedEvent['results'] = {};
    for (const u of users) {
      const r = rng.next();
      const status: SafetyStatus = r < 0.05 ? 'unreachable' : r < 0.1 ? 'needs_support' : 'safe';
      const source: ResponseSource | null =
        status === 'unreachable' ? null : u.line.linked && rng.chance(0.5) ? 'line' : u.deviceId ? 'device' : 'phone';
      results[u.id] = { status, source, at: source ? iso(startedAt + rng.int(2, 55) * MIN) : null };
    }
    return {
      event: {
        id: `EVT-PAST-0${idx + 1}`,
        title: p.title,
        type: p.type,
        status: 'closed',
        startedAt: iso(startedAt),
        closedAt: iso(startedAt + 180 * MIN),
        startedBy: ADMIN_NAME,
        regionIds: REGIONS.map((r) => r.id),
        targetUserIds: users.map((u) => u.id),
        channels: { device: true, line: true },
        environment: 'test',
      },
      results,
    };
  });
}

function buildApiStats(rng: Rng, now: number): Record<ApiServiceId, ApiEndpointStats> {
  const hist = (base: number, spread: number) => Array.from({ length: 24 }, () => base + rng.int(-spread, spread));
  return {
    device: { id: 'device', name: '外部見守り端末 API', provider: '見守り端末メーカー（架空）', authStatus: 'valid', lastCommunicationAt: iso(now - 40_000), requests: 1284, success: 1241, failed: 43, avgResponseMs: 318, latencyHistory: hist(320, 90) },
    line: { id: 'line', name: 'LINE Messaging API', provider: 'LINE 連携ゲートウェイ', authStatus: 'valid', lastCommunicationAt: iso(now - 95_000), requests: 612, success: 609, failed: 3, avgResponseMs: 214, latencyHistory: hist(210, 50) },
    platform: { id: 'platform', name: '外部防災プラットフォーム API', provider: '連携先プラットフォーム（架空）', authStatus: 'valid', lastCommunicationAt: iso(now - 12 * MIN), requests: 86, success: 80, failed: 6, avgResponseMs: 842, latencyHistory: hist(820, 220) },
    gas: { id: 'gas', name: 'Google Apps Script（データ保存）', provider: 'Google Spreadsheet 連携', authStatus: 'valid', lastCommunicationAt: iso(now - 60_000), requests: 954, success: 951, failed: 3, avgResponseMs: 655, latencyHistory: hist(650, 150) },
  };
}

const statusText = (s: SafetyStatus) => STATUS_LABEL[s];
const sourceText = (s: ResponseSource) => SOURCE_LABEL[s];
