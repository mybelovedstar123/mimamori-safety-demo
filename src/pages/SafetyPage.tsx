import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, MessageCircle, PencilLine, RadioTower } from 'lucide-react';
import type { SafetyStatus } from '@/types';
import { useSafetyRows, type SafetyRow } from '@/hooks/useSafetyRows';
import { useEventStats } from '@/hooks/useEventStats';
import { useNow } from '@/hooks/useNow';
import { REGIONS, regionName } from '@/data/regions';
import { formatRelative, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { ConnectionBadge, DispatchBadge, DuplicateBadge, SourceBadge, StatusBadge } from '@/components/ui/Badges';
import { EmptyState, PageHeader, Pagination, SearchInput, Select } from '@/components/ui/misc';
import { UnansweredList } from '@/components/safety/UnansweredList';
import { FailedDispatchList } from '@/components/emergency/FailedDispatchList';
import { FirstComeRuleNote, ResponseDetail } from '@/components/safety/ResponseDetail';
import { ManualResponseModal } from '@/components/safety/ManualResponseModal';
import { needsAttention } from '@/domain/safety';

type Tab = 'list' | 'unanswered' | 'failed' | 'duplicates';
type Filter = 'all' | 'unconfirmed' | 'safe' | 'needs_support' | 'emergency' | 'unreachable' | 'line' | 'device' | 'attention';

const FILTERS: { id: Filter; label: string; test: (r: SafetyRow) => boolean }[] = [
  { id: 'all', label: '全員', test: () => true },
  { id: 'unconfirmed', label: '未回答', test: (r) => r.status === 'unconfirmed' },
  { id: 'safe', label: '無事', test: (r) => r.status === 'safe' },
  { id: 'needs_support', label: '要支援', test: (r) => r.status === 'needs_support' },
  { id: 'emergency', label: '緊急', test: (r) => r.status === 'emergency' },
  { id: 'unreachable', label: '連絡不能', test: (r) => r.status === 'unreachable' },
  { id: 'line', label: 'LINE回答', test: (r) => r.record?.response?.source === 'line' },
  { id: 'device', label: '外部端末回答', test: (r) => r.record?.response?.source === 'device' },
  { id: 'attention', label: '要確認', test: (r) => needsAttention(r.record) },
];

const PAGE_SIZE = 25;

export function SafetyPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'list';
  const filter = (params.get('filter') as Filter) || 'all';
  const rows = useSafetyRows();
  const stats = useEventStats();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [page, setPage] = useState(1);
  const [inputUser, setInputUser] = useState<SafetyRow['user'] | null>(null);

  const setTab = (t: Tab) => setParams(t === 'list' ? {} : { tab: t });
  const setFilter = (f: Filter) => setParams(f === 'all' ? {} : { filter: f });

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const q = query.trim();
    return rows.filter(
      (r) => f.test(r) && (region === 'all' || r.user.regionId === region) && (!q || r.user.name.includes(q) || r.user.kana.includes(q) || r.user.id.includes(q.toUpperCase())),
    );
  }, [rows, filter, query, region]);

  useEffect(() => setPage(1), [filter, query, region, tab]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, rows.filter(f.test).length])) as Record<Filter, number>, [rows]);
  const duplicates = useMemo(() => rows.filter((r) => r.duplicate).sort((a, b) => Number(b.conflict) - Number(a.conflict)), [rows]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!stats.targets) {
    return (
      <>
        <PageHeader title="安否確認" />
        <Card>
          <EmptyState title="実施中の安否確認はありません" description="画面上部の「緊急モードを開始」または「災害発生シミュレーション」から開始できます。" />
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="安否確認" description={`対象 ${stats.targets}名・回答済み ${stats.answered}名・未回答 ${stats.unanswered}名・要確認 ${stats.attention}名`} />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'list', label: '安否確認一覧', count: stats.targets },
          { id: 'unanswered', label: '未回答', count: stats.unanswered, alert: true },
          { id: 'failed', label: '送信失敗', count: stats.dispatchFailed, alert: true },
          { id: 'duplicates', label: '重複回答', count: stats.duplicates },
        ]}
      />

      {tab === 'list' && (
        <Card className="overflow-hidden">
          <div className="space-y-3 border-b border-line p-3 sm:p-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="絞り込み">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={cn(
                    'tabular rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                    filter === f.id ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink-soft ring-line hover:bg-slate-50',
                    f.id === 'emergency' && counts.emergency > 0 && filter !== f.id && 'text-red-700 ring-red-200',
                  )}
                >
                  {f.label} <span className="opacity-70">{counts[f.id]}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <SearchInput value={query} onChange={setQuery} placeholder="氏名・ふりがな・IDで検索" className="sm:max-w-xs sm:flex-1" />
              <Select label="地域" value={region} onChange={setRegion} options={[{ value: 'all', label: 'すべての地域' }, ...REGIONS.map((r) => ({ value: r.id, label: r.name }))]} className="sm:w-44" />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="該当する対象者はいません" description="絞り込み条件を変更してください。" />
          ) : (
            <>
              <SafetyTable rows={pageRows} onInput={setInputUser} />
              <SafetyCards rows={pageRows} />
            </>
          )}
          <Pagination page={page} pageCount={pageCount} total={filtered.length} onChange={setPage} />
        </Card>
      )}

      {tab === 'unanswered' && (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-xs text-ink-muted">送信済みで回答のない方を、送信からの経過時間が長い順に表示しています。電話・訪問での確認を検討してください。</div>
          <UnansweredList />
        </Card>
      )}

      {tab === 'failed' && (
        <Card className="overflow-hidden">
          <FailedDispatchList />
        </Card>
      )}

      {tab === 'duplicates' && (
        <div className="space-y-3">
          <FirstComeRuleNote />
          {duplicates.length === 0 ? (
            <Card>
              <EmptyState title="重複回答はありません" />
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {duplicates.map((r) => (
                <Card key={r.user.id} className={cn('p-3.5', r.conflict && 'border-amber-300')}>
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <Link to={`/users/${r.user.id}`} className="text-sm font-bold text-ink hover:text-brand-700 hover:underline">
                      {r.user.name}
                    </Link>
                    <span className="text-xs text-ink-muted">
                      {regionName(r.user.regionId)}・{r.user.id}
                    </span>
                    <span className="ml-auto">
                      <StatusBadge status={r.status} size="sm" />
                    </span>
                  </div>
                  {r.record?.response && <ResponseDetail response={r.record.response} />}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <ManualResponseModal user={inputUser} onClose={() => setInputUser(null)} />
    </div>
  );
}

function SafetyTable({ rows, onInput }: { rows: SafetyRow[]; onInput: (u: SafetyRow['user']) => void }) {
  const navigate = useNavigate();
  const now = useNow(30_000);
  return (
    <div className="scrollbar-thin hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1080px] text-sm">
        <thead className="bg-slate-50 text-left text-[11px] font-semibold text-ink-muted">
          <tr>
            <th className="px-4 py-2.5">氏名</th>
            <th className="px-3 py-2.5">地域</th>
            <th className="px-3 py-2.5">安否状態</th>
            <th className="px-3 py-2.5">回答経路</th>
            <th className="px-3 py-2.5">回答時刻</th>
            <th className="px-3 py-2.5">見守り端末</th>
            <th className="px-3 py-2.5">LINE</th>
            <th className="px-3 py-2.5">最終見守り</th>
            <th className="px-3 py-2.5">備考</th>
            <th className="px-3 py-2.5">
              <span className="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const resp = r.record?.response;
            return (
              <tr
                key={r.user.id}
                className={cn('cursor-pointer hover:bg-slate-50', r.status === 'emergency' && 'bg-red-50/60 hover:bg-red-50')}
                onClick={() => navigate(`/users/${r.user.id}`)}
              >
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-ink">{r.user.name}</p>
                  <p className="tabular text-[11px] text-ink-muted">
                    {r.user.id}・{r.user.age}歳
                  </p>
                </td>
                <td className="px-3 py-2.5 text-ink-soft">{regionName(r.user.regionId)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={r.status} />
                    {r.record?.manualStatus && <span className="text-[10px] text-ink-muted">管理者確定</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {resp ? (
                    <div className="flex flex-col items-start gap-1">
                      <SourceBadge source={resp.source} />
                      {r.duplicate && <DuplicateBadge count={resp.additionalResponses.length} conflict={r.conflict} />}
                    </div>
                  ) : (
                    <span className="text-xs text-ink-muted">—</span>
                  )}
                </td>
                <td className="tabular px-3 py-2.5 text-ink-soft">{formatTime(resp?.receivedAt)}</td>
                <td className="px-3 py-2.5">
                  {r.device ? (
                    <div className="flex flex-col items-start gap-1">
                      <span className="tabular text-xs text-ink-soft">{r.device.id}</span>
                      {r.record?.dispatch.device.state === 'failed' ? <DispatchBadge state="failed" /> : <ConnectionBadge state={r.device.connection} />}
                    </div>
                  ) : (
                    <span className="text-xs text-ink-muted">なし</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {r.user.line.linked ? (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                      <MessageCircle className="size-3.5 text-[#2a78d6]" aria-hidden />
                      連携済
                    </span>
                  ) : (
                    <span className="text-xs text-ink-muted">未連携</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-ink-soft">{formatRelative(r.user.lastWatchAt, now)}</td>
                <td className="max-w-[180px] truncate px-3 py-2.5 text-xs text-ink-muted" title={r.record?.manualStatus?.reason ?? r.user.notes}>
                  {r.record?.manualStatus?.reason ?? (r.user.notes || '—')}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={PencilLine}
                    onClick={(e) => {
                      e.stopPropagation();
                      onInput(r.user);
                    }}
                  >
                    回答入力
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** モバイル用カード表示 */
function SafetyCards({ rows }: { rows: SafetyRow[] }) {
  return (
    <ul className="divide-y divide-line md:hidden">
      {rows.map((r) => {
        const resp = r.record?.response;
        return (
          <li key={r.user.id}>
            <Link to={`/users/${r.user.id}`} className={cn('flex items-center gap-3 px-4 py-3', r.status === 'emergency' && 'bg-red-50/60')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-ink">{r.user.name}</p>
                  {r.duplicate && <DuplicateBadge count={resp?.additionalResponses.length ?? 0} conflict={r.conflict} />}
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                  <span>{regionName(r.user.regionId)}</span>
                  {resp && <SourceBadge source={resp.source} muted />}
                  {resp && <span className="tabular">{formatTime(resp.receivedAt, false)}</span>}
                  {r.device && r.record?.dispatch.device.state === 'failed' && (
                    <span className="inline-flex items-center gap-0.5 text-orange-800">
                      <RadioTower className="size-3" />
                      送信失敗
                    </span>
                  )}
                </p>
              </div>
              <StatusBadge status={r.status as SafetyStatus} />
              <ChevronRight className="size-4 text-ink-muted" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
