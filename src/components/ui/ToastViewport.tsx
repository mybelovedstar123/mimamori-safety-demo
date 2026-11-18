import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppStore, type ToastTone } from '@/store/appStore';
import { cn } from '@/utils/cn';

const STYLE: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-emerald-600' },
  error: { icon: AlertOctagon, className: 'text-red-600' },
  warning: { icon: AlertTriangle, className: 'text-amber-500' },
  info: { icon: Info, className: 'text-sky-600' },
};

export function ToastViewport() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96" aria-live="polite">
      {toasts.map((t) => {
        const { icon: Icon, className } = STYLE[t.tone];
        return (
          <div
            key={t.id}
            className={cn(
              'animate-slide-in pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-white p-3.5 shadow-lg',
              t.tone === 'error' ? 'border-red-200' : 'border-line',
            )}
            role={t.tone === 'error' ? 'alert' : 'status'}
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', className)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.message && <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{t.message}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-ink-muted hover:bg-slate-100" aria-label="閉じる">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
