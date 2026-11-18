import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 送信中など閉じてはいけない状態 */
  locked?: boolean;
  tone?: 'default' | 'emergency';
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', locked, tone = 'default' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, locked, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => !locked && onClose()} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'animate-slide-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl',
          SIZES[size],
        )}
      >
        <div className={cn('flex items-start justify-between gap-4 border-b px-5 py-4', tone === 'emergency' ? 'border-red-100 bg-red-50/60' : 'border-line')}>
          <div className="min-w-0">
            <h2 className={cn('text-base font-bold', tone === 'emergency' ? 'text-red-800' : 'text-ink')}>{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-ink-muted">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            disabled={locked}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 disabled:opacity-30"
            aria-label="閉じる"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
