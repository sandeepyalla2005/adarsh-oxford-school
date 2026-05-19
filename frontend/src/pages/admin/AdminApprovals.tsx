import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    AlertCircle, 
    CheckCircle, 
    XCircle, 
    GraduationCap, 
    User,
    Calendar,
    Loader2,
    Search,
    TrendingDown,
    Activity,
    ArrowRight,
    Sparkles,
    BrainCircuit,
    ListFilter,
    Phone,
    MapPin,
    FileText,
    TrendingUp,
    ShieldAlert,
    Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Student = {
    id: string | number;
    full_name?: string;
    admission_number?: string;
    class_id?: string;
    classes?: { name?: string };
    status?: 'active' | 'dropout' | 'graduated' | 'dropout_pending';
    dropout_reason?: string | null;
    is_active?: boolean;
    dob?: string;
    father_name?: string;
    father_phone?: string;
    mother_name?: string;
    mother_phone?: string;
    parent_email?: string;
    roll_number?: string;
    gender?: string;
    aadhaar?: string;
    address?: string;
    joining_date?: string;
    term1_fee?: number;
    term2_fee?: number;
    term3_fee?: number;
    has_books?: boolean;
    books_fee?: number;
    has_transport?: boolean;
    transport_fee?: number;
    old_dues?: number;
    student_type?: string;
    dropout_date?: string | null;
};

// Categorize dropout reasons dynamically to build retention charts
const categorizeReason = (reason: string | null | undefined): string => {
    if (!reason) return 'Other / Personal Reasons';
    const r = reason.toLowerCase();
    if (r.includes('fee') || r.includes('financial') || r.includes('money') || r.includes('afford') || r.includes('cost') || r.includes('pay')) {
        return 'Financial / Fee Issues';
    }
    if (r.includes('relocat') || r.includes('shift') || r.includes('mov') || r.includes('transfer') || r.includes('tc') || r.includes('city') || r.includes('village')) {
        return 'Relocation / Migration';
    }
    if (r.includes('better') || r.includes('another school') || r.includes('other school') || r.includes('admission elsewhere') || r.includes('different school')) {
        return 'School Transfer';
    }
    if (r.includes('travel') || r.includes('distance') || r.includes('transport') || r.includes('far') || r.includes('bus')) {
        return 'Distance / Transport';
    }
    if (r.includes('health') || r.includes('sick') || r.includes('medical') || r.includes('illness') || r.includes('personal')) {
        return 'Health & Personal';
    }
    if (r.includes('fail') || r.includes('study') || r.includes('academic') || r.includes('grade') || r.includes('learning')) {
        return 'Academic Performance';
    }
    return 'Other / Personal Reasons';
};

