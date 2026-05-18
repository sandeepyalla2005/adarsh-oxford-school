import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { 
    AlertCircle, 
    CheckCircle, 
    XCircle, 
    GraduationCap, 
    User,
    Calendar,
    Loader2
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
};

export default function AdminApprovals() {
    const { isAdmin } = useAuth();
    const { toast } = useToast();
    
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | number | null>(null);

    const fetchPendingRequests = async () => {
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
            // Filter only pending dropouts
            const pending = (data as Student[]).filter(
                (s) => s.status === 'dropout_pending' || s.dropout_reason === 'DELETED_PENDING_PURGE'
            );
            setStudents(pending);
        } catch (error: any) {
            console.error('Error fetching requests:', error);
            toast({
                variant: 'destructive',
                title: 'Data Error',
                description: error.message || 'Failed to load pending requests.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingRequests();
    }, []);

    const handleApprove = async (student: Student) => {
        if (!isAdmin || !student?.id) return;
        setProcessingId(student.id);
        
        // Handle normal dropout approval vs permanent deletion approval
        const isPurge = student.dropout_reason === 'DELETED_PENDING_PURGE';
        const endpoint = isPurge 
            ? `/api/students/purge/${student.id}` // Assuming a purge endpoint exists if needed, otherwise we just use approve
            : `/api/students/approve-dropout/${student.id}`;
            
        try {
            const resp = await apiFetch(`/api/students/approve-dropout/${student.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Approval failed');
            toast({ title: 'Approved', description: data.message });
            fetchPendingRequests();
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
            fetchPendingRequests();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setProcessingId(null);
        }
    };

    const getClassName = (student: Student) => {
        return student.classes?.name || 'Unknown Class';
    };

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
            <div className="space-y-8 pb-12">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-[#002147] font-display">Notifications & Approvals</h1>
                        <p className="text-slate-500 mt-2 text-lg">Review and manage student dropout requests from Fee In-Charge</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : students.length === 0 ? (
                    <div className="flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm">
                        <div className="h-24 w-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-50/50">
                            <CheckCircle className="h-12 w-12 text-emerald-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-[#002147] mb-2">All Caught Up!</h3>
                        <p className="text-slate-500 max-w-sm">
                            There are no pending dropout requests or deletions at the moment. 
                            Great job staying on top of things!
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {students.map((student, index) => (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                key={student.id}
                            >
                                <Card className="border-none shadow-md overflow-hidden ring-1 ring-slate-200 hover:shadow-lg transition-all">
                                    <div className="absolute top-0 left-0 w-2 h-full bg-amber-400"></div>
                                    <CardContent className="p-0">
                                        <div className="flex flex-col md:flex-row items-stretch">
                                            {/* Student Details Section */}
                                            <div className="p-6 md:p-8 flex-1 border-b md:border-b-0 md:border-r border-slate-100 bg-white">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div>
                                                        <h3 className="text-2xl font-black text-[#002147] tracking-tight">{student.full_name}</h3>
                                                        <p className="text-sm font-bold text-slate-500 flex items-center gap-2 mt-1">
                                                            <GraduationCap className="h-4 w-4" />
                                                            {getClassName(student)} • Adm No: {student.admission_number || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                                                        Action Required
                                                    </Badge>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4 mt-6">
                                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Father's Name</p>
                                                        <p className="text-sm font-bold text-slate-700">{student.father_name || 'N/A'}</p>
                                                    </div>
                                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">DOB</p>
                                                        <p className="text-sm font-bold text-slate-700">{student.dob || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Request Details Section */}
                                            <div className="p-6 md:p-8 md:w-96 bg-amber-50/30 flex flex-col justify-between">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-2">
                                                        <AlertCircle className="h-4 w-4" />
                                                        Request Reason
                                                    </h4>
                                                    <p className="text-sm font-medium text-slate-700 leading-relaxed bg-white/60 p-4 rounded-xl border border-amber-100 shadow-sm">
                                                        {student.dropout_reason || "No reason provided."}
                                                    </p>
                                                </div>
                                                
                                                <div className="flex gap-3 mt-8">
                                                    <Button 
                                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md rounded-xl h-11"
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
                                                        className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold shadow-sm rounded-xl h-11"
                                                        onClick={() => handleReject(student)}
                                                        disabled={processingId !== null}
                                                    >
                                                        <XCircle className="h-4 w-4 mr-2" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
