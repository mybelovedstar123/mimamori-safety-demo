import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  MessageCircle,
  RadioTower,
  SendHorizonal,
  Users,
  Wifi,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useEventStats } from '@/hooks/useEventStats';
import { useNow } from '@/hooks/useNow';
import { bucketResponses, summarizeRegions } from '@/domain/stats';
import { REGIONS } from '@/data/regions';
import { percent } from '@/utils/format';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/misc';
import { EmergencyAlert } from '@/components/dashboard/EmergencyAlert';
import { IntegrationFlow } from '@/components/dashboard/IntegrationFlow';
import { UnansweredList } from '@/components/safety/UnansweredList';
import { DispatchProgress } from '@/components/emergency/DispatchProgress';
import { LogItem } from '@/components/logs/LogItem';
import {
  ApiSuccessChart,
  DeviceConnectionChart,
  HourlyResponsesChart,
  RegionUnansweredChart,
  ResponseRateChart,
  SourceBreakdownChart,
} from '@/components/charts/Charts';

export function DashboardPage() {
  const stats = useEventStats();
  const event = useAppStore((s) => s.event);
  const records = useAppStore((s) => s.records);
  const users = useAppStore((s) => s.users);
  const apiStats = useAppStore((s) => s.apiStats);
  const logs = useAppStore((s) => s.logs);
  const usersById = useAppStore((s) => s.usersById);
  const navigate = useNavigate();
  const now = useNow(20_000);

  const hourly = useMemo(() => bucketResponses(records, event, now), [records, event, now]);
  const regions = useMemo(() => summarizeRegions(REGIONS, users, records, event), [users, records, event]);
  const recentLogs = useMemo(() => logs.filter((l) => l.category !== 'audit').slice(0, 8), [logs]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="ダッシュボード"
        description={event ? '誰が無事か・誰が未回答か・どこで問題が起きているかを一目で確認できます。' : '平常時の見守り状況を表示しています。'}
        actions={
          <>
            <ButtonLink to="/safety?tab=unanswered" size="sm" icon={Clock}>
              未回答者一覧
            </ButtonLink>
            <ButtonLink to="/map" size="sm" variant="subtle">
              地図で確認
            </ButtonLink>
          </>
        }
      />

      <EmergencyAlert />

      <section aria-label="主要指標" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        <KpiCard label="本日の安否確認対象者" value={stats.targets} unit="名" icon={CalendarCheck} accent="brand" hint={event ? `${event.regionIds.length}地区・${event.id}` : '安否確認は実施されていません'} />
        <KpiCard label="回答済み" value={stats.answered} unit="名" icon={CheckCircle2} accent="safe" hint={`回答率 ${percent(stats.answered, stats.targets)}・無事 ${stats.byStatus.safe}名`} to="/safety?filter=safe" />
        <KpiCard label="未回答" value={stats.unanswered} unit="名" icon={Clock} accent="pending" hint="送信済みで回答がない方" to="/safety?tab=unanswered" />
        <KpiCard
          label="要確認"
          value={stats.attention}
          unit="名"
          icon={AlertTriangle}
          accent={stats.byStatus.emergency > 0 ? 'emergency' : 'support'}
          highlight={stats.byStatus.emergency > 0}
          hint={`緊急 ${stats.byStatus.emergency}・要支援 ${stats.byStatus.needs_support}・連絡不能 ${stats.byStatus.unreachable}・不一致 ${stats.conflicts}`}
          to="/safety?filter=attention"
        />
        <KpiCard label="送信失敗" value={stats.dispatchFailed} unit="件" icon={SendHorizonal} accent="error" hint="再送信・電話確認が必要" to="/safety?tab=failed" />
      </section>
      <section aria-label="連携指標" className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <KpiCard label="登録対象者数" value={stats.totalUsers} unit="名" icon={Users} to="/users" />
        <KpiCard label="見守り端末接続数" value={`${stats.devicesOnline}/${stats.devicesTotal}`} unit="台" icon={Wifi} hint={`Warning ${stats.devicesWarning}・Offline ${stats.devicesOffline}`} to="/devices" />
        <KpiCard label="LINE回答" value={stats.bySource.line} unit="件" icon={MessageCircle} hint={`LINE送信 ${stats.lineSent}名`} to="/safety?filter=line" />
        <KpiCard label="外部端末回答" value={stats.bySource.device} unit="件" icon={RadioTower} hint={`重複回答 ${stats.duplicates}名（先着採用）`} to="/safety?filter=device" />
      </section>

      <Card>
        <CardHeader title="連携ステータス" subtitle="外部見守り端末 ⇔ Webシステム ⇔ LINE ⇔ 外部プラットフォーム" />
        <CardBody>
          <IntegrationFlow />
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader title="安否回答率" subtitle="状態別の内訳" />
          <CardBody>
            <ResponseRateChart byStatus={stats.byStatus} total={stats.targets} answered={stats.answered} />
          </CardBody>
        </Card>
        <Card className="overflow-hidden lg:col-span-4">
          <CardHeader title="未回答者" subtitle="送信からの経過時間が長い順" actions={<span className="tabular text-sm font-bold">{stats.unanswered}名</span>} />
          <UnansweredList limit={7} showChannels={false} />
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title="緊急モード送信状況" subtitle="外部端末・LINEへの送信結果" />
          <CardBody>{event ? <DispatchProgress compact /> : <p className="text-sm text-ink-muted">送信はありません。</p>}</CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader title="時間別回答数" subtitle="回答経路別の積み上げ（発信時刻から）" />
          <CardBody>
            <HourlyResponsesChart data={hourly} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title="回答経路別比率" subtitle="正式採用された回答の経路" />
          <CardBody>
            <SourceBreakdownChart bySource={stats.bySource} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader title="地域別未回答数" subtitle="バーをクリックすると地図で表示" />
          <CardBody>
            <RegionUnansweredChart regions={regions} onSelect={(id) => navigate(`/map?region=${id}`)} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title="API成功率" subtitle="累計リクエストに対する成功割合" />
          <CardBody>
            <ApiSuccessChart stats={Object.values(apiStats)} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="端末接続状況" subtitle={`全${stats.devicesTotal}台`} />
          <CardBody>
            <DeviceConnectionChart online={stats.devicesOnline} warning={stats.devicesWarning} offline={stats.devicesOffline} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="最新のアクティビティ" subtitle="API通信・安否回答の流れ" actions={<ButtonLink to="/logs" size="sm" variant="ghost">すべてのログ</ButtonLink>} />
        <CardBody className="py-2">
          <ul className="divide-y divide-line">
            {recentLogs.map((l) => (
              <LogItem key={l.id} log={l} userName={l.userId ? usersById[l.userId]?.name : undefined} compact />
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
