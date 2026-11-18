import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, MessageCircle, Phone, RadioTower } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useNow } from '@/hooks/useNow';
import { getEffectiveStatus } from '@/domain/safety';
import { regionName } from '@/data/regions';
import { formatElapsed, minutesSince } from '@/utils/format';
import { cn } from '@/utils/cn';
import { EmptyState } from '@/components/ui/misc';
import { DispatchBadge } from '@/components/ui/Badges';

/** 未回答者（送信からの経過時間が長い順） */
export function UnansweredList({ limit, showChannels = true }: { limit?: number; showChannels?: boolean }) {
  const event = useAppStore((s) => s.event);
  const records = useAppStore((s) => s.records);
  const usersById = useAppStore((s) => s.usersById);
  const now = useNow(15_000);

  const rows = useMemo(() => {
    if (!event) return [];
    return event.targetUserIds
      .filter((id) => getEffectiveStatus(records[id]) === 'unconfirmed')
      .map((id) => {
        const r = records[id];
        const since = r.dispatch.device.lastAttemptAt ?? r.dispatch.line.lastAttemptAt ?? event.startedAt;
        return { user: usersById[id], record: r, since };
      })
      .sort((a, b) => a.since.localeCompare(b.since));
  }, [event, records, usersById]);

  if (!event) return <EmptyState title="実施中の安否確認はありません" />;
  if (!rows.length) return <EmptyState title="未回答者はいません" description="対象者全員から回答を受信しました。" />;

  const list = limit ? rows.slice(0, limit) : rows;
  return (
    <div>
      <ul className="divide-y divide-line">
        {list.map(({ user, record, since }) => {
          const mins = minutesSince(since, now);
          return (
            <li key={user.id}>
              <Link to={`/users/${user.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {regionName(user.regionId)}・{user.age}歳{user.livesAlone ? '・一人暮らし' : ''}
                    {!user.deviceId && !user.line.linked && <span className="ml-1 font-semibold text-amber-800">・通知手段なし（電話確認）</span>}
                  </p>
                </div>
                {showChannels && (
                  <div className="hidden items-center gap-1.5 sm:flex">
                    {user.deviceId && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted" title="外部端末">
                        <RadioTower className="size-3.5" />
                        <DispatchBadge state={record.dispatch.device.state} />
                      </span>
                    )}
                    {user.line.linked && <MessageCircle className="size-3.5 text-ink-muted" aria-label="LINE連携済み" />}
                    {!user.deviceId && !user.line.linked && <Phone className="size-3.5 text-amber-600" aria-label="電話のみ" />}
                  </div>
                )}
                <span
                  className={cn(
                    'tabular inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold',
                    mins >= 30 ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700',
                  )}
                >
                  <Clock className="size-3.5" aria-hidden />
                  未回答 {formatElapsed(since, now)}
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {limit && rows.length > limit && (
        <Link to="/safety?tab=unanswered" className="block border-t border-line px-4 py-2.5 text-center text-xs font-medium text-brand-700 hover:bg-slate-50">
          未回答者 {rows.length}名をすべて表示
        </Link>
      )}
    </div>
  );
}
