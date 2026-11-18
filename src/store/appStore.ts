import { create } from 'zustand';
import type {
  ApiEndpointStats,
  ApiLog,
  ApiServiceId,
  AppNotification,
  ArchivedEvent,
  Device,
  EmergencyEvent,
  Environment,
  FaultSettings,
  PlatformSync,
  SafetyRecord,
  SimulationStep,
  SimulationStepId,
  User,
} from '@/types';
import { ADMIN_NAME, createSeedState } from '@/data/seed';
import { createEmptyRecord, getEffectiveStatus } from '@/domain/safety';
import { apiClient } from '@/services/apiClient';
import { configureMock } from '@/services/mock/mockTransport';
import type { ApiCallRecord } from '@/services/transport';
import { createId } from '@/utils/id';
import { redactPayload } from '@/utils/mask';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';
export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
}

export interface DuplicateHighlight {
  userId: string;
  primary: { source: string; status: string; at: string };
  additional: { source: string; status: string; at: string };
}

export interface SimulationState {
  visible: boolean;
  running: boolean;
  steps: SimulationStep[];
  speed: number;
  highlight?: DuplicateHighlight;
  startedAt?: string;
  finishedAt?: string;
}

export interface DispatchRun {
  running: boolean;
  eventId?: string;
  startedAt?: string;
  finishedAt?: string;
}

const MAX_LOGS = 3000;
const MAX_NOTIFICATIONS = 400;

interface AppState {
  environment: Environment;
  adminName: string;
  faults: FaultSettings;
  users: User[];
  usersById: Record<string, User>;
  devices: Record<string, Device>;
  event: EmergencyEvent | null;
  eventArchive: ArchivedEvent[];
  records: Record<string, SafetyRecord>;
  notifications: AppNotification[];
  logs: ApiLog[];
  platformSyncs: PlatformSync[];
  apiStats: Record<ApiServiceId, ApiEndpointStats>;
  lastSyncAt: string;
  toasts: Toast[];
  simulation: SimulationState;
  dispatchRun: DispatchRun;
  wizardOpen: boolean;
  sidebarOpen: boolean;

  setEnvironment: (env: Environment) => void;
  setFaults: (patch: Partial<FaultSettings>) => void;
  addLog: (entry: Omit<ApiLog, 'id' | 'at'> & { at?: string }) => void;
  /** critical は既定でトーストも表示。一括処理中は toast:false で集約表示に任せる */
  addNotification: (n: Omit<AppNotification, 'id' | 'at' | 'read'> & { at?: string }, opts?: { toast?: boolean }) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateRecord: (userId: string, updater: (r: SafetyRecord) => SafetyRecord) => void;
  updateRecords: (userIds: string[], updater: (r: SafetyRecord) => SafetyRecord) => void;
  updateDevice: (id: string, updater: (d: Device) => Device) => void;
  beginEvent: (event: EmergencyEvent) => void;
  archiveCurrentEvent: () => void;
  upsertPlatformSync: (sync: PlatformSync) => void;
  setLastSyncAt: (iso: string) => void;
  recordApiCall: (rec: ApiCallRecord) => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  setSimulation: (patch: Partial<SimulationState>) => void;
  setSimulationStep: (id: SimulationStepId, patch: Partial<SimulationStep>) => void;
  setDispatchRun: (patch: Partial<DispatchRun>) => void;
  setWizardOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  resetDemo: () => void;
}

export const SIMULATION_STEPS: { id: SimulationStepId; label: string }[] = [
  { id: 'start', label: '緊急モード開始' },
  { id: 'dispatch', label: '外部端末・LINEへ送信' },
  { id: 'dispatch_success', label: '一部端末は送信成功' },
  { id: 'dispatch_failed', label: '一部端末は送信失敗' },
  { id: 'line_responses', label: 'LINE回答を受信' },
  { id: 'device_responses', label: '外部端末回答を受信' },
  { id: 'duplicate', label: '重複回答を検知' },
  { id: 'adopt', label: '先着回答を採用' },
  { id: 'unanswered', label: '未回答者を抽出' },
  { id: 'platform', label: '外部プラットフォームへ送信' },
];

export const initialSimulationSteps = (): SimulationStep[] =>
  SIMULATION_STEPS.map((s) => ({ ...s, state: 'pending' }));

const DEFAULT_FAULTS: FaultSettings = { timeoutRate: 0.01, platformFailureRate: 0.08, latencyFactor: 1 };

function buildInitialData() {
  const seed = createSeedState();
  return {
    users: seed.users,
    usersById: Object.fromEntries(seed.users.map((u) => [u.id, u])),
    devices: seed.devices,
    event: seed.event as EmergencyEvent | null,
    eventArchive: seed.eventArchive,
    records: seed.records,
    notifications: seed.notifications,
    logs: seed.logs,
    platformSyncs: seed.platformSyncs,
    apiStats: seed.apiStats,
    lastSyncAt: seed.lastSyncAt,
  };
}

