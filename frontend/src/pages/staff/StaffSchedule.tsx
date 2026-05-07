import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CalendarDays,
    Clock,
    BookOpen,
    GraduationCap,
    Coffee,
    Zap,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Bell
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type ScheduleEntry = {
    id: number;
    staff_name: string;
    day: string;
    period_id: string;
    period_label: string;
    period_time: string;
    class_name: string;
    subject: string;
    timetable_group: string;
};

// ─── Helper: parse "09.10 AM - 09.50 AM" into comparable minutes ───────────
function timeToMinutes(timeStr: string): number {
    const match = timeStr.match(/(\d+)\.(\d+)\s*(AM|PM)/i);
    if (!match) return -1;
    const [, h, m, period] = match;
    let hours = parseInt(h);
    const mins = parseInt(m);
    if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
    return hours * 60 + mins;
}

function parseTimeRange(timeStr: string): { start: number; end: number } {
    const parts = timeStr.split('-').map(s => s.trim());
    return {
        start: timeToMinutes(parts[0] || ''),
        end: timeToMinutes(parts[1] || '')
    };
}

function getTodayName(): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
}

function getNowMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

export default function StaffSchedule() {
    const { user } = useAuth();

    const todayName = getTodayName();
    const [selectedDay, setSelectedDay] = useState(
        DAYS.includes(todayName) ? todayName : 'Monday'
    );
    const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [nowMinutes, setNowMinutes] = useState(getNowMinutes());
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    // ─── Resolved staff name from profiles table (matches what admin typed in timetable) ───
    const [staffName, setStaffName] = useState<string>('');
    const [nameResolved, setNameResolved] = useState(false);

    // Fetch the canonical full_name from the profiles table for this user
    useEffect(() => {
        if (!user?.id) return;
        (async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!error && data?.full_name) {
                    setStaffName((data.full_name as string).trim());
                } else {
                    // Fallback: use metadata name or email prefix
                    const meta = user.user_metadata as any;
                    const fallback =
                        (meta?.full_name as string | undefined)?.trim() ||
                        user.email?.split('@')[0] ||
                        '';
                    setStaffName(fallback);
                }
            } catch {
                const meta = user.user_metadata as any;
                const fallback =
                    (meta?.full_name as string | undefined)?.trim() ||
                    user.email?.split('@')[0] ||
                    '';
                setStaffName(fallback);
            } finally {
                setNameResolved(true);
            }
        })();
    }, [user?.id]);

    // Update current time every minute for "running period" highlight
    useEffect(() => {
        const timer = setInterval(() => setNowMinutes(getNowMinutes()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const fetchSchedule = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('staff_schedule')
                .select('*')
                .eq('staff_name', staffName)
                .order('day')
                .order('period_id');

            if (error) {
                console.error('Error fetching staff schedule:', error);
                toast.error('Could not load your schedule.');
                return;
            }
            setSchedule((data as ScheduleEntry[]) || []);
            setLastUpdated(new Date());
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // Initial fetch + real-time subscription — runs only after staffName is resolved
    useEffect(() => {
        if (!nameResolved) return;
        if (!staffName) {
            setIsLoading(false);
            return;
        }
        fetchSchedule();

        // Real-time: refresh whenever admin updates the timetable schedules
        channelRef.current = supabase
            .channel(`staff-schedule-${staffName}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'staff_schedule' },
                () => {
                    fetchSchedule(true);
                    toast.info('📅 Your timetable has been updated by Admin.');
                }
            )
            .subscribe();

        return () => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, [staffName, nameResolved]);

    const daySchedule = schedule.filter(s => s.day === selectedDay);

    // Determine current/upcoming period status
    const getPeriodStatus = (entry: ScheduleEntry): 'running' | 'past' | 'upcoming' => {
        const { start, end } = parseTimeRange(entry.period_time);
        if (start === -1) return 'upcoming';
        if (nowMinutes >= start && nowMinutes < end) return 'running';
        if (nowMinutes >= end) return 'past';
        return 'upcoming';
    };

    // Summary stats
    const totalPeriods = schedule.filter(s => s.day === selectedDay).length;
    const allPeriods = schedule.length;
    const uniqueDays = new Set(schedule.map(s => s.day)).size;

    // Day selector ring (only school days)
    const dayIndex = DAYS.indexOf(selectedDay);

    return (
        <DashboardLayout>
            <div className="space-y-8 pb-20">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-[#002147] font-display">
                            My Schedule
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium">
                            {staffName
                                ? `Showing timetable for ${staffName}`
                                : 'Your personal class timetable'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {lastUpdated && (
                            <span className="text-xs text-slate-400 hidden sm:block">
                                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 rounded-xl"
                            onClick={() => fetchSchedule()}
                            disabled={isLoading}
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Total Periods', value: allPeriods, icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Active Days', value: uniqueDays, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: "Today's Classes", value: DAYS.includes(todayName) ? schedule.filter(s => s.day === todayName).length : 0, icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50' },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                        >
                            <Card className="border-none shadow-md rounded-2xl">
                                <CardContent className="flex items-center gap-4 p-5">
                                    <div className={`p-3 rounded-xl ${stat.bg}`}>
                                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
                                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Day Navigator */}
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setSelectedDay(DAYS[Math.max(0, dayIndex - 1)])}
                        disabled={dayIndex === 0}
                        className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm inline-flex overflow-x-auto max-w-full gap-1">
                        {DAYS.map((day) => {
                            const isToday = day === todayName;
                            const isSelected = day === selectedDay;
                            const count = schedule.filter(s => s.day === day).length;
                            return (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDay(day)}
                                    className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${isSelected
                                        ? 'bg-[#002147] text-white shadow-md'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    {day.slice(0, 3)}
                                    {isToday && (
                                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                                    )}
                                    {count > 0 && !isSelected && (
                                        <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5 font-bold">
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => setSelectedDay(DAYS[Math.min(DAYS.length - 1, dayIndex + 1)])}
                        disabled={dayIndex === DAYS.length - 1}
                        className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {/* Schedule for selected day */}
                <Card className="border-none shadow-xl rounded-[1.5rem] overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-[#002147] to-[#003570] text-white p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-bold text-white">
                                    {selectedDay}
                                    {selectedDay === todayName && (
                                        <Badge className="ml-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5">
                                            TODAY
                                        </Badge>
                                    )}
                                </CardTitle>
                                <p className="text-white/60 text-sm mt-1">
                                    {totalPeriods === 0
                                        ? 'No classes assigned'
                                        : `${totalPeriods} class${totalPeriods !== 1 ? 'es' : ''} assigned`}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                <CalendarDays className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="h-10 w-10 rounded-full border-4 border-[#002147] border-t-transparent animate-spin" />
                                    <p className="text-slate-500 font-medium">Loading your schedule…</p>
                                </div>
                            </div>
                        ) : daySchedule.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col items-center justify-center py-20 text-center"
                            >
                                <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <Coffee className="h-10 w-10 text-slate-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700">Free Day!</h3>
                                <p className="text-slate-500 mt-2 max-w-sm">
                                    No classes assigned for {selectedDay}. Enjoy your free time or contact Admin if this looks incorrect.
                                </p>
                            </motion.div>
                        ) : (
                            <div className="space-y-3">
                                <AnimatePresence mode="popLayout">
                                    {daySchedule
                                        .sort((a, b) => {
                                            const aStart = parseTimeRange(a.period_time).start;
                                            const bStart = parseTimeRange(b.period_time).start;
                                            return aStart - bStart;
                                        })
                                        .map((entry, i) => {
                                            const status = selectedDay === todayName
                                                ? getPeriodStatus(entry)
                                                : 'upcoming';

                                            return (
                                                <motion.div
                                                    key={entry.id}
                                                    initial={{ opacity: 0, x: -16 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 16 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className={`relative flex items-start gap-4 p-4 rounded-2xl border-2 transition-all ${status === 'running'
                                                        ? 'border-emerald-400 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-md shadow-emerald-100'
                                                        : status === 'past'
                                                            ? 'border-slate-100 bg-slate-50/50 opacity-60'
                                                            : 'border-slate-100 bg-white hover:border-[#002147]/20 hover:shadow-sm'
                                                        }`}
                                                >
                                                    {/* Current period pulse indicator */}
                                                    {status === 'running' && (
                                                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
                                                        </span>
                                                    )}

                                                    {/* Period number badge */}
                                                    <div className={`flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center font-black text-sm ${status === 'running'
                                                        ? 'bg-emerald-500 text-white'
                                                        : status === 'past'
                                                            ? 'bg-slate-200 text-slate-400'
                                                            : 'bg-[#002147] text-white'
                                                        }`}>
                                                        {entry.period_id === 'zero' ? '0' : entry.period_label}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <h3 className={`font-bold text-base ${status === 'past' ? 'text-slate-400' : 'text-slate-900'}`}>
                                                                    {entry.subject}
                                                                </h3>
                                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                    <span className={`flex items-center gap-1 text-sm font-medium ${status === 'past' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                                        <GraduationCap className="h-3.5 w-3.5" />
                                                                        Class {entry.class_name}
                                                                    </span>
                                                                    <span className="text-slate-300">·</span>
                                                                    <span className={`flex items-center gap-1 text-sm ${status === 'past' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                                        <BookOpen className="h-3.5 w-3.5" />
                                                                        Period {entry.period_label === 'Zero Period' ? '0 (Zero)' : entry.period_label}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Time badge */}
                                                            <div className="flex flex-col items-end gap-1.5">
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`text-[11px] font-bold px-2.5 whitespace-nowrap ${status === 'running'
                                                                        ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                                                                        : status === 'past'
                                                                            ? 'border-slate-200 text-slate-400'
                                                                            : 'border-[#002147]/20 text-[#002147]'
                                                                        }`}
                                                                >
                                                                    <Clock className="h-3 w-3 mr-1" />
                                                                    {entry.period_time}
                                                                </Badge>
                                                                {status === 'running' && (
                                                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider animate-pulse">
                                                                        ● Now Running
                                                                    </span>
                                                                )}
                                                                {status === 'past' && (
                                                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                                                                        ✓ Completed
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                </AnimatePresence>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* No schedule at all state */}
                {!isLoading && schedule.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center"
                    >
                        <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-600">No Schedule Yet</h3>
                        <p className="text-slate-400 mt-2 text-sm max-w-sm mx-auto">
                            The Admin hasn't assigned you to any classes yet, or the timetable hasn't been saved.
                            You'll be notified as soon as it's ready.
                        </p>
                    </motion.div>
                )}
            </div>
        </DashboardLayout>
    );
}
