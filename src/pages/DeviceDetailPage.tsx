import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bug, CheckCircle2, Clock, Info, RadioTower, RotateCw, Stethoscope, XCircle } from 'lucide-react';
import type { DeviceEvent } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useNow } from '@/hooks/useNow';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { checkDeviceStatus, simulateCorruptPayload, simulateDeviceButton } from '@/workflows/devices';
import { resendDevice } from '@/workflows/emergency';
import { DEVICE_BUTTONS } from '@/domain/validation';
import { regionName } from '@/data/regions';
import { formatDateTime, formatRelative, formatTime } from '@/utils/format';
import { API_STATUS_LABEL, DEVICE_MODE_LABEL } from '@/utils/labels';
import { cn } from '@/utils/cn';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Badge, ConnectionBadge, DispatchBadge } from '@/components/ui/Badges';
import { BatteryMeter, DefinitionList, EmptyState, SignalBars } from '@/components/ui/misc';

type HistTab = 'all' | 'response' | 'error';

const KIND_LABEL: Record<DeviceEvent['kind'], string> = {
  heartbeat: '定期通信',
  emergency_signal: '緊急モード信号',
  response: '安否回答',
  error: 'エラー',
  mode_change: 'モード変更',
};

export function DeviceDetailPage() {
  const { deviceId = '' } = useParams();
  const device = useAppStore((s) => s.devices[deviceId]);
  const user = useAppStore((s) => (device ? s.usersById[device.userId] : undefined));
  const record = useAppStore((s) => (device ? s.records[device.userId] : undefined));
  const event = useAppStore((s) => s.event);
  const now = useNow(10_000);
  const [tab, setTab] = useState<HistTab>('all');
  const check = useAsyncAction(checkDeviceStatus, { errorTitle: '端末から応答がありません' });
  const resend = useAsyncAction(resendDevice);
  const press = useAsyncAction(simulateDeviceButton, { errorTitle: '回答を処理できませんでした' });
  const corrupt = useAsyncAction(simulateCorruptPayload);

  const history = useMemo(() => {
    if (!device) return [];
    const h = [...device.history].sort((a, b) => b.at.localeCompare(a.at));
    return tab === 'all' ? h : h.filter((e) => e.kind === tab);
  }, [device, tab]);

  if (!device || !user) {
    return (
      <Card>
        <EmptyState title="端末が見つかりません" description={deviceId} />
      </Card>
    );
  }
  const errors = device.history.filter((e) => e.kind === 'error').length;
  const responses = device.history.filter((e) => e.kind === 'response').length;
  const lastComm = device.lastCommunicationAt;

  return (
    <div className="space-y-4">
      <Link to="/devices" className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> 見守り端末一覧へ戻る
      </Link>

      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3">
            <span className={cn('grid size-14 place-items-center rounded-2xl', device.connection === 'offline' ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-700')}>
              <RadioTower className="size-7" />
            </span>
            <div>
              <h1 className="tabular text-xl font-bold">{device.id}</h1>
              <p className="text-xs text-ink-muted">
                {device.model}・FW {device.firmware}・利用者{' '}
                <Link to={`/users/${user.id}`} className="font-medium text-brand-700 hover:underline">
                  {user.name}
                </Link>
                （{regionName(user.regionId)}）
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <ConnectionBadge state={device.connection} />
            <Badge tone={device.mode === 'emergency' ? 'danger' : 'neutral'}>{DEVICE_MODE_LABEL[device.mode]}</Badge>
            <Badge tone={device.apiStatus === 'connected' ? 'success' : 'orange'}>API: {API_STATUS_LABEL[device.apiStatus]}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 sm:px-5">
          <Button size="sm" icon={Stethoscope} loading={check.loading} onClick={() => void check.run(device.id)}>
            疎通確認
          </Button>
          {record?.dispatch.device.state === 'failed' && (
            <Button size="sm" icon={RotateCw} variant="primary" loading={resend.loading} onClick={() => void resend.run(user.id)}>
              緊急モード信号を再送信
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader title="基本情報" icon={Info} />
            <CardBody>
              <DefinitionList
                items={[
                  { label: '端末ID', value: device.id },
                  { label: '機種', value: device.model },
                  { label: 'ファームウェア', value: device.firmware },
                  { label: '利用者', value: user.name },
                  { label: 'バッテリー', value: <BatteryMeter value={device.battery} /> },
                  { label: '電波強度', value: <SignalBars value={device.connection === 'offline' ? 0 : device.signal} /> },
                  { label: '現在のモード', value: DEVICE_MODE_LABEL[device.mode] },
                  { label: 'API接続状態', value: API_STATUS_LABEL[device.apiStatus] },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="最終通信" icon={Clock} />
            <CardBody>
              <p className="tabular text-2xl font-bold">{formatTime(lastComm)}</p>
              <p className="text-xs text-ink-muted">
                {formatDateTime(lastComm)}（{formatRelative(lastComm, now)}）
              </p>
              {device.connection === 'offline' && <p className="mt-2 rounded-lg bg-slate-100 p-2 text-xs text-ink-soft">定期通信が途絶えています。電源・設置場所の確認を家族または地区担当者へ依頼してください。</p>}
              {event && record && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-line p-2.5">
                  <span className="text-xs text-ink-muted">今回の緊急モード送信</span>
                  <DispatchBadge state={record.dispatch.device.state} />
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="端末操作のシミュレーション" subtitle="外部端末から届くWebhookをモックで再現します" icon={Bug} />
            <CardBody className="space-y-2">
              {!event && <p className="text-xs text-ink-muted">安否確認の実施中のみ回答を受け付けます。</p>}
              <div className="flex flex-wrap gap-2">
                {DEVICE_BUTTONS.map((b) => (
                  <Button key={b.code} size="sm" variant={b.code === 'BTN_SOS' ? 'danger' : 'secondary'} disabled={!event} loading={press.loading} onClick={() => void press.run(device.id, b.code)}>
                    {b.label}
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="ghost" icon={Bug} loading={corrupt.loading} onClick={() => void corrupt.run(device.id)}>
                不正なデータを送信（検証テスト）
              </Button>
              <p className="text-[11px] text-ink-muted">LINEで回答済みの方の場合は「追加回答」として記録され、先着回答は変わりません。</p>
            </CardBody>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader title="履歴" subtitle="通信履歴・安否回答履歴・エラー履歴" />
          <div className="border-b border-line px-4 py-2.5 sm:px-5">
            <Tabs<HistTab>
              value={tab}
              onChange={setTab}
              items={[
                { id: 'all', label: '通信履歴', count: device.history.length },
                { id: 'response', label: '安否回答履歴', count: responses },
                { id: 'error', label: 'エラー履歴', count: errors, alert: true },
              ]}
            />
          </div>
          {history.length === 0 ? (
            <EmptyState title="履歴はありません" />
          ) : (
            <ol className="relative px-4 py-3 sm:px-5">
              <span className="absolute top-5 bottom-5 left-[29px] w-px bg-line sm:left-[33px]" aria-hidden />
              {history.map((h) => (
                <li key={h.id} className="relative flex gap-3 py-2">
                  <span className={cn('relative z-10 grid size-7 shrink-0 place-items-center rounded-full ring-4 ring-white', h.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600')}>
                    {h.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold">{KIND_LABEL[h.kind]}</span>
                      <span className="tabular text-[11px] text-ink-muted">{formatDateTime(h.at)}</span>
                    </div>
                    <p className="text-xs text-ink-soft">{h.message}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
