import { useMemo } from 'react';
import { computeEventStats } from '@/domain/stats';
import { useAppStore } from '@/store/appStore';

export function useEventStats() {
  const users = useAppStore((s) => s.users);
  const records = useAppStore((s) => s.records);
  const devices = useAppStore((s) => s.devices);
  const event = useAppStore((s) => s.event);
  return useMemo(() => computeEventStats(users, records, devices, event), [users, records, devices, event]);
}
