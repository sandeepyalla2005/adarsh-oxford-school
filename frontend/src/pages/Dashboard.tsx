import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAfter } from 'date-fns';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  IndianRupee,
  AlertCircle,
  TrendingUp,
  BookOpen,
  Bus,
  Calendar,
  RefreshCw,
  Wallet,
  QrCode,
  Building2,
  CreditCard,
  Smartphone,
  MessageSquare,
  Plus,
  User,
  XCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { apiFetch } from '@/lib/api';
import { getCurrentPortal, portalPath } from '@/lib/portal';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// Oxford-inspired vibrant colors for dark theme
const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

interface IncomeBreakdown {
  cash: number;
  upi: number;
  bank: number;
  cards: number;
  swiping: number;
}

import StaffDashboard from './staff/StaffDashboard';
import { useAcademicYear } from '@/contexts/AcademicYearContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const portal = getCurrentPortal(location.pathname);
  const { user, userRole, profile, isLoading: authLoading, signOut } = useAuth();
  const { currentAcademicYear } = useAcademicYear();

  // --- All state hooks must be declared before any conditional returns ---
  const [academicYear, setAcademicYear] = useState<string>('');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Course' | 'Books' | 'Transport' | 'Accessory'>('All');
  const [stats, setStats] = useState({
    totalStudents: 0,
    newStudents: 0,
    oldStudents: 0,
    todayIncome: 0,
    weeklyIncome: 0,
    monthlyIncome: 0,
    pendingCourse: 0,
    pendingBooks: 0,
    pendingTransport: 0,
    pendingAccessories: 0,
    todayCourse: 0, todayBooks: 0, todayTransport: 0, todayAccessories: 0,
    weeklyCourse: 0, weeklyBooks: 0, weeklyTransport: 0, weeklyAccessories: 0,
    monthlyCourse: 0, monthlyBooks: 0, monthlyTransport: 0, monthlyAccessories: 0,
  });

  const emptyBreakdown = (): IncomeBreakdown => ({ cash: 0, upi: 0, bank: 0, cards: 0, swiping: 0 });
  const emptyGroup = () => ({ All: emptyBreakdown(), Course: emptyBreakdown(), Books: emptyBreakdown(), Transport: emptyBreakdown(), Accessory: emptyBreakdown() });

  const [categoryBreakdowns, setCategoryBreakdowns] = useState<{
    today: { All: IncomeBreakdown; Course: IncomeBreakdown; Books: IncomeBreakdown; Transport: IncomeBreakdown; Accessory: IncomeBreakdown; };
    week: { All: IncomeBreakdown; Course: IncomeBreakdown; Books: IncomeBreakdown; Transport: IncomeBreakdown; Accessory: IncomeBreakdown; };
    month: { All: IncomeBreakdown; Course: IncomeBreakdown; Books: IncomeBreakdown; Transport: IncomeBreakdown; Accessory: IncomeBreakdown; };
  }>({
    today: emptyGroup(),
    week: emptyGroup(),
    month: emptyGroup(),
  });

  const [showStudentBreakdown, setShowStudentBreakdown] = useState(false);
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false);
  const [livePendingStudents, setLivePendingStudents] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState<{
    name: string;
    amount: number;
    displayLabel: string;
    amountFormatted: string;
    trend?: string;
    trendColor?: string;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notices, setNotices] = useState<{ id: number; title: string; content: string; created_at: string; author: string; pinned: boolean; expires_at?: string }[]>([]);
  const [isNoticesLoading, setIsNoticesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingWipes, setPendingWipes] = useState<{ user_id: string; user_name: string; otp: string }[]>([]);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const resp = await apiFetch('/api/dashboard/stats');
        if (!resp.ok) throw new Error('Backend analytics offline');
        const data = await resp.json();

        const totalStudents = Number(data.totalStudents) || 0;
        const newStudents = Number(data.newStudents) || 0;
        const oldStudents = Number(data.oldStudents) || 0;
        const todayIncome = Number(data.todayIncome) || 0;
        const weeklyIncome = Number(data.weeklyIncome) || 0;
        const monthlyIncome = Number(data.monthlyIncome) || 0;

        setStats({
          totalStudents,
          newStudents,
          oldStudents,
          todayIncome,
          weeklyIncome,
          monthlyIncome,
          pendingCourse:    Number(data.pendingCourse)    || 0,
          pendingBooks:     Number(data.pendingBooks)     || 0,
          pendingTransport: Number(data.pendingTransport) || 0,
          pendingAccessories: Number(data.pendingAccessories) || 0,
          // Per-category today
          todayCourse:     Number(data.todayCourse)      || 0,
          todayBooks:      Number(data.todayBooks)       || 0,
          todayTransport:  Number(data.todayTransport)   || 0,
          todayAccessories:Number(data.todayAccessories) || 0,
          // Per-category week
          weeklyCourse:    Number(data.weeklyCourse)     || 0,
          weeklyBooks:     Number(data.weeklyBooks)      || 0,
          weeklyTransport: Number(data.weeklyTransport)  || 0,
          weeklyAccessories:Number(data.weeklyAccessories)||0,
          // Per-category month
          monthlyCourse:   Number(data.monthlyCourse)    || 0,
          monthlyBooks:    Number(data.monthlyBooks)     || 0,
          monthlyTransport:Number(data.monthlyTransport) || 0,
          monthlyAccessories:Number(data.monthlyAccessories)||0,
        });

        if (data.monthlyChartData) {
          setMonthlyData(data.monthlyChartData);
        }

        if (data.categoryBreakdowns) {
          setCategoryBreakdowns(data.categoryBreakdowns);
        }
        if (data.academicYear) {
          setAcademicYear(data.academicYear);
        }
        
        setLastUpdated(new Date(data.lastUpdated));
        setShowStudentBreakdown(false);
      } catch (err: any) {
        console.error('Failed to fetch dashboard stats:', err);
        setError(err.message || 'Backend connection failed.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        setIsNoticesLoading(true);
        const resp = await apiFetch('/api/notices');
        if (!resp.ok) throw new Error('Backend notices offline');
        const data = await resp.json();
        setNotices(data);
      } catch (err) {
        console.error('Failed to fetch notices:', err);
      } finally {
        setIsNoticesLoading(false);
      }
    };

    fetchNotices();

    const channel = supabase
      .channel('admin-notices')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notices' },
        (payload) => {
          setNotices(prev => [payload.new as any, ...prev].slice(0, 3));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (userRole !== 'admin') return;

    const fetchPendingWipes = async () => {
      try {
        const resp = await apiFetch('/api/auth/admin/pending-wipes');
        if (resp.ok) {
          const data = await resp.json();
          setPendingWipes(data);
        }
      } catch (err) {
        console.error('Failed to fetch pending wipes:', err);
      }
    };

    fetchPendingWipes();
    const interval = setInterval(fetchPendingWipes, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [userRole]);

  if (authLoading || (user && userRole === null)) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-[400px] items-center justify-center gap-6">
          <div className="relative">
            <div className="h-20 w-20 animate-spin rounded-full border-[6px] border-blue-100 border-t-[#002147]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-[#002147] animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-bold text-[#002147] tracking-tight">Personalizing your dashboard...</p>
            <p className="text-sm text-slate-400 font-medium">Verifying your secure access role</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (userRole === 'staff' || portal === 'staff') {
    return <StaffDashboard />;
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  // Academic year start — Indian academic year starts April 1 (month index 3)
  const academicYearStart = (() => {
    const now = new Date();
    return new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);
  })();

  const pendingData = [
    { name: 'Course Fees', value: stats.pendingCourse },
    { name: 'Books Fees', value: stats.pendingBooks },
    { name: 'Transport Fees', value: stats.pendingTransport },
    { name: 'Accessories Fees', value: stats.pendingAccessories },
  ];


  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-header"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 rounded-2xl border-4 border-white bg-white/50 backdrop-blur-md shadow-xl overflow-hidden flex items-center justify-center transition-transform hover:scale-105">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="bg-slate-100 h-full w-full flex items-center justify-center">
                    <User className="h-8 w-8 text-[#002147] opacity-40" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="page-title">Dashboard</h1>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#002147] text-white shadow-sm border border-white/10">
                    Academic Year: {academicYear || currentAcademicYear}
                  </span>
                </div>
                <p className="page-description">
                  Welcome back, <span className="font-bold text-[#002147]">{profile?.full_name || user?.email?.split('@')[0] || 'Administrator'}</span>! Here's an overview of Adarsh Oxford.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="border-slate-200 text-[#002147] hover:bg-slate-50"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white"
                onClick={() => navigate(portalPath(portal, '/notices'))}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Post Notice
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Pending Wipe Requests Alert */}
        {pendingWipes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-6 rounded-[2rem] bg-gradient-to-r from-red-50 to-white border-2 border-red-100 shadow-xl shadow-red-500/10 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-[1.25rem] bg-red-100 flex items-center justify-center animate-bounce shadow-inner">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-red-800 font-display">System Wipe Requested!</h3>
                <p className="text-red-600 text-sm font-bold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                  {pendingWipes[0].user_name} is requesting a full database wipe.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white px-8 py-4 rounded-[1.5rem] border-2 border-red-200 shadow-lg group">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Confirmation OTP</span>
                <span className="text-4xl font-black text-red-600 font-display tracking-[0.3em] group-hover:scale-110 transition-transform">
                  {pendingWipes[0].otp}
                </span>
              </div>
              <div className="h-10 w-px bg-red-100" />
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-red-400 hover:text-red-600 font-bold"
                onClick={() => setPendingWipes([])} // Temporary hide
              >
                Dismiss
              </Button>
            </div>
          </motion.div>
        )}

        {/* Recent Notices Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="card-elevated border-none bg-sidebar shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-sidebar-foreground">Recent Notices</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:bg-primary/10"
                onClick={() => navigate(portalPath(portal, '/notices'))}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {isNoticesLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-sidebar-accent/50" />
                  ))
                ) : notices.length > 0 ? (
                  notices.filter(n => !n.expires_at || isAfter(new Date(n.expires_at), new Date())).slice(0, 3).map((notice) => (
                    <div
                      key={notice.id}
                      className="group relative overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent/20 p-4 transition-all hover:bg-sidebar-accent/30"
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="font-display font-semibold text-sidebar-foreground line-clamp-1">
                          {notice.title}
                        </h4>
                        <div className="rounded-full bg-primary/10 p-1">
                          <AlertCircle className="h-3 w-3 text-primary" />
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-sidebar-foreground/60 line-clamp-2">
                        {notice.content}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-sidebar-foreground/40 uppercase tracking-wider">
                        <span>{notice.author || 'Admin'}</span>
                        <span>{new Date(notice.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 text-center py-6 text-muted-foreground">
                    No recent notices. Post one to keep staff updated!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Premium Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

          {/* Total Students Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 p-6 shadow-lg group cursor-pointer hover:shadow-xl transition-all"
            onClick={() => setShowStudentBreakdown(!showStudentBreakdown)}
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-violet-50 blur-2xl transition-transform group-hover:scale-150" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="rounded-2xl bg-violet-100 p-2.5">
                  <GraduationCap className="h-5 w-5 text-violet-600" />
                </div>
                {showStudentBreakdown ?
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 px-2 py-1 rounded-lg"> detailed </span> :
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 px-2 py-1 rounded-lg"> Active </span>
                }
              </div>
              <h3 className="text-sm font-medium text-slate-500">Total Students</h3>
              <p className="text-2xl font-black font-display tracking-tight mt-1 text-slate-800">{stats?.totalStudents || 0}</p>

              {showStudentBreakdown && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6 pt-6 border-t border-slate-100"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center p-2.5">
                        <img src="/school-logo.png" alt="School Logo" className="h-full w-full object-contain" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-0.5">Old Students</p>
                        <p className="text-2xl font-black text-[#002147] font-display">{stats.oldStudents}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
                        <Plus className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-0.5">New Students</p>
                        <p className="text-2xl font-black text-[#002147] font-display">{stats.newStudents}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Today's Income Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => { setSelectedTimeRange('today'); setSelectedCategory('All'); setShowIncomeBreakdown(true); }}
            className={`relative overflow-hidden rounded-[2rem] bg-white border p-6 shadow-lg group cursor-pointer transition-all hover:shadow-xl ${selectedTimeRange === 'today' ? 'border-blue-300 ring-2 ring-blue-200' : 'border-slate-100'}`}
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-blue-50 blur-2xl transition-transform group-hover:scale-150" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="rounded-2xl bg-blue-100 p-2.5">
                  <IndianRupee className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-slate-500">Today's Income</h3>
              <p className="text-2xl font-black font-display tracking-tight mt-1 text-slate-800">{formatCurrency(stats?.todayIncome || 0)}</p>
              <div className="mt-4 text-[10px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1">
                Click for details <TrendingUp className="h-3 w-3" />
              </div>
            </div>
          </motion.div>

          {/* Weekly Income Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => { setSelectedTimeRange('week'); setSelectedCategory('All'); }}
            className={`relative overflow-hidden rounded-[2rem] bg-white border p-6 shadow-lg group cursor-pointer transition-all hover:shadow-xl ${selectedTimeRange === 'week' ? 'border-teal-300 ring-2 ring-teal-200' : 'border-slate-100'}`}
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-teal-50 blur-2xl transition-transform group-hover:scale-150" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="rounded-2xl bg-teal-100 p-2.5">
                  <Calendar className="h-5 w-5 text-teal-600" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-700 px-2 py-1 rounded-lg"> This Week </span>
              </div>
              <h3 className="text-sm font-medium text-slate-500">Weekly Income</h3>
              <p className="text-2xl font-black font-display tracking-tight mt-1 text-slate-800">{formatCurrency(stats?.weeklyIncome || 0)}</p>
            </div>
          </motion.div>

          {/* Monthly Income Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => { setSelectedTimeRange('month'); setSelectedCategory('All'); }}
            className={`relative overflow-hidden rounded-[2rem] bg-white border p-6 shadow-lg group cursor-pointer transition-all hover:shadow-xl ${selectedTimeRange === 'month' ? 'border-rose-300 ring-2 ring-rose-200' : 'border-slate-100'}`}
          >
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-rose-50 blur-2xl transition-transform group-hover:scale-150" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="rounded-2xl bg-rose-100 p-2.5">
                  <TrendingUp className="h-5 w-5 text-rose-600" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 px-2 py-1 rounded-lg"> This Month </span>
              </div>
              <h3 className="text-sm font-medium text-slate-500">Monthly Income</h3>
              <p className="text-2xl font-black font-display tracking-tight mt-1 text-slate-800">{formatCurrency(stats?.monthlyIncome || 0)}</p>
            </div>
          </motion.div>

        </div>

        {/* Daily Collection Split - Replaces Pending Fee Summary */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              id: 'Course',
              title: "Course Fee",
              value: selectedTimeRange === 'today' ? stats.todayCourse : selectedTimeRange === 'week' ? stats.weeklyCourse : stats.monthlyCourse,
              pending: stats.pendingCourse,
              icon: <IndianRupee className="h-6 w-6 text-blue-600" />,
              iconBg: "bg-blue-100",
              glowBg: "bg-blue-50",
              accentText: "text-blue-600",
              accentBg: "bg-blue-100",
              ring: "border-blue-300 ring-2 ring-blue-200"
            },
            {
              id: 'Books',
              title: "Books Fee",
              value: selectedTimeRange === 'today' ? stats.todayBooks : selectedTimeRange === 'week' ? stats.weeklyBooks : stats.monthlyBooks,
              pending: stats.pendingBooks,
              icon: <BookOpen className="h-6 w-6 text-amber-600" />,
              iconBg: "bg-amber-100",
              glowBg: "bg-amber-50",
              accentText: "text-amber-600",
              accentBg: "bg-amber-100",
              ring: "border-amber-300 ring-2 ring-amber-200"
            },
            {
              id: 'Transport',
              title: "Transport Fee",
              value: selectedTimeRange === 'today' ? stats.todayTransport : selectedTimeRange === 'week' ? stats.weeklyTransport : stats.monthlyTransport,
              pending: stats.pendingTransport,
              icon: <Bus className="h-6 w-6 text-emerald-600" />,
              iconBg: "bg-emerald-100",
              glowBg: "bg-emerald-50",
              accentText: "text-emerald-600",
              accentBg: "bg-emerald-100",
              ring: "border-emerald-300 ring-2 ring-emerald-200"
            },
            {
              id: 'Accessory',
              title: "Accessories",
              value: selectedTimeRange === 'today' ? stats.todayAccessories : selectedTimeRange === 'week' ? stats.weeklyAccessories : stats.monthlyAccessories,
              pending: stats.pendingAccessories,
              icon: <Plus className="h-6 w-6 text-purple-600" />,
              iconBg: "bg-purple-100",
              glowBg: "bg-purple-50",
              accentText: "text-purple-600",
              accentBg: "bg-purple-100",
              ring: "border-purple-300 ring-2 ring-purple-200"
            }
          ].map((item, index) => {
            const isSelected = selectedCategory === item.id;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  scale: isSelected ? 1.05 : 1,
                  y: isSelected ? -5 : 0
                }}
                transition={{ delay: 0.1 * index }}
                className={`relative overflow-hidden rounded-[2rem] bg-white border p-6 shadow-lg cursor-pointer group hover:shadow-xl transition-all ${isSelected ? item.ring : 'border-slate-100'}`}
                onClick={() => setSelectedCategory(prev => prev === item.id ? 'All' : item.id as any)}
              >
                <div className={`absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full ${item.glowBg} blur-2xl transition-transform group-hover:scale-150`} />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`rounded-2xl ${item.iconBg} p-3`}>
                      {item.icon}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${item.accentBg} ${item.accentText} px-2 py-1 rounded-lg flex items-center gap-1`}>
                      {isSelected && <div className={`h-1.5 w-1.5 rounded-full ${item.accentText.replace('text-', 'bg-')} animate-pulse`} />}
                      {selectedTimeRange === 'today' ? 'Today' : selectedTimeRange === 'week' ? 'This Week' : 'This Month'}
                    </span>
                  </div>

                  <h3 className="text-lg font-medium text-slate-500">{item.title}</h3>
                  <p className="text-3xl font-black font-display tracking-tight mt-1 text-slate-800">
                    {formatCurrency(item.value)}
                  </p>

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 font-medium">{item.id === 'Accessory' ? 'Total Sales' : 'Pending Dues'}</span>
                      <span className={`font-bold ${item.accentBg} ${item.accentText} px-2 py-0.5 rounded`}>
                        {formatCurrency(item.id === 'Accessory' ? item.value : item.pending)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Payment Modes Breakdown - Only visible when a specific category is selected */}
        {selectedCategory !== 'All' && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2.5rem] bg-white border border-slate-100 shadow-xl p-8 relative overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 relative z-10 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-[#002147] font-display">
                    {selectedCategory} Payment Modes ({selectedTimeRange === 'today' ? 'Today' : selectedTimeRange === 'week' ? 'This Week' : 'This Month'})
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-blue-100 text-blue-700">
                    Filtered
                  </span>
                </div>
                <p className="text-slate-400 font-medium">
                  Breakdown of collections for {selectedCategory} via different modes
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedCategory('All')} className="text-slate-400 hover:text-slate-600">
                  Hide Breakdown / Clear
                </Button>
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
              {[
                { label: 'Cash', value: (categoryBreakdowns[selectedTimeRange] as any)[selectedCategory]?.cash || 0, icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'UPI', value: (categoryBreakdowns[selectedTimeRange] as any)[selectedCategory]?.upi || 0, icon: QrCode, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Bank', value: (categoryBreakdowns[selectedTimeRange] as any)[selectedCategory]?.bank || 0, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Cards', value: (categoryBreakdowns[selectedTimeRange] as any)[selectedCategory]?.cards || 0, icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Swiping', value: (categoryBreakdowns[selectedTimeRange] as any)[selectedCategory]?.swiping || 0, icon: Smartphone, color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map((mode, i) => (
                <motion.div
                  key={i}
                  layoutId={`mode-${i}`}
                  className="flex flex-col items-center justify-center p-4 rounded-3xl bg-slate-50 border border-slate-100 hover:border-blue-100 hover:shadow-lg transition-all group cursor-default"
                >
                  <div className={`h-12 w-12 rounded-2xl ${mode.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <mode.icon className={`h-6 w-6 ${mode.color}`} />
                  </div>
                  <span className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">{mode.label}</span>
                  <span className={`text-lg font-black ${mode.color} font-display`}>
                    {formatCurrency(mode.value)}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}


        {/* Charts - Only show in consolidated view */}
        {selectedCategory === 'All' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Monthly Income Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="card-elevated border-none bg-sidebar shadow-lg">
                <CardHeader>
                  <CardTitle className="font-display text-sidebar-foreground">Monthly Income</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full flex justify-center items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `₹${value / 1000}k`}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          formatter={(value: number) => [formatCurrency(value), 'Income']}
                          contentStyle={{
                            backgroundColor: '#1a1f2e',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#f8fafc'
                          }}
                        />
                        <Legend verticalAlign="top" align="right" />
                        <Bar
                          dataKey="amount"
                          name="Total Collection"
                          fill="#F59E0B"
                          radius={[4, 4, 0, 0]}
                          barSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pending Fees Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="card-elevated border-none bg-sidebar shadow-lg">
                <CardHeader>
                  <CardTitle className="font-display text-sidebar-foreground">Pending Fees Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full flex justify-center items-center relative">
                    {pendingData.every(d => d.value === 0) ? (
                      <div className="text-center">
                        <p className="text-muted-foreground font-display text-lg">No pending fees</p>
                        <p className="text-xs text-muted-foreground/60">All collections are up to date! 🎉</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pendingData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => percent > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
                          >
                            {pendingData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [formatCurrency(value), 'Pending']}
                            contentStyle={{
                              backgroundColor: '#1a1f2e',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '8px',
                              color: '#f8fafc'
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Income Breakdown Dialog */}
        <Dialog open={showIncomeBreakdown} onOpenChange={setShowIncomeBreakdown}>
          <DialogContent className="max-w-md bg-white border-blue-50 text-slate-900 rounded-[2rem] p-0 overflow-hidden">
            <div className="bg-[#002147] p-8 text-white relative">
              <div className="absolute top-0 right-0 h-32 w-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
              <DialogHeader>
                <DialogTitle className="text-2xl font-black font-display text-white">Income Analysis</DialogTitle>
                <DialogDescription className="text-white/60">
                  Detailed {selectedCategory !== 'All' ? selectedCategory : 'Consolidated'} collection report for {selectedTimeRange === 'today' ? 'Today' : selectedTimeRange === 'week' ? 'This Week' : 'This Month'}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-8 space-y-4 bg-slate-50/50">
              {[
                { label: 'Cash', value: (categoryBreakdowns[selectedTimeRange] as any)[selectedCategory]?.cash || 0, icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'UPI', value: (categoryBreakdowns[selectedTimeRange] as any)[selectedCategory]?.upi || 0, icon: QrCode, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Bank', value: (categoryBreakdowns[selectedTimeRange] as any)[selectedCategory]?.bank || 0, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Cards', value: (categoryBreakdowns[selectedTimeRange] as any)[selectedCategory]?.cards || 0, icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Swiping', value: (categoryBreakdowns[selectedTimeRange] as any)[selectedCategory]?.swiping || 0, icon: Smartphone, color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map((mode, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${mode.bg}`}>
                      <mode.icon className={`h-5 w-5 ${mode.color}`} />
                    </div>
                    <span className="font-bold text-slate-700">{mode.label}</span>
                  </div>
                  <span className={`text-lg font-black ${mode.color} font-display`}>{formatCurrency(mode.value)}</span>
                </div>
              ))}

              <div className="mt-8 p-6 rounded-[2rem] bg-gradient-to-br from-[#002147] to-[#003366] text-white shadow-xl shadow-blue-900/20 flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Grand Total</p>
                  <p className="text-3xl font-black font-display">{formatCurrency(stats.todayIncome)}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                  <IndianRupee className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
