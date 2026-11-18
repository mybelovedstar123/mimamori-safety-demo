import type { Environment } from '@/types';
import { toApiError } from '@/utils/errors';
import { DATA_SOURCE } from './config';
import { gasTransport } from './gasTransport';
import { mockTransport } from './mock/mockTransport';
import type { ApiCallRecord, ApiRequest, ApiTransport } from './transport';

type Listener = (rec: ApiCallRecord) => void;

/** 全 API 呼び出しの共通窓口。環境切替・計測・エラー正規化を担う */
class ApiClient {
  private environment: Environment = 'test';
  private transport: ApiTransport = DATA_SOURCE === 'gas' ? gasTransport : mockTransport;
  private listeners = new Set<Listener>();

  setEnvironment(env: Environment) {
    this.environment = env;
  }

  get transportName() {
    return this.transport.name;
  }

  onCall(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async request<T>(req: ApiRequest): Promise<T> {
    const started = performance.now();
    const at = new Date().toISOString();
    try {
      const res = await this.transport.send<T>(req, this.environment);
      this.emit({ service: req.service, method: req.method, path: req.path, ok: true, status: res.status, durationMs: Math.round(performance.now() - started), at });
      return res.data;
    } catch (err) {
      const apiErr = toApiError(err, req.path);
      this.emit({ service: req.service, method: req.method, path: req.path, ok: false, status: apiErr.status, durationMs: Math.round(performance.now() - started), error: apiErr.code, at });
      throw apiErr;
    }
  }

  private emit(rec: ApiCallRecord) {
    this.listeners.forEach((l) => l(rec));
  }
}

export const apiClient = new ApiClient();
