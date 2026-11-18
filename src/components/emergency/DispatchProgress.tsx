import { useMemo } from 'react';
import { MessageCircle, RadioTower } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { ProgressBar } from '@/components/ui/misc';
import type { DispatchState } from '@/types';
import { cn } from '@/utils/cn';

interface ChannelCounts {
  target: number;
  sent: number;
  sending: number;
  failed: number;
}

const COLORS = { sent: '#0ca30c', sending: '#2a78d6', queued: '#c9cfcb', failed: '#ec835a' };

export function useDispatchCounts() {
  const event = useAppStore((s) => s.event);
  const records = useAppStore((s) => s.records);
  return useMemo(() => {
    const empty = (): ChannelCounts & { queued: number } => ({ target: 0, sent: 0, sending: 0, failed: 0, queued: 0 });
    const res = { total: event?.targetUserIds.length ?? 0, device: empty(), line: empty() };
    if (!event) return res;
    for (const id of event.targetUserIds) {
      const r = records[id];
      if (!r) continue;
      (['device', 'line'] as const).forEach((ch) => {
        const st: DispatchState = r.dispatch[ch].state;
        if (st === 'skipped' || st === 'idle') return;
        const c = res[ch];
        c.target += 1;
        if (st === 'sent') c.sent += 1;
        else if (st === 'failed') c.failed += 1;
        else if (st === 'sending') c.sending += 1;
        else c.queued += 1;
      });
    }
    return res;
  }, [event, records]);
}

function ChannelRow({ label, icon: Icon, c, unit }: { label: string; icon: typeof RadioTower; c: ChannelCounts & { queued: number }; unit: string }) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <Icon className="size-4 text-ink-soft" aria-hidden />
          {label}
          <span className="font-normal text-ink-muted">（対象 {c.target}{unit}）</span>
        </span>
        <span className="tabular ml-auto flex flex-wrap gap-x-3 text-ink-soft">
          <span>
            <i className="mr-1 inline-block size-2 rounded-full" style={{ background: COLORS.sent }} />
            送信済み <b className="text-ink">{c.sent}</b>
          </span>
          <span>
            <i className="mr-1 inline-block size-2 rounded-full" style={{ background: COLORS.sending }} />
            送信中 <b className="text-ink">{c.sending + c.queued}</b>
          </span>
          <span className={cn(c.failed > 0 && 'font-semibold text-orange-800')}>
            <i className="mr-1 inline-block size-2 rounded-full" style={{ background: COLORS.failed }} />
            送信失敗 <b>{c.failed}</b>
          </span>
        </span>
      </div>
      <ProgressBar
        segments={[
          { label: '送信済み', value: c.sent, color: COLORS.sent },
          { label: '送信中', value: c.sending, color: COLORS.sending },
          { label: '送信待ち', value: c.queued, color: COLORS.queued },
          { label: '送信失敗', value: c.failed, color: COLORS.failed },
        ]}
      />
    </div>
  );
}

export function DispatchProgress({ compact }: { compact?: boolean }) {
  const counts = useDispatchCounts();
  const running = useAppStore((s) => s.dispatchRun.running);
  return (
    <div className="space-y-4">
      <div className={cn('rounded-xl border p-4', running ? 'border-sky-200 bg-sky-50/60' : 'border-line bg-slate-50/60')}>
        <p className="text-xs text-ink-muted">{running ? '送信処理中…' : '送信結果'}</p>
        <p className={cn('tabular mt-0.5 font-bold text-ink', compact ? 'text-lg' : 'text-2xl')}>
          {counts.total}名中 <span className="text-brand-700">{counts.device.sent}台</span>へ送信済み
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          LINE {counts.line.sent}名へ送信済み
          {counts.device.failed + counts.line.failed > 0 && (
            <span className="ml-2 font-semibold text-orange-800">送信失敗 {counts.device.failed + counts.line.failed}件</span>
          )}
        </p>
      </div>
      <ChannelRow label="外部見守り端末" icon={RadioTower} c={counts.device} unit="台" />
      <ChannelRow label="LINE" icon={MessageCircle} c={counts.line} unit="名" />
    </div>
  );
}
