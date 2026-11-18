import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import type { SafetyStatus } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useSafetyRows } from '@/hooks/useSafetyRows';
import { summarizeRegions } from '@/domain/stats';
import { CITY_NAME, REGIONS, REGION_BY_ID } from '@/data/regions';
import { polygonPoints } from '@/utils/geometry';
import { STATUS_LABEL } from '@/utils/labels';
import { cn } from '@/utils/cn';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badges';
import { PageHeader, ProgressBar } from '@/components/ui/misc';
import { STATUS_META, STATUS_ORDER } from '@/components/ui/statusMeta';

function Marker({ status, x, y }: { status: SafetyStatus; x: number; y: number }) {
  const c = STATUS_META[status].color;
  switch (status) {
    case 'emergency':
      return (
        <g>
          <circle cx={x} cy={y} r={15} fill={c} opacity={0.18}>
            <animate attributeName="r" values="9;17;9" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx={x} cy={y} r={8.5} fill={c} stroke="#fff" strokeWidth={2} />
          <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff">
            !
          </text>
        </g>
      );
    case 'unreachable':
      return <rect x={x - 6} y={y - 6} width={12} height={12} transform={`rotate(45 ${x} ${y})`} fill={c} stroke="#fff" strokeWidth={1.5} />;
    case 'unconfirmed':
      return <circle cx={x} cy={y} r={6} fill="#fff" stroke="#5f6866" strokeWidth={2.2} />;
    case 'needs_support':
      return <circle cx={x} cy={y} r={7} fill={c} stroke="#8a5a00" strokeWidth={1.5} />;
    default:
      return <circle cx={x} cy={y} r={5.5} fill={c} stroke="#fff" strokeWidth={1.5} />;
  }
}

