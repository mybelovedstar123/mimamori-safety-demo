import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, MessageCircle, PhoneCall, RadioTower, Send, Users, WifiOff } from 'lucide-react';
import type { DisasterType, User } from '@/types';
import { useAppStore } from '@/store/appStore';
import { REGIONS, regionName } from '@/data/regions';
import { DISASTER_LABEL } from '@/utils/labels';
import { cn } from '@/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badges';
import { SearchInput } from '@/components/ui/misc';
import { dispatchEmergency, startEmergencyEvent } from '@/workflows/emergency';
import { DispatchProgress } from './DispatchProgress';
import { FailedDispatchList } from './FailedDispatchList';

type Group = 'all' | 'alone' | 'care' | 'custom';

const GROUPS: { id: Group; label: string; description: string; filter: (u: User) => boolean }[] = [
  { id: 'all', label: '全登録者', description: '登録されているすべての対象者', filter: () => true },
  { id: 'alone', label: '一人暮らしの方', description: '同居家族がいない対象者', filter: (u) => u.livesAlone },
  { id: 'care', label: '要介護認定の方', description: '要介護1以上（避難に支援が必要）', filter: (u) => u.careLevel.startsWith('要介護') },
  { id: 'custom', label: '個別に指定', description: '氏名・IDで検索して選択', filter: () => true },
];

const STEPS = ['対象者を選択', '対象地域を選択', '対象人数確認', '送信確認', '送信状況'];

const TITLE_PRESET: Record<DisasterType, string> = {
  earthquake: '地震発生に伴う安否確認',
  flood: '大雨・洪水警報に伴う安否確認',
  landslide: '土砂災害警戒情報に伴う安否確認',
  typhoon: '台風接近に伴う安否確認',
  other: '安否確認',
};

