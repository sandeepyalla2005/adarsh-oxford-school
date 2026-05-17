import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Calendar, Filter, Download, Loader2, Check, X, Clock,
    FileText, RefreshCw, Wifi, WifiOff, CheckCircle, Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const CLASSES = [
    'All', 'Nursery', 'LKG', 'UKG',
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
];

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

interface AttendanceRecord {
    id: string;
    student_id: string;
    student_name: string;
    class_name: string;
    date: string;
    status: AttendanceStatus;
    staff_name: string;
    created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
    Present: { label: 'P', bg: 'bg-emerald-100', text: 'text-emerald-800', icon: Check },
    Absent: { label: 'A', bg: 'bg-red-100', text: 'text-red-800', icon: X },
    Late: { label: 'L', bg: 'bg-amber-100', text: 'text-amber-800', icon: Clock },
    Leave: { label: 'Le', bg: 'bg-blue-100', text: 'text-blue-800', icon: FileText },
};

export default function AdminAttendance() {
    const { userRole } = useAuth();
    const isAdmin = userRole === 'admin' || userRole === 'feeInCharge';
    const [filterClass, setFilterClass] = useState<string>('All');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isLive, setIsLive] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        fetchAttendance();
    }, [filterClass, filterDate]);

    // Real-time subscription
    useEffect(() => {
        channelRef.current = supabase
            .channel('admin-attendance-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' },
                (payload) => {
                    fetchAttendance(true);
                    if (payload.eventType === 'INSERT') toast.info('📋 New attendance submitted by staff');
                    else if (payload.eventType === 'UPDATE') toast.info('✏️ Attendance record updated');
                }
            )
            .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));

        return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
    }, []);

    const fetchAttendance = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            let query = supabase
                .from('attendance_records')
                .select('*')
                .eq('date', filterDate)
                .order('class_name', { ascending: true })
                .order('student_name', { ascending: true });

            if (filterClass !== 'All') query = query.eq('class_name', filterClass);

            const { data, error } = await query;
            if (error) throw error;
            setRecords((data || []) as AttendanceRecord[]);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdminOverride = async (record: AttendanceRecord, newStatus: AttendanceStatus) => {
        setEditingId(record.id);
        try {
            const { error } = await supabase
                .from('attendance_records')
                .update({
                    status: newStatus,
                    staff_name: (record.staff_name || 'Staff').replace(' (Management Override)', '') + ' (Management Override)',
                })
                .eq('id', record.id);

            if (error) throw error;
            setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: newStatus } : r));
            toast.success(`Updated ${record.student_name} to ${newStatus}`);
        } catch (err: any) {
            toast.error('Override failed: ' + err.message);
        } finally {
            setEditingId(null);
        }
    };

    const handleExport = () => {
        const rows = [
            ['Student Name', 'Class', 'Status', 'Marked By', 'Time'],
            ...records.map(r => [
                r.student_name, r.class_name, r.status,
                r.staff_name || 'System',
                r.created_at ? format(new Date(r.created_at), 'dd/MM/yyyy hh:mm a') : ''
            ])
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${filterDate}_${filterClass}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const summary = {
        total: records.length,
        present: records.filter(r => r.status === 'Present').length,
        absent: records.filter(r => r.status === 'Absent').length,
        late: records.filter(r => r.status === 'Late').length,
        leave: records.filter(r => r.status === 'Leave').length,
    };

    // Apply status quick-filter
    const displayedRecords = statusFilter === 'All'
        ? records
        : records.filter(r => r.status === statusFilter);

    const classes = [...new Set(displayedRecords.map(r => r.class_name))].sort();

    const statCards = [
        { key: 'All', label: 'All Students', value: summary.total, icon: Users, activeBg: 'bg-slate-50', activeBorder: 'border-slate-400', ring: 'ring-slate-300', num: 'text-slate-800' },
        { key: 'Present', label: 'Present', value: summary.present, icon: Check, activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-400', ring: 'ring-emerald-300', num: 'text-emerald-700' },
        { key: 'Absent', label: 'Absent', value: summary.absent, icon: X, activeBg: 'bg-red-50', activeBorder: 'border-red-400', ring: 'ring-red-300', num: 'text-red-700' },
        { key: 'Late', label: 'Late', value: summary.late, icon: Clock, activeBg: 'bg-amber-50', activeBorder: 'border-amber-400', ring: 'ring-amber-300', num: 'text-amber-700' },
        { key: 'Leave', label: 'Leave', value: summary.leave, icon: FileText, activeBg: 'bg-blue-50', activeBorder: 'border-blue-400', ring: 'ring-blue-300', num: 'text-blue-700' },
    ];

    return (
        <DashboardLayout>
            <div className="space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-[#002147] tracking-tight font-display">
                            Attendance Register
                        </h1>
                        <p className="text-slate-500 font-medium flex items-center gap-2">
                            {isAdmin ? 'Monitor and override attendance across all classes' : 'Monitor student attendance register'}
                            {isLive ? (
                                <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                    <Wifi className="h-3 w-3" /> Live
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-red-500 text-xs font-bold">
                                    <WifiOff className="h-3 w-3" /> Offline
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {lastUpdated && (
                            <span className="text-xs text-slate-400 hidden sm:block">
                                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        <Button variant="outline" size="sm" onClick={() => fetchAttendance()} className="gap-2 rounded-xl">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* ── Always-visible clickable stat cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {statCards.map((s, i) => {
                        const Icon = s.icon;
                        const isActive = statusFilter === s.key;
                        return (
                            <motion.button
                                key={s.key}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                onClick={() => setStatusFilter(s.key)}
                                className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left w-full transition-all duration-200 shadow-sm ${isActive
                                    ? `${s.activeBg} ${s.activeBorder} ring-2 ${s.ring} scale-[1.03] shadow-md`
                                    : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md'
                                    }`}
                            >
                                <div className={`p-2.5 rounded-xl ${isActive ? s.activeBg : 'bg-slate-50'} border border-slate-200`}>
                                    <Icon className={`h-5 w-5 ${isActive ? s.num : 'text-slate-400'}`} />
                                </div>
                                <div>
                                    <p className={`text-2xl font-black leading-none ${isActive ? s.num : 'text-slate-800'}`}>
                                        {s.value}
                                    </p>
                                    <p className="text-xs font-semibold text-slate-500 mt-0.5">{s.label}</p>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>

                {/* Active filter pill */}
                {statusFilter !== 'All' && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">Filtered by:</span>
                        <Badge className={`font-bold border-none px-3 ${statusFilter === 'Present' ? 'bg-emerald-100 text-emerald-700' :
                            statusFilter === 'Absent' ? 'bg-red-100 text-red-700' :
                                statusFilter === 'Late' ? 'bg-amber-100 text-amber-700' :
                                    'bg-blue-100 text-blue-700'
                            }`}>
                            {statusFilter} only · {displayedRecords.length} student{displayedRecords.length !== 1 ? 's' : ''}
                        </Badge>
                        <button
                            onClick={() => setStatusFilter('All')}
                            className="text-xs text-slate-400 hover:text-slate-700 underline transition-colors"
                        >
                            Clear filter
                        </button>
                    </div>
                )}

                {/* Filter Card */}
                <Card className="border-none shadow-xl bg-white/60 backdrop-blur-sm rounded-[1.5rem]">
                    <CardHeader className="flex flex-col md:flex-row gap-4 items-center justify-between pb-5 border-b border-slate-100 p-6">
                        <div className="flex items-center gap-2 text-[#002147] font-bold text-lg">
                            <Filter className="h-5 w-5" /> Filters
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <Input
                                    type="date"
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="border-none p-0 h-auto font-medium text-slate-700 focus-visible:ring-0 w-auto"
                                />
                            </div>
                            <Select value={filterClass} onValueChange={setFilterClass}>
                                <SelectTrigger className="w-[180px] bg-white border-slate-200 rounded-xl">
                                    <SelectValue placeholder="Filter by Class" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl z-[100]">
                                    {CLASSES.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                className="gap-2 text-[#002147] border-[#002147]/20 hover:bg-[#002147]/5 rounded-xl"
                                onClick={handleExport}
                                disabled={records.length === 0}
                            >
                                <Download className="h-4 w-4" /> Export CSV
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center items-center gap-2 text-slate-500 p-16">
                                <Loader2 className="h-6 w-6 animate-spin" /> Loading records…
                            </div>
                        ) : displayedRecords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-16 text-center">
                                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <Calendar className="h-8 w-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-600">No Records Found</h3>
                                <p className="text-slate-400 text-sm mt-1">
                                    {records.length > 0
                                        ? `No ${statusFilter} students for ${filterClass !== 'All' ? filterClass : 'any class'} on this date.`
                                        : `No attendance has been submitted for this date${filterClass !== 'All' ? ` / ${filterClass}` : ''}.`
                                    }
                                </p>
                            </div>
                        ) : (
                            <div>
                                {classes.map(cls => {
                                    const classRecords = displayedRecords.filter(r => r.class_name === cls);
                                    if (classRecords.length === 0) return null;
                                    const submittedBy = classRecords[0]?.staff_name || 'Unknown';

                                    return (
                                        <div key={cls} className="border-b border-slate-100 last:border-b-0">
                                            {/* Class group header */}
                                            <div className="flex items-center justify-between px-6 py-3 bg-slate-50/80">
                                                <div className="flex items-center gap-3">
                                                    <Badge variant="outline" className="font-black text-[#002147] border-[#002147]/30 bg-white px-3">
                                                        {cls}
                                                    </Badge>
                                                    <span className="text-xs text-slate-500">{classRecords.length} students</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                                                    <span>
                                                        Submitted by <strong>{submittedBy.replace(' (Management Override)', '')}</strong>
                                                    </span>
                                                    {classRecords[0]?.created_at && (
                                                        <span>· {format(new Date(classRecords[0].created_at), 'hh:mm a')}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <Table>
                                                <TableHeader className="bg-slate-50/40">
                                                    <TableRow>
                                                        <TableHead className="font-bold text-[#002147] pl-6">#</TableHead>
                                                        <TableHead className="font-bold text-[#002147]">Student Name</TableHead>
                                                        <TableHead className="font-bold text-[#002147]">Class</TableHead>
                                                        <TableHead className="font-bold text-[#002147]">Status</TableHead>
                                                        <TableHead className="font-bold text-[#002147]">Marked By</TableHead>
                                                        {isAdmin && <TableHead className="font-bold text-[#002147] text-right pr-6">Admin Override</TableHead>}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    <AnimatePresence>
                                                        {classRecords.map((record, i) => {
                                                            const cfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.Present;
                                                            const Icon = cfg.icon;
                                                            const isEditing = editingId === record.id;
                                                            return (
                                                                <motion.tr
                                                                    key={record.id}
                                                                    initial={{ opacity: 0, x: -8 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    exit={{ opacity: 0, x: 8 }}
                                                                    transition={{ delay: i * 0.02 }}
                                                                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                                                                >
                                                                    <TableCell className="font-medium text-slate-400 pl-6 text-sm">{i + 1}</TableCell>
                                                                    <TableCell className="font-semibold text-slate-800">{record.student_name}</TableCell>
                                                                    <TableCell className="text-slate-500 text-sm">{record.class_name}</TableCell>
                                                                    <TableCell>
                                                                        <Badge className={`${cfg.bg} ${cfg.text} border-none shadow-none font-bold gap-1.5`}>
                                                                            <Icon className="h-3 w-3" />
                                                                            {record.status}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-slate-500 text-sm">
                                                                        {record.staff_name?.replace(' (Management Override)', '') || 'System'}
                                                                        {record.staff_name?.includes('Management Override') && (
                                                                            <span className="ml-1 text-xs text-violet-500 font-bold">(overridden)</span>
                                                                        )}
                                                                    </TableCell>
                                                                    {isAdmin && (
                                                                        <TableCell className="text-right pr-6">
                                                                            {isEditing ? (
                                                                                <Loader2 className="h-4 w-4 animate-spin ml-auto text-slate-400" />
                                                                            ) : (
                                                                                <div className="flex items-center justify-end gap-1">
                                                                                    {(['Present', 'Absent', 'Late', 'Leave'] as AttendanceStatus[]).map(s => {
                                                                                        const sCfg = STATUS_CONFIG[s];
                                                                                        const SIcon = sCfg.icon;
                                                                                        return (
                                                                                            <button
                                                                                                key={s}
                                                                                                onClick={() => record.status !== s && handleAdminOverride(record, s)}
                                                                                                title={s}
                                                                                                className={`h-7 w-7 rounded-lg flex items-center justify-center border transition-all ${record.status === s
                                                                                                    ? `${sCfg.bg} ${sCfg.text} border-transparent`
                                                                                                    : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                                                                                                    }`}
                                                                                            >
                                                                                                <SIcon className="h-3.5 w-3.5" />
                                                                                            </button>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                        </TableCell>
                                                                    )}
                                                                </motion.tr>
                                                            );
                                                        })}
                                                    </AnimatePresence>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    );
                                })}

                                <div className="p-4 border-t border-slate-100 bg-slate-50/30 text-xs text-slate-500 text-center">
                                    {displayedRecords.length} record{displayedRecords.length !== 1 ? 's' : ''} · {format(new Date(filterDate), 'dd MMM yyyy')}
                                    {filterClass !== 'All' ? ` · ${filterClass}` : ' · All Classes'}
                                    {statusFilter !== 'All' ? ` · ${statusFilter} only` : ''}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
