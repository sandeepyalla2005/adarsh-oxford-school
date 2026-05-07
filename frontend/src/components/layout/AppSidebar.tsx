import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Bus,
  ShoppingBag,
  History,
  AlertCircle,
  Settings,
  UserCog,
  MessageSquare,
  LogOut,
  CalendarDays,
  CalendarRange,
  UserRoundCog,
  BarChart3,
  UserCheck,
  ClipboardList
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getCurrentPortal, portalPath } from '@/lib/portal';
import { useRef, useLayoutEffect } from 'react';
const adminNavigation = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'Students', path: '/students', icon: GraduationCap, roles: ['admin'] },
  { name: 'Course Fees', path: '/course-fees', icon: BookOpen, roles: ['admin', 'feeInCharge'] },
  { name: 'Books Fees', path: '/books-fees', icon: BookOpen, roles: ['admin', 'feeInCharge'] },
  { name: 'Transport Fees', path: '/transport-fees', icon: Bus, roles: ['admin', 'feeInCharge'] },
  { name: 'Accessories', path: '/accessories', icon: ShoppingBag, roles: ['admin', 'feeInCharge'] },
  { name: 'Fee Analytics', path: '/fee-analytics', icon: BarChart3, roles: ['admin'] },
  { name: 'Audit Logs', path: '/audit', icon: History, roles: ['admin'] },
  { name: 'Notices', path: '/notices', icon: MessageSquare, roles: ['admin'] },
  { name: 'SMS', path: '/sms', icon: MessageSquare, roles: ['admin'] },
  { name: 'Attendance', path: '/attendance', icon: UserCheck, roles: ['admin'] },
  { name: 'Homework', path: '/homework', icon: ClipboardList, roles: ['admin'] },
  { name: 'Time Table', path: '/time-table', icon: CalendarDays, roles: ['admin'] },
  { name: 'Academic Calendar', path: '/academic-calendar', icon: CalendarRange, roles: ['admin'] },
];

const staffNavigation = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['staff', 'admin', 'feeInCharge'] },
  { name: 'My Profile', path: '/profile', icon: UserCog, roles: ['staff', 'admin', 'feeInCharge'] },
  { name: 'Students', path: '/students', icon: GraduationCap, roles: ['staff', 'admin', 'feeInCharge'] },
  { name: 'Attendance', path: '/attendance', icon: CalendarRange, roles: ['staff', 'admin', 'feeInCharge'] },
  { name: 'Homework', path: '/homework', icon: BookOpen, roles: ['staff', 'admin', 'feeInCharge'] },
  { name: 'Notices', path: '/notices', icon: MessageSquare, roles: ['staff', 'admin', 'feeInCharge'] },
  { name: 'Schedule', path: '/schedule', icon: CalendarDays, roles: ['staff', 'admin', 'feeInCharge'] },
  { name: 'Academic Calendar', path: '/academic-calendar', icon: CalendarRange, roles: ['staff', 'admin', 'feeInCharge'] },
  { name: 'Course Fees', path: '/course-fees', icon: BookOpen, roles: ['feeInCharge', 'admin'] },
  { name: 'Books Fees', path: '/books-fees', icon: BookOpen, roles: ['feeInCharge', 'admin'] },
  { name: 'Transport Fees', path: '/transport-fees', icon: Bus, roles: ['feeInCharge', 'admin'] },
  { name: 'Accessories', path: '/accessories', icon: ShoppingBag, roles: ['feeInCharge', 'admin'] },
];

const feeNavigation = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'feeInCharge'] },
  { name: 'Students', path: '/students', icon: GraduationCap, roles: ['admin', 'feeInCharge'] },
  { name: 'Course Fees', path: '/course-fees', icon: BookOpen, roles: ['admin', 'feeInCharge'] },
  { name: 'Books Fees', path: '/books-fees', icon: BookOpen, roles: ['admin', 'feeInCharge'] },
  { name: 'Transport Fees', path: '/transport-fees', icon: Bus, roles: ['admin', 'feeInCharge'] },
  { name: 'Accessories', path: '/accessories', icon: ShoppingBag, roles: ['admin', 'feeInCharge'] },
  { name: 'Fee History', path: '/fee-history', icon: History, roles: ['admin', 'feeInCharge'] },
  { name: 'Pending Fees', path: '/pending-fees', icon: AlertCircle, roles: ['admin', 'feeInCharge'] },
  { name: 'Notices', path: '/notices', icon: MessageSquare, roles: ['admin', 'feeInCharge'] },
  { name: 'SMS', path: '/sms', icon: MessageSquare, roles: ['admin', 'feeInCharge'] },
  { name: 'Academic Calendar', path: '/academic-calendar', icon: CalendarRange, roles: ['admin', 'feeInCharge'] },
];

const adminSettingsNavigation = [
  { name: 'Fee Structure', path: '/fee-structure', icon: Settings, roles: ['admin', 'feeInCharge'] },
  { name: 'Staff Login', path: '/staff-login', icon: UserRoundCog, roles: ['admin'] },
  { name: 'Settings', path: '/settings', icon: Settings, roles: ['admin'] },
];