export const useAppStore = create<AppState>()((set, get) => ({
  environment: 'test',
  adminName: ADMIN_NAME,
  faults: DEFAULT_FAULTS,
  ...buildInitialData(),
  toasts: [],
  simulation: { visible: false, running: false, steps: initialSimulationSteps(), speed: 1 },
  dispatchRun: { running: false },
  wizardOpen: false,
  sidebarOpen: false,

  setEnvironment: (environment) => {
    apiClient.setEnvironment(environment);
    set({ environment });
    get().addLog({
      category: 'audit',
      level: environment === 'production' ? 'warning' : 'info',
      action: '環境切替',
      message: environment === 'production' ? '本番環境へ切り替えました' : 'テスト環境へ切り替えました',
    });
  },

  setFaults: (patch) => {
    const faults = { ...get().faults, ...patch };
    configureMock(faults);
    set({ faults });
  },

  addLog: (entry) =>
    set((s) => ({
      logs: [
        { id: createId('LOG'), at: entry.at ?? new Date().toISOString(), ...entry, payload: entry.payload && redactPayload(entry.payload) },
        ...s.logs,
      ].slice(0, MAX_LOGS),
    })),

  addNotification: (n, opts) => {
    const item: AppNotification = { id: createId('NTF'), at: n.at ?? new Date().toISOString(), read: false, ...n };
    set((s) => ({ notifications: [item, ...s.notifications].slice(0, MAX_NOTIFICATIONS) }));
    if (n.severity === 'critical' && opts?.toast !== false) get().pushToast({ tone: 'error', title: n.title, message: n.message });
  },

  markNotificationRead: (id) =>
    set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),

  markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

  updateRecord: (userId, updater) =>
    set((s) => {
      const r = s.records[userId];
      return r ? { records: { ...s.records, [userId]: updater(r) } } : {};
    }),

  updateRecords: (userIds, updater) =>
    set((s) => {
      const next = { ...s.records };
      for (const id of userIds) if (next[id]) next[id] = updater(next[id]);
      return { records: next };
    }),

  updateDevice: (id, updater) =>
    set((s) => (s.devices[id] ? { devices: { ...s.devices, [id]: updater(s.devices[id]) } } : {})),

  beginEvent: (event) =>
    set((s) => {
      const records: Record<string, SafetyRecord> = {};
      for (const id of event.targetUserIds) records[id] = createEmptyRecord(id, event.id);
      return { event, records, simulation: { ...s.simulation, highlight: undefined } };
    }),

  archiveCurrentEvent: () =>
    set((s) => {
      if (!s.event) return {};
      const results: ArchivedEvent['results'] = {};
      for (const id of s.event.targetUserIds) {
        const r = s.records[id];
        results[id] = { status: getEffectiveStatus(r), source: r?.response?.source ?? null, at: r?.response?.receivedAt ?? null };
      }
      const closed: EmergencyEvent = { ...s.event, status: 'closed', closedAt: new Date().toISOString() };
      const devices = Object.fromEntries(
        Object.entries(s.devices).map(([k, d]) => [k, d.mode === 'emergency' ? { ...d, mode: 'normal' as const } : d]),
      );
      return { event: null, records: {}, devices, eventArchive: [{ event: closed, results }, ...s.eventArchive] };
    }),

  upsertPlatformSync: (sync) =>
    set((s) => {
      const exists = s.platformSyncs.some((p) => p.id === sync.id);
      return { platformSyncs: exists ? s.platformSyncs.map((p) => (p.id === sync.id ? sync : p)) : [sync, ...s.platformSyncs] };
    }),

  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),

  recordApiCall: (rec) =>
    set((s) => {
      const cur = s.apiStats[rec.service];
      const requests = cur.requests + 1;
      return {
        apiStats: {
          ...s.apiStats,
          [rec.service]: {
            ...cur,
            requests,
            success: cur.success + (rec.ok ? 1 : 0),
            failed: cur.failed + (rec.ok ? 0 : 1),
            lastCommunicationAt: rec.at,
            avgResponseMs: Math.round((cur.avgResponseMs * cur.requests + rec.durationMs) / requests),
            latencyHistory: [...cur.latencyHistory.slice(-23), rec.durationMs],
            authStatus: rec.error === 'AUTH' && rec.service !== 'device' ? 'invalid' : cur.authStatus,
          },
        },
      };
    }),

  pushToast: (t) => {
    const id = createId('TST');
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }));
    setTimeout(() => get().dismissToast(id), t.tone === 'error' ? 7000 : 4500);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setSimulation: (patch) => set((s) => ({ simulation: { ...s.simulation, ...patch } })),

  setSimulationStep: (id, patch) =>
    set((s) => ({
      simulation: { ...s.simulation, steps: s.simulation.steps.map((st) => (st.id === id ? { ...st, ...patch } : st)) },
    })),

  setDispatchRun: (patch) => set((s) => ({ dispatchRun: { ...s.dispatchRun, ...patch } })),

  setWizardOpen: (wizardOpen) => set({ wizardOpen }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  resetDemo: () => {
    set({
      ...buildInitialData(),
      toasts: [],
      simulation: { visible: false, running: false, steps: initialSimulationSteps(), speed: get().simulation.speed },
      dispatchRun: { running: false },
    });
    get().pushToast({ tone: 'info', title: 'デモデータを初期化しました' });
  },
}));

// API 呼び出しの計測値を連携状況へ反映
apiClient.onCall((rec) => useAppStore.getState().recordApiCall(rec));
configureMock(DEFAULT_FAULTS);
