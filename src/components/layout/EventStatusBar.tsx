import { useState } from 'react';
import { PlayCircle, ShieldCheck, Siren, Square } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useEventStats } from '@/hooks/useEventStats';
import { useNow } from '@/hooks/useNow';
import { formatElapsed, formatTime, percent } from '@/utils/format';
import { DISASTER_LABEL } from '@/utils/labels';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { closeEmergencyEvent } from '@/workflows/emergency';
import { runDisasterSimulation } from '@/workflows/simulation';

export function EventStatusBar() {
  const event = useAppStore((s) => s.event);
  const simRunning = useAppStore((s) => s.simulation.running);
  const setWizardOpen = useAppStore((s) => s.setWizardOpen);
  const stats = useEventStats();
  const now = useNow(1000);
  const [confirmClose, setConfirmClose] = useState(false);

  const simButton = (
    <Button size="sm" variant="secondary" icon={PlayCircle} onClick={() => void runDisasterSimulation()} disabled={simRunning} loading={simRunning}>
      <span className="hidden sm:inline">災害発生シミュレーション</span>
      <span className="sm:hidden">シミュレーション</span>
    </Button>
  );

  if (!event) {
    return (
      <div className="border-b border-emerald-100 bg-emerald-50/70">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-5">
          <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900">平常時 見守り中</p>
            <p className="text-[11px] text-emerald-800/80">緊急モードは無効です。日常の見守りデータを受信しています。</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {simButton}
            <Button size="sm" variant="emergency" icon={Siren} onClick={() => setWizardOpen(true)}>
              緊急モードを開始
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-red-200 bg-gradient-to-r from-red-50 via-red-50/70 to-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex size-3 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-3 rounded-full bg-red-600" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-red-800">
              災害時安否確認 実施中
              <span className="rounded bg-red-600 px-1.5 py-px text-[10px] font-bold text-white">緊急モード</span>
            </p>
            <p className="truncate text-[11px] text-red-900/80">
              {DISASTER_LABEL[event.type]}｜{event.title}｜{event.id}｜開始 {formatTime(event.startedAt, false)}（経過 {formatElapsed(event.startedAt, now)}）
            </p>
          </div>
        </div>
        <div className="flex min-w-[180px] flex-1 items-center gap-2 sm:max-w-xs">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-red-100">
            <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${stats.responseRate * 100}%` }} />
          </div>
          <span className="tabular text-xs font-semibold text-ink">回答率 {percent(stats.answered, stats.targets)}</span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {simButton}
          <Button size="sm" variant="emergency" icon={Siren} onClick={() => setWizardOpen(true)} disabled={simRunning}>
            <span className="hidden sm:inline">緊急モード送信</span>
            <span className="sm:hidden">送信</span>
          </Button>
          <Button size="sm" variant="ghost" icon={Square} onClick={() => setConfirmClose(true)} disabled={simRunning} aria-label="安否確認を終了">
            <span className="hidden md:inline">安否確認を終了</span>
            <span className="md:hidden">終了</span>
          </Button>
        </div>
      </div>

      <Modal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="安否確認を終了しますか？"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClose(false)}>
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                closeEmergencyEvent();
                setConfirmClose(false);
              }}
            >
              終了して平常時に戻す
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          未回答 <b className="text-ink">{stats.unanswered}名</b>・要確認 <b className="text-ink">{stats.attention}名</b> が残っています。終了すると結果は履歴として保存され、端末は通常見守りモードに戻ります。
        </p>
      </Modal>
    </div>
  );
}
