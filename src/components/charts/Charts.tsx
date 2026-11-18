import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { ApiEndpointStats, ResponseSource, SafetyStatus } from '@/types';
import type { RegionSummary, TimeBucket } from '@/domain/stats';
import { SOURCE_LABEL, STATUS_LABEL } from '@/utils/labels';
import { SOURCE_META, SOURCE_ORDER, STATUS_META, STATUS_ORDER } from '@/components/ui/statusMeta';
import { percent } from '@/utils/format';

const AXIS = { fontSize: 11, fill: '#7c8582' };
const GRID = '#e8ebe7';

function ChartTooltip({ active, payload, label, unit = '件' }: TooltipProps<number, string> & { unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-semibold text-ink">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-ink-soft">
          <span className="size-2 rounded-full" style={{ background: (p.payload as { fill?: string })?.fill ?? p.color }} />
          {p.name}
          <span className="tabular ml-auto pl-3 font-semibold text-ink">
            {p.value}
            {unit}
          </span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; value?: number | string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-soft">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {i.value !== undefined && <b className="tabular text-ink">{i.value}</b>}
        </li>
      ))}
    </ul>
  );
}

/** 安否回答率（状態内訳ドーナツ） */
export function ResponseRateChart({ byStatus, total, answered }: { byStatus: Record<SafetyStatus, number>; total: number; answered: number }) {
  const data = STATUS_ORDER.map((s) => ({ name: STATUS_LABEL[s], value: byStatus[s], fill: STATUS_META[s].color })).filter((d) => d.value > 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="100%" paddingAngle={1} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip unit="名" />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] text-ink-muted">回答率</p>
          <p className="tabular text-3xl font-bold text-ink">{percent(answered, total, 0)}</p>
          <p className="tabular text-[11px] text-ink-muted">
            {answered} / {total}名
          </p>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {STATUS_ORDER.map((s) => {
          const Icon = STATUS_META[s].icon;
          return (
            <li key={s} className="flex items-center gap-2 whitespace-nowrap">
              <Icon className="size-4" style={{ color: STATUS_META[s].color }} aria-hidden />
              <span className="text-ink-soft">{STATUS_LABEL[s]}</span>
              <span className="tabular ml-auto font-semibold text-ink">{byStatus[s]}名</span>
              <span className="tabular w-12 text-right text-xs text-ink-muted">{percent(byStatus[s], total, 0)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 時間別回答数（回答経路の積み上げ） */
export function HourlyResponsesChart({ data }: { data: TimeBucket[] }) {
  const series = SOURCE_ORDER.map((s) => ({ key: s, name: SOURCE_LABEL[s], color: SOURCE_META[s].color }));
  return (
    <div>
      <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
      <div className="mt-2 h-56">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: '#c9cfcb' }} interval="preserveStartEnd" />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(28,35,33,0.04)' }} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} stroke="#fff" strokeWidth={1} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 回答経路別比率 */
export function SourceBreakdownChart({ bySource }: { bySource: Record<ResponseSource, number> }) {
  const total = Object.values(bySource).reduce((a, b) => a + b, 0);
  const data = SOURCE_ORDER.map((s) => ({ name: SOURCE_LABEL[s], value: bySource[s], fill: SOURCE_META[s].color }));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data.filter((d) => d.value > 0)} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="100%" stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {data
                .filter((d) => d.value > 0)
                .map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2">
        {SOURCE_ORDER.map((s) => {
          const Icon = SOURCE_META[s].icon;
          return (
            <li key={s}>
              <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                <Icon className="size-4" style={{ color: SOURCE_META[s].color }} aria-hidden />
                <span className="text-ink-soft">{SOURCE_LABEL[s]}</span>
                <span className="tabular ml-auto font-semibold">{bySource[s]}件</span>
                <span className="tabular w-11 text-right text-xs text-ink-muted">{percent(bySource[s], total, 0)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 地域別未回答数 */
export function RegionUnansweredChart({ regions, onSelect }: { regions: RegionSummary[]; onSelect?: (regionId: string) => void }) {
  const data = useMemo(
    () =>
      [...regions]
        .map((r) => ({ id: r.region.id, name: r.region.name, value: r.byStatus.unconfirmed, total: r.total }))
        .sort((a, b) => b.value - a.value),
    [regions],
  );
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: '#4b5552' }} tickLine={false} axisLine={false} width={64} />
          <Tooltip content={<ChartTooltip unit="名" />} cursor={{ fill: 'rgba(28,35,33,0.04)' }} />
          <Bar
            dataKey="value"
            name="未回答"
            fill="#7d8784"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: 'right', fontSize: 11, fill: '#4b5552' }}
            onClick={(d: { id?: string }) => d.id && onSelect?.(d.id)}
            className={onSelect ? 'cursor-pointer' : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** API 成功率 */
export function ApiSuccessChart({ stats }: { stats: ApiEndpointStats[] }) {
  return (
    <ul className="space-y-3">
      {stats.map((s) => {
        const rate = s.requests ? s.success / s.requests : 1;
        const low = rate < 0.97;
        return (
          <li key={s.id}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-ink-soft">{s.name}</span>
              <span className={`tabular font-semibold ${low ? 'text-orange-800' : 'text-ink'}`}>{(rate * 100).toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${s.name} 成功率 ${(rate * 100).toFixed(1)}%`}>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${rate * 100}%`, background: low ? '#ec835a' : '#1f756c' }} />
            </div>
            <p className="tabular mt-0.5 text-[10px] text-ink-muted">
              成功 {s.success.toLocaleString()} / 失敗 {s.failed.toLocaleString()}・平均 {s.avgResponseMs}ms
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** 端末接続状況 */
export function DeviceConnectionChart({ online, warning, offline }: { online: number; warning: number; offline: number }) {
  const data = [
    { name: 'Online', value: online, fill: '#0ca30c' },
    { name: 'Warning', value: warning, fill: '#fab219' },
    { name: 'Offline', value: offline, fill: '#898781' },
  ];
  const total = online + warning + offline;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="relative h-32 w-32 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip unit="台" />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="tabular text-xl font-bold">{percent(online, total, 0)}</p>
          <p className="text-[10px] text-ink-muted">Online</p>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 whitespace-nowrap">
            <span className="size-2.5 rounded-sm" style={{ background: d.fill }} />
            <span className="w-16 text-ink-soft">{d.name}</span>
            <b className="tabular">{d.value}台</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LatencySparkline({ values }: { values: number[] }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }} barCategoryGap={1}>
          <Tooltip content={<ChartTooltip unit="ms" />} cursor={false} />
          <Bar dataKey="v" name="応答時間" fill="#77cbbf" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
