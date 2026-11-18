import type { Environment } from '@/types';
import { ApiError } from '@/utils/errors';
import { getEndpoint, REQUEST_TIMEOUT_MS } from './config';
import type { ApiRequest, ApiResponse, ApiTransport } from './transport';

/**
 * Google Apps Script Web アプリ経由の通信（将来の本番構成）。
 * GAS 側 doPost(e) で { service, method, path, body } を受け取り、
 * スクリプトプロパティに保持した API キーで外部 API を呼び出す想定。
 * デモでは VITE_DATA_SOURCE=gas を指定しない限り使用されない。
 */
export const gasTransport: ApiTransport = {
  name: 'Google Apps Script',
  async send<T>(req: ApiRequest, environment: Environment): Promise<ApiResponse<T>> {
    const { baseUrl } = getEndpoint(environment, 'gas');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        // GAS はプリフライト非対応のため text/plain で送信する
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ service: req.service, method: req.method, path: req.path, body: req.body }),
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) throw new ApiError('AUTH', req.path);
      if (res.status === 429) throw new ApiError('RATE_LIMIT', req.path);
      if (!res.ok) throw new ApiError('SERVER', req.path);
      const json = (await res.json()) as { ok: boolean; data: T; errorCode?: string };
      if (!json.ok) throw new ApiError('SERVER', req.path, json.errorCode);
      return { data: json.data, status: res.status };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') throw new ApiError('TIMEOUT', req.path);
      throw new ApiError('NETWORK', req.path);
    } finally {
      clearTimeout(timer);
    }
  },
};