const feeSettingsNavigation = [
  { name: 'Fee Structure', path: '/fee-structure', icon: Settings, roles: ['admin', 'feeInCharge'] },
  { name: 'Receipt', path: '/receipt', icon: ClipboardList, roles: ['admin', 'feeInCharge'] },
];

interface AppSidebarProps {
  onClose?: () => void;
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const location = useLocation();
  const { userRole, signOut, user, profile } = useAuth();
  const navRef = useRef<HTMLElement>(null);
  const portal = getCurrentPortal(location.pathname);
  const buildHref = (path: string) => portalPath(portal, path);

  // Restore scroll position on mount
  useLayoutEffect(() => {
    const savedScrollPos = sessionStorage.getItem('sidebar-scroll');
    if (navRef.current && savedScrollPos) {
      navRef.current.scrollTop = parseInt(savedScrollPos, 10);
    }
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    sessionStorage.setItem('sidebar-scroll', e.currentTarget.scrollTop.toString());
  };

  const isActive = (href: string) =>
    location.pathname === href || location.pathname === href.replace(/^\/(admin|staff|fee)/, '');

  const handleLogout = () => {
    signOut();
  };

  const visibleRole = userRole || '';
  const portalConfig =
    portal === 'admin'
      ? { main: adminNavigation, secondary: adminSettingsNavigation }
      : portal === 'fee'
        ? { main: feeNavigation, secondary: feeSettingsNavigation }
        : { main: staffNavigation, secondary: [] as typeof adminSettingsNavigation };

  const filteredMainNav = portalConfig.main.filter(item => item.roles.includes(visibleRole));
  const filteredAdminNav = portalConfig.secondary.filter(item => item.roles.includes(visibleRole));

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[260px] bg-[#1A2642] text-white shadow-2xl transition-all duration-300">
      <div className="flex h-full flex-col">
        {/* Logo Section */}
        <div className="flex flex-col justify-center px-6 pt-12 pb-8">
          <Link to={buildHref('/dashboard')} className="flex items-center gap-5 group">
            <div className="h-16 w-16 flex items-center justify-center transition-transform group-hover:scale-110 shrink-0">
              <img src="/school-logo-official.png" alt="School Logo" className="h-full w-full object-contain filter drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-serif text-[24px] font-black leading-none text-white tracking-tighter">
                ADARSH
                <span className="block text-[24px] text-white/90">OXFORD</span>
              </h1>
              <p className="text-[10px] font-bold leading-tight text-[#A8B6CF] uppercase tracking-[0.3em] mt-2 opacity-80">
                A Way and a Vision
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Section */}
        <nav
          ref={navRef}
          onScroll={handleScroll}
          className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-6 scrollbar-hide"
        >
          <div className="space-y-1">
            {filteredMainNav.map((item) => {
              const active = isActive(buildHref(item.path));
              return (
                <Link
                  key={item.name}
                  to={buildHref(item.path)}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300',
                    active ? 'bg-[#293B5F] text-white font-semibold shadow-md' : 'text-[#8EA1C0] hover:bg-white/5 hover:text-white'
                  )}
                >
                  <item.icon strokeWidth={active ? 2.5 : 2} className={cn(
                    "h-[18px] w-[18px] transition-all duration-300",
                    active ? "text-white" : "text-[#8EA1C0] group-hover:text-white"
                  )} />
                  <span className="text-[14px]">{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#6A7B9C]">
            Administration
          </div>
          <div className="space-y-1">
            {filteredAdminNav.map((item) => {
              const active = isActive(buildHref(item.path));
              return (
              <Link
                key={item.name}
                to={buildHref(item.path)}
                onClick={onClose}
                className={cn(
                  'group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300',
                  active ? 'bg-[#293B5F] text-white font-semibold shadow-md' : 'text-[#8EA1C0] hover:bg-white/5 hover:text-white'
                )}
              >
                <item.icon strokeWidth={active ? 2.5 : 2} className={cn(
                  "h-[18px] w-[18px] transition-all duration-300",
                  active ? "text-white" : "text-[#8EA1C0] group-hover:text-white"
                )} />
                <span className="text-[14px]">{item.name}</span>
              </Link>
            )})}
          </div>
        </nav>

        {/* User profile section */}
        <div className="mt-auto border-t border-white/5 bg-[#141F32]/50 p-6">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#293B5F] shadow-inner overflow-hidden ring-2 ring-white/10">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'User'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src="/school-logo-official.png"
                  alt="School Logo"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-[14px] font-bold text-white tracking-wide">
                {profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Super Admin'}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6A7B9C] mt-0.5">
                {userRole === 'admin' ? 'ADMIN' : userRole}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[#8EA1C0] transition-all hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px] text-[#8EA1C0] group-hover:text-white transition-all" />
            Log Out
          </button>
        </div>
      </div>
    </aside>
  );
}
