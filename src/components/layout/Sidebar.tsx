import { NavLink } from 'react-router-dom';
import {
  Bell,
  LayoutDashboard,
  Map,
  MessageCircle,
  Plug,
  RadioTower,
  ScrollText,
  Settings,
  Share2,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useEventStats } from '@/hooks/useEventStats';
import { CITY_NAME } from '@/data/regions';
import { cn } from '@/utils/cn';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeTone?: 'alert' | 'muted';
}

export function Sidebar() {
  const open = useAppStore((s) => s.sidebarOpen);
  const setOpen = useAppStore((s) => s.setSidebarOpen);
  const unread = useAppStore((s) => s.notifications.filter((n) => !n.read).length);
  const stats = useEventStats();

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: '運用',
      items: [
        { to: '/', label: 'ダッシュボード', icon: LayoutDashboard },
        { to: '/safety', label: '安否確認', icon: ShieldCheck, badge: stats.unanswered, badgeTone: 'muted' },
        { to: '/users', label: '対象者管理', icon: Users },
        { to: '/map', label: '地図', icon: Map },
        { to: '/alerts', label: '通知・アラート', icon: Bell, badge: unread, badgeTone: 'alert' },
      ],
    },
    {
      title: '連携',
      items: [
        { to: '/devices', label: '見守り端末', icon: RadioTower, badge: stats.devicesOffline, badgeTone: 'muted' },
        { to: '/line', label: 'LINE連携', icon: MessageCircle },
        { to: '/api', label: 'API連携', icon: Plug },
        { to: '/platform', label: '外部プラットフォーム', icon: Share2 },
      ],
    },
    {
      title: '管理',
      items: [
        { to: '/logs', label: 'ログ', icon: ScrollText },
        { to: '/settings', label: '設定', icon: Settings },
      ],
    },
  ];

  return (
    <>
      <div
        className={cn('fixed inset-0 z-40 bg-slate-900/40 transition-opacity lg:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-950 text-slate-200 transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-60 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="メインメニュー"
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-9 rounded-lg ring-1 ring-white/10" />
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">みまもり安否連携</p>
              <p className="text-[10px] text-slate-400">{CITY_NAME} 防災課（デモ）</p>
            </div>
          </div>
          <button className="rounded-md p-1 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="メニューを閉じる">
            <X className="size-5" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-2.5 pb-4">
          {groups.map((g) => (
            <div key={g.title} className="mt-3">
              <p className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-slate-500">{g.title}</p>
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                          isActive ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-brand-300' : 'text-slate-400 group-hover:text-slate-200')} aria-hidden />
                          <span className="flex-1 truncate">{item.label}</span>
                          {!!item.badge && (
                            <span
                              className={cn(
                                'tabular rounded-full px-1.5 py-px text-[10px] font-bold',
                                item.badgeTone === 'alert' ? 'bg-red-500 text-white' : 'bg-white/15 text-slate-200',
                              )}
                            >
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-3 text-[10px] leading-relaxed text-slate-500">
          本デモは架空データ・モック通信のみで動作します。外部サービスへの実通信は行いません。
        </div>
      </aside>
    </>
  );
}
