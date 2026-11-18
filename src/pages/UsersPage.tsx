import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useNow } from '@/hooks/useNow';
import { getEffectiveStatus } from '@/domain/safety';
import { REGIONS, regionName } from '@/data/regions';
import { formatRelative } from '@/utils/format';
import { Card } from '@/components/ui/Card';
import { ConnectionBadge, StatusBadge, Badge } from '@/components/ui/Badges';
import { EmptyState, PageHeader, Pagination, SearchInput, Select } from '@/components/ui/misc';

type ChannelFilter = 'all' | 'device' | 'line' | 'none' | 'alone';
const PAGE_SIZE = 30;

export function UsersPage() {
  const users = useAppStore((s) => s.users);
  const devices = useAppStore((s) => s.devices);
  const records = useAppStore((s) => s.records);
  const event = useAppStore((s) => s.event);
  const now = useNow(30_000);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim();
    return users.filter((u) => {
      if (region !== 'all' && u.regionId !== region) return false;
      if (channel === 'device' && !u.deviceId) return false;
      if (channel === 'line' && !u.line.linked) return false;
      if (channel === 'none' && (u.deviceId || u.line.linked)) return false;
      if (channel === 'alone' && !u.livesAlone) return false;
      return !q || u.name.includes(q) || u.kana.includes(q) || u.id.includes(q.toUpperCase());
    });
  }, [users, query, region, channel]);

  useEffect(() => setPage(1), [query, region, channel]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <PageHeader
        title="対象者管理"
        description={`登録対象者 ${users.length}名（見守り端末 ${users.filter((u) => u.deviceId).length}名・LINE連携 ${users.filter((u) => u.line.linked).length}名）。一覧では個人情報を必要最小限のみ表示しています。`}
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:p-4">
          <SearchInput value={query} onChange={setQuery} placeholder="氏名・ふりがな・IDで検索" className="sm:max-w-xs sm:flex-1" />
          <Select label="地域" value={region} onChange={setRegion} options={[{ value: 'all', label: 'すべての地域' }, ...REGIONS.map((r) => ({ value: r.id, label: r.name }))]} className="sm:w-44" />
          <Select<ChannelFilter>
            label="連絡手段"
            value={channel}
            onChange={setChannel}
            options={[
              { value: 'all', label: 'すべての連絡手段' },
              { value: 'device', label: '見守り端末あり' },
              { value: 'line', label: 'LINE連携済み' },
              { value: 'none', label: '電話のみ' },
              { value: 'alone', label: '一人暮らし' },
            ]}
            className="sm:w-48"
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="該当する対象者はいません" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold text-ink-muted">
                <tr>
                  <th className="px-4 py-2.5">氏名</th>
                  <th className="px-3 py-2.5">地域</th>
                  <th className="px-3 py-2.5">介護度</th>
                  <th className="px-3 py-2.5">見守り端末</th>
                  <th className="px-3 py-2.5">LINE</th>
                  <th className="px-3 py-2.5">最終見守り</th>
                  <th className="px-3 py-2.5">現在の安否</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageRows.map((u) => {
                  const d = u.deviceId ? devices[u.deviceId] : undefined;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link to={`/users/${u.id}`} className="font-semibold text-ink hover:text-brand-700 hover:underline">
                          {u.name}
                        </Link>
                        <p className="tabular text-[11px] text-ink-muted">
                          {u.id}・{u.age}歳{u.livesAlone ? '・一人暮らし' : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-ink-soft">{regionName(u.regionId)}</td>
                      <td className="px-3 py-2.5 text-xs text-ink-soft">{u.careLevel}</td>
                      <td className="px-3 py-2.5">{d ? <ConnectionBadge state={d.connection} /> : <Badge tone="warning">なし</Badge>}</td>
                      <td className="px-3 py-2.5">
                        {u.line.linked ? (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                            <MessageCircle className="size-3.5 text-[#2a78d6]" />
                            連携済
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted">未連携</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-soft">{formatRelative(u.lastWatchAt, now)}</td>
                      <td className="px-3 py-2.5">{event && records[u.id] ? <StatusBadge status={getEffectiveStatus(records[u.id])} size="sm" /> : <span className="text-xs text-ink-muted">平常時</span>}</td>
                      <td className="pr-3">
                        <Link to={`/users/${u.id}`} aria-label={`${u.name}の詳細`}>
                          <ChevronRight className="size-4 text-ink-muted" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} total={filtered.length} onChange={setPage} />
      </Card>
    </div>
  );
}
