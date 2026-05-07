import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Search, Calendar, UserCheck, Clock, Loader2, Save, AlertTriangle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';

const CLASSES = [
    'Nursery', 'LKG', 'UKG',
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
];

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

interface Student {
    id: string;
    full_name: string;
    admission_number: string;
    profile_photo?: string;
}

export default function Attendance() {
    const { user } = useAuth();
    const [staffDisplayName, setStaffDisplayName] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const isFutureDate = date > today;

    // Fetch staff display name from profiles
    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.id) return;
            const { data } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', user.id)
                .single();
            if (data?.full_name) setStaffDisplayName(data.full_name as string);
            else setStaffDisplayName(user.email?.split('@')[0] || 'Staff');
        };
        fetchProfile();
    }, [user?.id]);

    // Fetch students + existing records when class/date changes
    useEffect(() => {
        if (selectedClass) {
            fetchStudents();
        } else {
            setStudents([]);
            setAttendanceData({});
            setAlreadySubmitted(false);
        }
    }, [selectedClass, date]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            // 1. Get class_id
            const { data: classList, error: classError } = await supabase
                .from('classes')
                .select('id')
                .eq('name', selectedClass)
                .limit(1);

            if (classError) throw classError;
            if (!classList || classList.length === 0) {
                toast.error('Class not found');
                setLoading(false);
                return;
            }
            const classData = classList[0];

            // 2. Fetch students in this class
            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select('id, full_name, admission_number, profile_photo')
                .eq('class_id', classData.id)
                .order('full_name');

            if (studentsError) throw studentsError;
            const fetched = (studentsData || []) as Student[];
            setStudents(fetched);

            // 3. Check if attendance already submitted for this date+class
            const studentIds = fetched.map(s => s.id);
            if (studentIds.length === 0) {
                setAttendanceData({});
                setAlreadySubmitted(false);
                return;
            }

            const { data: existing } = await supabase
                .from('attendance_records')
                .select('student_id, status')
                .eq('class_name', selectedClass)
                .eq('date', date)
                .in('student_id', studentIds);

            const init: Record<string, AttendanceStatus> = {};
            fetched.forEach((s: Student) => { init[s.id] = 'Present'; });

            if (existing && existing.length > 0) {
                setAlreadySubmitted(true);
                existing.forEach((r: any) => {
                    init[r.student_id] = r.status as AttendanceStatus;
                });
                toast.info('Existing attendance loaded. You can update it.');
            } else {
                setAlreadySubmitted(false);
            }

            setAttendanceData(init);
        } catch (error: any) {
            console.error('Error fetching students:', error);
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAttendance = (studentId: string, status: AttendanceStatus) => {
        setAttendanceData(prev => ({ ...prev, [studentId]: status }));
    };

    // Mark all at once
    const markAll = (status: AttendanceStatus) => {
        const next: Record<string, AttendanceStatus> = {};
        students.forEach(s => { next[s.id] = status; });
        setAttendanceData(next);
    };

    const handleSubmit = async () => {
        if (!selectedClass || students.length === 0) return;
        if (isFutureDate) {
            toast.error('Cannot mark attendance for a future date.');
            return;
        }
        setSaving(true);
        try {
            // Build only the columns that definitely exist in the original schema
            const records = students.map(student => ({
                student_id: student.id,
                student_name: student.full_name,
                class_name: selectedClass,
                date: date,
                status: attendanceData[student.id] || 'Present',
                staff_id: user?.id,
                staff_name: staffDisplayName,
            }));

            const studentIds = students.map(s => s.id);

            // Step 1: Delete any existing records for this class+date
            const { error: delErr } = await supabase
                .from('attendance_records')
                .delete()
                .eq('class_name', selectedClass)
                .eq('date', date)
                .in('student_id', studentIds);

            // Ignore delete errors (e.g., no records existed yet or RLS)
            if (delErr) {
                console.warn('Delete step skipped (no existing records or RLS):', delErr.message);
            }

            // Step 2: Fresh insert
            const { error: insertErr } = await supabase
                .from('attendance_records')
                .insert(records);

            if (insertErr) {
                console.error('Insert error:', insertErr);
                throw insertErr;
            }

            toast.success(`✅ Attendance ${alreadySubmitted ? 'updated' : 'submitted'} for ${selectedClass}!`);
            setAlreadySubmitted(true);
        } catch (err: any) {
            console.error('Attendance save failed:', err);
            toast.error(`❌ Failed to save attendance: ${err.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const filteredStudents = students.filter(s =>
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.admission_number?.toLowerCase().includes(search.toLowerCase())
    );

    const summary = {
        present: Object.values(attendanceData).filter(s => s === 'Present').length,
        absent: Object.values(attendanceData).filter(s => s === 'Absent').length,
        late: Object.values(attendanceData).filter(s => s === 'Late').length,
        leave: Object.values(attendanceData).filter(s => s === 'Leave').length,
    };

    const statusConfig: Record<AttendanceStatus, { label: string; icon: any; active: string; inactive: string }> = {
        Present: { label: 'Present', icon: Check, active: 'bg-emerald-50 text-emerald-700 border-emerald-300', inactive: 'text-slate-400 border-slate-200' },
        Absent: { label: 'Absent', icon: X, active: 'bg-red-50 text-red-700 border-red-300', inactive: 'text-slate-400 border-slate-200' },
        Late: { label: 'Late', icon: Clock, active: 'bg-amber-50 text-amber-700 border-amber-300', inactive: 'text-slate-400 border-slate-200' },
        Leave: { label: 'Leave', icon: FileText, active: 'bg-blue-50 text-blue-700 border-blue-300', inactive: 'text-slate-400 border-slate-200' },
    };

    return (
        <DashboardLayout>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-[#002147] tracking-tight font-display">Attendance Register</h1>
                        <p className="text-slate-500 font-medium">
                            Mark attendance for your class — syncs instantly to Admin
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Date picker */}
                        <div className={`flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border ${isFutureDate ? 'border-red-300 bg-red-50' : 'border-slate-100'}`}>
                            <Calendar className={`h-4 w-4 ${isFutureDate ? 'text-red-400' : 'text-slate-400'}`} />
                            <Input
                                type="date"
                                value={date}
                                max={today}
                                onChange={(e) => setDate(e.target.value)}
                                className="border-none p-0 h-auto font-bold text-slate-700 focus-visible:ring-0"
                            />
                        </div>

                        {/* Class selector */}
                        <Select value={selectedClass || ''} onValueChange={setSelectedClass}>
                            <SelectTrigger className="w-[180px] rounded-xl border-slate-200 bg-white font-bold text-[#002147] shadow-sm">
                                <SelectValue placeholder="Select Class" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-100 shadow-2xl z-[100]">
                                {CLASSES.map((c) => (
                                    <SelectItem key={c} value={c} className="font-medium rounded-lg my-1">{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Future date warning */}
                {isFutureDate && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                        <p className="font-medium text-sm">Attendance cannot be marked for future dates.</p>
                    </div>
                )}

                {/* Already submitted badge */}
                {alreadySubmitted && !isFutureDate && (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-700">
                        <Check className="h-5 w-5 flex-shrink-0" />
                        <p className="font-medium text-sm">
                            Attendance already submitted for this class on this date. Changes will update the existing record.
                        </p>
                    </div>
                )}

                {!selectedClass ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                        <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center">
                            <UserCheck className="h-10 w-10 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">Select a Class</h3>
                            <p className="text-slate-500 max-w-xs mx-auto">Choose a class from the dropdown to view student list and mark attendance.</p>
                        </div>
                    </div>
                ) : (
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                        {/* Toolbar */}
                        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search by name or roll no..."
                                    className="pl-10 rounded-xl border-slate-200 bg-white"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            {/* Summary + Mark All */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide mr-1">Quick Mark:</span>
                                {(['Present', 'Absent', 'Late', 'Leave'] as AttendanceStatus[]).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => markAll(s)}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${statusConfig[s].active}`}
                                    >
                                        All {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Summary strip */}
                        <div className="flex items-center gap-4 px-6 py-3 bg-white border-b border-slate-50">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">P: {summary.present}</span>
                            <span className="text-xs font-bold text-red-700 bg-red-50 px-3 py-1 rounded-full">A: {summary.absent}</span>
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">L: {summary.late}</span>
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">Le: {summary.leave}</span>
                            <span className="text-xs text-slate-400 ml-auto">{students.length} students</span>
                        </div>

                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center p-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-[#002147]" />
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="text-center p-12 text-slate-400">No students found.</div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    <AnimatePresence>
                                        {filteredStudents.map((student, i) => {
                                            const status = attendanceData[student.id];
                                            return (
                                                <motion.div
                                                    key={student.id}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.02 }}
                                                    className={`flex items-center justify-between p-4 transition-colors ${status === 'Absent' ? 'bg-red-50/30' : status === 'Leave' ? 'bg-blue-50/20' : 'hover:bg-slate-50'}`}
                                                >
                                                    {/* Student info */}
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative">
                                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs ring-2 overflow-hidden ${status === 'Present' ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                                                                : status === 'Absent' ? 'bg-red-100 text-red-700 ring-red-200'
                                                                    : status === 'Late' ? 'bg-amber-100 text-amber-700 ring-amber-200'
                                                                        : 'bg-blue-100 text-blue-700 ring-blue-200'
                                                                }`}>
                                                                {student.profile_photo ? (
                                                                    <img src={student.profile_photo} alt="" className="h-full w-full object-cover" />
                                                                ) : (
                                                                    (i + 1)
                                                                )}
                                                            </div>
                                                            {student.profile_photo && (
                                                                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-white shadow-sm flex items-center justify-center text-[8px] font-bold text-slate-500 border border-slate-100">
                                                                    {i + 1}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900">{student.full_name}</p>
                                                            <p className="text-xs text-slate-500">Roll: {student.admission_number || 'N/A'}</p>
                                                        </div>
                                                    </div>

                                                    {/* Status buttons */}
                                                    <div className="flex items-center gap-1.5">
                                                        {(Object.keys(statusConfig) as AttendanceStatus[]).map(s => {
                                                            const cfg = statusConfig[s];
                                                            const Icon = cfg.icon;
                                                            const isActive = status === s;
                                                            return (
                                                                <button
                                                                    key={s}
                                                                    onClick={() => handleMarkAttendance(student.id, s)}
                                                                    disabled={isFutureDate}
                                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isActive ? cfg.active : cfg.inactive + ' hover:bg-slate-50'}`}
                                                                >
                                                                    <Icon className="h-3 w-3" />
                                                                    <span className="hidden sm:inline">{cfg.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Submit footer */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4">
                                <div className="text-sm text-slate-500">
                                    Submitting as <span className="font-bold text-slate-700">{staffDisplayName}</span>
                                </div>
                                <Button
                                    onClick={handleSubmit}
                                    className="bg-[#002147] hover:bg-[#1e3a8a] text-white rounded-xl px-8 font-bold shadow-lg flex items-center gap-2"
                                    disabled={saving || loading || students.length === 0 || isFutureDate}
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {alreadySubmitted ? 'Update Attendance' : 'Submit Attendance'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    );
}
