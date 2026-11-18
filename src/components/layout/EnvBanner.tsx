import { FlaskConical, ShieldAlert } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { apiClient } from '@/services/apiClient';

export function EnvBanner() {
  const environment = useAppStore((s) => s.environment);
  if (environment === 'production') {
    return (
      <div className="prod-stripes text-white" role="alert">
        <div className="flex items-center gap-2 bg-red-800/70 px-3 py-1.5 text-xs font-semibold sm:px-5">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          <span className="rounded bg-white px-1.5 py-px text-[10px] font-black tracking-wider text-red-700">PRODUCTION</span>
          <span>本番環境：実データを扱う可能性があります。送信操作は慎重に行ってください。</span>
          <span className="ml-auto hidden font-normal opacity-80 md:inline">※デモのため実際は {apiClient.transportName} で動作</span>
        </div>
      </div>
    );
  }
  return (
    <div className="border-b border-sky-100 bg-sky-50 text-sky-900">
      <div className="flex items-center gap-2 px-3 py-1 text-xs sm:px-5">
        <FlaskConical className="size-3.5 shrink-0 text-sky-600" aria-hidden />
        <span className="rounded bg-sky-600 px-1.5 py-px text-[10px] font-bold tracking-wider text-white">TEST</span>
        <span>テスト用APIへ接続しています（{apiClient.transportName}・架空データ）</span>
      </div>
    </div>
  );
}
