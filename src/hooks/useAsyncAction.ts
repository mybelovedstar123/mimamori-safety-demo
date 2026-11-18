import { useCallback, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { ERROR_INFO, toApiError } from '@/utils/errors';

/** 非同期操作のローディング・エラー表示を共通化 */
export function useAsyncAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: { errorTitle?: string } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pushToast = useAppStore((s) => s.pushToast);

  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setLoading(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err) {
        const e = toApiError(err);
        const info = ERROR_INFO[e.code];
        const msg = `${info.message}${e.message && e.message !== info.label ? `（${e.message}）` : ''}`;
        setError(msg);
        pushToast({ tone: 'error', title: opts.errorTitle ?? info.label, message: `${msg} ${info.hint}` });
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [fn, opts.errorTitle, pushToast],
  );

  return { run, loading, error };
}
