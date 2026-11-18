import { AlertTriangle, Info } from 'lucide-react';
import type { SafetyResponse } from '@/types';
import { formatTime } from '@/utils/format';
import { STATUS_LABEL } from '@/utils/labels';
import { cn } from '@/utils/cn';
import { SourceBadge, StatusBadge } from '@/components/ui/Badges';

export function FirstComeRuleNote({ className }: { className?: string }) {
  return (
    <div className={cn('flex gap-2.5 rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-900', className)}>
      <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
      <div>
        <p className="font-bold">重複回答の処理ルール：先着回答を採用</p>
        <p className="mt-0.5 leading-relaxed">
          同じ方からLINE・外部端末など複数の回答が届いた場合、<b>最初に届いた回答を正式な安否回答</b>として採用します。後から届いた回答は「追記」として経路・時刻とともに保存し、元データは削除しません。内容が異なる場合は「回答不一致」として要確認に分類します。
        </p>
      </div>
    </div>
  );
}

/** 採用回答と追加回答の比較表示 */
export function ResponseDetail({ response }: { response: SafetyResponse }) {
  const conflict = response.additionalResponses.some((a) => a.conflicts);
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-brand-300 bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold text-white">採用回答</span>
          <SourceBadge source={response.source} />
          <span className="tabular text-xs text-ink-soft">{formatTime(response.receivedAt)}</span>
          <StatusBadge status={response.status} size="sm" />
          <span className="ml-auto text-[10px] text-ink-muted">先着</span>
        </div>
      </div>
      {response.additionalResponses.map((a, i) => (
        <div key={a.responseId} className={cn('rounded-lg border border-dashed p-2.5', a.conflicts ? 'border-amber-300 bg-amber-50/50' : 'border-line bg-slate-50/60')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">追加回答 {i + 1}</span>
            <SourceBadge source={a.source} muted />
            <span className="tabular text-xs text-ink-muted">{formatTime(a.receivedAt)}</span>
            <StatusBadge status={a.status} size="sm" />
            <span className="ml-auto text-[10px] text-ink-muted">追記として保存</span>
          </div>
          {a.conflicts && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-amber-900">
              <AlertTriangle className="size-3.5" aria-hidden />
              採用回答「{STATUS_LABEL[response.status]}」と内容が異なります。電話等で確認してください。
            </p>
          )}
        </div>
      ))}
      {conflict && <p className="text-[11px] text-ink-muted">※ 管理者が確認後、対象者詳細画面から状態を確定できます。</p>}
    </div>
  );
}
