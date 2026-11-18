import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

type Accent = 'neutral' | 'brand' | 'safe' | 'pending' | 'support' | 'emergency' | 'error';

const ACCENTS: Record<Accent, { bar: string; icon: string; value: string }> = {
  neutral: { bar: 'bg-slate-300', icon: 'bg-slate-100 text-slate-600', value: 'text-ink' },
  brand: { bar: 'bg-brand-500', icon: 'bg-brand-50 text-brand-700', value: 'text-ink' },
  safe: { bar: 'bg-[#0ca30c]', icon: 'bg-emerald-50 text-emerald-700', value: 'text-ink' },
  pending: { bar: 'bg-slate-500', icon: 'bg-slate-100 text-slate-700', value: 'text-ink' },
  support: { bar: 'bg-[#fab219]', icon: 'bg-amber-50 text-amber-700', value: 'text-ink' },
  emergency: { bar: 'bg-[#d03b3b]', icon: 'bg-red-600 text-white', value: 'text-red-700' },
  error: { bar: 'bg-[#ec835a]', icon: 'bg-orange-50 text-orange-700', value: 'text-ink' },
};

interface KpiCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  icon: LucideIcon;
  accent?: Accent;
  hint?: ReactNode;
  to?: string;
  /** 0 より大きい場合に強調する */
  highlight?: boolean;
}

export function KpiCard({ label, value, unit, icon: Icon, accent = 'neutral', hint, to, highlight }: KpiCardProps) {
  const a = ACCENTS[accent];
  const body = (
    <div
      className={cn(
        'relative h-full overflow-hidden rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,20,0.04)] transition-shadow sm:p-4',
        highlight && accent === 'emergency' ? 'border-red-300 ring-2 ring-red-100' : 'border-line',
        to && 'hover:shadow-md',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', a.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', a.icon)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className={cn('tabular mt-1.5 text-2xl font-bold tracking-tight sm:text-[28px]', a.value)}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-ink-muted">{unit}</span>}
      </p>
      {hint && <div className="mt-1 text-[11px] leading-tight text-ink-muted">{hint}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full focus-visible:rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}
