import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox, Search } from 'lucide-react';
import { cn } from '@/utils/cn';

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500">{icon ?? <Inbox className="size-5" />}</div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-ink-muted">{description}</p>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{placeholder ?? '検索'}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '検索'}
        className="h-10 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-sm placeholder:text-ink-muted focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
      />
    </label>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={label}
        className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Pagination({ page, pageCount, total, onChange }: { page: number; pageCount: number; total: number; onChange: (p: number) => void }) {
  if (pageCount <= 1) return <p className="px-4 py-3 text-xs text-ink-muted">全 {total} 件</p>;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
      <p className="tabular text-xs text-ink-muted">
        全 {total} 件中 {page} / {pageCount} ページ
      </p>
      <div className="flex gap-1">
        <button className="rounded-md p-1.5 text-ink-soft hover:bg-slate-100 disabled:opacity-30" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="前のページ">
          <ChevronLeft className="size-4" />
        </button>
        <button className="rounded-md p-1.5 text-ink-soft hover:bg-slate-100 disabled:opacity-30" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="次のページ">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function ProgressBar({ segments, className, height = 'h-2.5' }: { segments: { value: number; color: string; label: string }[]; className?: string; height?: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className={cn('flex w-full gap-[2px] overflow-hidden rounded-full bg-slate-100', height, className)} role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join('、')}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div key={s.label} className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />
        ))}
    </div>
  );
}

export function DefinitionList({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-[11px] font-medium text-ink-muted">{i.label}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">{title}</h1>
        {description && <p className="mt-1 text-xs text-ink-muted sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function BatteryMeter({ value }: { value: number }) {
  const color = value < 20 ? 'bg-[#ec835a]' : value < 40 ? 'bg-[#fab219]' : 'bg-emerald-500';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative h-2.5 w-7 rounded-[3px] border border-slate-400 p-[1px]" aria-hidden>
        <span className={cn('block h-full rounded-[1px]', color)} style={{ width: `${value}%` }} />
      </span>
      <span className={cn('tabular text-xs', value < 20 ? 'font-semibold text-orange-800' : 'text-ink-soft')}>{value}%</span>
    </span>
  );
}

export function SignalBars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-end gap-[2px]" aria-label={`電波強度 ${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn('w-[3px] rounded-sm', i <= value ? 'bg-ink-soft' : 'bg-slate-200')} style={{ height: 3 + i * 2 }} />
      ))}
    </span>
  );
}
