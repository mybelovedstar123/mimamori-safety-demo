import {
  CheckCircle2,
  CircleHelp,
  LifeBuoy,
  MessageCircle,
  Phone,
  PhoneOff,
  RadioTower,
  Siren,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { ResponseSource, SafetyStatus } from '@/types';

export interface StatusMeta {
  icon: LucideIcon;
  /** 地図・グラフ用の色 */
  color: string;
  badge: string;
}

export const STATUS_META: Record<SafetyStatus, StatusMeta> = {
  safe: { icon: CheckCircle2, color: '#0ca30c', badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  needs_support: { icon: LifeBuoy, color: '#fab219', badge: 'bg-amber-50 text-amber-900 ring-amber-300' },
  unreachable: { icon: PhoneOff, color: '#ec835a', badge: 'bg-orange-50 text-orange-900 ring-orange-200' },
  emergency: { icon: Siren, color: '#d03b3b', badge: 'bg-red-600 text-white ring-red-700' },
  unconfirmed: { icon: CircleHelp, color: '#898781', badge: 'bg-slate-100 text-slate-700 ring-slate-300' },
};

export const SOURCE_META: Record<ResponseSource, { icon: LucideIcon; color: string }> = {
  line: { icon: MessageCircle, color: '#2a78d6' },
  device: { icon: RadioTower, color: '#eb6834' },
  phone: { icon: Phone, color: '#1baf7a' },
  admin: { icon: UserCog, color: '#eda100' },
};

export const STATUS_ORDER: SafetyStatus[] = ['safe', 'needs_support', 'emergency', 'unreachable', 'unconfirmed'];
export const SOURCE_ORDER: ResponseSource[] = ['line', 'device', 'phone', 'admin'];
