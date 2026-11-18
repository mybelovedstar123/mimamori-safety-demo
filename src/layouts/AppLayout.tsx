import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { EnvBanner } from '@/components/layout/EnvBanner';
import { EventStatusBar } from '@/components/layout/EventStatusBar';
import { MobileNav } from '@/components/layout/MobileNav';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { EmergencyWizard } from '@/components/emergency/EmergencyWizard';
import { SimulationPanel } from '@/components/simulation/SimulationPanel';
import { useAppStore } from '@/store/appStore';

export function AppLayout() {
  const location = useLocation();
  const environment = useAppStore((s) => s.environment);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh">
      {environment === 'production' && <div className="pointer-events-none fixed inset-0 z-[70] border-4 border-red-600" aria-hidden />}
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <EnvBanner />
        <EventStatusBar />
        <main className="flex-1 px-3 pt-4 pb-24 sm:px-5 sm:pt-5 md:pb-10">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <MobileNav />
      <EmergencyWizard />
      <SimulationPanel />
      <ToastViewport />
    </div>
  );
}
