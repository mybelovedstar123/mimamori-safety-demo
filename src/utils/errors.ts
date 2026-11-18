import type { ApiErrorCode } from '@/types';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly endpoint: string;

  constructor(code: ApiErrorCode, endpoint: string, message?: string) {
    super(message ?? ERROR_INFO[code].label);
    this.name = 'ApiError';
    this.code = code;
    this.endpoint = endpoint;
    this.status = ERROR_INFO[code].status;
  }
}

export const ERROR_INFO: Record<
  ApiErrorCode,
  { label: string; status: number; message: string; hint: string; retryable: boolean }
> = {
  TIMEOUT: {
    label: 'API Timeout',
    status: 504,
    message: '外部APIからの応答がありませんでした。',
    hint: '時間をおいて再送信してください。',
    retryable: true,
  },
  AUTH: {
    label: '認証エラー',
    status: 401,
    message: 'APIの認証に失敗しました。',
    hint: '認証情報の有効期限を「API連携」画面で確認してください。',
    retryable: false,
  },
  DEVICE_OFFLINE: {
    label: '端末オフライン',
    status: 409,
    message: '見守り端末がオフラインのため送信できませんでした。',
    hint: '電話または訪問による確認を検討してください。',
    retryable: true,
  },
  NETWORK: {
    label: 'ネットワークエラー',
    status: 0,
    message: 'ネットワークに接続できませんでした。',
    hint: '通信環境を確認してから再試行してください。',
    retryable: true,
  },
  INVALID_DATA: {
    label: '不正なデータ',
    status: 422,
    message: '受信データの形式が正しくないため破棄しました。',
    hint: '端末のファームウェアまたは送信元設定を確認してください。',
    retryable: false,
  },
  RATE_LIMIT: {
    label: 'レート制限',
    status: 429,
    message: '送信が集中したため一時的に制限されました。',
    hint: '数秒後に自動で再送信されます。',
    retryable: true,
  },
  SERVER: {
    label: 'サーバーエラー',
    status: 500,
    message: '連携先サーバーでエラーが発生しました。',
    hint: '連携先の稼働状況を確認してください。',
    retryable: true,
  },
};

export function toApiError(err: unknown, endpoint = 'unknown'): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError('NETWORK', endpoint, err instanceof Error ? err.message : undefined);
}

export function describeError(code: ApiErrorCode | undefined): string {
  return code ? ERROR_INFO[code].label : '';
}
