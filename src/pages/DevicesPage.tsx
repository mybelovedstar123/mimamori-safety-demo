import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Radio, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import type { ConnectionState } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useNow } from '@/hooks/useNow';
import { formatRelative, formatTime } from '@/utils/format';
import { API_STATUS_LABEL, DEVICE_MODE_LABEL } from '@/utils/labels';
import { cn } from '@/utils/cn';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { Tabs } from '@/components/ui/Tabs';
import { ConnectionBadge, Badge } from '@/components/ui/Badges';
import { BatteryMeter, EmptyState, PageHeader, Pagination, SearchInput, SignalBars } from '@/components/ui/misc';

type Filter = 'all' | ConnectionState | 'api_error';
const PAGE_SIZE = 30;

export function DevicesPage() {
  const devices = useAppStore((s) => s.devices);
  const usersById = useAppStore((s) => s.usersById);
  const now = useNow(15_000);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const list = useMemo(() => Object.values(devices), [devices]);
  const counts = {
    all: list.length,
    online: list.filter((d) => d.connection === 'online').length,
    warning: list.filter((d) => d.connection === 'warning').length,
    offline: list.filter((d) => d.connection === 'offline').length,
    api_error: list.filter((d) => d.apiStatus !== 'connected').length,
  };
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const order: Record<ConnectionState, number> = { offline: 0, warning: 1, online: 2 };
    return list
      .filter((d) => (filter === 'all' ? true : filter === 'api_error' ? d.apiStatus !== 'connected' : d.connection === filter))
      .filter((d) => !q || d.id.includes(q) || usersById[d.userId].name.includes(query.trim()))
      .sort((a, b) => order[a.connection] - order[b.connection] || a.id.localeCompare(b.id));
  }, [list, filter, query, usersById]);
  useEffect(() => setPage(1), [filter, query]);

  return (
    <div className="space-y-4">
      <PageHeader title="見守り端末" description="外部見守り端末の接続状態・バッテリー・API接続状況を管理します。" />
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <KpiCard label="登録端末" value={counts.all} unit="台" icon={Radio} accent="brand" />
        <KpiCard label="Online" value={counts.online} unit="台" icon={Wifi} accent="safe" />
        <KpiCard label="Warning（電池・電波）" value={counts.warning} unit="台" icon={AlertTriangle} accent="support" />
        <KpiCard label="Offline" value={counts.offline} unit="台" icon={WifiOff} accent="pending" hint={`API異常 ${counts.api_error}台`} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:p-4">
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            items={[
              { id: 'all', label: 'すべて', count: counts.all },
              { id: 'online', label: 'Online', count: counts.online },
              { id: 'warning', label: 'Warning', count: counts.warning },
              { id: 'offline', label: 'Offline', count: counts.offline, alert: true },
              { id: 'api_error', label: 'API異常', count: counts.api_error, alert: true },
            ]}
          />
          <SearchInput value={query} onChange={setQuery} placeholder="端末ID・利用者名" className="sm:ml-auto sm:w-64" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="該当する端末はありません" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold text-ink-muted">
                <tr>
                  <th className="px-4 py-2.5">端末ID</th>
                  <th className="px-3 py-2.5">利用者</th>
                  <th className="px-3 py-2.5">接続状態</th>
                  <th className="px-3 py-2.5">最終通信時刻</th>
                  <th className="px-3 py-2.5">バッテリー</th>
                  <th className="px-3 py-2.5">電波</th>
                  <th className="px-3 py-2.5">現在のモード</th>
                  <th className="px-3 py-2.5">API接続状態</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link to={`/devices/${d.id}`} className="tabular font-semibold text-ink hover:text-brand-700 hover:underline">
                        {d.id}
                      </Link>
                      <p className="text-[11px] text-ink-muted">{d.model}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link to={`/users/${d.userId}`} className="text-ink-soft hover:underline">
                        {usersById[d.userId].name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <ConnectionBadge state={d.connection} />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="tabular text-xs">{formatTime(d.lastCommunicationAt)}</p>
                      <p className={cn('text-[11px]', d.connection === 'offline' ? 'font-semibold text-ink-soft' : 'text-ink-muted')}>{formatRelative(d.lastCommunicationAt, now)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <BatteryMeter value={d.battery} />
                    </td>
                    <td className="px-3 py-2.5">
                      <SignalBars value={d.connection === 'offline' ? 0 : d.signal} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={d.mode === 'emergency' ? 'danger' : 'neutral'}>{DEVICE_MODE_LABEL[d.mode]}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={d.apiStatus === 'connected' ? 'success' : d.apiStatus === 'auth_error' ? 'danger' : 'orange'}>{API_STATUS_LABEL[d.apiStatus]}</Badge>
                    </td>
                    <td className="pr-3">
                      <Link to={`/devices/${d.id}`} aria-label={`${d.id}の詳細`}>
                        <ChevronRight className="size-4 text-ink-muted" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} total={filtered.length} onChange={setPage} />
      </Card>
    </div>
  );
}
