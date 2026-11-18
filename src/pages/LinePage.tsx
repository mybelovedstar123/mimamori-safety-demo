import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Link2, MessageCircle, Send, UserCheck, Users } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useEventStats } from '@/hooks/useEventStats';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { receiveLineWebhook } from '@/workflows/responses';
import { buildLineWebhook } from '@/services/mock/inbound';
import { getEndpoint } from '@/services/config';
import { LINE_REPLY_OPTIONS } from '@/domain/validation';
import { regionName } from '@/data/regions';
import { formatRelative, formatTime } from '@/utils/format';
import { maskKeyId, maskSecret } from '@/utils/mask';
import { useNow } from '@/hooks/useNow';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badges';
import { DefinitionList, EmptyState, PageHeader } from '@/components/ui/misc';
import type { SafetyStatus } from '@/types';

export function LinePage() {
  const users = useAppStore((s) => s.users);
  const records = useAppStore((s) => s.records);
  const event = useAppStore((s) => s.event);
  const environment = useAppStore((s) => s.environment);
  const lineStats = useAppStore((s) => s.apiStats.line);
  const pushToast = useAppStore((s) => s.pushToast);
  const stats = useEventStats();
  const now = useNow(15_000);
  const linked = useMemo(() => users.filter((u) => u.line.linked), [users]);
  const [testUser, setTestUser] = useState(linked[0]?.id ?? '');
  const endpoint = getEndpoint(environment, 'line');

  const send = useAsyncAction(
    async (text: string) => {
      const res = await receiveLineWebhook(buildLineWebhook(testUser, text));
      if (!res) {
        pushToast({ tone: 'warning', title: '判定できないメッセージを破棄しました', message: 'ログに記録しました。' });
        return;
      }
      pushToast({
        tone: 'success',
        title: res.outcome === 'adopted' ? 'LINE回答を正式回答として採用しました' : 'LINE回答を追記として保存しました',
        message: res.outcome === 'adopted' ? '最初に届いた回答のため採用されました。' : '先着回答があるため、追加回答として記録しました（先着採用ルール）。',
      });
    },
    { errorTitle: 'LINE回答を処理できませんでした' },
  );

  const recent = useMemo(() => {
    if (!event) return [];
    const items: { userId: string; status: SafetyStatus; at: string; primary: boolean }[] = [];
    for (const id of event.targetUserIds) {
      const r = records[id]?.response;
      if (!r) continue;
      if (r.source === 'line') items.push({ userId: id, status: r.status, at: r.receivedAt, primary: true });
      r.additionalResponses.filter((a) => a.source === 'line').forEach((a) => items.push({ userId: id, status: a.status, at: a.receivedAt, primary: false }));
    }
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);
  }, [event, records]);

  const usersById = useAppStore((s) => s.usersById);
  const lineUnanswered = event ? event.targetUserIds.filter((id) => records[id]?.dispatch.line.state === 'sent' && !records[id]?.response).length : 0;

  return (
    <div className="space-y-4">
      <PageHeader title="LINE連携" description="LINE Messaging API を通じた安否確認メッセージの送信と回答の受信状況です。" />
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <KpiCard label="LINE連携者" value={linked.length} unit="名" icon={Users} accent="brand" hint={`全${users.length}名中`} />
        <KpiCard label="今回の送信" value={stats.lineSent} unit="名" icon={Send} hint={`対象 ${stats.lineTarget}名`} />
        <KpiCard label="LINE回答（正式採用）" value={stats.bySource.line} unit="件" icon={UserCheck} accent="safe" />
        <KpiCard label="LINE送信済み・未回答" value={lineUnanswered} unit="名" icon={MessageCircle} accent="pending" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="チャネル設定" icon={Link2} subtitle="認証情報はマスク表示しています" />
          <CardBody>
            <DefinitionList
              className="sm:grid-cols-1"
              items={[
                { label: '接続先', value: <span className="break-all">{endpoint.baseUrl}</span> },
                { label: 'Webhook URL', value: <span className="break-all text-ink-soft">https://mimamori.example.jp/webhook/line/****</span> },
                { label: 'チャネルアクセストークン', value: <span className="tabular">{maskSecret()}</span> },
                { label: 'キー識別子', value: maskKeyId(endpoint.keyId) },
                { label: '認証状態', value: <Badge tone={lineStats.authStatus === 'valid' ? 'success' : 'danger'}>{lineStats.authStatus === 'valid' ? '有効' : '無効'}</Badge> },
                { label: '最終通信', value: `${formatTime(lineStats.lastCommunicationAt)}（${formatRelative(lineStats.lastCommunicationAt, now)}）` },
              ]}
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="LINE回答を受信（テスト）" icon={Bot} subtitle="利用者のLINE画面を模擬。クイックリプライを押すとWebhookとして受信処理します。" />
          <CardBody>
            <label className="block text-xs font-medium text-ink-soft">
              送信者（LINE連携済みの対象者）
              <select value={testUser} onChange={(e) => setTestUser(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm">
                {linked.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}（{regionName(u.regionId)}）{records[u.id]?.response ? ' ― 回答済み' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="mx-auto mt-4 max-w-sm rounded-2xl bg-[#8ca6c3]/25 p-3">
              <div className="flex gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-700 text-[10px] font-bold text-white">防災</span>
                <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm shadow-sm">
                  【{event?.title ?? '安否確認'}】
                  <br />
                  ご無事ですか？下のボタンで教えてください。
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {LINE_REPLY_OPTIONS.map((t) => (
                  <button
                    key={t}
                    disabled={!event || send.loading || !testUser}
                    onClick={() => void send.run(t)}
                    className="rounded-full border border-[#06c755] bg-white px-3 py-1.5 text-xs font-semibold text-[#05a346] hover:bg-[#06c755]/10 disabled:opacity-40"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {!event && <p className="mt-2 text-center text-xs text-ink-muted">安否確認の実施中のみ回答を受け付けます。</p>}
            <div className="mt-3 flex justify-center">
              <Button size="sm" variant="ghost" disabled={!event || !testUser} onClick={() => void send.run('スタンプ')}>
                判定できないメッセージを送る（検証テスト）
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="最近のLINE回答" subtitle="正式採用・追記の両方を表示" />
        {recent.length === 0 ? (
          <EmptyState title="LINE回答はまだありません" />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((r, i) => (
              <li key={`${r.userId}-${i}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className="tabular w-16 text-xs text-ink-muted">{formatTime(r.at)}</span>
                <Link to={`/users/${r.userId}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {usersById[r.userId]?.name}
                </Link>
                <Badge tone={r.primary ? 'brand' : 'neutral'}>{r.primary ? '採用回答' : '追記'}</Badge>
                <StatusBadge status={r.status} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
