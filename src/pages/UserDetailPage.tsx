import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, CheckSquare, History, MessageCircle, PencilLine, RadioTower, RotateCw, ShieldCheck, UserRound } from 'lucide-react';
import type { SafetyRecord, SafetyStatus, User, Device, EmergencyEvent } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useNow } from '@/hooks/useNow';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { getEffectiveStatus, hasConflict } from '@/domain/safety';
import { resendDevice } from '@/workflows/emergency';
import { regionName } from '@/data/regions';
import { formatDateTime, formatElapsed, formatRelative, formatTime } from '@/utils/format';
import { maskAddress, maskPhone } from '@/utils/mask';
import { ERROR_INFO } from '@/utils/errors';
import { API_STATUS_LABEL, DEVICE_MODE_LABEL, DISPATCH_LABEL, SOURCE_LABEL, STATUS_LABEL } from '@/utils/labels';
import { cn } from '@/utils/cn';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { BatteryMeter, DefinitionList, EmptyState } from '@/components/ui/misc';
import { ConnectionBadge, DispatchBadge, SeverityBadge, SourceBadge, StatusBadge } from '@/components/ui/Badges';
import { PiiField } from '@/components/ui/PiiField';
import { FirstComeRuleNote, ResponseDetail } from '@/components/safety/ResponseDetail';
import { ManualResponseModal } from '@/components/safety/ManualResponseModal';
import { LogItem } from '@/components/logs/LogItem';
import { STATUS_META } from '@/components/ui/statusMeta';

const NEXT_ACTION: Record<SafetyStatus, string> = {
  emergency: '至急：119番通報・地区担当者／民生委員への出動依頼を検討してください。',
  needs_support: '支援内容を電話で確認し、地区の支援者へ連絡してください。',
  unreachable: 'すべての連絡手段で届いていません。緊急連絡先への電話、または訪問確認を手配してください。',
  unconfirmed: '回答を待っています。一定時間経過後は電話で確認してください。',
  safe: '無事が確認されています。追加の対応は不要です。',
};

function describe(user: User, record: SafetyRecord | undefined, event: EmergencyEvent | null, now: number): string {
  if (!event || !record) return `平常時の見守り中です。最終見守りは${formatRelative(user.lastWatchAt, now)}です。`;
  if (record.manualStatus) {
    return `管理者が${formatTime(record.manualStatus.at, false)}に「${STATUS_LABEL[record.manualStatus.status]}」に確定しました（${record.manualStatus.reason}）。`;
  }
  const r = record.response;
  if (r) {
    const extra = r.additionalResponses.length ? `。その後 ${r.additionalResponses.map((a) => `${SOURCE_LABEL[a.source]}「${STATUS_LABEL[a.status]}」`).join('、')} の追加回答あり` : '';
    return `${SOURCE_LABEL[r.source]}で${formatTime(r.receivedAt)}に「${STATUS_LABEL[r.status]}」と回答しました${extra}。`;
  }
  const { device, line } = record.dispatch;
  const parts = [
    device.state !== 'skipped' && `外部端末: ${DISPATCH_LABEL[device.state]}${device.error ? `（${ERROR_INFO[device.error].label}）` : ''}`,
    line.state !== 'skipped' && `LINE: ${DISPATCH_LABEL[line.state]}`,
  ].filter(Boolean);
  const since = device.lastAttemptAt ?? line.lastAttemptAt ?? event.startedAt;
  return `送信から${formatElapsed(since, now)}経過、まだ回答がありません。${parts.length ? parts.join('／') : '通知手段がありません（電話のみ）'}。`;
}

