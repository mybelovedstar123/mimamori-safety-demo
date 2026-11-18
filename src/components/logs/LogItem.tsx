import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { ApiLog } from '@/types';
import { formatTime } from '@/utils/format';
import { LOG_CATEGORY_LABEL } from '@/utils/labels';
import { cn } from '@/utils/cn';

const LEVEL_DOT: Record<ApiLog['level'], string> = {
  success: 'bg-emerald-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-400',
  error: 'bg-[#ec835a]',
};

const LEVEL_TEXT: Record<ApiLog['level'], string> = {
  success: 'text-emerald-700',
  info: 'text-ink',
  warning: 'text-amber-800',
  error: 'text-orange-800',
};

/** タイムライン形式のログ1行（payload は展開表示・マスク済み） */
export function LogItem({ log, userName, compact }: { log: ApiLog; userName?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!(log.payload || log.endpoint);
  return (
    <li className="relative flex gap-3 py-2 pl-1">
      <span className="tabular w-[58px] shrink-0 pt-0.5 text-[11px] text-ink-muted">{formatTime(log.at)}</span>
      <span className="relative mt-1.5 flex flex-col items-center" aria-hidden>
        <span className={cn('size-2 rounded-full ring-2 ring-white', LEVEL_DOT[log.level])} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[11px] font-semibold tracking-wide text-ink-muted">{LOG_CATEGORY_LABEL[log.category]}</span>
          <span className={cn('text-xs font-semibold', LEVEL_TEXT[log.level])}>{log.action}</span>
          {log.userId && (
            <Link to={`/users/${log.userId}`} className="tabular text-[11px] text-brand-700 hover:underline">
              {log.userId}
              {userName && !compact ? `（${userName}）` : ''}
            </Link>
          )}
          {log.deviceId && (
            <Link to={`/devices/${log.deviceId}`} className="tabular text-[11px] text-brand-700 hover:underline">
              {log.deviceId}
            </Link>
          )}
        </div>
        <p className={cn('text-xs text-ink-soft', compact && 'truncate')}>{log.message}</p>
        {!compact && hasDetail && (
          <button onClick={() => setOpen((v) => !v)} className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-ink-muted hover:text-ink">
            <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
            詳細
          </button>
        )}
        {open && (
          <pre className="scrollbar-thin mt-1 overflow-x-auto rounded-lg bg-slate-900 p-2.5 text-[11px] leading-relaxed text-slate-100">
            {JSON.stringify(
              {
                endpoint: log.endpoint,
                method: log.method,
                status: log.statusCode,
                durationMs: log.durationMs,
                headers: log.endpoint ? { Authorization: 'Bearer ************' } : undefined,
                payload: log.payload,
              },
              null,
              2,
            )}
          </pre>
        )}
      </div>
    </li>
  );
}
