import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCw, Search } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { resendAllFailed, resendDevice } from '@/workflows/emergency';
import { ERROR_INFO } from '@/utils/errors';
import { formatTime } from '@/utils/format';
import { regionName } from '@/data/regions';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badges';
import { EmptyState } from '@/components/ui/misc';

function ResendButton({ userId }: { userId: string }) {
  const { run, loading } = useAsyncAction(resendDevice, { errorTitle: '再送信に失敗しました' });
  const sending = useAppStore((s) => s.records[userId]?.dispatch.device.state === 'sending');
  return (
    <Button size="sm" variant="secondary" icon={RotateCw} loading={loading || sending} onClick={() => void run(userId)}>
      再送信
    </Button>
  );
}

export function FailedDispatchList({ limit }: { limit?: number }) {
  const event = useAppStore((s) => s.event);
  const records = useAppStore((s) => s.records);
  const usersById = useAppStore((s) => s.usersById);
  const { run: runAll, loading: allLoading } = useAsyncAction(resendAllFailed);

  const failed = useMemo(
    () => (event ? event.targetUserIds.filter((id) => records[id]?.dispatch.device.state === 'failed' || records[id]?.dispatch.line.state === 'failed') : []),
    [event, records],
  );

  if (!failed.length) return <EmptyState title="送信失敗はありません" description="すべての外部端末・LINEへの送信が完了しています。" />;
  const rows = limit ? failed.slice(0, limit) : failed;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-orange-50/50 px-4 py-2.5">
        <AlertTriangle className="size-4 text-orange-600" aria-hidden />
        <p className="text-sm font-semibold text-orange-900">外部端末への送信に失敗しました（{failed.length}件）</p>
        <Button size="sm" variant="secondary" icon={RotateCw} className="ml-auto" loading={allLoading} onClick={() => void runAll()}>
          失敗分をまとめて再送信
        </Button>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((id) => {
          const u = usersById[id];
          const r = records[id];
          const ch = r.dispatch.device.state === 'failed' ? r.dispatch.device : r.dispatch.line;
          const isDevice = r.dispatch.device.state === 'failed';
          const info = ch.error ? ERROR_INFO[ch.error] : null;
          return (
            <li key={id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-[160px] flex-1">
                <Link to={`/users/${id}`} className="text-sm font-semibold text-ink hover:text-brand-700 hover:underline">
                  {u.name}
                </Link>
                <p className="text-[11px] text-ink-muted">
                  {regionName(u.regionId)}・{isDevice ? u.deviceId : 'LINE'}・試行 {ch.attempts}回・{formatTime(ch.lastAttemptAt)}
                </p>
              </div>
              <div className="min-w-[180px] flex-1">
                <Badge tone="orange">{info?.label ?? '不明なエラー'}</Badge>
                <p className="mt-1 text-[11px] text-ink-muted">{info?.hint}</p>
              </div>
              <div className="flex gap-2">
                {isDevice && <ResendButton userId={id} />}
                <ButtonLink to={isDevice && u.deviceId ? `/devices/${u.deviceId}` : `/users/${id}`} size="sm" variant="ghost" icon={Search}>
                  詳細確認
                </ButtonLink>
              </div>
            </li>
          );
        })}
      </ul>
      {limit && failed.length > limit && (
        <Link to="/safety?tab=failed" className="block border-t border-line px-4 py-2.5 text-center text-xs font-medium text-brand-700 hover:bg-slate-50">
          残り {failed.length - limit}件を表示
        </Link>
      )}
    </div>
  );
}
