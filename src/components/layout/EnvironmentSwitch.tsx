import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Environment } from '@/types';
import { useAppStore } from '@/store/appStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

export function EnvironmentSwitch() {
  const environment = useAppStore((s) => s.environment);
  const setEnvironment = useAppStore((s) => s.setEnvironment);
  const pushToast = useAppStore((s) => s.pushToast);
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);

  const select = (env: Environment) => {
    if (env === environment) return;
    if (env === 'production') {
      setAck(false);
      setConfirming(true);
    } else {
      setEnvironment('test');
      pushToast({ tone: 'info', title: 'テスト環境に切り替えました', message: 'テスト用APIへ接続しています。' });
    }
  };

  return (
    <>
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold tracking-wide" role="radiogroup" aria-label="接続環境">
        {(['test', 'production'] as const).map((env) => {
          const active = env === environment;
          return (
            <button
              key={env}
              role="radio"
              aria-checked={active}
              onClick={() => select(env)}
              className={cn(
                'rounded-md px-2 py-1 transition-colors sm:px-2.5',
                active && env === 'test' && 'bg-sky-600 text-white shadow-sm',
                active && env === 'production' && 'bg-red-600 text-white shadow-sm',
                !active && 'text-ink-muted hover:text-ink',
              )}
            >
              {env === 'test' ? 'TEST' : 'PRODUCTION'}
            </button>
          );
        })}
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="本番環境へ切り替えますか？"
        tone="emergency"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              キャンセル
            </Button>
            <Button
              variant="emergency"
              disabled={!ack}
              onClick={() => {
                setEnvironment('production');
                setConfirming(false);
                pushToast({ tone: 'warning', title: '本番環境に切り替えました', message: '操作は実データに影響する可能性があります（デモではモックのみ）。' });
              }}
            >
              本番環境に切り替える
            </Button>
          </>
        }
      >
        <div className="flex gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />
          <p>本番環境では、緊急モードの送信や外部プラットフォームへの送信が実際の利用者・連携先に影響する可能性があります。</p>
        </div>
        <p className="mt-3 text-xs text-ink-muted">※ 本デモでは本番環境を選択しても実データ・実APIは使用されません。</p>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-red-600" />
          本番環境での操作であることを理解しました
        </label>
      </Modal>
    </>
  );
}
