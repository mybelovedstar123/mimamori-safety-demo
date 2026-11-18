import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bell, Menu, RefreshCw, UserCircle2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useNow } from '@/hooks/useNow';
import { formatRelative, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { SeverityBadge } from '@/components/ui/Badges';
import { EnvironmentSwitch } from './EnvironmentSwitch';

function SystemStatus() {
  const apiStats = useAppStore((s) => s.apiStats);
  const offline = useAppStore((s) => Object.values(s.devices).filter((d) => d.connection === 'offline').length);
  const lastPlatform = useAppStore((s) => s.platformSyncs[0]);
  const authIssue = Object.values(apiStats).some((a) => a.authStatus !== 'valid');
  const platformIssue = lastPlatform && lastPlatform.status !== 'success' && lastPlatform.status !== 'running';
  const degraded = authIssue || platformIssue;
  const detail = [authIssue && 'API認証エラー', platformIssue && '外部PF一部失敗', offline > 0 && `端末Offline ${offline}台`].filter(Boolean).join('・');
  return (
    <Link
      to="/api"
      className={cn(
        'hidden items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ring-1 ring-inset md:inline-flex',
        degraded ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-emerald-50 text-emerald-800 ring-emerald-200',
      )}
      title={detail || 'すべての連携が正常です'}
    >
      <Activity className="size-3.5" aria-hidden />
      <span className="font-semibold">{degraded ? '一部注意' : '正常稼働'}</span>
      {detail && <span className="hidden max-w-[220px] truncate text-[11px] opacity-80 xl:inline">{detail}</span>}
    </Link>
  );
}

function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notifications = useAppStore((s) => s.notifications);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const unread = notifications.filter((n) => !n.read);
  const now = useNow(30_000);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const critical = unread.some((n) => n.severity === 'critical');
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-slate-100"
        aria-label={`通知 ${unread.length}件未読`}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unread.length > 0 && (
          <span className={cn('tabular absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full px-1 text-center text-[10px] leading-[18px] font-bold text-white', critical ? 'bg-red-600' : 'bg-amber-500')}>
            {unread.length > 99 ? '99+' : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="animate-slide-in absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">通知（未読 {unread.length}件）</p>
            <Link to="/alerts" onClick={() => setOpen(false)} className="text-xs font-medium text-brand-700 hover:underline">
              すべて表示
            </Link>
          </div>
          <ul className="scrollbar-thin max-h-96 divide-y divide-line overflow-y-auto">
            {notifications.slice(0, 8).map((n) => (
              <li key={n.id}>
                <Link
                  to={n.link ?? '/alerts'}
                  onClick={() => {
                    markRead(n.id);
                    setOpen(false);
                  }}
                  className={cn('block px-4 py-2.5 hover:bg-slate-50', !n.read && 'bg-brand-50/40')}
                >
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={n.severity} />
                    <span className="ml-auto text-[11px] text-ink-muted">{formatRelative(n.at, now)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink">{n.title}</p>
                  <p className="truncate text-xs text-ink-muted">{n.message}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const adminName = useAppStore((s) => s.adminName);
  const environment = useAppStore((s) => s.environment);
  const now = useNow(15_000);

  return (
    <header className={cn('sticky top-0 z-30 border-b bg-white/95 backdrop-blur', environment === 'production' ? 'border-red-200' : 'border-line')}>
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <button className="grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="メニューを開く">
          <Menu className="size-5" />
        </button>
        <EnvironmentSwitch />
        <SystemStatus />
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <div className="hidden items-center gap-1.5 text-xs text-ink-muted sm:flex" title="外部プラットフォームとの最終同期">
            <RefreshCw className="size-3.5" aria-hidden />
            <span>最終同期</span>
            <span className="tabular font-medium text-ink-soft">{formatTime(lastSyncAt, false)}</span>
            <span className="hidden lg:inline">（{formatRelative(lastSyncAt, now)}）</span>
          </div>
          <NotificationMenu />
          <div className="flex items-center gap-2 border-l border-line pl-2 sm:pl-3">
            <UserCircle2 className="size-7 text-brand-700" aria-hidden />
            <div className="hidden leading-tight md:block">
              <p className="text-xs font-semibold text-ink">{adminName}</p>
              <p className="text-[10px] text-ink-muted">管理者権限</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
