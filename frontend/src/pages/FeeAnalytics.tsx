import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  BookOpen,
  Bus,
  ShoppingBag,
  IndianRupee,
  TrendingUp,
  Download,
  Printer,
  ChevronDown,
  BarChart2,
  PieChart as PieChartIcon,
  RefreshCw,
  Calendar,
  XCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
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
  Legend,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CATEGORIES = [
  { key: 'course',    label: 'Course Fee',    icon: GraduationCap, color: '#3B82F6', bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200'    },
  { key: 'books',     label: 'Books Fee',     icon: BookOpen,       color: '#F59E0B', bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200'   },
  { key: 'transport', label: 'Transport Fee', icon: Bus,            color: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  { key: 'accessory', label: 'Accessories',   icon: ShoppingBag,    color: '#8B5CF6', bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-200'  },
];

interface MonthData {
  month: number;
  course: number;
  books: number;
  transport: number;
  accessory: number;
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const sumBy = (arr: any[], key: string) =>
  arr.reduce((s: number, r: any) => s + (Number(r[key]) || 0), 0);

// ─── Component ────────────────────────────────────────────────────────────────
export default function FeeAnalytics() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const { data: monthData = [], isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['fee-analytics', selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate   = `${selectedYear}-12-31`;

      const [courseRes, booksRes, transportRes, accessoryRes, accessoriesPaymentsRes] = await Promise.all([
        supabase.from('course_payments').select('amount_paid, payment_date').gte('payment_date', startDate).lte('payment_date', endDate),
        supabase.from('books_payments').select('amount_paid, payment_date').gte('payment_date', startDate).lte('payment_date', endDate),
        supabase.from('transport_payments').select('amount_paid, payment_date').gte('payment_date', startDate).lte('payment_date', endDate),
        supabase.from('accessory_sales').select('total_amount, created_at').gte('created_at', startDate).lte('created_at', endDate),
        supabase.from('student_accessory_payments').select('amount_paid, payment_date').gte('payment_date', startDate).lte('payment_date', endDate),
      ]);

      const anyError = courseRes.error || booksRes.error || transportRes.error || accessoryRes.error || accessoriesPaymentsRes.error;
      if (anyError) throw anyError;

      return Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const inMonth = (d: string) => {
          if (!d) return false;
          const parts = d.split('-');
          return parts.length > 1 && parseInt(parts[1], 10) === m;
        };

        const course    = (courseRes.data    || []).filter((r: any) => inMonth(r.payment_date)).reduce((s: number, r: any) => s + Number(r.amount_paid),  0);
        const books     = (booksRes.data     || []).filter((r: any) => inMonth(r.payment_date)).reduce((s: number, r: any) => s + Number(r.amount_paid),  0);
        const transport = (transportRes.data || []).filter((r: any) => inMonth(r.payment_date)).reduce((s: number, r: any) => s + Number(r.amount_paid),  0);
        const accessoryOld = (accessoryRes.data || []).filter((r: any) => inMonth(r.created_at)).reduce((s: number, r: any) => s + Number(r.total_amount), 0);
        const accessoryNew = (accessoriesPaymentsRes.data || []).filter((r: any) => inMonth(r.payment_date)).reduce((s: number, r: any) => s + Number(r.amount_paid), 0);
        const accessory = accessoryOld + accessoryNew;

        return { month: m, course, books, transport, accessory, total: course + books + transport + accessory };
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const error = queryError ? (queryError as any).message : null;
  const [chartView, setChartView] = useState<'bar' | 'pie'>('bar');
  const printRef = useRef<HTMLDivElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  // ── Derived ────────────────────────────────────────────────────────────────
  const displayData = selectedMonth === 'all'
    ? monthData
    : monthData.filter(d => d.month === selectedMonth);

  const yearly = {
    course:    monthData.reduce((s, d) => s + d.course,    0),
    books:     monthData.reduce((s, d) => s + d.books,     0),
    transport: monthData.reduce((s, d) => s + d.transport, 0),
    accessory: monthData.reduce((s, d) => s + d.accessory, 0),
    total:     monthData.reduce((s, d) => s + d.total,     0),
  };

  const pieData = CATEGORIES.map(c => ({
    name:  c.label,
    value: yearly[c.key as keyof typeof yearly],
    color: c.color,
  })).filter(d => d.value > 0);

  const barData = monthData.map((d, i) => ({
    name:      SHORT_MONTHS[i],
    Course:    d.course,
    Books:     d.books,
    Transport: d.transport,
    Accessory: d.accessory,
  }));

  // ── Print / PDF ────────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      {/* Print-only style */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #fee-analytics-print, #fee-analytics-print * { visibility: visible !important; }
          #fee-analytics-print { position: fixed; inset: 0; background: white; z-index: 9999; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="fee-analytics-print" ref={printRef} className="space-y-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="page-header">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-2xl bg-[#002147] flex items-center justify-center shrink-0">
                  <BarChart2 className="h-5 w-5 text-white" />
                </div>
                <h1 className="page-title">Fee Analytics &amp; Reports</h1>
              </div>
              <p className="page-description pl-[52px]">
                Monthly &amp; yearly revenue breakdown across all fee categories
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 no-print">
              {/* Year */}
              <Select value={String(selectedYear)} onValueChange={v => { setSelectedYear(Number(v)); setSelectedMonth('all'); }}>
                <SelectTrigger id="year-select" className="w-32 border-slate-200 rounded-xl font-semibold">
                  <Calendar className="h-4 w-4 mr-1 text-slate-500" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Month filter */}
              <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(v === 'all' ? 'all' : Number(v))}>
                <SelectTrigger id="month-select" className="w-36 border-slate-200 rounded-xl font-semibold">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-xl border-slate-200 gap-1.5">
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl border-slate-200 gap-1.5">
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </div>
        </motion.div>

        {/* --- Error Alert --- */}
        {error && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-red-900 mb-1">Connection Error</h3>
            <p className="text-red-700 max-w-md mx-auto mb-4">{error}</p>
            <Button variant="outline" onClick={() => refetch()} className="rounded-xl border-red-200 bg-white hover:bg-red-50 text-red-700 gap-2">
              <RefreshCw className="h-4 w-4" /> Try Reconnecting
            </Button>
          </motion.div>
        )}

        {/* ── Yearly Summary Cards ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#002147]" />
            <h2 className="text-lg font-bold text-[#002147] font-display">
              Yearly Summary — {selectedYear}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {CATEGORIES.map((cat, idx) => {
              const Icon = cat.icon;
              const val = yearly[cat.key as keyof typeof yearly];
              return (
                <motion.div
                  key={cat.key}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                  className={`relative overflow-hidden rounded-2xl border ${cat.border} bg-white p-5 shadow-sm hover:shadow-md transition-all`}
                >
                  <div className={`mb-3 inline-flex rounded-xl p-2.5 ${cat.bg}`}>
                    <Icon className={`h-5 w-5 ${cat.text}`} />
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{cat.label}</p>
                  <p className={`text-2xl font-black font-display ${cat.text}`}>{fmt(val)}</p>
                  <div className={`absolute bottom-0 left-0 h-1 w-full`} style={{ background: cat.color, opacity: 0.3 }} />
                </motion.div>
              );
            })}

            {/* Grand Total */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#002147] to-[#004080] p-5 shadow-lg text-white"
            >
              <div className="mb-3 inline-flex rounded-xl bg-white/15 p-2.5">
                <IndianRupee className="h-5 w-5 text-white" />
              </div>
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Grand Total</p>
              <p className="text-2xl font-black font-display">{fmt(yearly.total)}</p>
              <div className="absolute bottom-0 left-0 h-1 w-full bg-white/20" />
            </motion.div>
          </div>
        </motion.div>

        {/* ── Charts ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-[#002147]" />
              <h2 className="text-lg font-bold text-[#002147] font-display">Income Charts</h2>
            </div>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden no-print">
              {(['bar', 'pie'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setChartView(v)}
                  className={`px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors ${chartView === v ? 'bg-[#002147] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {v === 'bar' ? <BarChart2 className="h-4 w-4" /> : <PieChartIcon className="h-4 w-4" />}
                  {v === 'bar' ? 'Bar Chart' : 'Pie Chart'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Bar */}
            {chartView === 'bar' && (
              <Card className="col-span-full card-elevated border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="font-display text-[#002147]">Monthly Income — {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-72 flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#002147] border-t-transparent" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(val: number, name: string) => [fmt(val), name]}
                          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                        />
                        <Legend />
                        {CATEGORIES.map(cat => (
                          <Bar key={cat.key} dataKey={cat.label.split(' ')[0]} fill={cat.color} radius={[4, 4, 0, 0]} barSize={14} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pie */}
            {chartView === 'pie' && (
              <>
                <Card className="card-elevated border-none shadow-lg">
                  <CardHeader>
                    <CardTitle className="font-display text-[#002147]">Category Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="h-64 flex items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#002147] border-t-transparent" />
                      </div>
                    ) : pieData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data for {selectedYear}</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value"
                            label={({ name, percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}>
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(val: number) => fmt(val)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Monthly bar alongside pie */}
                <Card className="card-elevated border-none shadow-lg">
                  <CardHeader>
                    <CardTitle className="font-display text-[#002147]">Monthly Total Income</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="h-64 flex items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#002147] border-t-transparent" />
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={monthData.map((d, i) => ({ name: SHORT_MONTHS[i], Total: d.total }))} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(val: number) => [fmt(val), 'Total']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                          <Bar dataKey="Total" fill="#002147" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </motion.div>

        {/* ── Monthly Table ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-[#002147]" />
            <h2 className="text-lg font-bold text-[#002147] font-display">
              Monthly Breakdown — {selectedYear}
            </h2>
          </div>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#002147] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Table Header */}
              <div className="hidden lg:grid grid-cols-6 gap-2 px-5 py-3 rounded-2xl bg-[#002147] text-white text-xs font-bold uppercase tracking-wider">
                <div>Month</div>
                {CATEGORIES.map(c => (
                  <div key={c.key} className="text-right flex items-center justify-end gap-1">
                    <c.icon className="h-3.5 w-3.5 opacity-70" />
                    {c.label.split(' ')[0]}
                  </div>
                ))}
                <div className="text-right">Total</div>
              </div>

              {/* Month rows */}
              {displayData.map((row, idx) => {
                const hasActivity = row.total > 0;
                return (
                  <motion.div
                    key={row.month}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all overflow-hidden ${hasActivity ? 'border-slate-100' : 'border-dashed border-slate-200 opacity-60'}`}
                  >
                    {/* Desktop row */}
                    <div className="hidden lg:grid grid-cols-6 gap-2 items-center px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black ${hasActivity ? 'bg-[#002147] text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {SHORT_MONTHS[row.month - 1]}
                        </div>
                        <span className="font-semibold text-slate-700">{MONTHS[row.month - 1]}</span>
                      </div>

                      {CATEGORIES.map(cat => (
                        <div key={cat.key} className="text-right">
                          <span className={`font-semibold text-sm ${row[cat.key as keyof MonthData] > 0 ? cat.text : 'text-slate-300'}`}>
                            {fmt(row[cat.key as keyof MonthData] as number)}
                          </span>
                        </div>
                      ))}

                      <div className="text-right">
                        <span className={`text-base font-black font-display ${hasActivity ? 'text-[#002147]' : 'text-slate-300'}`}>
                          {fmt(row.total)}
                        </span>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="lg:hidden p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black ${hasActivity ? 'bg-[#002147] text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {SHORT_MONTHS[row.month - 1]}
                          </div>
                          <span className="font-bold text-slate-800">{MONTHS[row.month - 1]}</span>
                        </div>
                        <span className={`text-lg font-black font-display ${hasActivity ? 'text-[#002147]' : 'text-slate-300'}`}>
                          {fmt(row.total)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {CATEGORIES.map(cat => {
                          const Icon = cat.icon;
                          return (
                            <div key={cat.key} className={`flex items-center justify-between rounded-xl p-2 ${cat.bg}`}>
                              <div className="flex items-center gap-1.5">
                                <Icon className={`h-3.5 w-3.5 ${cat.text}`} />
                                <span className="text-xs font-semibold text-slate-600">{cat.label.split(' ')[0]}</span>
                              </div>
                              <span className={`text-xs font-bold ${cat.text}`}>
                                {fmt(row[cat.key as keyof MonthData] as number)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Totals row */}
              {selectedMonth === 'all' && (
                <div className="rounded-2xl bg-gradient-to-r from-[#002147] to-[#004080] text-white px-5 py-4 shadow-xl">
                  <div className="hidden lg:grid grid-cols-6 gap-2 items-center">
                    <div className="font-black text-sm uppercase tracking-wider text-white/80">TOTAL {selectedYear}</div>
                    {CATEGORIES.map(cat => (
                      <div key={cat.key} className="text-right font-bold text-sm">{fmt(yearly[cat.key as keyof typeof yearly])}</div>
                    ))}
                    <div className="text-right font-black text-xl font-display">{fmt(yearly.total)}</div>
                  </div>
                  {/* Mobile totals */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm uppercase tracking-wider text-white/80">TOTAL {selectedYear}</span>
                      <span className="text-xl font-black font-display">{fmt(yearly.total)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        return (
                          <div key={cat.key} className="flex items-center justify-between rounded-xl bg-white/10 p-2.5">
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3.5 w-3.5 text-white/70" />
                              <span className="text-xs font-semibold text-white/70">{cat.label.split(' ')[0]}</span>
                            </div>
                            <span className="text-xs font-bold text-white">{fmt(yearly[cat.key as keyof typeof yearly])}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

      </div>
    </DashboardLayout>
  );
}