export default function AdminApprovals() {
    const { isAdmin } = useAuth();
    const { toast } = useToast();
    
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [pendingStudents, setPendingStudents] = useState<Student[]>([]);
    const [confirmedDropouts, setConfirmedDropouts] = useState<Student[]>([]);
    const [activeCount, setActiveCount] = useState(0);
    
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | number | null>(null);
    const [activeTab, setActiveTab] = useState<'pending' | 'registry' | 'insights'>('pending');
    
    // Search and filters for registry
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const resp = await apiFetch('/api/class-students?class_name=all', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!resp.ok) {
                throw new Error(`Failed to load requests (${resp.status})`);
            }

            const data = await resp.json();
            const list = data as Student[];
            setAllStudents(list);

            // Filter pending requests
            const pending = list.filter(
                (s) => s.status === 'dropout_pending' || s.dropout_reason?.startsWith('PENDING APPROVAL:') || s.dropout_reason === 'DELETED_PENDING_PURGE'
            );
            setPendingStudents(pending);

            // Filter confirmed dropouts
            const confirmed = list.filter(
                (s) => s.status === 'dropout' || (!s.is_active && s.status !== 'dropout_pending' && s.dropout_reason && s.dropout_reason !== 'DELETED_PENDING_PURGE')
            );
            setConfirmedDropouts(confirmed);

            // Count active students
            const active = list.filter((s) => s.is_active && s.status !== 'dropout_pending').length;
            setActiveCount(active);
        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            toast({
                variant: 'destructive',
                title: 'Data Error',
                description: error.message || 'Failed to load dropout registry.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const handleApprove = async (student: Student) => {
        if (!isAdmin || !student?.id) return;
        setProcessingId(student.id);
        
        try {
            const resp = await apiFetch(`/api/students/approve-dropout/${student.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Approval failed');
            toast({ title: 'Approved', description: data.message });
            fetchAllData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (student: Student) => {
        if (!isAdmin || !student?.id) return;
        setProcessingId(student.id);
        
        try {
            const resp = await apiFetch(`/api/students/reject-dropout/${student.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Rejection failed');
            toast({ title: 'Rejected', description: data.message });
            fetchAllData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setProcessingId(null);
        }
    };

    const getClassName = (student: Student) => {
        return student.classes?.name || 'Unknown Class';
    };

    // Calculate Analytics
    const totalStudentsCount = activeCount + confirmedDropouts.length;
    const retentionRate = totalStudentsCount > 0 ? (activeCount / totalStudentsCount) * 100 : 100;
    
    // Group and categorize reasons
    const reasonStats = {
        'Financial / Fee Issues': 0,
        'Relocation / Migration': 0,
        'School Transfer': 0,
        'Distance / Transport': 0,
        'Health & Personal': 0,
        'Academic Performance': 0,
        'Other / Personal Reasons': 0
    };
    
    confirmedDropouts.forEach(s => {
        const cat = categorizeReason(s.dropout_reason);
        if (cat in reasonStats) {
            reasonStats[cat as keyof typeof reasonStats]++;
        }
    });

    // Find top driver
    let topDriver = 'None';
    let topDriverCount = 0;
    Object.entries(reasonStats).forEach(([key, val]) => {
        if (val > topDriverCount) {
            topDriverCount = val;
            topDriver = key;
        }
    });

    // Dynamic classes list for filter dropdown
    const classesList = Array.from(
        new Set(allStudents.map(s => s.classes?.name).filter(Boolean))
    ).sort() as string[];

    // Filter confirmed dropouts for search
    const filteredConfirmed = confirmedDropouts.filter((s) => {
        const matchesSearch = 
            (s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
            (s.admission_number?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
            
        const matchesClass = classFilter === 'all' || s.classes?.name === classFilter;
        return matchesSearch && matchesClass;
    });

    if (!isAdmin) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh]">
                    <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
                    <p className="text-slate-500 mt-2">Only administrators can view this page.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-8 pb-16">
                
                {/* Dashboard Title Section */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-[#002147] font-display flex items-center gap-3">
                            Dropouts & Approvals <Sparkles className="h-6 w-6 text-amber-500" />
                        </h1>
                        <p className="text-slate-500 mt-1.5 text-base">
                            Track student retention, manage pending dropout requests, and analyze historical drivers.
                        </p>
                    </div>
                </div>

                {/* Metrics Cards Grid */}
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    
                    {/* Card 1: Retention Rate */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 p-6 shadow-md hover:shadow-lg transition-all"
                    >
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-20 w-20 rounded-full bg-emerald-50 blur-2xl" />
                        <div className="flex items-center justify-between mb-3">
                            <div className="rounded-2xl bg-emerald-50 p-2.5">
                                <Activity className="h-5 w-5 text-emerald-600" />
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold">
                                Target &gt; 95%
                            </Badge>
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Retention Rate</h3>
                        <p className="text-3xl font-black font-display text-emerald-600 mt-1">
                            {retentionRate.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                            {activeCount} active / {totalStudentsCount} total enrolled
                        </p>
                    </motion.div>

                    {/* Card 2: Pending Requests */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 p-6 shadow-md hover:shadow-lg transition-all"
                    >
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-20 w-20 rounded-full bg-amber-50 blur-2xl" />
                        <div className="flex items-center justify-between mb-3">
                            <div className="rounded-2xl bg-amber-50 p-2.5">
                                <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                            {pendingStudents.length > 0 && (
                                <span className="flex h-2.5 w-2.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                </span>
                            )}
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Approvals</h3>
                        <p className="text-3xl font-black font-display text-amber-600 mt-1">
                            {pendingStudents.length}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">Requires administrative review</p>
                    </motion.div>

                    {/* Card 3: Total Dropouts */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 p-6 shadow-md hover:shadow-lg transition-all"
                    >
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-20 w-20 rounded-full bg-violet-50 blur-2xl" />
                        <div className="flex items-center justify-between mb-3">
                            <div className="rounded-2xl bg-violet-50 p-2.5">
                                <GraduationCap className="h-5 w-5 text-violet-600" />
                            </div>
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Dropouts</h3>
                        <p className="text-3xl font-black font-display text-violet-600 mt-1">
                            {confirmedDropouts.length}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">Historical dropouts registry</p>
                    </motion.div>

                    {/* Card 4: Top Driver */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 p-6 shadow-md hover:shadow-lg transition-all"
                    >
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-20 w-20 rounded-full bg-red-50 blur-2xl" />
                        <div className="flex items-center justify-between mb-3">
                            <div className="rounded-2xl bg-red-50 p-2.5">
                                <ShieldAlert className="h-5 w-5 text-red-600" />
                            </div>
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Top Dropout Driver</h3>
                        <p className="text-lg font-black font-display text-red-600 mt-1.5 truncate">
                            {topDriverCount > 0 ? topDriver : 'None'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                            {topDriverCount > 0 ? `${topDriverCount} student${topDriverCount > 1 ? 's' : ''} impacted` : 'No driver recorded'}
                        </p>
                    </motion.div>

                </div>

                {/* Custom Glassmorphic Navigation Tabs */}
                <div className="flex bg-[#F1F5F9] p-1.5 rounded-2xl max-w-lg border border-slate-200/50 shadow-inner">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-extrabold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                            activeTab === 'pending'
                                ? 'bg-white text-[#002147] shadow-md border border-slate-100'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        Pending Approvals
                        {pendingStudents.length > 0 && (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-5 w-5 flex items-center justify-center p-0 rounded-full text-[10px]">
                                {pendingStudents.length}
                            </Badge>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('registry')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-extrabold tracking-wide transition-all duration-300 ${
                            activeTab === 'registry'
                                ? 'bg-white text-[#002147] shadow-md border border-slate-100'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        Dropout Registry
                    </button>
                    <button
                        onClick={() => setActiveTab('insights')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-extrabold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                            activeTab === 'insights'
                                ? 'bg-white text-[#002147] shadow-md border border-slate-100'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <BrainCircuit className="h-4 w-4" />
                        Insights
                    </button>
                </div>

                {/* Tabs Content */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-80 bg-white rounded-[2rem] border border-slate-100 shadow-md">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-3" />
                        <p className="text-slate-400 font-bold text-sm">Synchronizing dropout records...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        
                        {/* Tab 1: Pending Approvals */}
                        {activeTab === 'pending' && (
                            <div className="space-y-6">
                                {pendingStudents.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-slate-200/50 p-16 text-center shadow-lg"
                                    >
                                        <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-50/50">
                                            <CheckCircle className="h-10 w-10 text-emerald-500" />
                                        </div>
                                        <h3 className="text-2xl font-black text-[#002147] tracking-tight mb-1.5">All Caught Up!</h3>
                                        <p className="text-slate-500 max-w-sm text-sm">
                                            There are no pending dropout requests or deletions requiring administrative approval.
                                        </p>
                                    </motion.div>
                                ) : (
                                    <div className="grid gap-6">
                                        {pendingStudents.map((student, index) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                key={student.id}
                                            >
                                                <Card className="border-none shadow-md overflow-hidden ring-1 ring-slate-100 hover:shadow-lg transition-all relative">
                                                    <div className="absolute top-0 left-0 w-2 h-full bg-amber-400" />
                                                    <CardContent className="p-0">
                                                        {(() => {
                                                            const t1 = Number(student.term1_fee || 0);
                                                            const t2 = Number(student.term2_fee || 0);
                                                            const t3 = Number(student.term3_fee || 0);
                                                            const books = student.has_books ? Number(student.books_fee || 0) : 0;
                                                            const transport = student.has_transport ? Number(student.transport_fee || 0) : 0;
                                                            const oldDues = Number(student.old_dues || 0);
                                                            const totalPending = t1 + t2 + t3 + books + transport + oldDues;

                                                            return (
                                                                <div className="flex flex-col lg:flex-row items-stretch">
                                                                    
                                                                    {/* Left side details */}
                                                                    <div className="p-6 md:p-8 flex-1 border-b lg:border-b-0 lg:border-r border-slate-100 bg-white space-y-6">
                                                                        <div className="flex items-start justify-between flex-wrap gap-4">
                                                                            <div>
                                                                                <h3 className="text-2xl font-black text-[#002147] tracking-tight">{student.full_name}</h3>
                                                                                <p className="text-sm font-bold text-slate-500 flex items-center gap-2 mt-1">
                                                                                    <GraduationCap className="h-4 w-4" />
                                                                                    {getClassName(student)} • Adm No: {student.admission_number || 'N/A'}
                                                                                </p>
                                                                            </div>
                                                                            <Badge className="bg-amber-100 text-amber-800 border-none font-bold uppercase tracking-wider text-[10px] px-3 py-1">
                                                                                Action Required
                                                                            </Badge>
                                                                        </div>

                                                                        {/* Profile Grids */}
                                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#002147] border-b border-slate-200 pb-1.5 mb-2">Student Bio</h4>
                                                                                <div>
                                                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Gender</span>
                                                                                    <p className="text-xs font-bold text-slate-700">{student.gender || 'N/A'}</p>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-[10px] uppercase font-bold text-slate-400">DOB</span>
                                                                                    <p className="text-xs font-bold text-slate-700">{student.dob || 'N/A'}</p>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Aadhaar Card</span>
                                                                                    <p className="text-xs font-bold text-slate-700">{student.aadhaar || 'N/A'}</p>
                                                                                </div>
                                                                            </div>

                                                                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#002147] border-b border-slate-200 pb-1.5 mb-2">Contacts</h4>
                                                                                <div>
                                                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Father's Info</span>
                                                                                    <p className="text-xs font-bold text-slate-700">{student.father_name || 'N/A'}</p>
                                                                                    {student.father_phone && <p className="text-[11px] font-bold text-[#002147] mt-0.5">{student.father_phone}</p>}
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Mother's Info</span>
                                                                                    <p className="text-xs font-bold text-slate-700">{student.mother_name || 'N/A'}</p>
                                                                                    {student.mother_phone && <p className="text-[11px] font-bold text-[#002147] mt-0.5">{student.mother_phone}</p>}
                                                                                </div>
                                                                            </div>

                                                                            <div className="bg-red-50/20 p-4 rounded-2xl border border-red-100/50 space-y-2">
                                                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-700 border-b border-red-100 pb-1.5 mb-2 font-display">Outstanding Fees</h4>
                                                                                <div className="flex justify-between text-xs font-semibold text-slate-600">
                                                                                    <span>Course Dues:</span>
                                                                                    <span className="font-bold text-slate-800">₹{t1 + t2 + t3}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-xs font-semibold text-slate-600">
                                                                                    <span>Special Fees:</span>
                                                                                    <span className="font-bold text-slate-800">₹{books + transport}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-xs font-semibold text-slate-600">
                                                                                    <span>Old Outstanding:</span>
                                                                                    <span className="font-bold text-slate-800">₹{oldDues}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-sm font-bold text-red-700 bg-red-100/50 px-2 py-1.5 rounded-lg border border-red-200 mt-2">
                                                                                    <span>Total Due:</span>
                                                                                    <span>₹{totalPending}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Right side reason and actions */}
                                                                    <div className="p-6 md:p-8 lg:w-96 bg-amber-50/30 flex flex-col justify-between">
                                                                        <div>
                                                                            <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-2">
                                                                                <AlertCircle className="h-4 w-4" />
                                                                                Request Reason
                                                                            </h4>
                                                                            <p className="text-sm font-bold text-slate-700 leading-relaxed bg-white/60 p-4 rounded-xl border border-amber-100 shadow-sm min-h-24">
                                                                                {student.dropout_reason?.replace("PENDING APPROVAL: ", "") || "No reason provided."}
                                                                            </p>
                                                                        </div>

                                                                        <div className="flex gap-3 mt-8">
                                                                            <Button 
                                                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md rounded-xl h-11 border-none transition-all"
                                                                                onClick={() => handleApprove(student)}
                                                                                disabled={processingId !== null}
                                                                            >
                                                                                {processingId === student.id ? (
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                ) : (
                                                                                    <>
                                                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                                                        Approve
                                                                                    </>
                                                                                )}
                                                                            </Button>
                                                                            <Button 
                                                                                variant="outline"
                                                                                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold shadow-sm rounded-xl h-11 transition-all"
                                                                                onClick={() => handleReject(student)}
                                                                                disabled={processingId !== null}
                                                                            >
                                                                                <XCircle className="h-4 w-4 mr-2" />
                                                                                Reject
                                                                            </Button>
                                                                        </div>
                                                                    </div>

                                                                </div>
                                                            );
                                                        })()}
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 2: Dropout Registry */}
                        {activeTab === 'registry' && (
                            <div className="space-y-6">
                                
                                {/* Search and Filter Box */}
                                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by student name, admission number..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-slate-300 transition-all placeholder:text-slate-400"
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="relative shrink-0">
                                            <ListFilter className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                            <select
                                                value={classFilter}
                                                onChange={(e) => setClassFilter(e.target.value)}
                                                className="pl-11 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-extrabold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-slate-300 transition-all cursor-pointer"
                                            >
                                                <option value="all">All Classes</option>
                                                {classesList.map((c) => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Registry Student List */}
                                {filteredConfirmed.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm">
                                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                            <Search className="h-8 w-8 text-slate-400" />
                                        </div>
                                        <h3 className="text-xl font-extrabold text-[#002147] mb-1">No matches found</h3>
                                        <p className="text-slate-500 max-w-sm text-sm">
                                            We couldn't find any confirmed dropouts matching your current filter. Try adjusting your search.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-slate-100 rounded-[2rem] shadow-md overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[10px] font-extrabold">
                                                        <th className="py-5 px-6">Student Info</th>
                                                        <th className="py-5 px-6">Class</th>
                                                        <th className="py-5 px-6">Dropout Date</th>
                                                        <th className="py-5 px-6">Primary Driver</th>
                                                        <th className="py-5 px-6">Reason for Dropout</th>
                                                        <th className="py-5 px-6 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredConfirmed.map((student) => {
                                                        const cat = categorizeReason(student.dropout_reason);
                                                        
                                                        return (
                                                            <tr key={student.id} className="hover:bg-slate-50/50 transition-all font-semibold text-slate-700">
                                                                <td className="py-4 px-6">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 shrink-0 text-sm">
                                                                            {student.full_name?.charAt(0)}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-bold text-slate-900 leading-tight">{student.full_name}</p>
                                                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">Adm: {student.admission_number}</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="py-4 px-6 text-sm">{getClassName(student)}</td>
                                                                <td className="py-4 px-6 text-sm text-slate-500">
                                                                    <span className="flex items-center gap-1.5">
                                                                        <Calendar className="h-4 w-4 text-slate-400" />
                                                                        {student.dropout_date ? new Date(student.dropout_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 px-6">
                                                                    <Badge className={`border-none text-[10px] font-bold py-0.5 px-2.5 rounded-full ${
                                                                        cat === 'Financial / Fee Issues' ? 'bg-red-50 text-red-700' :
                                                                        cat === 'Relocation / Migration' ? 'bg-blue-50 text-blue-700' :
                                                                        cat === 'School Transfer' ? 'bg-teal-50 text-teal-700' :
                                                                        cat === 'Distance / Transport' ? 'bg-amber-50 text-amber-700' :
                                                                        cat === 'Health & Personal' ? 'bg-violet-50 text-violet-700' :
                                                                        cat === 'Academic Performance' ? 'bg-indigo-50 text-indigo-700' :
                                                                        'bg-slate-100 text-slate-700'
                                                                    }`}>
                                                                        {cat}
                                                                    </Badge>
                                                                </td>
                                                                <td className="py-4 px-6 text-xs max-w-xs truncate text-slate-500 font-medium">
                                                                    {student.dropout_reason || 'No reason documented.'}
                                                                </td>
                                                                <td className="py-4 px-6 text-right">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => setSelectedStudent(student)}
                                                                        className="font-extrabold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl px-3"
                                                                    >
                                                                        Analyze Details
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}

                        {/* Tab 3: Insights & Prevention */}
                        {activeTab === 'insights' && (
                            <div className="grid gap-8 grid-cols-1 lg:grid-cols-12">
                                
                                {/* Left Side: Driver Distribution */}
                                <div className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-md lg:col-span-7 space-y-6">
                                    <div>
                                        <h3 className="text-xl font-black text-[#002147] tracking-tight">Dropout Drivers Analysis</h3>
                                        <p className="text-sm text-slate-400 font-semibold mt-1">Breakdown of reasons provided for student dropouts</p>
                                    </div>

                                    {confirmedDropouts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <BrainCircuit className="h-12 w-12 text-slate-300 mb-3" />
                                            <p className="text-slate-400 font-bold text-sm">No historical data available to compile drivers chart.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-5 pt-3">
                                            {Object.entries(reasonStats)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([key, val]) => {
                                                    const pct = confirmedDropouts.length > 0 ? (val / confirmedDropouts.length) * 100 : 0;
                                                    
                                                    return (
                                                        <div key={key} className="space-y-1.5">
                                                            <div className="flex justify-between text-xs font-bold text-slate-600">
                                                                <span className="flex items-center gap-2">
                                                                    <span className={`h-2.5 w-2.5 rounded-full ${
                                                                        key === 'Financial / Fee Issues' ? 'bg-red-500' :
                                                                        key === 'Relocation / Migration' ? 'bg-blue-500' :
                                                                        key === 'School Transfer' ? 'bg-teal-500' :
                                                                        key === 'Distance / Transport' ? 'bg-amber-500' :
                                                                        key === 'Health & Personal' ? 'bg-violet-500' :
                                                                        key === 'Academic Performance' ? 'bg-indigo-500' :
                                                                        'bg-slate-400'
                                                                    }`} />
                                                                    {key}
                                                                </span>
                                                                <span>{val} student{val !== 1 ? 's' : ''} ({pct.toFixed(0)}%)</span>
                                                            </div>
                                                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${pct}%` }}
                                                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                                                    className={`h-full rounded-full ${
                                                                        key === 'Financial / Fee Issues' ? 'bg-red-500' :
                                                                        key === 'Relocation / Migration' ? 'bg-blue-500' :
                                                                        key === 'School Transfer' ? 'bg-teal-500' :
                                                                        key === 'Distance / Transport' ? 'bg-amber-500' :
                                                                        key === 'Health & Personal' ? 'bg-violet-500' :
                                                                        key === 'Academic Performance' ? 'bg-indigo-500' :
                                                                        'bg-slate-400'
                                                                    }`}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Retention Risks & Action Plans */}
                                <div className="lg:col-span-5 space-y-6">
                                    <div className="bg-gradient-to-br from-[#002147] to-[#1A2642] text-white p-8 rounded-[2rem] shadow-lg relative overflow-hidden">
                                        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-28 w-28 rounded-full bg-white/5 blur-2xl" />
                                        <h3 className="text-lg font-black tracking-tight flex items-center gap-2 mb-2">
                                            <BrainCircuit className="h-5 w-5 text-amber-400 animate-pulse" />
                                            Retention Recommendation
                                        </h3>
                                        <p className="text-xs text-[#A8B6CF] font-bold leading-relaxed mb-6">
                                            Our algorithms analyzed dropouts history and formulated custom, proactive measures:
                                        </p>
                                        
                                        <div className="space-y-4">
                                            {topDriver === 'Financial / Fee Issues' && (
                                                <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                                                    <h4 className="text-sm font-bold text-amber-300">Financial Aid & Flexi-Installments</h4>
                                                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                                        With financial issues being a primary reason, consider setting up a dynamic "installments schedule" or waiver models in their fee profiles to accommodate tight parent cashflows.
                                                    </p>
                                                </div>
                                            )}
                                            {topDriver === 'Distance / Transport' && (
                                                <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                                                    <h4 className="text-sm font-bold text-amber-300">Transport Optimisation</h4>
                                                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                                        Distance has been recorded as a top issue. Try expanding the school bus network routing or launching peer-based parent carpool groups.
                                                    </p>
                                                </div>
                                            )}
                                            {topDriver === 'School Transfer' && (
                                                <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                                                    <h4 className="text-sm font-bold text-amber-300">Exit Surveys & Feedback Loop</h4>
                                                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                                        Since students are shifting to other alternatives, institute a systematic survey during the TC request to track curriculum, infra, or staff feedbacks.
                                                    </p>
                                                </div>
                                            )}
                                            <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                                                <h4 className="text-sm font-bold text-amber-300">Mid-Term Academic Counseling</h4>
                                                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                                    Early intervention based on academic performance drop logs (e.g. from low homework ratings or attendance counts) can resolve issues before parents consider dropout plans.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}

                    </div>
                )}

            </div>

            {/* Premium Dropout Student Detail Modal */}
            <AnimatePresence>
                {selectedStudent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-3xl overflow-hidden relative"
                        >
                            {/* Modal Header */}
                            <div className="bg-[#002147] text-white px-8 py-6 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Student Profile & Dropout Log</span>
                                    <h3 className="text-2xl font-black tracking-tight mt-0.5">{selectedStudent.full_name}</h3>
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={() => setSelectedStudent(null)}
                                    className="text-white hover:bg-white/10 rounded-full h-10 w-10 p-0 flex items-center justify-center"
                                >
                                    <XCircle className="h-6 w-6" />
                                </Button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                                
                                {/* Status Flag Banner */}
                                <div className="bg-red-50 rounded-2xl border border-red-100 p-5 flex items-start gap-4">
                                    <div className="bg-red-100 p-2.5 rounded-xl shrink-0 mt-0.5">
                                        <ShieldAlert className="h-5 w-5 text-red-700" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-red-900 uppercase tracking-wide">Confirmed Dropout Details</h4>
                                        <p className="text-xs text-red-700/80 font-bold mt-0.5">
                                            Status finalized on {selectedStudent.dropout_date ? new Date(selectedStudent.dropout_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                                        </p>
                                        <div className="mt-3 bg-white/80 border border-red-200/50 p-4 rounded-xl shadow-sm">
                                            <span className="text-[9px] uppercase font-bold text-slate-400">Documented Reason</span>
                                            <p className="text-xs font-bold text-slate-700 mt-1 leading-relaxed">
                                                "{selectedStudent.dropout_reason || 'No specific reason entered.'}"
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Personal and Family Grids */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    
                                    {/* Personal Profile */}
                                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-[#002147] border-b border-slate-200 pb-1.5 mb-2 flex items-center gap-2">
                                            <User className="h-4 w-4" /> Personal Profile
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Class & Roll</span>
                                                <p className="font-bold text-slate-700 mt-0.5">{getClassName(selectedStudent)} • Roll {selectedStudent.roll_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Admission No</span>
                                                <p className="font-bold text-slate-700 mt-0.5">{selectedStudent.admission_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Gender</span>
                                                <p className="font-bold text-slate-700 mt-0.5">{selectedStudent.gender || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-400">DOB</span>
                                                <p className="font-bold text-slate-700 mt-0.5">{selectedStudent.dob || 'N/A'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Residential Address</span>
                                                <p className="font-bold text-slate-700 mt-0.5 leading-relaxed">{selectedStudent.address || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Parent / Contacts */}
                                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-[#002147] border-b border-slate-200 pb-1.5 mb-2 flex items-center gap-2">
                                            <Phone className="h-4 w-4" /> Parent Contacts
                                        </h4>
                                        <div className="space-y-3 text-xs">
                                            <div className="flex justify-between items-start gap-4">
                                                <div>
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Father's Info</span>
                                                    <p className="font-bold text-slate-700 mt-0.5">{selectedStudent.father_name || 'N/A'}</p>
                                                </div>
                                                {selectedStudent.father_phone && (
                                                    <Badge className="bg-blue-50 text-blue-700 font-bold border-none py-1 hover:bg-blue-50">
                                                        {selectedStudent.father_phone}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-start gap-4 border-t border-slate-100 pt-2.5">
                                                <div>
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Mother's Info</span>
                                                    <p className="font-bold text-slate-700 mt-0.5">{selectedStudent.mother_name || 'N/A'}</p>
                                                </div>
                                                {selectedStudent.mother_phone && (
                                                    <Badge className="bg-blue-50 text-blue-700 font-bold border-none py-1 hover:bg-blue-50">
                                                        {selectedStudent.mother_phone}
                                                    </Badge>
                                                )}
                                            </div>
                                            {selectedStudent.parent_email && (
                                                <div className="border-t border-slate-100 pt-2.5">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Parent Email</span>
                                                    <p className="font-bold text-slate-700 truncate mt-0.5">{selectedStudent.parent_email}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
