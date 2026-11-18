import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, ChevronRight } from 'lucide-react';
import type { NotificationCategory, Severity } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useNow } from '@/hooks/useNow';
import { formatRelative, formatTime } from '@/utils/format';
import { NOTIFICATION_CATEGORY_LABEL } from '@/utils/labels';
import { cn } from '@/utils/cn';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Badge, SeverityBadge } from '@/components/ui/Badges';
import { EmptyState, PageHeader, Select } from '@/components/ui/misc';

type SevFilter = 'all' | Severity;

export function AlertsPage() {
  const notifications = useAppStore((s) => s.notifications);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const markAll = useAppStore((s) => s.markAllNotificationsRead);
  const now = useNow(30_000);
  const [sev, setSev] = useState<SevFilter>('all');
  const [category, setCategory] = useState<'all' | NotificationCategory>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = useMemo(
    () => notifications.filter((n) => (sev === 'all' || n.severity === sev) && (category === 'all' || n.category === category) && (!unreadOnly || !n.read)),
    [notifications, sev, category, unreadOnly],
  );
  const count = (s: Severity) => notifications.filter((n) => n.severity === s && !n.read).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="通知・アラート"
        description="未回答・APIエラー・送信失敗・端末Offline・緊急回答・外部プラットフォーム送信失敗を通知します。"
        actions={
          <Button size="sm" icon={CheckCheck} onClick={markAll}>
            すべて既読にする
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:p-4">
          <Tabs<SevFilter>
            value={sev}
            onChange={setSev}
            items={[
              { id: 'all', label: 'すべて', count: notifications.filter((n) => !n.read).length },
              { id: 'critical', label: 'Critical', count: count('critical'), alert: true },
              { id: 'warning', label: 'Warning', count: count('warning') },
              { id: 'info', label: 'Info', count: count('info') },
            ]}
          />
          <div className="flex items-center gap-3 sm:ml-auto">
            <Select<'all' | NotificationCategory>
              label="種別"
              value={category}
              onChange={setCategory}
              options={[{ value: 'all', label: 'すべての種別' }, ...(Object.keys(NOTIFICATION_CATEGORY_LABEL) as NotificationCategory[]).map((c) => ({ value: c, label: NOTIFICATION_CATEGORY_LABEL[c] }))]}
              className="w-44"
            />
            <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-soft">
              <input type="checkbox" className="accent-brand-700" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
              未読のみ
            </label>
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="通知はありません" />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.slice(0, 150).map((n) => (
              <li key={n.id} className={cn('flex gap-3 px-4 py-3 sm:px-5', !n.read && 'bg-brand-50/30', n.severity === 'critical' && !n.read && 'bg-red-50/50')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand-600')} aria-label={n.read ? '既読' : '未読'} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={n.severity} />
                    <Badge>{NOTIFICATION_CATEGORY_LABEL[n.category]}</Badge>
                    <span className="tabular ml-auto text-[11px] text-ink-muted">
                      {formatTime(n.at)}（{formatRelative(n.at, now)}）
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-ink">{n.title}</p>
                  <p className="text-xs text-ink-soft">{n.message}</p>
                  <div className="mt-1.5 flex gap-3">
                    {n.link && (
                      <Link to={n.link} onClick={() => markRead(n.id)} className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-700 hover:underline">
                        対応する <ChevronRight className="size-3" />
                      </Link>
                    )}
                    {!n.read && (
                      <button onClick={() => markRead(n.id)} className="text-xs text-ink-muted hover:text-ink">
                        既読にする
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
