import type { ApiServiceId, FaultSettings } from '@/types';
import { ApiError } from '@/utils/errors';
import { sleep } from '@/utils/random';
import type { ApiRequest, ApiResponse, ApiTransport } from '../transport';

/**
 * ブラウザ内で完結するモック API。外部への通信は一切行わない。
 * 遅延・障害は FaultSettings により再現する。
 */

let faults: FaultSettings = { timeoutRate: 0.01, platformFailureRate: 0.08, latencyFactor: 1 };

export function configureMock(next: FaultSettings) {
  faults = next;
}

const LATENCY: Record<ApiServiceId, [number, number]> = {
  device: [120, 520],
  line: [150, 380],
  platform: [500, 1200],
  gas: [350, 800],
};

type Handler = (body: unknown, match: RegExpMatchArray) => unknown;

const routes: { method: string; pattern: RegExp; handler: Handler }[] = [
  {
    method: 'POST',
    pattern: /^\/devices\/(DEV-\d{4})\/emergency$/,
    handler: (_b, m) => ({ accepted: true, deviceId: m[1], mode: 'emergency', ackAt: new Date().toISOString() }),
  },
  {
    method: 'POST',
    pattern: /^\/devices\/(DEV-\d{4})\/release$/,
    handler: (_b, m) => ({ accepted: true, deviceId: m[1], mode: 'normal' }),
  },
  {
    method: 'GET',
    pattern: /^\/devices\/(DEV-\d{4})\/status$/,
    handler: (_b, m) => ({ deviceId: m[1], reachable: true, checkedAt: new Date().toISOString() }),
  },
  {
    method: 'POST',
    pattern: /^\/messages\/multicast$/,
    handler: (body) => {
      const { to } = body as { to: string[] };
      if (!Array.isArray(to) || to.length > 500) throw new ApiError('INVALID_DATA', '/messages/multicast');
      // 稀にブロック済みユーザーへの送信が拒否される
      const rejected = to.filter(() => Math.random() < 0.01).map((userId) => ({ userId, reason: 'ブロック中のユーザー' }));
      const rejectedIds = new Set(rejected.map((r) => r.userId));
      return { requestId: `req_${Date.now().toString(36)}`, accepted: to.filter((id) => !rejectedIds.has(id)), rejected };
    },
  },
  {
    method: 'POST',
    pattern: /^\/safety-responses$/,
    handler: () => ({ stored: true, sheet: 'responses' }),
  },
  {
    method: 'PUT',
    pattern: /^\/safety-records\/(USER-\d+)$/,
    handler: (_b, m) => ({ stored: true, userId: m[1] }),
  },
  {
    method: 'POST',
    pattern: /^\/safety-records\/bulk$/,
    handler: (body) => {
      const { records } = body as { records: { userId: string }[] };
      if (Math.random() < faults.platformFailureRate) throw new ApiError('TIMEOUT', '/safety-records/bulk');
      return { accepted: records.map((r) => r.userId), rejected: [] as string[] };
    },
  },
  {
    method: 'GET',
    pattern: /^\/health$/,
    handler: () => ({ status: 'ok', checkedAt: new Date().toISOString() }),
  },
];

export const mockTransport: ApiTransport = {
  name: 'Mock API',
  async send<T>(req: ApiRequest): Promise<ApiResponse<T>> {
    const [min, max] = LATENCY[req.service];
    const latency = (min + Math.random() * (max - min)) * faults.latencyFactor;
    const forced = req.mock?.forceError;

    if (forced === 'TIMEOUT' || (!forced && req.service === 'device' && Math.random() < faults.timeoutRate)) {
      await sleep(Math.min(2400, latency * 4));
      throw new ApiError('TIMEOUT', req.path);
    }
    await sleep(latency);
    if (forced) throw new ApiError(forced, req.path);

    const route = routes.find((r) => r.method === req.method && r.pattern.test(req.path));
    if (!route) throw new ApiError('SERVER', req.path, `Mock route not found: ${req.method} ${req.path}`);
    const data = route.handler(req.body, req.path.match(route.pattern)!) as T;
    return { data, status: req.method === 'POST' ? 202 : 200 };
  },
};
