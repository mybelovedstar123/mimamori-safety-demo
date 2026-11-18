import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { getEffectiveStatus } from '@/domain/safety';
import { regionName } from '@/data/regions';
import { formatTime } from '@/utils/format';
import { SourceBadge } from '@/components/ui/Badges';

/** 緊急回答者のみを強調表示（画面上で赤を使うのはここに限定） */
export function EmergencyAlert() {
  const event = useAppStore((s) => s.event);
  const records = useAppStore((s) => s.records);
  const usersById = useAppStore((s) => s.usersById);

  const rows = useMemo(
    () => (event ? event.targetUserIds.filter((id) => getEffectiveStatus(records[id]) === 'emergency').map((id) => ({ user: usersById[id], record: records[id] })) : []),
    [event, records, usersById],
  );
  if (!rows.length) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-red-300 bg-white shadow-sm" role="alert" aria-label="緊急回答">
      <div className="flex flex-wrap items-center gap-2 bg-red-600 px-4 py-2.5 text-white">
        <Siren className="size-5" aria-hidden />
        <p className="text-sm font-bold">緊急回答 {rows.length}名 — 至急対応してください</p>
        <Link to="/safety?filter=emergency" className="ml-auto text-xs font-medium underline-offset-2 hover:underline">
          一覧で確認
        </Link>
      </div>
      <ul className="grid divide-y divide-red-100 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-3">
        {rows.map(({ user, record }) => (
          <li key={user.id} className="sm:border-b sm:border-red-100">
            <Link to={`/users/${user.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50/60">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{user.name}</p>
                <p className="truncate text-[11px] text-ink-muted">
                  {regionName(user.regionId)}・{user.age}歳・{user.notes || '特記事項なし'}
                </p>
              </div>
              <div className="text-right">
                {record.response && <SourceBadge source={record.response.source} />}
                <p className="tabular text-[11px] text-ink-muted">{formatTime(record.response?.receivedAt ?? record.manualStatus?.at)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
