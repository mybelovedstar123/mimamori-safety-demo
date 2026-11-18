import type { ApiErrorCode, ApiServiceId, Environment } from '@/types';

export type HttpMethod = 'GET' | 'POST' | 'PUT';

/**
 * モック環境でのみ参照される挙動ヒント。
 * 実 API では端末状態などはサーバー側が判定するため無視される。
 */
export interface MockHints {
  forceError?: ApiErrorCode;
}

export interface ApiRequest<B = unknown> {
  service: ApiServiceId;
  method: HttpMethod;
  path: string;
  body?: B;
  mock?: MockHints;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

/** 通信手段の差し替えポイント（Mock / GAS / 実 API） */
export interface ApiTransport {
  readonly name: string;
  send<T>(req: ApiRequest, environment: Environment): Promise<ApiResponse<T>>;
}

export interface ApiCallRecord {
  service: ApiServiceId;
  method: HttpMethod;
  path: string;
  ok: boolean;
  status: number;
  durationMs: number;
  error?: ApiErrorCode;
  at: string;
}
