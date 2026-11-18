import { useEffect, useState } from 'react';
import type { SafetyStatus, User } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { recordManualResponse, setManualStatus } from '@/workflows/responses';
import { STATUS_LABEL } from '@/utils/labels';
import { cn } from '@/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { STATUS_META } from '@/components/ui/statusMeta';

type Mode = 'response' | 'confirm';

interface Props {
  user: User | null;
  onClose: () => void;
  /** response: 電話/管理者入力として回答登録、confirm: 管理者判断で状態を確定 */
  mode?: Mode;
}

const RESPONSE_STATUSES: SafetyStatus[] = ['safe', 'needs_support', 'emergency'];
const CONFIRM_STATUSES: SafetyStatus[] = ['safe', 'needs_support', 'emergency', 'unreachable'];

export function ManualResponseModal({ user, onClose, mode = 'response' }: Props) {
  const hasResponse = useAppStore((s) => (user ? !!s.records[user.id]?.response : false));
  const [status, setStatus] = useState<SafetyStatus>('safe');
  const [source, setSource] = useState<'phone' | 'admin'>('phone');
  const [memo, setMemo] = useState('');
  const submit = useAsyncAction(async () => {
    if (!user) return;
    if (mode === 'confirm') await setManualStatus(user.id, status, memo.trim() || '管理者確認済み');
    else await recordManualResponse(user.id, status, source, memo.trim() || undefined);
    onClose();
  }, { errorTitle: '登録できませんでした' });

  useEffect(() => {
    if (user) {
      setStatus('safe');
      setMemo('');
    }
  }, [user]);

  const statuses = mode === 'confirm' ? CONFIRM_STATUSES : RESPONSE_STATUSES;
  return (
    <Modal
      open={!!user}
      onClose={onClose}
      size="sm"
      title={mode === 'confirm' ? '状態を管理者確定' : '回答を入力（電話・管理者）'}
      subtitle={user ? `${user.name}（${user.id}）` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="primary" loading={submit.loading} onClick={() => void submit.run()} disabled={mode === 'confirm' && !memo.trim()}>
            登録する
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mode === 'response' && hasResponse && (
          <p className="rounded-lg bg-brand-50 p-2.5 text-xs text-brand-900">すでに回答があります。この入力は「追加回答」として記録され、先着の採用回答は変わりません。</p>
        )}
        {mode === 'confirm' && <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">回答内容に関わらず、管理者判断で現在の状態を上書きします。回答データ自体は削除されません。</p>}
        <fieldset>
          <legend className="text-xs font-medium text-ink-soft">安否状態</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {statuses.map((s) => {
              const Icon = STATUS_META[s].icon;
              return (
                <label key={s} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', status === s ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-line')}>
                  <input type="radio" name="st" className="sr-only" checked={status === s} onChange={() => setStatus(s)} />
                  <Icon className="size-4" style={{ color: STATUS_META[s].color }} aria-hidden />
                  {STATUS_LABEL[s]}
                </label>
              );
            })}
          </div>
        </fieldset>
        {mode === 'response' && (
          <fieldset>
            <legend className="text-xs font-medium text-ink-soft">回答経路</legend>
            <div className="mt-1.5 flex gap-2">
              {(['phone', 'admin'] as const).map((s) => (
                <label key={s} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', source === s ? 'border-brand-500 bg-brand-50/50' : 'border-line')}>
                  <input type="radio" name="src" className="accent-brand-700" checked={source === s} onChange={() => setSource(s)} />
                  {s === 'phone' ? '電話' : '管理者入力'}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="block">
          <span className="text-xs font-medium text-ink-soft">{mode === 'confirm' ? '確定理由（必須）' : 'メモ（任意）'}</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder={mode === 'confirm' ? '例: 長女に電話で無事を確認' : '例: 本人と通話、自宅で待機中'}
            className="mt-1 w-full rounded-lg border border-line p-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
        </label>
      </div>
    </Modal>
  );
}
