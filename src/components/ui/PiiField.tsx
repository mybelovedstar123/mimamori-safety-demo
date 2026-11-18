import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

interface PiiFieldProps {
  value: string;
  masked: string;
  /** 監査ログに残す項目名 */
  field: string;
  userId: string;
}

/** 個人情報は既定でマスクし、表示操作は監査ログに記録する */
export function PiiField({ value, masked, field, userId }: PiiFieldProps) {
  const [shown, setShown] = useState(false);
  const addLog = useAppStore((s) => s.addLog);

  const toggle = () => {
    if (!shown) addLog({ category: 'audit', level: 'info', action: '個人情報閲覧', message: `${field}を表示`, userId });
    setShown((v) => !v);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="tabular">{shown ? value : masked}</span>
      <button onClick={toggle} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-brand-700 hover:bg-brand-50" aria-label={shown ? `${field}を隠す` : `${field}を表示`}>
        {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        {shown ? '隠す' : '表示'}
      </button>
    </span>
  );
}
