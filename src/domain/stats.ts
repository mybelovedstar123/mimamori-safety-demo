import type {
  Device,
  EmergencyEvent,
  Region,
  ResponseSource,
  SafetyRecord,
  SafetyStatus,
  User,
} from '@/types';
import { getEffectiveStatus, hasConflict, hasDuplicate, needsAttention } from './safety';

export interface EventStats {
  totalUsers: number;
  targets: number;
  answered: number;
  unanswered: number;
  attention: number;
  byStatus: Record<SafetyStatus, number>;
  bySource: Record<ResponseSource, number>;
  duplicates: number;
  conflicts: number;
  dispatchFailed: number;
  dispatchSending: number;
  deviceSent: number;
  deviceTarget: number;
  lineSent: number;
  lineTarget: number;
  devicesOnline: number;
  devicesWarning: number;
  devicesOffline: number;
  devicesTotal: number;
  responseRate: number;
}

export const emptyStatusCount = (): Record<SafetyStatus, number> => ({
  unconfirmed: 0,
  safe: 0,
  needs_support: 0,
  emergency: 0,
  unreachable: 0,
});

export function computeEventStats(
  users: User[],
  records: Record<string, SafetyRecord>,
  devices: Record<string, Device>,
  event: EmergencyEvent | null,
): EventStats {
  const targetIds = event ? event.targetUserIds : [];
  const byStatus = emptyStatusCount();
  const bySource: Record<ResponseSource, number> = { line: 0, device: 0, phone: 0, admin: 0 };
  let duplicates = 0;
  let conflicts = 0;
  let dispatchFailed = 0;
  let dispatchSending = 0;
  let attention = 0;
  let deviceSent = 0;
  let deviceTarget = 0;
  let lineSent = 0;
  let lineTarget = 0;
  let answered = 0;

  for (const id of targetIds) {
    const r = records[id];
    if (!r) continue;
    byStatus[getEffectiveStatus(r)] += 1;
    if (r.response) {
      bySource[r.response.source] += 1;
      answered += 1;
    } else if (r.manualStatus && r.manualStatus.status !== 'unconfirmed' && r.manualStatus.status !== 'unreachable') {
      answered += 1;
    }
    if (hasDuplicate(r)) duplicates += 1;
    if (hasConflict(r)) conflicts += 1;
    if (needsAttention(r)) attention += 1;
    const { device, line } = r.dispatch;
    if (device.state === 'failed' || line.state === 'failed') dispatchFailed += 1;
    if (['queued', 'sending'].includes(device.state) || ['queued', 'sending'].includes(line.state)) dispatchSending += 1;
    if (device.state !== 'skipped' && device.state !== 'idle') deviceTarget += 1;
    if (device.state === 'sent') deviceSent += 1;
    if (line.state !== 'skipped' && line.state !== 'idle') lineTarget += 1;
    if (line.state === 'sent') lineSent += 1;
  }

  const deviceList = Object.values(devices);
  const targets = targetIds.length;
  return {
    totalUsers: users.length,
    targets,
    answered,
    unanswered: byStatus.unconfirmed,
    attention,
    byStatus,
    bySource,
    duplicates,
    conflicts,
    dispatchFailed,
    dispatchSending,
    deviceSent,
    deviceTarget,
    lineSent,
    lineTarget,
    devicesOnline: deviceList.filter((d) => d.connection === 'online').length,
    devicesWarning: deviceList.filter((d) => d.connection === 'warning').length,
    devicesOffline: deviceList.filter((d) => d.connection === 'offline').length,
    devicesTotal: deviceList.length,
    responseRate: targets ? answered / targets : 0,
  };
}

export interface TimeBucket {
  label: string;
  line: number;
  device: number;
  phone: number;
  admin: number;
}

/** 発信からの回答数を時間帯ごとに集計（最大12区間） */
export function bucketResponses(
  records: Record<string, SafetyRecord>,
  event: EmergencyEvent | null,
  now: number,
): TimeBucket[] {
  if (!event) return [];
  const start = new Date(event.startedAt).getTime();
  const spanSec = Math.max(10, Math.ceil((now - start) / 1000));
  // 区間幅（秒）。直後のシミュレーションでも推移が見えるよう秒単位まで細かくする
  const steps = [10, 30, 60, 120, 300, 600, 900, 1800, 3600];
  const size = steps.find((s) => spanSec / s <= 12) ?? 3600;
  const count = Math.max(1, Math.ceil(spanSec / size));
  const pad = (n: number) => String(n).padStart(2, '0');
  const buckets: TimeBucket[] = Array.from({ length: count }, (_, i) => {
    const t = new Date(start + i * size * 1000);
    return {
      label: `${pad(t.getHours())}:${pad(t.getMinutes())}${size < 60 ? `:${pad(t.getSeconds())}` : ''}`,
      line: 0,
      device: 0,
      phone: 0,
      admin: 0,
    };
  });
  for (const id of event.targetUserIds) {
    const resp = records[id]?.response;
    if (!resp) continue;
    const idx = Math.floor((new Date(resp.receivedAt).getTime() - start) / (size * 1000));
    buckets[Math.min(Math.max(idx, 0), count - 1)][resp.source] += 1;
  }
  return buckets;
}

export interface RegionSummary {
  region: Region;
  total: number;
  byStatus: Record<SafetyStatus, number>;
  attention: number;
}

export function summarizeRegions(
  regions: Region[],
  users: User[],
  records: Record<string, SafetyRecord>,
  event: EmergencyEvent | null,
): RegionSummary[] {
  const targetSet = new Set(event?.targetUserIds ?? []);
  return regions.map((region) => {
    const byStatus = emptyStatusCount();
    let total = 0;
    let attention = 0;
    for (const u of users) {
      if (u.regionId !== region.id || !targetSet.has(u.id)) continue;
      total += 1;
      byStatus[getEffectiveStatus(records[u.id])] += 1;
      if (needsAttention(records[u.id])) attention += 1;
    }
    return { region, total, byStatus, attention };
  });
}
