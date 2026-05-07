import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    CalendarDays,
    BookOpen,
    MessageSquare,
    CheckCircle2,
    Clock,
    GraduationCap,
    User
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

interface Notice {
    id: number;
    title: string;
    content: string;
    date: string;
    author: string;
    pinned: boolean;
    created_at: string;
}

interface ScheduleEntry {
    id: number;
    period_label: string;
    period_time: string;
    class_name: string;
    subject: string;
}

function getTodayName(): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
}

function getNowMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

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

function getPeriodStatus(periodTime: string): 'running' | 'past' | 'upcoming' {
    const parts = periodTime.split('-').map(s => s.trim());
    const start = timeToMinutes(parts[0] || '');
    const end = timeToMinutes(parts[1] || '');
    const now = getNowMinutes();
    if (start === -1) return 'upcoming';
    if (now >= start && now < end) return 'running';
    if (now >= end) return 'past';
    return 'upcoming';
}

export default function StaffDashboard() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const todayName = getTodayName();

    // Stabilize staffName with a ref — prevents re-subscribing on every auth state update
    const staffNameRef = useRef(user?.user_metadata?.full_name || user?.email?.split('@')[0] || '');
    // Update ref if user changes, but don't use it as an effect dependency
    staffNameRef.current = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
    const staffName = staffNameRef.current;

    const [notices, setNotices] = useState<Notice[]>([]);
    const [todaySchedule, setTodaySchedule] = useState<ScheduleEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        fetchNotices();
        if (staffNameRef.current) fetchTodaySchedule();

        const noticeChannel = supabase
            .channel('staff-notices-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' },
                (payload) => setNotices(prev => [payload.new as Notice, ...prev].slice(0, 3))
            )
            .subscribe();

        if (staffNameRef.current) {
            channelRef.current = supabase
                .channel(`staff-dash-schedule-${staffNameRef.current}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_schedule' },
                    () => fetchTodaySchedule()
                )
                .subscribe();
        }

        return () => {
            supabase.removeChannel(noticeChannel);
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, []); // ← Empty deps: subscribe once only, staffName accessed via ref

    const fetchNotices = async () => {
        try {
            const { data, error } = await supabase
                .from('notices')
                .select('*')
                .order('pinned', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(3);
            if (!error && data) setNotices(data as any);
        } catch (error) {
            console.error('Fatal error fetching notices:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTodaySchedule = async () => {
        try {
            const { data, error } = await supabase
                .from('staff_schedule')
                .select('*')
                .eq('staff_name', staffName)
                .eq('day', todayName)
                .order('period_id');
            if (!error && data) setTodaySchedule(data as ScheduleEntry[]);
        } catch (e) {
            console.error(e);
        }
    };

    const upcomingCount = todaySchedule.filter(s => getPeriodStatus(s.period_time) === 'upcoming').length;

    const stats = [
        { title: "Today's Classes", value: todaySchedule.length.toString(), icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-100" },
        { title: "Upcoming", value: upcomingCount.toString(), icon: Clock, color: "text-purple-600", bg: "bg-purple-100" },
        { title: "Completed", value: (todaySchedule.length - upcomingCount).toString(), icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
        { title: "New Notices", value: notices.length.toString(), icon: MessageSquare, color: "text-amber-600", bg: "bg-amber-100" }
    ];

    return (
        <DashboardLayout>
            <div className="space-y-8 p-4">
                <div className="flex items-center gap-5">
                    <div className="h-20 w-20 shrink-0 rounded-3xl border-4 border-white bg-slate-100 shadow-xl overflow-hidden flex items-center justify-center transition-transform hover:scale-105">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                            <div className="bg-slate-100 h-full w-full flex items-center justify-center">
                                <User className="h-10 w-10 text-[#002147] opacity-40" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-black tracking-tight text-[#002147] font-display">
                            Welcome back, {profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Teacher'} 👋
                        </h1>
                        <p className="text-slate-500 font-medium font-inter">
                            {todaySchedule.length > 0
                                ? `You have ${todaySchedule.length} class${todaySchedule.length !== 1 ? 'es' : ''} today.`
                                : todayName === 'Sunday' ? 'Enjoy your Sunday!' : 'No classes scheduled for today.'}
                        </p>
                    </div>
                </div>

                <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {stats.map((stat, index) => (
                        <motion.div key={index} variants={item}>
                            <Card className="border-none shadow-sm hover:shadow-md transition-shadow duration-200">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.title}</p>
                                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                    </div>
                                    <div className={`p-3 rounded-xl ${stat.bg}`}>
                                        <stat.icon className={`h-6 w-6 ${stat.color}`} />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>

                <div className="grid gap-8 md:grid-cols-2">
                    {/* Recent Notices */}
                    <Card className="border-none shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-lg font-bold text-slate-900">Recent Notices</CardTitle>
                            <MessageSquare className="h-4 w-4 text-slate-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {isLoading ? (
                                    <div className="flex justify-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                                    </div>
                                ) : notices.length > 0 ? (
                                    notices.filter((n: any) => !n.expires_at || isAfter(new Date(n.expires_at), new Date())).slice(0, 3).map((notice) => (
                                        <div key={notice.id} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                                            <div className={`p-2 rounded-lg ${notice.pinned ? 'bg-amber-100' : 'bg-blue-100'}`}>
                                                <MessageSquare className={`h-4 w-4 ${notice.pinned ? 'text-amber-600' : 'text-blue-600'}`} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold text-slate-900 line-clamp-1">{notice.title}</h4>
                                                    {notice.pinned && <span className="text-[10px] font-bold text-amber-600 uppercase">Pinned</span>}
                                                </div>
                                                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{notice.content}</p>
                                                <p className="text-xs text-slate-400 mt-2">
                                                    {(() => {
                                                        try {
                                                            const d = notice.created_at || notice.date;
                                                            return d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : 'Recently';
                                                        } catch { return 'Recently'; }
                                                    })()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-slate-500"><p>No recent notices found.</p></div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Today's Live Schedule */}
                    <Card className="border-none shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div>
                                <CardTitle className="text-lg font-bold text-slate-900">Today's Schedule</CardTitle>
                                <p className="text-xs text-slate-500 mt-0.5">{todayName}</p>
                            </div>
                            <button
                                onClick={() => navigate('/staff/schedule')}
                                className="text-xs text-[#002147] font-bold hover:underline"
                            >
                                View Full →
                            </button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {todaySchedule.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400">
                                        <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">No classes today</p>
                                    </div>
                                ) : (
                                    todaySchedule.slice(0, 4).map((entry) => {
                                        const status = getPeriodStatus(entry.period_time);
                                        return (
                                            <div
                                                key={entry.id}
                                                className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${status === 'running'
                                                    ? 'border-emerald-300 bg-emerald-50'
                                                    : status === 'past'
                                                        ? 'border-slate-100 bg-slate-50 opacity-60'
                                                        : 'border-slate-100'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${status === 'running' ? 'bg-emerald-100' : 'bg-purple-50'}`}>
                                                        <GraduationCap className={`h-4 w-4 ${status === 'running' ? 'text-emerald-600' : 'text-purple-600'}`} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 text-sm">{entry.subject}</h4>
                                                        <p className="text-xs text-slate-500">Class {entry.class_name} · Period {entry.period_label}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                                                        {entry.period_time.split('-')[0].trim()}
                                                    </span>
                                                    {status === 'running' && (
                                                        <span className="text-[10px] text-emerald-600 font-bold animate-pulse">● Live</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                {todaySchedule.length > 4 && (
                                    <button
                                        onClick={() => navigate('/staff/schedule')}
                                        className="w-full text-center text-sm text-[#002147] font-bold py-2 rounded-xl hover:bg-slate-50 transition-colors"
                                    >
                                        +{todaySchedule.length - 4} more — View All
                                    </button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