export function EmergencyWizard() {
  const open = useAppStore((s) => s.wizardOpen);
  const setOpen = useAppStore((s) => s.setWizardOpen);
  const users = useAppStore((s) => s.users);
  const devices = useAppStore((s) => s.devices);
  const environment = useAppStore((s) => s.environment);
  const activeEvent = useAppStore((s) => s.event);
  const dispatchRunning = useAppStore((s) => s.dispatchRun.running);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [group, setGroup] = useState<Group>('all');
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [regionIds, setRegionIds] = useState<Set<string>>(new Set(REGIONS.map((r) => r.id)));
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [type, setType] = useState<DisasterType>('earthquake');
  const [title, setTitle] = useState(TITLE_PRESET.earthquake);
  const [channels, setChannels] = useState({ device: true, line: true });
  const [ack, setAck] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setAck(false);
      setExcluded(new Set());
    }
  }, [open]);

  const groupUsers = useMemo(() => {
    const g = GROUPS.find((x) => x.id === group)!;
    return group === 'custom' ? users.filter((u) => customIds.has(u.id)) : users.filter(g.filter);
  }, [group, users, customIds]);

  const targets = useMemo(() => groupUsers.filter((u) => regionIds.has(u.regionId) && !excluded.has(u.id)), [groupUsers, regionIds, excluded]);

  const breakdown = useMemo(() => {
    let device = 0;
    let offline = 0;
    let line = 0;
    let none = 0;
    for (const u of targets) {
      const hasDev = channels.device && !!u.deviceId;
      const hasLine = channels.line && u.line.linked;
      if (hasDev) {
        device += 1;
        if (devices[u.deviceId!].connection === 'offline' || devices[u.deviceId!].apiStatus !== 'connected') offline += 1;
      }
      if (hasLine) line += 1;
      if (!hasDev && !hasLine) none += 1;
    }
    return { device, offline, line, none };
  }, [targets, devices, channels]);

  const close = () => {
    if (!dispatchRunning) setOpen(false);
  };

  const send = () => {
    const event = startEmergencyEvent({ title, type, regionIds: [...regionIds], userIds: targets.map((u) => u.id), channels });
    setStep(4);
    void dispatchEmergency(event);
  };

  const canNext =
    (step === 0 && groupUsers.length > 0) ||
    (step === 1 && regionIds.size > 0 && targets.length > 0) ||
    (step === 2 && targets.length > 0) ||
    (step === 3 && title.trim().length > 0 && (channels.device || channels.line) && (environment === 'test' || ack));

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return users.slice(0, 30);
    return users.filter((u) => u.name.includes(q) || u.kana.includes(q) || u.id.includes(q.toUpperCase())).slice(0, 30);
  }, [query, users]);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const footer =
    step < 4 ? (
      <>
        {step > 0 && (
          <Button variant="ghost" icon={ChevronLeft} onClick={() => setStep(step - 1)} className="mr-auto">
            戻る
          </Button>
        )}
        <Button variant="ghost" onClick={close}>
          キャンセル
        </Button>
        {step < 3 ? (
          <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            次へ
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button variant="emergency" icon={Send} disabled={!canNext} onClick={send}>
            外部端末へ送信
          </Button>
        )}
      </>
    ) : (
      <>
        <Button
          variant="secondary"
          disabled={dispatchRunning}
          onClick={() => {
            setOpen(false);
            navigate('/safety');
          }}
        >
          安否確認画面へ
        </Button>
        <Button variant="primary" disabled={dispatchRunning} onClick={close}>
          {dispatchRunning ? '送信中…' : '閉じる'}
        </Button>
      </>
    );

  return (
    <Modal
      open={open}
      onClose={close}
      locked={dispatchRunning}
      size="lg"
      tone="emergency"
      title="緊急モードを開始"
      subtitle="外部見守り端末・LINEへ安否確認の合図を送信します"
      footer={footer}
    >
      {/* ステッパー */}
      <ol className="mb-5 grid grid-cols-5 gap-1.5" aria-label="手順">
        {STEPS.map((label, i) => (
          <li key={label} className="min-w-0">
            <div className={cn('h-1.5 rounded-full', i < step ? 'bg-brand-600' : i === step ? 'bg-red-500' : 'bg-slate-200')} />
            <p className={cn('mt-1.5 hidden truncate text-[11px] sm:block', i === step ? 'font-semibold text-ink' : 'text-ink-muted')}>
              {i + 1}. {label}
            </p>
          </li>
        ))}
      </ol>
      <p className="mb-3 text-sm font-bold text-ink sm:hidden">
        {step + 1}. {STEPS[step]}
      </p>

      {step === 0 && (
        <div className="space-y-4">
          {activeEvent && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              実施中の安否確認（{activeEvent.id}）は終了し、結果を履歴に保存してから新しい安否確認を開始します。
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {GROUPS.map((g) => {
              const count = g.id === 'custom' ? customIds.size : users.filter(g.filter).length;
              return (
                <label key={g.id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors', group === g.id ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-line hover:bg-slate-50')}>
                  <input type="radio" name="group" className="mt-1 accent-brand-700" checked={group === g.id} onChange={() => setGroup(g.id)} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink">{g.label}</p>
                    <p className="text-xs text-ink-muted">{g.description}</p>
                  </div>
                  <span className="tabular text-sm font-bold text-ink">{count}名</span>
                </label>
              );
            })}
          </div>
          {group === 'custom' && (
            <div className="rounded-xl border border-line">
              <div className="border-b border-line p-3">
                <SearchInput value={query} onChange={setQuery} placeholder="氏名・ふりがな・ID で検索" />
              </div>
              <ul className="scrollbar-thin max-h-60 divide-y divide-line overflow-y-auto">
                {searchResults.map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                      <input type="checkbox" className="accent-brand-700" checked={customIds.has(u.id)} onChange={() => setCustomIds(toggle(customIds, u.id))} />
                      <span className="flex-1 text-sm">{u.name}</span>
                      <span className="text-xs text-ink-muted">{regionName(u.regionId)}</span>
                      <span className="tabular text-[11px] text-ink-muted">{u.id}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="subtle" onClick={() => setRegionIds(new Set(REGIONS.map((r) => r.id)))}>
              全地区
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setRegionIds(new Set(REGIONS.filter((r) => r.hazard === 'flood').map((r) => r.id)))}>
              浸水想定区域のみ
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setRegionIds(new Set(REGIONS.filter((r) => r.hazard === 'landslide').map((r) => r.id)))}>
              土砂災害警戒区域のみ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRegionIds(new Set())}>
              選択解除
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {REGIONS.map((r) => {
              const count = groupUsers.filter((u) => u.regionId === r.id).length;
              const checked = regionIds.has(r.id);
              return (
                <label key={r.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors', checked ? 'border-brand-500 bg-brand-50/40' : 'border-line hover:bg-slate-50')}>
                  <input type="checkbox" className="accent-brand-700" checked={checked} onChange={() => setRegionIds(toggle(regionIds, r.id))} />
                  <span className="flex-1 text-sm font-medium">{r.name}</span>
                  {r.hazard === 'flood' && <Badge tone="info">浸水想定</Badge>}
                  {r.hazard === 'landslide' && <Badge tone="warning">土砂災害警戒</Badge>}
                  <span className="tabular w-12 text-right text-sm font-bold">{count}名</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Summary icon={Users} label="対象人数" value={`${targets.length}名`} strong />
            <Summary icon={RadioTower} label="外部端末へ送信" value={`${breakdown.device}台`} />
            <Summary icon={MessageCircle} label="LINEへ送信" value={`${breakdown.line}名`} />
            <Summary icon={PhoneCall} label="通知手段なし" value={`${breakdown.none}名`} warn={breakdown.none > 0} />
          </div>
          {breakdown.offline > 0 && (
            <div className="flex gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
              <WifiOff className="size-4 shrink-0 text-orange-600" />
              Offline・API異常の端末が {breakdown.offline}台 あります。送信失敗となる可能性が高いため、LINE・電話での確認を併用してください。
            </div>
          )}
          <div className="rounded-xl border border-line">
            <p className="border-b border-line px-3 py-2 text-xs text-ink-muted">対象者一覧（チェックを外すと除外）</p>
            <ul className="scrollbar-thin max-h-64 divide-y divide-line overflow-y-auto">
              {groupUsers
                .filter((u) => regionIds.has(u.regionId))
                .map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                      <input type="checkbox" className="accent-brand-700" checked={!excluded.has(u.id)} onChange={() => setExcluded(toggle(excluded, u.id))} />
                      <span className="min-w-0 flex-1 truncate">{u.name}</span>
                      <span className="hidden text-xs text-ink-muted sm:inline">{regionName(u.regionId)}</span>
                      <span className="flex gap-1">
                        {u.deviceId && <Badge tone={devices[u.deviceId].connection === 'offline' ? 'orange' : 'neutral'}>端末</Badge>}
                        {u.line.linked && <Badge tone="info">LINE</Badge>}
                        {!u.deviceId && !u.line.linked && <Badge tone="warning">電話のみ</Badge>}
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <label className="block">
              <span className="text-xs font-medium text-ink-soft">災害種別</span>
              <select
                value={type}
                onChange={(e) => {
                  const t = e.target.value as DisasterType;
                  setType(t);
                  setTitle(TITLE_PRESET[t]);
                }}
                className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm"
              >
                {(Object.keys(DISASTER_LABEL) as DisasterType[]).map((t) => (
                  <option key={t} value={t}>
                    {DISASTER_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-soft">件名（LINEメッセージに表示）</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} className="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm" />
            </label>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-soft">送信チャネル</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {([
                ['device', '外部見守り端末', RadioTower],
                ['line', 'LINE', MessageCircle],
              ] as const).map(([key, label, Icon]) => (
                <label key={key} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', channels[key] ? 'border-brand-500 bg-brand-50/50' : 'border-line')}>
                  <input type="checkbox" className="accent-brand-700" checked={channels[key]} onChange={(e) => setChannels({ ...channels, [key]: e.target.checked })} />
                  <Icon className="size-4 text-ink-soft" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
            <p className="text-sm font-bold text-red-900">送信内容の確認</p>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              <li>
                対象：<b>{targets.length}名</b>（{[...regionIds].map(regionName).join('・')}）
              </li>
              <li>
                外部端末：<b>{channels.device ? `${breakdown.device}台` : '送信しない'}</b>／LINE：<b>{channels.line ? `${breakdown.line}名` : '送信しない'}</b>
              </li>
              <li>
                接続環境：
                <b className={environment === 'production' ? 'text-red-700' : 'text-sky-700'}>{environment === 'production' ? '本番環境（PRODUCTION）' : 'テスト環境（TEST）'}</b>
              </li>
            </ul>
            {environment === 'production' && (
              <label className="mt-3 flex items-start gap-2 rounded-lg bg-white p-2.5 text-sm text-red-900 ring-1 ring-red-200">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-red-600" />
                本番環境の実利用者へ送信されることを確認しました（デモではモック送信）
              </label>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <DispatchProgress />
          {!dispatchRunning && (
            <div className="overflow-hidden rounded-xl border border-line">
              <FailedDispatchList limit={5} />
            </div>
          )}
          {!dispatchRunning && (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Check className="size-4 text-emerald-600" /> 送信が完了しました。回答はリアルタイムに「安否確認」画面へ反映されます。
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function Summary({ icon: Icon, label, value, strong, warn }: { icon: typeof Users; label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-3', strong ? 'border-brand-200 bg-brand-50/60' : warn ? 'border-amber-200 bg-amber-50' : 'border-line')}>
      <p className="flex items-center gap-1 text-[11px] text-ink-muted">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="tabular mt-0.5 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}