export function UserDetailPage() {
  const { userId = '' } = useParams();
  const user = useAppStore((s) => s.usersById[userId]);
  const record = useAppStore((s) => s.records[userId]);
  const device = useAppStore((s) => (user?.deviceId ? s.devices[user.deviceId] : undefined));
  const event = useAppStore((s) => s.event);
  const archive = useAppStore((s) => s.eventArchive);
  const logs = useAppStore((s) => s.logs);
  const notifications = useAppStore((s) => s.notifications);
  const now = useNow(15_000);
  const [modal, setModal] = useState<'response' | 'confirm' | null>(null);
  const resend = useAsyncAction(resendDevice);

  const userLogs = useMemo(() => logs.filter((l) => l.userId === userId).slice(0, 30), [logs, userId]);
  const userNotifications = useMemo(() => notifications.filter((n) => n.userId === userId), [notifications, userId]);

  if (!user) {
    return (
      <Card>
        <EmptyState title="対象者が見つかりません" description={`ID: ${userId}`} />
      </Card>
    );
  }

  const status = event && record ? getEffectiveStatus(record) : null;
  const conflict = hasConflict(record);
  const meta = status ? STATUS_META[status] : null;

  return (
    <div className="space-y-4">
      <Link to="/safety" className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> 安否確認一覧へ戻る
      </Link>

      {/* 現在の状態（最重要） */}
      <Card className={cn('overflow-hidden', status === 'emergency' && 'border-red-300 ring-2 ring-red-100')}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-slate-100 text-ink-soft">
              <UserRound className="size-7" />
            </span>
            <div>
              <p className="text-[11px] text-ink-muted">{user.kana}</p>
              <h1 className="text-xl font-bold text-ink">{user.name}</h1>
              <p className="tabular text-xs text-ink-muted">
                {user.id}・{user.age}歳・{regionName(user.regionId)}・{user.careLevel}
                {user.livesAlone && '・一人暮らし'}
              </p>
            </div>
          </div>
          <div className="flex-1 rounded-xl bg-slate-50 p-3.5 sm:ml-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-ink-muted">現在の状態</p>
              {status ? <StatusBadge status={status} size="lg" /> : <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">平常時 見守り中</span>}
              {conflict && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">回答不一致・要確認</span>}
            </div>
            <p className="mt-2 text-sm text-ink">{describe(user, record, event, now)}</p>
            {status && (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-soft">
                {meta && <meta.icon className="mt-0.5 size-3.5 shrink-0" style={{ color: meta.color }} />}
                {NEXT_ACTION[status]}
              </p>
            )}
          </div>
        </div>
        {event && record && (
          <div className="flex flex-wrap gap-2 border-t border-line bg-white px-4 py-3 sm:px-5">
            <Button size="sm" variant="primary" icon={PencilLine} onClick={() => setModal('response')}>
              回答を入力（電話・管理者）
            </Button>
            <Button size="sm" icon={CheckSquare} onClick={() => setModal('confirm')}>
              状態を管理者確定
            </Button>
            {record.dispatch.device.state === 'failed' && (
              <Button size="sm" icon={RotateCw} loading={resend.loading} onClick={() => void resend.run(user.id)}>
                外部端末へ再送信
              </Button>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="回答履歴" subtitle={event ? `${event.title}（${event.id}）` : '実施中の安否確認はありません'} icon={MessageCircle} />
            <CardBody className="space-y-3">
              {record?.response ? (
                <>
                  <ResponseDetail response={record.response} />
                  {record.response.additionalResponses.length > 0 && <FirstComeRuleNote />}
                </>
              ) : (
                <p className="text-sm text-ink-muted">まだ回答はありません。</p>
              )}
              {record && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <DispatchInfo label="外部端末への送信" ch={record.dispatch.device} />
                  <DispatchInfo label="LINEへの送信" ch={record.dispatch.line} />
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="安否確認履歴" subtitle="過去の安否確認・訓練の結果" icon={History} />
            <ul className="divide-y divide-line">
              {event && (
                <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-[11px] text-ink-muted">{formatDateTime(event.startedAt)}・実施中</p>
                  </div>
                  {status && <StatusBadge status={status} size="sm" />}
                </li>
              )}
              {archive.map((a) => {
                const res = a.results[user.id];
                if (!res) return null;
                return (
                  <li key={a.event.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.event.title}</p>
                      <p className="text-[11px] text-ink-muted">
                        {formatDateTime(a.event.startedAt)}
                        {res.at && `・回答 ${formatTime(res.at, false)}`}
                      </p>
                    </div>
                    {res.source && <SourceBadge source={res.source} muted />}
                    <StatusBadge status={res.status} size="sm" />
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="通信・操作ログ" subtitle="この対象者に関するAPI通信と操作" icon={RadioTower} />
            <CardBody className="py-2">
              {userLogs.length ? (
                <ul className="divide-y divide-line">
                  {userLogs.map((l) => (
                    <LogItem key={l.id} log={l} />
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-sm text-ink-muted">ログはありません。</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="基本情報" icon={ShieldCheck} subtitle="個人情報は「表示」操作時のみ表示し、監査ログに記録します" />
            <CardBody>
              <DefinitionList
                className="sm:grid-cols-1"
                items={[
                  { label: '氏名', value: `${user.name}（${user.gender === 'female' ? '女性' : '男性'}・${user.age}歳）` },
                  { label: '地域', value: regionName(user.regionId) },
                  { label: '住所（デモ用・架空）', value: <PiiField value={user.address} masked={maskAddress(user.address)} field="住所" userId={user.id} /> },
                  {
                    label: '緊急連絡先',
                    value: (
                      <span>
                        {user.emergencyContact.name}（{user.emergencyContact.relation}）
                        <br />
                        <PiiField value={user.emergencyContact.phone} masked={maskPhone(user.emergencyContact.phone)} field="緊急連絡先電話番号" userId={user.id} />
                      </span>
                    ),
                  },
                  { label: '最終見守り', value: `${formatDateTime(user.lastWatchAt)}（${formatRelative(user.lastWatchAt, now)}）` },
                  { label: '備考', value: user.notes || '—' },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="見守り端末" icon={RadioTower} actions={device && <ButtonLink to={`/devices/${device.id}`} size="sm" variant="ghost">詳細</ButtonLink>} />
            <CardBody>{device ? <DeviceSummary device={device} now={now} /> : <p className="text-sm text-ink-muted">見守り端末は設置されていません。</p>}</CardBody>
          </Card>

          <Card>
            <CardHeader title="LINE連携" icon={MessageCircle} />
            <CardBody>
              {user.line.linked ? (
                <DefinitionList
                  className="sm:grid-cols-1"
                  items={[
                    { label: '連携状態', value: <span className="font-semibold text-emerald-700">連携済み</span> },
                    { label: '表示名', value: user.line.displayName },
                    { label: '連携日', value: formatDateTime(user.line.linkedAt) },
                    { label: 'LINEユーザーID', value: <span className="tabular text-ink-muted">U************</span> },
                  ]}
                />
              ) : (
                <p className="text-sm text-ink-muted">LINE未連携です。家族や支援者のLINE登録を案内できます。</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="通知履歴" icon={Bell} />
            {userNotifications.length ? (
              <ul className="divide-y divide-line">
                {userNotifications.map((n) => (
                  <li key={n.id} className="px-4 py-2.5 sm:px-5">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={n.severity} />
                      <span className="tabular ml-auto text-[11px] text-ink-muted">{formatTime(n.at)}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-ink-muted">{n.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-sm text-ink-muted">通知はありません。</p>
              </CardBody>
            )}
          </Card>
        </div>
      </div>

      <ManualResponseModal user={modal ? user : null} mode={modal ?? 'response'} onClose={() => setModal(null)} />
    </div>
  );
}

function DispatchInfo({ label, ch }: { label: string; ch: SafetyRecord['dispatch']['device'] }) {
  return (
    <div className="rounded-lg border border-line p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">{label}</p>
        <DispatchBadge state={ch.state} />
      </div>
      {ch.state !== 'skipped' && (
        <p className="tabular mt-1 text-[11px] text-ink-muted">
          試行 {ch.attempts}回・{formatTime(ch.lastAttemptAt)}
          {ch.error && <span className="ml-1 font-semibold text-orange-800">{ERROR_INFO[ch.error].label}</span>}
        </p>
      )}
    </div>
  );
}

function DeviceSummary({ device, now }: { device: Device; now: number }) {
  return (
    <DefinitionList
      items={[
        { label: '端末ID', value: <span className="tabular">{device.id}</span> },
        { label: '接続状態', value: <ConnectionBadge state={device.connection} /> },
        { label: 'バッテリー', value: <BatteryMeter value={device.battery} /> },
        { label: '現在のモード', value: DEVICE_MODE_LABEL[device.mode] },
        { label: 'API接続', value: API_STATUS_LABEL[device.apiStatus] },
        { label: '最終通信', value: formatRelative(device.lastCommunicationAt, now) },
      ]}
    />
  );
}
