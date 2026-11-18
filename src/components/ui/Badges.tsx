import type { ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, Info, Layers } from 'lucide-react';
import type { ConnectionState, DispatchState, ResponseSource, SafetyStatus, Severity } from '@/types';
import { cn } from '@/utils/cn';
import { CONNECTION_LABEL, DISPATCH_LABEL, SEVERITY_LABEL, SOURCE_LABEL, STATUS_LABEL } from '@/utils/labels';
import { SOURCE_META, STATUS_META } from './statusMeta';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'orange';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  orange: 'bg-orange-50 text-orange-900 ring-orange-200',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, size = 'md' }: { status: SafetyStatus; size?: 'sm' | 'md' | 'lg' }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset',
        meta.badge,
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-0.5 text-xs',
        size === 'lg' && 'px-3.5 py-1.5 text-base',
        status === 'emergency' && size !== 'sm' && 'animate-pulse-ring',
      )}
    >
      <Icon className={size === 'lg' ? 'size-5' : 'size-3.5'} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SourceBadge({ source, muted }: { source: ResponseSource; muted?: boolean }) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs whitespace-nowrap', muted ? 'text-ink-muted' : 'text-ink-soft')}>
      <Icon className="size-3.5" style={{ color: meta.color }} aria-hidden />
      {SOURCE_LABEL[source]}
    </span>
  );
}

const DISPATCH_TONE: Record<DispatchState, Tone> = {
  idle: 'neutral',
  queued: 'neutral',
  sending: 'info',
  sent: 'success',
  failed: 'danger',
  skipped: 'neutral',
};

export function DispatchBadge({ state }: { state: DispatchState }) {
  return (
    <Badge tone={DISPATCH_TONE[state]}>
      {state === 'sending' && <span className="size-1.5 animate-pulse rounded-full bg-sky-500" aria-hidden />}
      {DISPATCH_LABEL[state]}
    </Badge>
  );
}

const SEVERITY_STYLE: Record<Severity, { tone: Tone; icon: typeof Info }> = {
  critical: { tone: 'danger', icon: AlertOctagon },
  warning: { tone: 'warning', icon: AlertTriangle },
  info: { tone: 'info', icon: Info },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { tone, icon: Icon } = SEVERITY_STYLE[severity];
  return (
    <Badge tone={tone} className={severity === 'critical' ? 'bg-red-600 text-white ring-red-700' : undefined}>
      <Icon className="size-3" aria-hidden />
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}

const CONNECTION_DOT: Record<ConnectionState, string> = {
  online: 'bg-emerald-500',
  warning: 'bg-amber-400',
  offline: 'bg-slate-400',
};

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  return (
    <Badge tone={state === 'online' ? 'success' : state === 'warning' ? 'warning' : 'neutral'}>
      <span className={cn('size-1.5 rounded-full', CONNECTION_DOT[state])} aria-hidden />
      {CONNECTION_LABEL[state]}
    </Badge>
  );
}

export function DuplicateBadge({ count, conflict }: { count: number; conflict?: boolean }) {
  return (
    <Badge tone={conflict ? 'warning' : 'brand'}>
      <Layers className="size-3" aria-hidden />
      {conflict ? '回答不一致' : `重複 +${count}`}
    </Badge>
  );
}
