import { getEffectiveStatus } from '@/domain/safety';
import { useAppStore } from '@/store/appStore';
import { regionName } from '@/data/regions';

const store = () => useAppStore.getState();

/** 未回答者を抽出し、地区別の内訳を通知・ログに記録する */
export function extractUnanswered() {
  const { event, records, usersById } = store();
  if (!event) return [];
  const ids = event.targetUserIds.filter((id) => getEffectiveStatus(records[id]) === 'unconfirmed');
  const byRegion = new Map<string, number>();
  ids.forEach((id) => {
    const r = usersById[id].regionId;
    byRegion.set(r, (byRegion.get(r) ?? 0) + 1);
  });
  const breakdown = [...byRegion.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([r, n]) => `${regionName(r)} ${n}名`)
    .join('、');
  store().addLog({ category: 'safety', level: ids.length ? 'warning' : 'success', action: '未回答者抽出', message: `未回答 ${ids.length}名${breakdown ? `（${breakdown} ほか）` : ''}` });
  if (ids.length) {
    store().addNotification({
      severity: 'warning',
      category: 'unanswered',
      title: `未回答者 ${ids.length}名を抽出しました`,
      message: `電話・訪問による確認を検討してください。${breakdown ? `多い地区: ${breakdown}` : ''}`,
      link: '/safety?tab=unanswered',
    });
  }
  return ids;
}
