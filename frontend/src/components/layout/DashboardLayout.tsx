import { ReactNode, useEffect, useRef, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCurrentPortal, portalPath } from '@/lib/portal';

interface DashboardLayoutProps {
  children: ReactNode;
}

// Module-level singleton to prevent creating multiple channels on every route change
let _globalNoticeChannel: ReturnType<typeof supabase.channel> | null = null;
let _globalNoticeRefCount = 0;

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const portal = getCurrentPortal(location.pathname);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Keep navigate stable in the channel callback
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    _globalNoticeRefCount++;
    // Only subscribe once — shared across all mounted DashboardLayouts
    if (!_globalNoticeChannel) {
      _globalNoticeChannel = supabase
        .channel('global-announcements')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notices' },
          (payload) => {
              toast.info(`New Announcement: ${payload.new.title}`, {
                description: payload.new.content.substring(0, 100) + (payload.new.content.length > 100 ? '...' : ''),
                duration: 10000,
                action: { label: 'View All', onClick: () => navigateRef.current(portalPath(portal, '/notices')) }
              });
            }
          )
        .subscribe();
    }

    return () => {
      _globalNoticeRefCount--;
      // Only remove the channel when the last DashboardLayout unmounts
      if (_globalNoticeRefCount <= 0 && _globalNoticeChannel) {
        supabase.removeChannel(_globalNoticeChannel);
        _globalNoticeChannel = null;
        _globalNoticeRefCount = 0;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background relative flex overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 transition-all duration-300 transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full lg:w-[260px]'}`}>
        <AppSidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[260px] h-screen relative z-10">
        {/* Mobile Header */}
        <header className="lg:hidden flex h-20 items-center justify-between border-b bg-white px-4 shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 flex items-center justify-center rounded-xl bg-white shadow-md border border-slate-100 overflow-hidden shrink-0">
              <img src="/school-logo-official.png" alt="School Logo" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-primary text-[18px] leading-none tracking-tight">ADARSH OXFORD</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Management System</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-slate-600 hover:bg-slate-100"
          >
            {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 scroll-smooth -webkit-overflow-scrolling-touch">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
