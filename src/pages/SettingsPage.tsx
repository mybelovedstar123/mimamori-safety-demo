import { useState } from 'react';
import { Database, FlaskConical, RotateCcw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { DATA_SOURCE } from '@/services/config';
import { apiClient } from '@/services/apiClient';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/misc';

function Slider({ label, value, min, max, step, format, onChange, hint }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void; hint: string }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular font-semibold text-brand-700">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-brand-700" />
      <p className="text-[11px] text-ink-muted">{hint}</p>
    </label>
  );
}

export function SettingsPage() {
  const faults = useAppStore((s) => s.faults);
  const setFaults = useAppStore((s) => s.setFaults);
  const resetDemo = useAppStore((s) => s.resetDemo);
  const simRunning = useAppStore((s) => s.simulation.running);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="space-y-4">
      <PageHeader title="設定" description="デモ環境の障害シミュレーションやデータ初期化を行います。" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="障害シミュレーション（モックAPI）" icon={SlidersHorizontal} subtitle="エラー処理の確認用。実通信は行いません。" />
          <CardBody className="space-y-5">
            <Slider label="端末API タイムアウト発生率" value={faults.timeoutRate} min={0} max={0.3} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setFaults({ timeoutRate: v })} hint="緊急モード送信時に API Timeout を発生させる確率（自動再試行あり）" />
            <Slider label="外部プラットフォーム送信失敗率" value={faults.platformFailureRate} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setFaults({ platformFailureRate: v })} hint="バッチ単位で送信失敗（Timeout）を発生させる確率" />
            <Slider label="ネットワーク遅延倍率" value={faults.latencyFactor} min={0.2} max={3} step={0.1} format={(v) => `×${v.toFixed(1)}`} onChange={(v) => setFaults({ latencyFactor: v })} hint="モックAPIの応答時間に掛ける倍率" />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="データソース" icon={Database} />
            <CardBody className="space-y-2 text-sm">
              <p>
                現在の通信方式：<b>{apiClient.transportName}</b>（VITE_DATA_SOURCE={DATA_SOURCE}）
              </p>
              <p className="text-xs text-ink-muted">
                service層（deviceApi / lineApi / safetyApi / platformApi）は共通の ApiClient を経由しており、Transport を差し替えるだけで Google Apps Script + Google Spreadsheet や実APIへ移行できます。
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="セキュリティ設計" icon={ShieldCheck} />
            <CardBody>
              <ul className="list-disc space-y-1 pl-5 text-xs text-ink-soft">
                <li>APIキーはソースコード・フロントエンドに保持せず、GASスクリプトプロパティ等で管理</li>
                <li>接続先URLなどは環境変数（.env）から読み込み</li>
                <li>画面・ログの認証情報は常に「************」でマスク</li>
                <li>住所・電話番号は既定でマスクし、表示操作を監査ログに記録</li>
                <li>外部プラットフォームへは氏名・住所を送信しない</li>
                <li>本番環境への切替・送信時は確認チェックを必須化</li>
                <li>デモデータはすべて架空</li>
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="デモデータ" icon={FlaskConical} />
            <CardBody className="space-y-2">
              <p className="text-xs text-ink-muted">対象者・端末・回答・ログを初期状態（安否確認 実施中）に戻します。</p>
              <Button icon={RotateCcw} variant="danger" disabled={simRunning} onClick={() => setConfirmReset(true)}>
                デモデータを初期化
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="デモデータを初期化しますか？"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                resetDemo();
                setConfirmReset(false);
              }}
            >
              初期化する
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">操作で追加された回答・ログ・通知はすべて破棄されます。</p>
      </Modal>
    </div>
  );
}
