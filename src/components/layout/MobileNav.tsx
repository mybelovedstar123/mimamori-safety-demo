import { NavLink, useLocation } from 'react-router-dom';
import { Bell, Clock, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useEventStats } from '@/hooks/useEventStats';
import { cn } from '@/utils/cn';

/** スマートフォン用の下部ナビ（安否確認・未回答・通知に素早く到達） */
export function MobileNav() {
  const unread = useAppStore((s) => s.notifications.filter((n) => !n.read && n.severity !== 'info').length);
  const stats = useEventStats();
  const location = useLocation();
  const unansweredActive = location.pathname === '/safety' && location.search.includes('tab=unanswered');

  const items = [
    { to: '/', label: 'ホーム', icon: LayoutDashboard, end: true },
    { to: '/safety', label: '安否確認', icon: ShieldCheck, end: true, inactive: unansweredActive },
    { to: '/safety?tab=unanswered', label: '未回答', icon: Clock, badge: stats.unanswered, forceActive: unansweredActive },
    { to: '/alerts', label: '通知', icon: Bell, badge: unread, alert: true },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="クイックナビ">
      <ul className="grid grid-cols-4">
        {items.map((i) => (
          <li key={i.label}>
            <NavLink
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                  (i.forceActive || (isActive && !i.inactive)) ? 'text-brand-700' : 'text-ink-muted',
                )
              }
            >
              <i.icon className="size-5" aria-hidden />
              {i.label}
              {!!i.badge && (
                <span className={cn('tabular absolute top-1 left-1/2 ml-2 rounded-full px-1 text-[9px] leading-4 font-bold text-white', i.alert ? 'bg-red-600' : 'bg-slate-600')}>
                  {i.badge}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
