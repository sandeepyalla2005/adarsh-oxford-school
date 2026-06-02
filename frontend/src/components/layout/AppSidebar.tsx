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
  ClipboardList,
  Wallet,
  ChevronDown,
  ChevronRight,
  IndianRupee,
  UserMinus
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getCurrentPortal, portalPath } from '@/lib/portal';
import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
const adminNavigation = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'Students', path: '/students', icon: GraduationCap, roles: ['admin'] },
  { 
    name: 'Fees Management', 
    icon: Wallet, 
    roles: ['admin', 'feeInCharge'],
    isFolder: true,
    children: [
      { name: 'Course Fees', path: '/course-fees', icon: BookOpen },
      { name: 'Books Fees', path: '/books-fees', icon: BookOpen },
      { name: 'Transport Fees', path: '/transport-fees', icon: Bus },
      { name: 'Accessories', path: '/accessories', icon: ShoppingBag },
      { name: 'Fee History', path: '/fee-history', icon: History },
      { name: 'Pending Fees', path: '/pending-fees', icon: AlertCircle },
    ]
  },
  { name: 'Fee Analytics', path: '/fee-analytics', icon: BarChart3, roles: ['admin'] },
  { name: 'Financial Reports', path: '/financial-reports', icon: BarChart3, roles: ['admin'] },
  { name: 'Audit Logs', path: '/audit', icon: History, roles: ['admin'] },
  { name: 'Notices', path: '/notices', icon: MessageSquare, roles: ['admin'] },
  { name: 'Dropouts Dashboard', path: '/approvals', icon: AlertCircle, roles: ['admin'] },
  { name: 'Student Exit Register', path: '/left-students', icon: UserMinus, roles: ['admin'] },
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
  { name: 'Financial Reports', path: '/financial-reports', icon: BarChart3, roles: ['staff', 'admin', 'feeInCharge'] },
  { 
    name: 'Fees Management', 
    icon: Wallet, 
    roles: ['feeInCharge', 'admin'],
    isFolder: true,
    children: [
      { name: 'Course Fees', path: '/course-fees', icon: BookOpen },
      { name: 'Books Fees', path: '/books-fees', icon: BookOpen },
      { name: 'Transport Fees', path: '/transport-fees', icon: Bus },
      { name: 'Accessories', path: '/accessories', icon: ShoppingBag },
    ]
  },
];

