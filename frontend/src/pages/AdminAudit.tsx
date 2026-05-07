import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity,
    Search,
    Filter,
    Calendar,
    User,
    ChevronRight,
    ArrowRight,
    ShieldCheck,
    Download,
    Clock,
    LayoutGrid,
    List,
    RefreshCw,
    ChevronLeft,
    ChevronDown,
    X,
    CheckCircle,
    PenLine,
    Trash2,
    Plus,
    AlertCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { diffStudentObjects, FieldChange } from '@/lib/history';

// ─── Types ────────────────────────────────────────────────────────────────────
interface HistoryLog {
    log_id: string;
    student_id: string;
    student_name: string;
    action_type: 'ADD' | 'EDIT' | 'UPDATE' | 'DELETE';
    module_name: string;
    old_values: Record<string, string> | null;
    new_values: Record<string, string> | null;
    performed_by_name: string;
    role: string;
    created_at: string;
}

const PAGE_SIZE = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    ADD:    { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <Plus    className="h-3.5 w-3.5" />, label: 'Added'   },
    EDIT:   { color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: <PenLine  className="h-3.5 w-3.5" />, label: 'Edited'  },
    UPDATE: { color: 'bg-blue-100 text-blue-700 border-blue-200',          icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Updated' },
    DELETE: { color: 'bg-rose-100 text-rose-700 border-rose-200',          icon: <Trash2   className="h-3.5 w-3.5" />, label: 'Deleted' },
};

function getActionCfg(type: string) {
    return ACTION_CONFIG[type] ?? { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: <Activity className="h-3.5 w-3.5" />, label: type };
}

function ActionBadge({ type }: { type: string }) {
    const cfg = getActionCfg(type);
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>
            {cfg.icon} {cfg.label}
        </span>
    );
}

