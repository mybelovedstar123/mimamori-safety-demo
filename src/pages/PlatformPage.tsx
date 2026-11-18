import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Database, Send, Share2, ShieldCheck, XCircle } from 'lucide-react';
import type { PlatformSync } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useNow } from '@/hooks/useNow';
import { countQueueByStatus, getPlatformQueue, syncToPlatform } from '@/workflows/platform';
import { PLATFORM_BATCH_SIZE } from '@/services/platformApi';
import { getEndpoint } from '@/services/config';
import { formatDateTime, formatRelative, formatTime } from '@/utils/format';
import { ERROR_INFO } from '@/utils/errors';
import { STATUS_LABEL } from '@/utils/labels';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badges';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, PageHeader, ProgressBar } from '@/components/ui/misc';
import { STATUS_META, STATUS_ORDER } from '@/components/ui/statusMeta';

const SYNC_STATUS: Record<PlatformSync['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  running: { label: '送信中', tone: 'info' },
  success: { label: '成功', tone: 'success' },
  partial: { label: '一部失敗', tone: 'warning' },
  failed: { label: '失敗', tone: 'danger' },
};

const TRIGGER_LABEL: Record<PlatformSync['trigger'], string> = { manual: '手動', simulation: 'シミュレーション', auto: '自動（15分毎）' };

export function PlatformPage() {
  const records = useAppStore((s) => s.records);
  const event = useAppStore((s) => s.event);
  const syncs = useAppStore((s) => s.platformSyncs);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const environment = useAppStore((s) => s.environment);
  const now = useNow(15_000);
  const [confirm, setConfirm] = useState(false);
  const [ack, setAck] = useState(false);
  const sync = useAsyncAction(syncToPlatform, { errorTitle: '外部プラットフォームへの送信に失敗しました' });

  // records の更新に合わせて送信待ちキューを再計算
  const queue = useMemo(() => (records ? getPlatformQueue() : []), [records]);
  const byStatus = useMemo(() => countQueueByStatus(queue), [queue]);
  const latest = syncs[0];
  const running = latest?.status === 'running';

  const start = () => {
    setConfirm(false);
    void sync.run('manual');
  };

  return (
    <div className="space-y-4">
      <PageHeader title="外部プラットフォーム連携" description="当システムで集約した安否情報を、連携先の外部防災プラットフォームへ送信します。" />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="送信前の確認" icon={Database} subtitle={`接続先: ${getEndpoint(environment, 'platform').baseUrl}`} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-brand-50/70 p-3">
                <p className="text-[11px] text-ink-muted">対象件数（未送信）</p>
                <p className="tabular text-2xl font-bold">{queue.length}件</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-ink-muted">送信対象</p>
                <p className="text-sm font-semibold">{event ? event.id : '—'}</p>
                <p className="text-[11px] text-ink-muted">{Math.ceil(queue.length / PLATFORM_BATCH_SIZE)}バッチ</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-ink-muted">最終同期</p>
                <p className="tabular text-sm font-semibold">{formatTime(lastSyncAt)}</p>
                <p className="text-[11px] text-ink-muted">{formatRelative(lastSyncAt, now)}</p>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-ink-muted">送信対象の内訳（安否状態）</p>
              <ProgressBar segments={STATUS_ORDER.map((s) => ({ label: STATUS_LABEL[s], value: byStatus[s], color: STATUS_META[s].color }))} />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
                {STATUS_ORDER.map((s) => (
                  <span key={s}>
                    {STATUS_LABEL[s]} <b className="tabular text-ink">{byStatus[s]}</b>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 rounded-lg bg-slate-50 p-3 text-xs text-ink-soft">
              <ShieldCheck className="size-4 shrink-0 text-brand-600" />
              送信項目は「対象者ID・地区・安否状態・回答経路・回答時刻・追加回答の有無」のみです。氏名・住所・電話番号は外部へ送信しません。
            </div>
            <Button variant="primary" size="lg" icon={Send} className="w-full sm:w-auto" disabled={!event || queue.length === 0} loading={sync.loading || running} onClick={() => (environment === 'production' ? (setAck(false), setConfirm(true)) : start())}>
              外部プラットフォームへ送信
            </Button>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="送信結果" icon={Share2} subtitle={latest ? `${latest.id}・${formatDateTime(latest.startedAt)}` : '送信履歴はありません'} />
          <CardBody>
            {latest ? (
              <div className="space-y-3">
                <ResultRow icon={CheckCircle2} color="text-emerald-600" label="成功" value={latest.success} />
                <ResultRow icon={XCircle} color="text-orange-600" label="失敗" value={latest.failed} />
                <ResultRow icon={Clock} color="text-slate-500" label="未送信（送信待ち）" value={queue.length} />
                {latest.error && (
                  <div className="flex gap-2 rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-xs text-orange-900">
                    <AlertTriangle className="size-4 shrink-0" />
                    {ERROR_INFO[latest.error].message} {ERROR_INFO[latest.error].hint}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState title="送信はまだ行われていません" />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="送信履歴" />
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">送信ID</th>
                <th className="px-3 py-2.5">開始</th>
                <th className="px-3 py-2.5">状態</th>
                <th className="px-3 py-2.5 text-right">件数</th>
                <th className="px-3 py-2.5 text-right">成功</th>
                <th className="px-3 py-2.5 text-right">失敗</th>
                <th className="px-3 py-2.5">トリガー</th>
                <th className="px-3 py-2.5">環境</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {syncs.map((s) => (
                <tr key={s.id}>
                  <td className="tabular px-4 py-2.5 font-medium">{s.id}</td>
                  <td className="tabular px-3 py-2.5 text-ink-soft">{formatDateTime(s.startedAt)}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={SYNC_STATUS[s.status].tone}>{SYNC_STATUS[s.status].label}</Badge>
                    {s.error && <span className="ml-1.5 text-[11px] text-ink-muted">{ERROR_INFO[s.error].label}</span>}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{s.total}</td>
                  <td className="tabular px-3 py-2.5 text-right text-emerald-700">{s.success}</td>
                  <td className="tabular px-3 py-2.5 text-right">{s.failed ? <span className="font-semibold text-orange-800">{s.failed}</span> : 0}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-soft">{TRIGGER_LABEL[s.trigger]}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={s.environment === 'production' ? 'danger' : 'info'}>{s.environment === 'production' ? 'PROD' : 'TEST'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="本番の外部プラットフォームへ送信しますか？"
        tone="emergency"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              キャンセル
            </Button>
            <Button variant="emergency" disabled={!ack} onClick={start}>
              送信する
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">{queue.length}件の安否情報を本番環境の連携先へ送信します。</p>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-red-600" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          送信内容と送信先が本番環境であることを確認しました
        </label>
      </Modal>
    </div>
  );
}

function ResultRow({ icon: Icon, color, label, value }: { icon: typeof Clock; color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5">
      <Icon className={`size-5 ${color}`} />
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="tabular ml-auto text-xl font-bold">{value}件</span>
    </div>
  );
}