export function MapPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('region');
  const rows = useSafetyRows();
  const users = useAppStore((s) => s.users);
  const records = useAppStore((s) => s.records);
  const event = useAppStore((s) => s.event);
  const [visible, setVisible] = useState<Set<SafetyStatus>>(new Set(STATUS_ORDER));
  const [hover, setHover] = useState<{ x: number; y: number; name: string; status: SafetyStatus } | null>(null);

  const summaries = useMemo(() => summarizeRegions(REGIONS, users, records, event), [users, records, event]);
  const regionRows = useMemo(() => (selected ? rows.filter((r) => r.user.regionId === selected) : []), [rows, selected]);
  const sel = selected ? summaries.find((s) => s.region.id === selected) : null;

  const select = (id: string | null) => setParams(id ? { region: id } : {});
  const toggleStatus = (s: SafetyStatus) => {
    const next = new Set(visible);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setVisible(next);
  };

  // 描画順: 重要な状態を上に重ねる
  const drawOrder = useMemo(() => [...rows].filter((r) => visible.has(r.status)).reverse(), [rows, visible]);

  return (
    <div className="space-y-4">
      <PageHeader title="地図" description={`${CITY_NAME}の対象者位置と安否状態（デモ用の簡易地図・位置は架空）。地域をクリックすると対象者一覧を表示します。`} />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
            <span className="text-xs text-ink-muted">表示：</span>
            {STATUS_ORDER.map((s) => {
              const Icon = STATUS_META[s].icon;
              const on = visible.has(s);
              const count = rows.filter((r) => r.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  aria-pressed={on}
                  className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset', on ? 'bg-white text-ink ring-line' : 'bg-slate-100 text-ink-muted line-through ring-transparent')}
                >
                  <Icon className="size-3.5" style={{ color: on ? STATUS_META[s].color : undefined }} />
                  {STATUS_LABEL[s]}
                  <span className="tabular font-semibold">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative bg-[#eef3ef]">
            <svg viewBox="0 0 1000 680" className="block h-auto w-full" role="img" aria-label={`${CITY_NAME} 地図`}>
              <defs>
                <pattern id="hatch-flood" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="10" stroke="#2a78d6" strokeWidth="1.2" opacity="0.18" />
                </pattern>
                <pattern id="hatch-land" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                  <line x1="0" y1="0" x2="0" y2="10" stroke="#a16207" strokeWidth="1.2" opacity="0.2" />
                </pattern>
              </defs>
              {/* 海・川・道路（装飾） */}
              <rect x="0" y="0" width="1000" height="680" fill="#eef3ef" />
              <path d="M0 0 H34 C26 160 44 330 30 500 C22 580 34 640 40 680 H0 Z" fill="#cfe3f3" />
              <path d="M960 40 C880 180 820 260 760 330 C700 400 690 470 640 560 C610 610 600 650 590 680" fill="none" stroke="#b9d6ee" strokeWidth="20" strokeLinecap="round" />
              {REGIONS.map((r) => {
                const s = summaries.find((x) => x.region.id === r.id)!;
                const unansweredRate = s.total ? s.byStatus.unconfirmed / s.total : 0;
                const isSel = selected === r.id;
                return (
                  <g key={r.id} onClick={() => select(isSel ? null : r.id)} className="cursor-pointer" role="button" aria-label={`${r.name}を選択`}>
                    <polygon points={polygonPoints(r.polygon)} fill={isSel ? '#d5f1ec' : '#fbfcfa'} fillOpacity={isSel ? 0.95 : 0.55 + unansweredRate * 0.4} stroke={isSel ? '#1f756c' : '#c4ccc6'} strokeWidth={isSel ? 3 : 1.5} />
                    {r.hazard !== 'none' && <polygon points={polygonPoints(r.polygon)} fill={`url(#${r.hazard === 'flood' ? 'hatch-flood' : 'hatch-land'})`} pointerEvents="none" />}
                  </g>
                );
              })}
              <g stroke="#ffffff" strokeWidth="7" fill="none" opacity="0.9" pointerEvents="none">
                <path d="M40 260 C300 245 640 225 960 300" />
                <path d="M470 40 C480 250 460 470 450 640" />
              </g>
              {REGIONS.map((r) => {
                const s = summaries.find((x) => x.region.id === r.id)!;
                return (
                  <g key={`lbl-${r.id}`} pointerEvents="none">
                    <text x={r.labelAt[0]} y={r.labelAt[1] - 30} textAnchor="middle" fontSize={17} fontWeight={700} fill="#1c2321" stroke="#fff" strokeWidth={4} paintOrder="stroke">
                      {r.name}
                    </text>
                    <text x={r.labelAt[0]} y={r.labelAt[1] - 12} textAnchor="middle" fontSize={12} fill="#4b5552" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                      未回答 {s.byStatus.unconfirmed}／{s.total}名
                    </text>
                  </g>
                );
              })}
              {drawOrder.map((r) => (
                <g
                  key={r.user.id}
                  onMouseEnter={() => setHover({ x: r.user.position[0], y: r.user.position[1], name: r.user.name, status: r.status })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => select(r.user.regionId)}
                  className="cursor-pointer"
                >
                  <circle cx={r.user.position[0]} cy={r.user.position[1]} r={12} fill="transparent" />
                  <Marker status={r.status} x={r.user.position[0]} y={r.user.position[1]} />
                </g>
              ))}
            </svg>
            {hover && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-lg"
                style={{ left: `${(hover.x / 1000) * 100}%`, top: `calc(${(hover.y / 680) * 100}% - 12px)` }}
              >
                <p className="font-semibold">{hover.name}</p>
                <p className="text-ink-muted">{STATUS_LABEL[hover.status]}</p>
              </div>
            )}
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded bg-white/90 px-1.5 py-0.5 text-sky-800">斜線（青）: 浸水想定区域</span>
              <span className="rounded bg-white/90 px-1.5 py-0.5 text-amber-800">斜線（茶）: 土砂災害警戒区域</span>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {sel ? (
            <>
              <CardHeader
                title={`${sel.region.name}の対象者（${sel.total}名）`}
                subtitle={sel.region.hazard === 'flood' ? '浸水想定区域' : sel.region.hazard === 'landslide' ? '土砂災害警戒区域' : '一般区域'}
                actions={
                  <button onClick={() => select(null)} className="rounded p-1 text-ink-muted hover:bg-slate-100" aria-label="選択解除">
                    <X className="size-4" />
                  </button>
                }
              />
              <div className="border-b border-line p-4">
                <ProgressBar segments={STATUS_ORDER.map((s) => ({ label: STATUS_LABEL[s], value: sel.byStatus[s], color: STATUS_META[s].color }))} />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-soft">
                  {STATUS_ORDER.map((s) => (
                    <span key={s}>
                      {STATUS_LABEL[s]} <b className="tabular text-ink">{sel.byStatus[s]}</b>
                    </span>
                  ))}
                </div>
              </div>
              <ul className="scrollbar-thin max-h-[520px] divide-y divide-line overflow-y-auto">
                {regionRows.map((r) => (
                  <li key={r.user.id}>
                    <Link to={`/users/${r.user.id}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.user.name}</p>
                        <p className="text-[11px] text-ink-muted">
                          {r.user.age}歳{r.user.livesAlone ? '・一人暮らし' : ''}
                          {r.conflict && '・回答不一致'}
                        </p>
                      </div>
                      <StatusBadge status={r.status} size="sm" />
                      <ChevronRight className="size-4 text-ink-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <CardHeader title="地域別の状況" subtitle="地域を選択すると対象者を表示します" />
              <ul className="divide-y divide-line">
                {summaries.map((s) => (
                  <li key={s.region.id}>
                    <button onClick={() => select(s.region.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-sm font-semibold">{REGION_BY_ID[s.region.id].name}</span>
                        {s.region.hazard === 'flood' && <Badge tone="info">浸水想定</Badge>}
                        {s.region.hazard === 'landslide' && <Badge tone="warning">土砂災害</Badge>}
                        {s.byStatus.emergency > 0 && <Badge className="bg-red-600 text-white ring-red-700">緊急 {s.byStatus.emergency}</Badge>}
                        <span className="tabular ml-auto text-xs text-ink-muted">
                          未回答 <b className="text-ink">{s.byStatus.unconfirmed}</b>／{s.total}
                        </span>
                      </div>
                      <ProgressBar height="h-2" segments={STATUS_ORDER.map((st) => ({ label: STATUS_LABEL[st], value: s.byStatus[st], color: STATUS_META[st].color }))} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
