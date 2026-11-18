import type { ApiServiceId, Environment } from '@/types';

/**
 * 接続先設定。URL とキー識別子のみを環境変数から読み込む。
 * 秘密鍵そのものはフロントエンドに持たせず、GAS のスクリプトプロパティ
 * またはサーバー側プロキシで保持する前提。
 */
export interface ServiceEndpoint {
  baseUrl: string;
  /** 表示用のキー識別子（秘密情報ではない） */
  keyId?: string;
}

const env = import.meta.env;

const ENDPOINTS: Record<Environment, Record<ApiServiceId, ServiceEndpoint>> = {
  test: {
    device: { baseUrl: env.VITE_TEST_DEVICE_API_URL ?? 'https://sandbox.device-api.example.jp/v1', keyId: env.VITE_DEVICE_API_KEY_ID ?? 'dk_demo_0000' },
    line: { baseUrl: env.VITE_TEST_LINE_API_URL ?? 'https://sandbox.line-gateway.example.jp/v1', keyId: env.VITE_LINE_CHANNEL_KEY_ID ?? 'ln_demo_0000' },
    platform: { baseUrl: env.VITE_TEST_PLATFORM_API_URL ?? 'https://sandbox.bousai-platform.example.jp/api', keyId: env.VITE_PLATFORM_API_KEY_ID ?? 'pf_demo_0000' },
    gas: { baseUrl: env.VITE_TEST_GAS_URL ?? 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec' },
  },
  production: {
    device: { baseUrl: env.VITE_PROD_DEVICE_API_URL ?? 'https://device-api.example.jp/v1', keyId: env.VITE_DEVICE_API_KEY_ID ?? 'dk_demo_0000' },
    line: { baseUrl: env.VITE_PROD_LINE_API_URL ?? 'https://line-gateway.example.jp/v1', keyId: env.VITE_LINE_CHANNEL_KEY_ID ?? 'ln_demo_0000' },
    platform: { baseUrl: env.VITE_PROD_PLATFORM_API_URL ?? 'https://bousai-platform.example.jp/api', keyId: env.VITE_PLATFORM_API_KEY_ID ?? 'pf_demo_0000' },
    gas: { baseUrl: env.VITE_PROD_GAS_URL ?? 'https://script.google.com/macros/s/PROD_DEPLOYMENT_ID/exec' },
  },
};

export const getEndpoint = (environment: Environment, service: ApiServiceId) => ENDPOINTS[environment][service];

/** mock: 画面内モック / gas: Google Apps Script Web アプリ経由 */
export const DATA_SOURCE: 'mock' | 'gas' = env.VITE_DATA_SOURCE === 'gas' ? 'gas' : 'mock';

export const REQUEST_TIMEOUT_MS = 10_000;
