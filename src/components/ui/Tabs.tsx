import { cn } from '@/utils/cn';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  /** 件数を強調表示する（未回答・失敗など） */
  alert?: boolean;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn('scrollbar-thin -mx-1 overflow-x-auto px-1', className)}>
      <div role="tablist" className="inline-flex min-w-max gap-1 rounded-xl bg-slate-100 p-1">
        {items.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm',
                active ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    'tabular rounded-full px-1.5 text-[11px] font-semibold',
                    t.alert && t.count > 0 ? 'bg-red-100 text-red-700' : active ? 'bg-brand-50 text-brand-800' : 'bg-white/70 text-ink-muted',
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