/** Computes field-level diff from stored old/new maps */
function getFieldChanges(log: HistoryLog): FieldChange[] {
    if (!log.old_values || !log.new_values) return [];
    // new diffStudentObjects works on key→value maps too
    return diffStudentObjects(log.old_values, log.new_values);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminAudit() {
    const { userRole, isAdmin } = useAuth();

    const [logs, setLogs] = useState<HistoryLog[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(0);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // UI state
    const [selectedLog, setSelectedLog] = useState<HistoryLog | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'timeline'>('timeline');

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchLogs = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            let query = supabase
                .from('student_history_logs' as any)
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

            if (typeFilter !== 'all') query = query.eq('action_type', typeFilter);
            if (dateFrom) query = query.gte('created_at', dateFrom);
            if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

            const { data, error, count } = await query;
            if (error) throw error;
            setLogs((data as any) || []);
            setTotalCount(count ?? 0);
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [typeFilter, dateFrom, dateTo, page]);

    // ── Real-time subscription ────────────────────────────────────────────────
    // Use a ref so the channel handler always calls the latest fetchLogs without re-subscribing
    const fetchLogsRef = useRef(fetchLogs);
    fetchLogsRef.current = fetchLogs;

    useEffect(() => {
        const ch = supabase
            .channel('audit-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'student_history_logs' }, () => {
                // Silently refresh without loader flicker
                fetchLogsRef.current(true);
            })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, []); // ← Subscribe once only

    // ── Table view search (client-side on current page) ───────────────────────
    const filteredLogs = logs.filter(log =>
        log.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.performed_by_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ── Stats ─────────────────────────────────────────────────────────────────
    const stats = {
        ADD:    logs.filter(l => l.action_type === 'ADD').length,
        EDIT:   logs.filter(l => l.action_type === 'EDIT').length,
        UPDATE: logs.filter(l => l.action_type === 'UPDATE').length,
        DELETE: logs.filter(l => l.action_type === 'DELETE').length,
    };

    // ── CSV Export ────────────────────────────────────────────────────────────
    const handleExportCSV = () => {
        const headers = ['Timestamp', 'Action', 'Student', 'Module', 'Performed By', 'Role', 'Changed Fields'];
        const rows = filteredLogs.map(log => {
            const changes = getFieldChanges(log);
            const changedStr = changes.map(c => `${c.label}: ${c.oldValue} → ${c.newValue}`).join(' | ');
            return [
                format(new Date(log.created_at), 'dd MMM yyyy hh:mm a'),
                log.action_type,
                log.student_name,
                log.module_name,
                log.performed_by_name,
                log.role,
                changedStr || 'N/A',
            ].map(v => `"${String(v).replace(/"/g, '""')}"`);
        });
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        a.download = `audit_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // ── Access Guard ──────────────────────────────────────────────────────────
    if (!isAdmin) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <div className="bg-rose-50 p-6 rounded-full mb-4">
                        <ShieldCheck className="h-12 w-12 text-rose-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 font-display">Access Restricted</h2>
                    <p className="text-slate-500 mt-2 max-w-md">Only system administrators can access the audit history logs.</p>
                </div>
            </DashboardLayout>
        );
    }

    // ── Main Render ───────────────────────────────────────────────────────────
    return (
        <DashboardLayout>
            <div className="space-y-8">

                {/* ── Header ── */}
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-10 w-10 rounded-2xl bg-[#002147] flex items-center justify-center shrink-0">
                                <Activity className="h-5 w-5 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-[#002147] font-display">Action Audit Logs</h1>
                        </div>
                        <p className="text-slate-500 pl-[52px] text-sm">
                            Real-time tracking of every student record change for security &amp; accountability.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="sm" className="gap-2 border-slate-200 rounded-xl" onClick={() => fetchLogs()}>
                            <RefreshCw className="h-3.5 w-3.5" /> Refresh
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 border-slate-200 rounded-xl" onClick={handleExportCSV}>
                            <Download className="h-3.5 w-3.5" /> Export CSV
                        </Button>
                        {/* View toggle */}
                        <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                            <button
                                onClick={() => setViewMode('timeline')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'timeline' ? 'bg-white shadow-sm text-[#002147]' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <List className="h-3.5 w-3.5" /> Timeline
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#002147]' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" /> Table
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Stats Strip ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(['ADD', 'EDIT', 'UPDATE', 'DELETE'] as const).map(type => {
                        const cfg = getActionCfg(type);
                        return (
                            <button
                                key={type}
                                onClick={() => { setTypeFilter(typeFilter === type ? 'all' : type); setPage(0); }}
                                className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all hover:shadow-md ${typeFilter === type ? cfg.color + ' ring-2 ring-current/30' : 'bg-white border-slate-100'}`}
                            >
                                <div className={`mb-2 inline-flex rounded-xl p-2 ${cfg.color}`}>{cfg.icon}</div>
                                <div className="text-2xl font-black font-display">{stats[type]}</div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{cfg.label}</div>
                            </button>
                        );
                    })}
                </div>

                {/* ── Filters ── */}
                <Card className="border-none shadow-sm bg-slate-50/60 rounded-2xl">
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-3">
                            {/* Search */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    id="audit-search"
                                    placeholder="Search by student or user name..."
                                    className="pl-9 bg-white border-slate-200 rounded-xl focus:ring-[#002147]/10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Action type */}
                            <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
                                <SelectTrigger id="action-filter" className="w-[180px] bg-white border-slate-200 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-4 w-4 text-slate-400" />
                                        <SelectValue placeholder="Action Type" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Actions</SelectItem>
                                    <SelectItem value="ADD">Added</SelectItem>
                                    <SelectItem value="EDIT">Edited</SelectItem>
                                    <SelectItem value="UPDATE">Updated</SelectItem>
                                    <SelectItem value="DELETE">Deleted</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Date From */}
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <Input
                                    id="date-from"
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => { setDateFrom(e.target.value); setPage(0); }}
                                    className="pl-9 bg-white border-slate-200 rounded-xl w-[160px]"
                                    title="From date"
                                />
                            </div>

                            {/* Date To */}
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <Input
                                    id="date-to"
                                    type="date"
                                    value={dateTo}
                                    onChange={e => { setDateTo(e.target.value); setPage(0); }}
                                    className="pl-9 bg-white border-slate-200 rounded-xl w-[160px]"
                                    title="To date"
                                />
                            </div>

                            {/* Clear filters */}
                            {(dateFrom || dateTo || typeFilter !== 'all' || searchQuery) && (
                                <Button
                                    variant="ghost" size="sm"
                                    className="gap-1.5 text-slate-500 hover:text-slate-800 rounded-xl"
                                    onClick={() => { setSearchQuery(''); setTypeFilter('all'); setDateFrom(''); setDateTo(''); setPage(0); }}
                                >
                                    <X className="h-3.5 w-3.5" /> Clear
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* ── Count row ── */}
                <div className="flex items-center justify-between text-sm text-slate-500 px-1">
                    <span>
                        Showing <strong className="text-slate-800">{filteredLogs.length}</strong> of{' '}
                        <strong className="text-slate-800">{totalCount}</strong> log entries
                        {typeFilter !== 'all' && ` · filtered by "${typeFilter}"`}
                    </span>
                    <span className="text-xs font-medium bg-slate-100 px-2.5 py-1 rounded-lg">
                        Page {page + 1} of {Math.max(1, totalPages)}
                    </span>
                </div>

                {/* ── Log Content ── */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#002147]" />
                        <p className="mt-4 text-slate-500 font-medium">Fetching audit trail...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                        <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-semibold text-slate-800">No logs found</h3>
                        <p className="text-slate-400 text-sm mt-1">Try adjusting your search, filters, or date range.</p>
                    </div>
                ) : viewMode === 'timeline' ? (

                    /* ── TIMELINE VIEW ── */
                    <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                            {filteredLogs.map((log, index) => {
                                const changes = getFieldChanges(log);
                                const cfg = getActionCfg(log.action_type);
                                return (
                                    <motion.div
                                        key={log.log_id}
                                        initial={{ opacity: 0, x: -16 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 16 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="relative pl-10 pb-2"
                                    >
                                        {/* Timeline line */}
                                        {index !== filteredLogs.length - 1 && (
                                            <div className="absolute left-[15px] top-7 bottom-0 w-[2px] bg-slate-100" />
                                        )}
                                        {/* Dot */}
                                        <div className={`absolute left-0 top-2 h-7 w-7 rounded-full border-4 border-white shadow flex items-center justify-center ${cfg.color.split(' ')[0]}`}>
                                            <span className={cfg.color.split(' ')[1]}>{cfg.icon}</span>
                                        </div>

                                        <div
                                            className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                            onClick={() => setSelectedLog(log)}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="bg-slate-50 p-2.5 rounded-xl group-hover:bg-[#002147]/5 transition-colors shrink-0">
                                                        <User className="h-4 w-4 text-[#002147]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                                            <span className="font-bold text-slate-900 text-sm">{log.student_name}</span>
                                                            <ActionBadge type={log.action_type} />
                                                            <span className="text-slate-400 text-xs">• {log.module_name}</span>
                                                        </div>
                                                        <p className="text-slate-500 text-xs">
                                                            By <span className="font-semibold text-slate-700">{log.performed_by_name}</span>
                                                            <span className="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded uppercase">{log.role}</span>
                                                        </p>

                                                        {/* Inline field diffs preview */}
                                                        {changes.length > 0 && (
                                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                                {changes.slice(0, 3).map(c => (
                                                                    <span key={c.field} className="inline-flex items-center gap-1 text-[10px] bg-slate-50 border border-slate-100 rounded-lg px-2 py-0.5">
                                                                        <span className="font-semibold text-slate-600">{c.label}:</span>
                                                                        <span className="text-rose-500 line-through">{c.oldValue.length > 15 ? c.oldValue.slice(0, 15) + '…' : c.oldValue}</span>
                                                                        <ArrowRight className="h-2.5 w-2.5 text-slate-400" />
                                                                        <span className="text-emerald-600 font-medium">{c.newValue.length > 15 ? c.newValue.slice(0, 15) + '…' : c.newValue}</span>
                                                                    </span>
                                                                ))}
                                                                {changes.length > 3 && (
                                                                    <span className="text-[10px] text-slate-400 px-2 py-0.5">+{changes.length - 3} more</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-right hidden sm:block">
                                                        <div className="text-xs font-medium text-slate-800">{format(new Date(log.created_at), 'MMM dd, yyyy')}</div>
                                                        <div className="text-[10px] text-slate-400">{format(new Date(log.created_at), 'hh:mm a')}</div>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#002147] group-hover:translate-x-0.5 transition-all" />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>

                ) : (

                    /* ── TABLE VIEW ── */
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-[#002147] text-white">
                                <tr>
                                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-widest">Timestamp</th>
                                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-widest">Action</th>
                                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-widest">Student</th>
                                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-widest">Changed Fields</th>
                                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-widest">By</th>
                                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-center">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredLogs.map((log) => {
                                    const changes = getFieldChanges(log);
                                    return (
                                        <tr
                                            key={log.log_id}
                                            className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                                            onClick={() => setSelectedLog(log)}
                                        >
                                            <td className="px-5 py-3.5">
                                                <div className="text-xs font-medium text-slate-900">{format(new Date(log.created_at), 'dd MMM yyyy')}</div>
                                                <div className="text-[10px] text-slate-400">{format(new Date(log.created_at), 'hh:mm a')}</div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <ActionBadge type={log.action_type} />
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="text-sm font-bold text-slate-900">{log.student_name}</div>
                                                <div className="text-[10px] text-slate-400">{log.module_name}</div>
                                            </td>
                                            <td className="px-5 py-3.5 max-w-xs">
                                                {changes.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {changes.slice(0, 2).map(c => (
                                                            <span key={c.field} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.5 font-medium">
                                                                {c.label}
                                                            </span>
                                                        ))}
                                                        {changes.length > 2 && (
                                                            <span className="text-[10px] text-slate-400">+{changes.length - 2}</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-300 italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="text-xs text-slate-700 font-medium">{log.performed_by_name}</div>
                                                <div className="text-[10px] text-slate-400 uppercase">{log.role}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-[#002147] hover:bg-[#002147]/5">
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        <Button
                            variant="outline" size="sm" className="rounded-xl gap-1"
                            disabled={page === 0}
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" /> Prev
                        </Button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                            return (
                                <button
                                    key={pg}
                                    onClick={() => setPage(pg)}
                                    className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${pg === page ? 'bg-[#002147] text-white shadow' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {pg + 1}
                                </button>
                            );
                        })}
                        <Button
                            variant="outline" size="sm" className="rounded-xl gap-1"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        >
                            Next <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {/* ── Detail Modal ── */}
                <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold flex items-center gap-3 font-display">
                                {selectedLog && (
                                    <span className={`p-2 rounded-xl ${getActionCfg(selectedLog.action_type).color}`}>
                                        {getActionCfg(selectedLog.action_type).icon}
                                    </span>
                                )}
                                Audit Log Details
                            </DialogTitle>
                            <DialogDescription>
                                Complete record of the <strong>{selectedLog?.action_type}</strong> action on{' '}
                                <strong>{selectedLog?.student_name}</strong>
                            </DialogDescription>
                        </DialogHeader>

                        {selectedLog && (() => {
                            const changes = getFieldChanges(selectedLog);
                            return (
                                <div className="space-y-5 pt-2">
                                    {/* Meta */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        {[
                                            { label: 'Date',    val: format(new Date(selectedLog.created_at), 'MMM dd, yyyy') },
                                            { label: 'Time',    val: format(new Date(selectedLog.created_at), 'hh:mm:ss a') },
                                            { label: 'user',    val: selectedLog.performed_by_name },
                                            { label: 'Role',    val: selectedLog.role.toUpperCase() },
                                        ].map(({ label, val }) => (
                                            <div key={label}>
                                                <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">{label}</div>
                                                <div className="text-sm font-bold text-slate-900">{val}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Human-readable summary */}
                                    <div className="rounded-2xl bg-[#002147]/5 border border-[#002147]/10 p-4 text-sm text-slate-700 leading-relaxed">
                                        <strong className="text-[#002147]">{selectedLog.performed_by_name}</strong>
                                        {' '}({selectedLog.role}){' '}
                                        <strong>{selectedLog.action_type.toLowerCase()}d</strong>
                                        {' '}student{' '}
                                        <strong>{selectedLog.student_name}</strong>{' '}
                                        {changes.length > 0 && (
                                            <>— changed <strong>{changes.length}</strong> field{changes.length > 1 ? 's' : ''}</>
                                        )}
                                        {' '}on{' '}
                                        <strong>{format(new Date(selectedLog.created_at), 'dd MMM yyyy')} at {format(new Date(selectedLog.created_at), 'hh:mm a')}</strong>
                                    </div>

                                    {/* Field-level diff */}
                                    {changes.length > 0 ? (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-bold text-slate-900">Changed Fields ({changes.length})</h4>
                                            <div className="rounded-2xl border border-slate-100 overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50 border-b border-slate-100">
                                                        <tr>
                                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-1/4">Field</th>
                                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-rose-400 uppercase tracking-wider w-[37.5%]">Before</th>
                                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-emerald-500 uppercase tracking-wider w-[37.5%]">After</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {changes.map((c, i) => (
                                                            <motion.tr
                                                                key={c.field}
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                transition={{ delay: i * 0.04 }}
                                                                className="hover:bg-slate-50/50"
                                                            >
                                                                <td className="px-4 py-2.5 font-semibold text-slate-700 text-xs">{c.label}</td>
                                                                <td className="px-4 py-2.5">
                                                                    <span className="inline-block bg-rose-50 text-rose-700 rounded px-1.5 py-0.5 text-xs font-mono">
                                                                        {c.oldValue === '—' ? <em className="text-slate-400 font-sans not-italic">empty</em> : c.oldValue}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
                                                                        <span className="inline-block bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5 text-xs font-mono">
                                                                            {c.newValue === '—' ? <em className="text-slate-400 font-sans not-italic">empty</em> : c.newValue}
                                                                        </span>
                                                                    </span>
                                                                </td>
                                                            </motion.tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Fallback: show raw JSON for ADD/DELETE */
                                        <div className="grid sm:grid-cols-2 gap-4">
                                            {[
                                                { title: 'Previous State', data: selectedLog.old_values, bg: 'bg-slate-50', border: 'border-slate-100' },
                                                { title: 'New State', data: selectedLog.new_values, bg: 'bg-blue-50/30', border: 'border-blue-100/50' },
                                            ].map(({ title, data, bg, border }) => (
                                                <div key={title}>
                                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</div>
                                                    <div className={`${bg} rounded-2xl p-4 border ${border} min-h-[80px] overflow-auto`}>
                                                        {data ? (
                                                            <pre className="text-[10px] text-slate-600 font-mono whitespace-pre-wrap">
                                                                {JSON.stringify(data, null, 2)}
                                                            </pre>
                                                        ) : (
                                                            <div className="h-full flex items-center text-slate-300 italic text-xs">
                                                                {title === 'Previous State' ? 'New record — no previous data' : 'Record deleted'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                        <Button variant="outline" className="rounded-xl" onClick={() => setSelectedLog(null)}>
                                            Close
                                        </Button>
                                        <Button className="bg-[#002147] hover:bg-[#002147]/90 text-white rounded-xl gap-2" onClick={handleExportCSV}>
                                            <Download className="h-4 w-4" /> Export Log
                                        </Button>
                                    </div>
                                </div>
                            );
                        })()}
                    </DialogContent>
                </Dialog>

            </div>
        </DashboardLayout>
    );
}