const feeNavigation = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'feeInCharge'] },
  { name: 'Students', path: '/students', icon: GraduationCap, roles: ['admin', 'feeInCharge'] },
  { 
    name: 'Fees Management', 
    icon: Wallet, 
    roles: ['admin', 'feeInCharge'],
    isFolder: true,
    children: [
      { name: 'Course Fees', path: '/course-fees', icon: BookOpen },
      { name: 'Books Fees', path: '/books-fees', icon: BookOpen },
      { name: 'Transport Fees', path: '/transport-fees', icon: Bus },
      { name: 'Accessories', path: '/accessories', icon: ShoppingBag },
      { name: 'Fee History', path: '/fee-history', icon: History },
      { name: 'Pending Fees', path: '/pending-fees', icon: AlertCircle },
    ]
  },
  { name: 'Financial Reports', path: '/financial-reports', icon: BarChart3, roles: ['admin', 'feeInCharge'] },
  { name: 'Student Exit Register', path: '/left-students', icon: UserMinus, roles: ['admin', 'feeInCharge'] },
  { name: 'Notices', path: '/notices', icon: MessageSquare, roles: ['admin', 'feeInCharge'] },
  { name: 'Attendance', path: '/attendance', icon: UserCheck, roles: ['admin', 'feeInCharge'] },
  { name: 'Homework', path: '/homework', icon: ClipboardList, roles: ['admin', 'feeInCharge'] },
  { name: 'Time Table', path: '/time-table', icon: CalendarDays, roles: ['admin', 'feeInCharge'] },
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
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isFeesExpanded, setIsFeesExpanded] = useState(false);
  const buildHref = (path: string) => portalPath(portal, path);

  // Restore scroll position on mount
  useLayoutEffect(() => {
    const savedScrollPos = sessionStorage.getItem('sidebar-scroll');
    if (navRef.current && savedScrollPos) {
      navRef.current.scrollTop = parseInt(savedScrollPos, 10);
    }
  }, []);

  // Auto-expand folder if a child is active
  useEffect(() => {
    const portalConfig = portal === 'admin' ? adminNavigation : portal === 'fee' ? feeNavigation : staffNavigation;
    const feesFolder = portalConfig.find(item => item.isFolder);
    if (feesFolder && feesFolder.children) {
      const isChildActive = feesFolder.children.some(child => isActive(buildHref(child.path)));
      if (isChildActive) {
        setIsFeesExpanded(true);
      }
    }
  }, [location.pathname]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    sessionStorage.setItem('sidebar-scroll', e.currentTarget.scrollTop.toString());
  };

  const isActive = (href: string) =>
    location.pathname === href || location.pathname === href.replace(/^\/(admin|staff|fee)/, '');

  const handleLogoutClick = () => {
    setIsLogoutDialogOpen(true);
  };

  const handleConfirmLogout = () => {
    setIsLogoutDialogOpen(false);
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
          <Link to={buildHref('/dashboard')} className="flex items-center gap-4 group">
            {/* Crest with Motto Above */}
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-[#A8B6CF] mb-1 opacity-70">
                A Way and a Vision
              </span>
              <div className="h-20 w-20 flex items-center justify-center transition-transform group-hover:scale-105 shrink-0">
                <img src="/school-logo-official.png" alt="School Logo" className="h-full w-full object-contain filter drop-shadow-lg" />
              </div>
            </div>

            {/* School Name */}
            <div className="flex flex-col justify-center">
              <h1 className="flex flex-col leading-[0.85]">
                <span className="text-[22px] font-black tracking-tighter text-white">
                  Oxford
                </span>
                <span className="text-[22px] font-medium tracking-tight text-white mt-0.5">
                  School
                </span>
              </h1>
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
              if (item.isFolder) {
                const isAnyChildActive = item.children?.some(child => isActive(buildHref(child.path)));
                return (
                  <div key={item.name} className="space-y-1">
                    <button
                      onClick={() => setIsFeesExpanded(!isFeesExpanded)}
                      className={cn(
                        'group flex w-full items-center justify-between px-4 py-3 rounded-xl transition-all duration-300',
                        isAnyChildActive ? 'text-white font-semibold' : 'text-[#8EA1C0] hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <item.icon strokeWidth={isAnyChildActive ? 2.5 : 2} className={cn(
                          "h-[18px] w-[18px]",
                          isAnyChildActive ? "text-white" : "text-[#8EA1C0] group-hover:text-white"
                        )} />
                        <span className="text-[14px]">{item.name}</span>
                      </div>
                      {isFeesExpanded ? (
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      )}
                    </button>
                    
                    {isFeesExpanded && (
                      <div className="ml-6 space-y-1 border-l border-white/10 pl-4 transition-all duration-300">
                        {item.children?.map((child) => {
                          const active = isActive(buildHref(child.path));
                          return (
                            <Link
                              key={child.name}
                              to={buildHref(child.path)}
                              onClick={onClose}
                              className={cn(
                                'group flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-300',
                                active ? 'bg-[#293B5F] text-white font-medium shadow-sm' : 'text-[#8EA1C0] hover:text-white'
                              )}
                            >
                              <child.icon className={cn(
                                "h-4 w-4",
                                active ? "text-white" : "text-[#8EA1C0] group-hover:text-white"
                              )} />
                              <span className="text-[13px]">{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

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
            onClick={handleLogoutClick}
            className="group flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[#8EA1C0] transition-all hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px] text-[#8EA1C0] group-hover:text-white transition-all" />
            Log Out
          </button>
        </div>
      </div>

      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? You will need to sign in again to access the portal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsLogoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmLogout}>
              Log Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
