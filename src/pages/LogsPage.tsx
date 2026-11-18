import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { ApiLog, LogCategory } from '@/types';
import { useAppStore } from '@/store/appStore';
import { LOG_CATEGORY_LABEL } from '@/utils/labels';
import { formatDateTime } from '@/utils/format';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader, Pagination, SearchInput, Select } from '@/components/ui/misc';
import { LogItem } from '@/components/logs/LogItem';

const PAGE_SIZE = 50;
type Level = 'all' | ApiLog['level'];

function toCsv(logs: ApiLog[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['日時', '種別', 'レベル', '処理', '内容', '対象者ID', '端末ID', 'Endpoint', 'Status', 'ms'];
  const rows = logs.map((l) => [formatDateTime(l.at), LOG_CATEGORY_LABEL[l.category], l.level, l.action, l.message, l.userId, l.deviceId, l.endpoint, l.statusCode, l.durationMs].map(esc).join(','));
  return '﻿' + [header.map(esc).join(','), ...rows].join('\n');
}

export function LogsPage() {
  const logs = useAppStore((s) => s.logs);
  const usersById = useAppStore((s) => s.usersById);
  const addLog = useAppStore((s) => s.addLog);
  const [category, setCategory] = useState<'all' | LogCategory>('all');
  const [level, setLevel] = useState<Level>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(
      (l) =>
        (category === 'all' || l.category === category) &&
        (level === 'all' || l.level === level) &&
        (!q || `${l.message} ${l.action} ${l.userId ?? ''} ${l.deviceId ?? ''} ${l.endpoint ?? ''}`.toLowerCase().includes(q)),
    );
  }, [logs, category, level, query]);
  useEffect(() => setPage(1), [category, level, query]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addLog({ category: 'audit', level: 'info', action: 'ログ出力', message: `ログ ${filtered.length}件をCSV出力（秘密情報はマスク済み）` });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="ログ"
        description="システム操作・API通信・安否回答の流れを時系列で確認できます。認証情報はマスクされています。"
        actions={
          <Button size="sm" icon={Download} onClick={exportCsv}>
            CSV出力
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:p-4">
          <SearchInput value={query} onChange={setQuery} placeholder="対象者ID・端末ID・内容で検索（例: USER-1024）" className="sm:flex-1" />
          <Select<'all' | LogCategory>
            label="種別"
            value={category}
            onChange={setCategory}
            options={[{ value: 'all', label: 'すべての種別' }, ...(Object.keys(LOG_CATEGORY_LABEL) as LogCategory[]).map((c) => ({ value: c, label: LOG_CATEGORY_LABEL[c] }))]}
            className="sm:w-52"
          />
          <Select<Level>
            label="レベル"
            value={level}
            onChange={setLevel}
            options={[
              { value: 'all', label: 'すべてのレベル' },
              { value: 'success', label: '成功' },
              { value: 'info', label: '情報' },
              { value: 'warning', label: '警告' },
              { value: 'error', label: 'エラー' },
            ]}
            className="sm:w-40"
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="該当するログはありません" />
        ) : (
          <ul className="divide-y divide-line px-3 sm:px-4">
            {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((l) => (
              <LogItem key={l.id} log={l} userName={l.userId ? usersById[l.userId]?.name : undefined} />
            ))}
          </ul>
        )}
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} total={filtered.length} onChange={setPage} />
      </Card>
    </div>
  );
}
