import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Layers, Loader2, PlayCircle, RotateCcw, Square, X, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useEventStats } from '@/hooks/useEventStats';
import { cancelSimulation, runDisasterSimulation } from '@/workflows/simulation';
import { formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import type { SimulationStep } from '@/types';

const SPEEDS = [1, 2, 4];

function StepIcon({ state }: { state: SimulationStep['state'] }) {
  if (state === 'done') return <CheckCircle2 className="size-[18px] text-emerald-600" aria-label="完了" />;
  if (state === 'running') return <Loader2 className="size-[18px] animate-spin text-sky-600" aria-label="実行中" />;
  if (state === 'error') return <XCircle className="size-[18px] text-orange-600" aria-label="中断" />;
  return <Circle className="size-[18px] text-slate-300" aria-label="未実行" />;
}

export function SimulationPanel() {
  const sim = useAppStore((s) => s.simulation);
  const setSimulation = useAppStore((s) => s.setSimulation);
  const usersById = useAppStore((s) => s.usersById);
  const stats = useEventStats();
  const [collapsed, setCollapsed] = useState(false);

  if (!sim.visible) return null;
  const done = sim.steps.filter((s) => s.state === 'done').length;
  const current = sim.steps.find((s) => s.state === 'running');
  const hl = sim.highlight;

  return (
    <section
      className="animate-slide-in fixed inset-x-2 bottom-16 z-40 flex max-h-[70dvh] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl md:inset-x-auto md:bottom-4 md:left-4 md:w-[380px] lg:left-64"
      aria-label="災害発生シミュレーション"
    >
      <header className="flex items-center gap-2 border-b border-line bg-brand-950 px-4 py-2.5 text-white">
        <PlayCircle className="size-4 text-brand-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">災害発生シミュレーション</p>
          <p className="truncate text-[11px] text-slate-300">
            {sim.running ? `実行中: ${current?.label ?? '準備中'}` : sim.finishedAt ? `完了 ${formatTime(sim.finishedAt)}` : '待機中'}（{done}/{sim.steps.length}）
          </p>
        </div>
        <button className="rounded p-1 hover:bg-white/10" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? '展開' : '折りたたむ'}>
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {!sim.running && (
          <button className="rounded p-1 hover:bg-white/10" onClick={() => setSimulation({ visible: false })} aria-label="閉じる">
            <X className="size-4" />
          </button>
        )}
      </header>
      <div className="h-1 bg-slate-100">
        <div className="h-full bg-brand-500 transition-[width] duration-500" style={{ width: `${(done / sim.steps.length) * 100}%` }} />
      </div>

      {!collapsed && (
        <>
          <div className="grid grid-cols-4 divide-x divide-line border-b border-line text-center">
            {[
              ['回答済み', stats.answered],
              ['未回答', stats.unanswered],
              ['重複', stats.duplicates],
              ['送信失敗', stats.dispatchFailed],
            ].map(([l, v]) => (
              <div key={l} className="py-2">
                <p className="text-[10px] text-ink-muted">{l}</p>
                <p className="tabular text-base font-bold text-ink">{v}</p>
              </div>
            ))}
          </div>

          <ol className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
            {sim.steps.map((s, i) => (
              <li key={s.id} className={cn('flex gap-2.5 rounded-lg px-2 py-1.5', s.state === 'running' && 'bg-sky-50')}>
                <StepIcon state={s.state} />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-xs font-semibold', s.state === 'pending' ? 'text-ink-muted' : 'text-ink')}>
                    {i + 1}. {s.label}
                  </p>
                  {s.detail && <p className="text-[11px] leading-snug text-ink-soft">{s.detail}</p>}
                  {s.id === 'adopt' && s.state === 'done' && hl && (
                    <div className="mt-1.5 rounded-lg border border-brand-200 bg-brand-50/50 p-2 text-[11px]">
                      <p className="mb-1 flex items-center gap-1 font-semibold text-brand-800">
                        <Layers className="size-3" /> 例：
                        <Link to={`/users/${hl.userId}`} className="underline">
                          {usersById[hl.userId]?.name}
                        </Link>
                      </p>
                      <p>
                        <span className="mr-1 rounded bg-brand-700 px-1 text-[10px] text-white">採用回答</span>
                        {hl.primary.source} / <span className="tabular">{formatTime(hl.primary.at)}</span> / {hl.primary.status}
                      </p>
                      <p className="mt-0.5 text-ink-soft">
                        <span className="mr-1 rounded bg-slate-200 px-1 text-[10px] text-ink-soft">追加回答</span>
                        {hl.additional.source} / <span className="tabular">{formatTime(hl.additional.at)}</span> / {hl.additional.status}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <footer className="flex items-center gap-2 border-t border-line px-3 py-2.5">
            <div className="flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label="再生速度">
              {SPEEDS.map((sp) => (
                <button
                  key={sp}
                  role="radio"
                  aria-checked={sim.speed === sp}
                  onClick={() => setSimulation({ speed: sp })}
                  className={cn('tabular rounded-md px-2 py-1 text-[11px] font-semibold', sim.speed === sp ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}
                >
                  {sp}x
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              {sim.running ? (
                <Button size="sm" variant="danger" icon={Square} onClick={cancelSimulation}>
                  中断
                </Button>
              ) : (
                <>
                  <Link to="/logs" className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-brand-700 hover:bg-brand-50">
                    ログを確認
                  </Link>
                  <Button size="sm" variant="primary" icon={RotateCcw} onClick={() => void runDisasterSimulation()}>
                    もう一度
                  </Button>
                </>
              )}
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
