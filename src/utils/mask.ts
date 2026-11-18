/** 秘密情報は値の長さも含めて隠す */
export const maskSecret = (_value?: string) => '************';

/** キー識別子は末尾4文字のみ表示 */
export function maskKeyId(keyId: string | undefined): string {
  if (!keyId) return '未設定';
  return `****${keyId.slice(-4)}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `***-****-${digits.slice(-4)}`;
}

/** 住所は町名まで表示し、番地以降を伏せる */
export function maskAddress(address: string): string {
  const m = address.match(/^(.*?[町丁目区村])/);
  return m ? `${m[1]} ***` : '***';
}

const SECRET_KEYS = /(token|secret|password|apikey|api_key|authorization|key)$/i;

/** ログ出力前に payload 内の秘密情報を再帰的にマスク */
export function redactPayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redactPayload) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? maskSecret() : redactPayload(v);
    }
    return out as T;
  }
  return value;
}
