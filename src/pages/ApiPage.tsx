import { useMemo } from 'react';
import { KeyRound, Lock, PlugZap, ServerCog } from 'lucide-react';
import type { ApiEndpointStats, ApiServiceId } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useNow } from '@/hooks/useNow';
import { DATA_SOURCE, getEndpoint } from '@/services/config';
import { apiClient } from '@/services/apiClient';
import { deviceApi } from '@/services/deviceApi';
import { lineApi } from '@/services/lineApi';
import { platformApi } from '@/services/platformApi';
import { safetyApi } from '@/services/safetyApi';
import { formatRelative, formatTime } from '@/utils/format';
import { maskKeyId, maskSecret } from '@/utils/mask';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badges';
import { PageHeader } from '@/components/ui/misc';
import { LatencySparkline } from '@/components/charts/Charts';
import { LogItem } from '@/components/logs/LogItem';

const HEALTH_CHECK: Record<ApiServiceId, () => Promise<unknown>> = {
  device: deviceApi.healthCheck,
  line: lineApi.healthCheck,
  platform: platformApi.healthCheck,
  gas: safetyApi.healthCheck,
};

function EndpointCard({ stats }: { stats: ApiEndpointStats }) {
  const environment = useAppStore((s) => s.environment);
  const addLog = useAppStore((s) => s.addLog);
  const pushToast = useAppStore((s) => s.pushToast);
  const now = useNow(10_000);
  const ep = getEndpoint(environment, stats.id);
  const test = useAsyncAction(
    async () => {
      const started = performance.now();
      await HEALTH_CHECK[stats.id]();
      const ms = Math.round(performance.now() - started);
      addLog({ category: 'system', level: 'success', action: '接続テスト', message: `${stats.name}: 正常応答（${ms}ms）`, endpoint: `${ep.baseUrl}/health`, method: 'GET', statusCode: 200, durationMs: ms });
      pushToast({ tone: 'success', title: `${stats.name} 接続OK`, message: `応答時間 ${ms}ms` });
    },
    { errorTitle: `${stats.name} 接続テスト失敗` },
  );
  const rate = stats.requests ? (stats.success / stats.requests) * 100 : 100;

  return (
    <Card>
      <CardHeader
        title={stats.name}
        subtitle={stats.provider}
        icon={ServerCog}
        actions={
          <Button size="sm" icon={PlugZap} loading={test.loading} onClick={() => void test.run()}>
            接続テスト
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-[11px] text-ink-muted">API Endpoint（{environment === 'production' ? '本番' : 'テスト'}）</dt>
            <dd className="mt-0.5 rounded-md bg-slate-50 px-2 py-1 font-mono text-xs break-all text-ink-soft">{ep.baseUrl}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted">認証状態</dt>
            <dd className="mt-0.5">
              <Badge tone={stats.authStatus === 'valid' ? 'success' : 'danger'}>{stats.authStatus === 'valid' ? '認証済み' : stats.authStatus === 'expired' ? '期限切れ' : '認証エラー'}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted">APIキー</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-mono text-xs">
              <Lock className="size-3 text-ink-muted" />
              {maskSecret()}
              {ep.keyId && <span className="text-ink-muted">（ID {maskKeyId(ep.keyId)}）</span>}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted">最終通信</dt>
            <dd className="tabular mt-0.5">
              {formatTime(stats.lastCommunicationAt)} <span className="text-xs text-ink-muted">（{formatRelative(stats.lastCommunicationAt, now)}）</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted">平均レスポンスタイム</dt>
            <dd className="tabular mt-0.5 font-semibold">{stats.avgResponseMs}ms</dd>
          </div>
        </dl>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['リクエスト数', stats.requests.toLocaleString(), 'text-ink'],
            ['成功数', stats.success.toLocaleString(), 'text-emerald-700'],
            ['失敗数', stats.failed.toLocaleString(), stats.failed ? 'text-orange-800' : 'text-ink'],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-lg bg-slate-50 py-2">
              <p className="text-[10px] text-ink-muted">{l}</p>
              <p className={`tabular text-lg font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-ink-muted">
            <span>直近のレスポンスタイム</span>
            <span className="tabular">成功率 {rate.toFixed(1)}%</span>
          </div>
          <LatencySparkline values={stats.latencyHistory} />
        </div>
      </CardBody>
    </Card>
  );
}

export function ApiPage() {
  const apiStats = useAppStore((s) => s.apiStats);
  const logs = useAppStore((s) => s.logs);
  const errors = useMemo(() => logs.filter((l) => l.level === 'error' && (l.endpoint || l.statusCode)).slice(0, 12), [logs]);

  return (
    <div className="space-y-4">
      <PageHeader title="API連携" description="外部見守り端末・LINE・外部プラットフォーム・GASとの通信状況です。リクエストの計測値はリアルタイムに更新されます。" />

      <Card>
        <CardBody className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center">
          <KeyRound className="size-5 shrink-0 text-brand-700" />
          <div className="flex-1">
            <p className="font-semibold">
              通信方式：{apiClient.transportName}（VITE_DATA_SOURCE={DATA_SOURCE}）
            </p>
            <p className="text-xs text-ink-muted">
              APIキーなどの秘密情報はフロントエンドに保持せず、GASのスクリプトプロパティ／サーバー側で管理する設計です。画面・ログでは常にマスク表示されます。接続先URLは環境変数（.env）から読み込みます。
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {Object.values(apiStats).map((s) => (
          <EndpointCard key={s.id} stats={s} />
        ))}
      </div>

      <Card>
        <CardHeader title="最近のAPIエラー" subtitle="タイムアウト・認証エラー・端末オフラインなど" />
        <CardBody className="py-2">
          {errors.length ? (
            <ul className="divide-y divide-line">
              {errors.map((l) => (
                <LogItem key={l.id} log={l} />
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-ink-muted">エラーはありません。</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
