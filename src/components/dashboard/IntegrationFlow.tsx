import { Link } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, Database, MessageCircle, RadioTower, Share2, type LucideIcon } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useEventStats } from '@/hooks/useEventStats';
import { useNow } from '@/hooks/useNow';
import { formatRelative } from '@/utils/format';
import { cn } from '@/utils/cn';
import { getPlatformQueue } from '@/workflows/platform';
import { useMemo } from 'react';

type Health = 'ok' | 'warn' | 'error';

const HEALTH: Record<Health, { dot: string; label: string; ring: string }> = {
  ok: { dot: 'bg-emerald-500', label: '正常', ring: 'border-line' },
  warn: { dot: 'bg-amber-400', label: '注意', ring: 'border-amber-200' },
  error: { dot: 'bg-red-500', label: '異常', ring: 'border-red-200' },
};

function Node({ icon: Icon, title, health, lines, to, center }: { icon: LucideIcon; title: string; health: Health; lines: string[]; to: string; center?: boolean }) {
  const h = HEALTH[health];
  return (
    <Link
      to={to}
      className={cn(
        'block min-w-0 flex-1 rounded-xl border p-3 transition-shadow hover:shadow-md',
        center ? 'border-brand-200 bg-brand-50/60' : cn('bg-white', h.ring),
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', center ? 'bg-brand-700 text-white' : 'bg-slate-100 text-ink-soft')}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-tight font-semibold text-ink">{title}</p>
          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-ink-soft">
            <span className={cn('size-2 rounded-full', h.dot)} aria-hidden />
            {h.label}
          </span>
        </div>
      </div>
      <ul className="mt-2 space-y-0.5">
        {lines.map((l) => (
          <li key={l} className="tabular text-[11px] leading-snug text-ink-muted">
            {l}
          </li>
        ))}
      </ul>
    </Link>
  );
}

function Connector({ label, bidirectional }: { label: string; bidirectional?: boolean }) {
  const Icon = bidirectional ? ArrowLeftRight : ArrowRight;
  return (
    <div className="flex shrink-0 flex-row items-center justify-center gap-1 py-1 text-[10px] text-ink-muted lg:flex-col lg:px-1 lg:py-0">
      <Icon className="size-4 rotate-90 text-brand-500 lg:rotate-0" aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}

/** 外部端末 ⇔ Webシステム ⇔ LINE ⇔ 外部プラットフォーム の連携状況 */
export function IntegrationFlow() {
  const api = useAppStore((s) => s.apiStats);
  const lastSync = useAppStore((s) => s.platformSyncs[0]);
  const records = useAppStore((s) => s.records);
  const stats = useEventStats();
  const now = useNow(10_000);
  // getPlatformQueue はストアを直接参照するため records の変化で再計算する
  const queue = useMemo(() => (records ? getPlatformQueue().length : 0), [records]);

  const rate = (id: keyof typeof api) => (api[id].requests ? api[id].success / api[id].requests : 1);
  const deviceHealth: Health = api.device.authStatus !== 'valid' ? 'error' : stats.devicesOffline > 0 || rate('device') < 0.97 ? 'warn' : 'ok';
  const lineHealth: Health = api.line.authStatus !== 'valid' ? 'error' : rate('line') < 0.97 ? 'warn' : 'ok';
  const platformHealth: Health = !lastSync ? 'warn' : lastSync.status === 'failed' ? 'error' : lastSync.status === 'partial' ? 'warn' : 'ok';
  const gasHealth: Health = rate('gas') < 0.97 ? 'warn' : 'ok';

  return (
    <div className="flex flex-col items-stretch gap-1 lg:flex-row lg:items-center">
      <Node
        icon={RadioTower}
        title="外部見守り端末"
        health={deviceHealth}
        to="/devices"
        lines={[`Online ${stats.devicesOnline}/${stats.devicesTotal}台・Offline ${stats.devicesOffline}台`, `回答 ${stats.bySource.device}件・最終 ${formatRelative(api.device.lastCommunicationAt, now)}`]}
      />
      <Connector label="信号／回答" bidirectional />
      <Node
        icon={Database}
        title="Webシステム（安否データ）"
        health={gasHealth}
        to="/safety"
        center
        lines={[`回答済み ${stats.answered}/${stats.targets}名・重複 ${stats.duplicates}件`, `GAS保存 最終 ${formatRelative(api.gas.lastCommunicationAt, now)}`]}
      />
      <Connector label="通知／回答" bidirectional />
      <Node
        icon={MessageCircle}
        title="LINE"
        health={lineHealth}
        to="/line"
        lines={[`送信 ${stats.lineSent}名・回答 ${stats.bySource.line}件`, `最終 ${formatRelative(api.line.lastCommunicationAt, now)}`]}
      />
      <Connector label="安否送信" />
      <Node
        icon={Share2}
        title="外部プラットフォーム"
        health={platformHealth}
        to="/platform"
        lines={[`前回 ${lastSync ? `${lastSync.success}/${lastSync.total}件 成功` : '未送信'}`, `未送信 ${queue}件・${lastSync ? formatRelative(lastSync.finishedAt ?? lastSync.startedAt, now) : ''}`]}
      />
    </div>
  );
}
