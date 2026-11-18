import { useMemo } from 'react';
import type { Device, SafetyRecord, SafetyStatus, User } from '@/types';
import { STATUS_PRIORITY, getEffectiveStatus, hasConflict, hasDuplicate } from '@/domain/safety';
import { useAppStore } from '@/store/appStore';

export interface SafetyRow {
  user: User;
  record: SafetyRecord | undefined;
  device: Device | undefined;
  status: SafetyStatus;
  duplicate: boolean;
  conflict: boolean;
}

/** 対象者・安否記録・端末を結合した一覧行（状態の深刻度順） */
export function useSafetyRows(): SafetyRow[] {
  const users = useAppStore((s) => s.users);
  const records = useAppStore((s) => s.records);
  const devices = useAppStore((s) => s.devices);
  const event = useAppStore((s) => s.event);

  return useMemo(() => {
    const targets = new Set(event?.targetUserIds ?? []);
    return users
      .filter((u) => targets.has(u.id))
      .map((user) => {
        const record = records[user.id];
        return {
          user,
          record,
          device: user.deviceId ? devices[user.deviceId] : undefined,
          status: getEffectiveStatus(record),
          duplicate: hasDuplicate(record),
          conflict: hasConflict(record),
        };
      })
      .sort((a, b) => STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status] || Number(b.conflict) - Number(a.conflict));
  }, [users, records, devices, event]);
}
