import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Printer, ArrowLeft, Loader2, Search, FileText, ChevronRight, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { getCurrentPortal, portalPath } from '@/lib/portal';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

const MONTH_NAMES: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August',
  9: 'September', 10: 'October', 11: 'November', 12: 'December'
};

interface ReceiptData {
    receiptNo: string;
    date: string;
    studentName: string;
    parentName: string;
    parentMobile: string;
    admissionNo: string;
    class: string;
    academicYear: string;
    particulars: { name: string; amount: number }[];
    totalAmount: number;
    paymentMode: string;
    narration?: string;
    oldDueCollected?: number;
    currentYearCollected?: number;
    remainingOldDue?: number;
    remainingCurrentYearBalance?: number;
}

export default function Receipt() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [data, setData] = useState<ReceiptData | null>(null);
    const [loading, setLoading] = useState(true);

    // Search and filter states for receipts lookup
    const [students, setStudents] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClass, setSelectedClass] = useState('all');
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
    const [studentReceipts, setStudentReceipts] = useState<any[]>([]);
    const [fetchingReceipts, setFetchingReceipts] = useState(false);

    // Support all common casing and parameter names for receipt number and type
    const receiptNo = searchParams.get('receiptNo') || 
                      searchParams.get('receipt_no') || 
                      searchParams.get('receipt_number') || 
                      searchParams.get('receiptnumber') || 
                      searchParams.get('id');

    const type = searchParams.get('type') || 
                 searchParams.get('fee_type') || 
                 searchParams.get('feeType');

    const handleBack = () => {
        // If we entered via direct sidebar search lookup, clear searchParams to return to student selection
        if (searchParams.has('search_back')) {
            setSearchParams({});
            setSelectedStudent(null);
            setStudentReceipts([]);
            return;
        }

        if (type) {
            const portal = getCurrentPortal(window.location.pathname);
            const feePages: Record<string, string> = {
                course: '/course-fees',
                books: '/books-fees',
                transport: '/transport-fees',
                accessories: '/accessories',
                accessory: '/accessories',
                left_student: '/left-students'
            };
            const targetPage = feePages[type] || '/dashboard';
            navigate(portalPath(portal, targetPage));
        } else {
            // Direct receipt view from history back
            navigate(-1);
        }
    };

    useEffect(() => {
        if (receiptNo) {
            fetchReceiptData();
        } else {
            setLoading(false);
            fetchClasses();
            fetchStudents();
        }
    }, [receiptNo, type]);

    const fetchClasses = async () => {
        try {
            const { data } = await supabase
                .from('classes')
                .select('id, name')
                .order('sort_order');
            if (data) setClasses(data);
        } catch (err) {
            console.error("Error fetching classes:", err);
        }
    };

    const fetchStudents = async () => {
        try {
            const { data } = await supabase
                .from('students')
                .select('id, admission_number, full_name, class_id, classes(name)')
                .order('full_name');
            if (data) setStudents(data);
        } catch (err) {
            console.error("Error fetching students:", err);
        }
    };

    const fetchStudentReceipts = async (studentId: string) => {
        setFetchingReceipts(true);
        try {
            const [
                courseRes,
                booksRes,
                transportRes,
                accessorySalesRes,
                studentAccessoryPaymentsRes,
                leftStudentRes
            ] = await Promise.all([
                supabase.from('course_payments').select('id, receipt_number, amount_paid, payment_method, payment_date, term').eq('student_id', studentId),
                supabase.from('books_payments').select('id, receipt_number, amount_paid, payment_method, payment_date').eq('student_id', studentId),
                supabase.from('transport_payments').select('id, receipt_number, amount_paid, payment_method, payment_date, month').eq('student_id', studentId),
                supabase.from('accessory_sales').select('id, receipt_number, total_amount, payment_method, created_at, accessories(item_name)').eq('student_id', studentId),
                supabase.from('student_accessory_payments').select('id, receipt_number, amount_paid, payment_method, payment_date, accessory_categories(name)').eq('student_id', studentId),
                supabase.from('left_student_recovery_payments').select('id, receipt_number, amount_paid, payment_method, payment_date, left_student_fee_records!inner(student_id)').eq('left_student_fee_records.student_id', studentId)
            ]);

            const all: any[] = [
                ...(courseRes.data || []).map(p => ({
                    id: p.id,
                    receiptNo: p.receipt_number,
                    amount: Number(p.amount_paid),
                    method: p.payment_method,
                    date: p.payment_date,
                    type: 'course',
                    details: p.term === 0 ? 'Old Due' : `Term ${p.term}`
                })),
                ...(booksRes.data || []).map(p => ({
                    id: p.id,
                    receiptNo: p.receipt_number,
                    amount: Number(p.amount_paid),
                    method: p.payment_method,
                    date: p.payment_date,
                    type: 'books',
                    details: 'Books & Accessories Fee'
                })),
                ...(transportRes.data || []).map(p => ({
                    id: p.id,
                    receiptNo: p.receipt_number,
                    amount: Number(p.amount_paid),
                    method: p.payment_method,
                    date: p.payment_date,
                    type: 'transport',
                    details: p.month && MONTH_NAMES[p.month] ? MONTH_NAMES[p.month] : 'Transport Fee'
                })),
                ...(accessorySalesRes.data || []).map(p => ({
                    id: p.id,
                    receiptNo: p.receipt_number,
                    amount: Number(p.total_amount),
                    method: p.payment_method,
                    date: p.created_at,
                    type: 'accessory',
                    details: (p.accessories as any)?.item_name || 'Accessory Item'
                })),
                ...(studentAccessoryPaymentsRes.data || []).map(p => ({
                    id: p.id,
                    receiptNo: p.receipt_number,
                    amount: Number(p.amount_paid),
                    method: p.payment_method,
                    date: p.payment_date,
                    type: 'accessories',
                    details: (p.accessory_categories as any)?.name || 'Accessory category'
                })),
                ...(leftStudentRes.data || []).map(p => ({
                    id: p.id,
                    receiptNo: p.receipt_number,
                    amount: Number(p.amount_paid),
                    method: p.payment_method,
                    date: p.payment_date,
                    type: 'left_student',
                    details: 'Left Student Dues Recovery'
                }))
            ];

            // Sort by date descending
            all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setStudentReceipts(all);
        } catch (err) {
            console.error("Error fetching receipts:", err);
            toast.error("Failed to fetch student receipts");
        } finally {
            setFetchingReceipts(false);
        }
    };

    const viewReceipt = (receiptNumber: string, feeType: string) => {
        setSearchParams({ receiptNo: receiptNumber, type: feeType, search_back: 'true' });
    };

    const fetchReceiptData = async () => {
        try {
            const pathWithQuery = `/api/receipts/${encodeURIComponent(receiptNo || '')}${type ? `?type=${encodeURIComponent(type)}` : ''}`;
            const resp = await apiFetch(pathWithQuery);
            if (!resp.ok) throw new Error("Receipt not found in Backend");
            
            const paymentData = await resp.json();
            const records = Array.isArray(paymentData) ? paymentData : (paymentData?.data || []);
            if (!records || records.length === 0) throw new Error("Receipt not found");

            // Extract dues details returned by wrapper
            const oldDueCollected = Number(paymentData?.old_due_collected || 0);
            const currentYearCollected = Number(paymentData?.current_year_collected || 0);
            const remainingOldDue = Number(paymentData?.remaining_old_due || 0);
            const remainingCurrentYearBalance = Number(paymentData?.remaining_current_year_balance || 0);

            // Use the first record for common details
            const record = records[0] as any;

            // Format date
            const dateObj = new Date(record.created_at || record.payment_date || new Date());
            const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

            // Extract Parent Details
            const student = record.students || record.left_student_fee_records?.students || {};
            const parentName = student.father_name || student.mother_name || 'N/A';
            const parentMobile = student.father_phone || student.mother_phone || 'N/A';

            // Calculate total and build particulars
            let totalAmount = 0;
            const particulars = records.map((item: any) => {
                const amount = Number(item.amount_paid || item.total_amount || 0);
                totalAmount += amount;
                return {
                    name: getParticularsName(type, item),
                    amount: amount
                };
            });

            const receiptDataObj: ReceiptData = {
                receiptNo: record.receipt_number,
                date: dateStr,
                studentName: student.full_name || 'N/A',
                parentName: parentName,
                parentMobile: parentMobile,
                admissionNo: student.admission_number || 'N/A',
                class: student.classes?.name || 'N/A',
                academicYear: record.academic_year || getCurrentAcademicYear(),
                particulars: particulars,
                totalAmount: totalAmount,
                paymentMode: formatPaymentMode(record.payment_method),
                narration: (record.notes?.includes('Receipt URL') || record.remarks?.includes('Receipt URL')) ? `Fee payment received. Receipt verified.` : `Fee payment received.`,
                oldDueCollected: oldDueCollected,
                currentYearCollected: currentYearCollected,
                remainingOldDue: remainingOldDue,
                remainingCurrentYearBalance: remainingCurrentYearBalance
            };

            setData(receiptDataObj);
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to load receipt");
        } finally {
            setLoading(false);
        }
    };

    const formatPaymentMode = (method: string) => {
        if (!method) return 'UPI / Cash / Card';
        const m = method.toLowerCase();
        if (m === 'qr_code' || m === 'upi') return 'UPI';
        if (m === 'cash') return 'Cash';
        if (m === 'card' || m === 'cards') return 'Card';
        if (m === 'bank_transfer' || m === 'bank') return 'Bank Transfer';
        return method.toUpperCase();
    };

    const getParticularsName = (type: string | null, data: any) => {
        if (type === 'course') return `Tuition Fee (${data.term === 0 ? 'OLD DUE' : `Term ${data.term}`})`;
        if (type === 'books') return `Books & Accessories Fee`;
        if (type === 'transport') return `Transport Fee (${data.month && MONTH_NAMES[data.month] ? MONTH_NAMES[data.month] : 'Monthly'})`;
        if (type === 'accessories') return `Accessories: ${data.accessory_categories?.name || 'FEE'}`;
        if (type === 'accessory') return `Accessory: ${data.accessories?.item_name || 'Item'} (${data.quantity || 1} qty)`;
        if (type === 'left_student') return `Left Student Dues Recovery`;
        return 'Tuition Fee';
    };

    const numberToWords = (num: number): string => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];

        if (num === 0) return 'Zero';

        const convert = (n: number): string => {
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + a[n % 10];
            if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + convert(n % 100) : '');
            if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? convert(n % 1000) : '');
            if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? convert(n % 100000) : '');
            return n.toString() + ' ';
        };

        return convert(num).trim();
    };

    const handlePrint = () => {
        window.print();
    };

    const getFeeTypeBadge = (feeType: string) => {
        const variants: Record<string, string> = {
            course: 'bg-primary/10 text-primary border-primary/20',
            books: 'bg-secondary/15 text-secondary-foreground border-secondary/20',
            transport: 'bg-success/10 text-success border-success/20',
            accessories: 'bg-info/10 text-info border-info/20',
            accessory: 'bg-warning/10 text-warning-foreground border-warning/20',
        };
        const labels: Record<string, string> = {
            course: 'Course Fee',
            books: 'Books Fee',
            transport: 'Transport',
            accessories: 'Accessories',
            accessory: 'Accessory Sale',
        };
        return (
            <Badge variant="outline" className={`${variants[feeType] || ''} font-bold text-[10px] uppercase tracking-wider py-0.5 px-2 shrink-0 border`}>
                {labels[feeType] || feeType}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Render Student receipts lookup dashboard when no specific receipt is requested
    if (!receiptNo) {
        const filteredStudents = students.filter(student => {
            const matchesSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  student.admission_number.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesClass = selectedClass === 'all' || student.classes?.name === selectedClass;
            return matchesSearch && matchesClass;
        });

        return (
            <DashboardLayout>
                <div className="space-y-6 max-w-6xl mx-auto p-2">
                    {/* Page Title Header */}
                    <div className="page-header mb-6">
                        <h1 className="page-title flex items-center gap-2">
                            <ClipboardList className="h-6 w-6 text-primary" />
                            Receipts Lookup Module
                        </h1>
                        <p className="page-description">Search for a student and view/print their official fee receipts across all categories</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Left Column: Student Search */}
                        <div className="lg:col-span-5 space-y-4">
                            <Card className="card-elevated p-4">
                                <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Search className="h-4 w-4 text-primary" />
                                    Student Search
                                </h2>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by name or admission number..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10 bg-slate-50/50 focus-visible:bg-white"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <span className="text-xs font-semibold text-slate-500">Filter by Class</span>
                                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                                            <SelectTrigger className="w-full bg-slate-50/50">
                                                <SelectValue placeholder="All Classes" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Classes</SelectItem>
                                                {classes.map((cls) => (
                                                    <SelectItem key={cls.id} value={cls.name}>
                                                        {cls.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </Card>

                            {/* Search Results List */}
                            <Card className="card-elevated p-0 overflow-hidden max-h-[500px] flex flex-col">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                                    <span className="text-xs font-bold text-slate-500">Students Found ({filteredStudents.length})</span>
                                </div>
                                <div className="overflow-y-auto divide-y divide-slate-100 flex-1 min-h-[300px]">
                                    {filteredStudents.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-sm">
                                            No students matched your search criteria.
                                        </div>
                                    ) : (
                                        filteredStudents.map((student) => {
                                            const isSelected = selectedStudent?.id === student.id;
                                            return (
                                                <motion.button
                                                    key={student.id}
                                                    whileHover={{ x: 2 }}
                                                    onClick={() => {
                                                        setSelectedStudent(student);
                                                        fetchStudentReceipts(student.id);
                                                    }}
                                                    className={`w-full text-left p-3.5 flex justify-between items-center transition-colors ${
                                                        isSelected ? 'bg-primary/5 border-l-4 border-primary text-primary font-bold' : 'hover:bg-slate-50/80 text-slate-700'
                                                    }`}
                                                >
                                                    <div className="space-y-0.5">
                                                        <p className={`text-sm ${isSelected ? 'font-extrabold' : 'font-semibold'}`}>
                                                            {student.full_name}
                                                        </p>
                                                        <div className="flex gap-2 text-xs text-slate-400">
                                                            <span>Class: <span className="text-slate-600 font-medium">{student.classes?.name || 'N/A'}</span></span>
                                                            <span>•</span>
                                                            <span>Adm No: <span className="text-slate-600 font-medium">{student.admission_number}</span></span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'translate-x-1 text-primary' : 'text-slate-400'}`} />
                                                </motion.button>
                                            );
                                        })
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* Right Column: Student Receipts Table */}
                        <div className="lg:col-span-7">
                            <Card className="card-elevated min-h-[480px] p-6 flex flex-col">
                                {!selectedStudent ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                            <ClipboardList className="h-8 w-8 text-slate-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 mb-1">No Student Selected</h3>
                                        <p className="text-slate-400 text-sm max-w-sm">
                                            Please search and select a student from the left panel to view their official receipts history.
                                        </p>
                                    </div>
                                ) : fetchingReceipts ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                        <p className="text-slate-500 text-sm">Loading fee payment receipts...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 flex-1 flex flex-col">
                                        {/* Student Header */}
                                        <div className="border-b border-slate-100 pb-4 mb-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shrink-0">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-800">{selectedStudent.full_name}</h3>
                                                <div className="flex gap-3 text-xs text-slate-500 mt-1">
                                                    <span>Class: <span className="font-bold text-slate-700">{selectedStudent.classes?.name || 'N/A'}</span></span>
                                                    <span>•</span>
                                                    <span>Admission No: <span className="font-bold text-slate-700">{selectedStudent.admission_number}</span></span>
                                                </div>
                                            </div>
                                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0 py-1 px-3 text-xs shrink-0 self-start sm:self-auto font-bold">
                                                {studentReceipts.length} Receipts
                                            </Badge>
                                        </div>

                                        {/* Receipts List Table */}
                                        <div className="overflow-x-auto flex-1">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="table-header">
                                                        <TableHead className="w-32">Receipt No.</TableHead>
                                                        <TableHead>Fee Type</TableHead>
                                                        <TableHead>Particulars</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                        <TableHead className="text-center w-24">Action</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {studentReceipts.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                                                                No payment receipts found for this student.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        studentReceipts.map((receipt) => (
                                                            <TableRow key={receipt.id} className="hover:bg-slate-50/50">
                                                                <TableCell className="font-mono text-xs font-semibold text-slate-600">
                                                                    {receipt.receiptNo}
                                                                </TableCell>
                                                                <TableCell className="py-2.5">
                                                                    {getFeeTypeBadge(receipt.type)}
                                                                </TableCell>
                                                                <TableCell className="text-slate-600 font-semibold text-xs">
                                                                    {receipt.details}
                                                                </TableCell>
                                                                <TableCell className="text-right font-black text-slate-800">
                                                                    ₹{receipt.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => viewReceipt(receipt.receiptNo, receipt.type)}
                                                                        className="h-8 w-8 p-0"
                                                                        title="View/Print Receipt"
                                                                    >
                                                                        <FileText className="h-4 w-4 text-primary" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col min-h-screen items-center justify-center bg-slate-50 gap-4">
                <p className="text-slate-500">Receipt not found.</p>
                <Button onClick={handleBack} variant="outline">Go Back</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white flex flex-col items-center">
            {/* Top print utility bar */}
            <div className="w-full max-w-[800px] mb-6 flex flex-wrap gap-4 justify-between items-center print:hidden">
                <Button onClick={handleBack} variant="outline" className="gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={handlePrint} className="gap-2 bg-[#002147] text-white hover:bg-[#002147]/90 font-bold">
                    <Printer className="h-4 w-4" /> Print Receipt
                </Button>
            </div>

            {/* Official School Receipt Card */}
            <Card className="w-full max-w-[800px] bg-white p-6 md:p-8 border border-slate-300 print:border-0 print:shadow-none print:w-full print:max-w-none text-slate-900 shadow-lg relative overflow-hidden">
                
                {/* Header Branding */}
                <div className="flex flex-col items-center pb-4 border-b border-slate-800 mb-6">
                    <img 
                        src="/school-logo.png" 
                        alt="Adarsh Oxford Logo" 
                        className="h-28 w-28 object-contain mb-3"
                    />
                    <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-wide text-center uppercase font-sans">
                        ADARSH OXFORD ENGLISH MEDIUM SCHOOL
                    </h1>
                    <p className="text-xs md:text-sm font-semibold text-slate-700 text-center tracking-wide mt-1">
                        2-50-102-9, Seethammadhara, North Extension, Visakhapatnam - 530013
                    </p>
                </div>

                {/* Receipt Header Title */}
                <div className="text-center my-6">
                    <span className="text-lg md:text-xl font-bold uppercase tracking-widest border-b-2 border-slate-900 px-6 pb-1">
                        FEE RECEIPT
                    </span>
                </div>

                {/* Details Grid Table */}
                <div className="w-full border border-slate-800 text-xs md:text-sm font-bold text-slate-800 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-slate-800">
                        <div className="grid grid-cols-[110px_1fr] sm:border-r border-slate-800 p-2.5">
                            <span className="text-slate-600">Receipt No</span>
                            <span>: {data.receiptNo}</span>
                        </div>
                        <div className="grid grid-cols-[110px_1fr] p-2.5 border-t sm:border-t-0 border-slate-800">
                            <span className="text-slate-600">Date</span>
                            <span>: {data.date}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-slate-800">
                        <div className="grid grid-cols-[110px_1fr] sm:border-r border-slate-800 p-2.5">
                            <span className="text-slate-600">Student Name</span>
                            <span className="break-all">: {data.studentName}</span>
                        </div>
                        <div className="grid grid-cols-[110px_1fr] p-2.5 border-t sm:border-t-0 border-slate-800">
                            <span className="text-slate-600">Parent Name</span>
                            <span className="break-all">: {data.parentName}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-slate-800">
                        <div className="grid grid-cols-[110px_1fr] sm:border-r border-slate-800 p-2.5">
                            <span className="text-slate-600">Parent Mobile</span>
                            <span>: {data.parentMobile}</span>
                        </div>
                        <div className="grid grid-cols-[110px_1fr] p-2.5 border-t sm:border-t-0 border-slate-800">
                            <span className="text-slate-600">Academic Year</span>
                            <span>: {data.academicYear}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2">
                        <div className="grid grid-cols-[110px_1fr] sm:border-r border-slate-800 p-2.5">
                            <span className="text-slate-600">Class</span>
                            <span>: {data.class}</span>
                        </div>
                        <div className="grid grid-cols-[110px_1fr] p-2.5 border-t sm:border-t-0 border-slate-800">
                            <span className="text-slate-600">Admission No</span>
                            <span>: {data.admissionNo}</span>
                        </div>
                    </div>
                </div>

                {/* Particulars Table */}
                <div className="w-full border border-slate-800 text-xs md:text-sm font-bold text-slate-800 mb-6">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-50">
                                <th className="border-r border-slate-800 p-2.5 text-left w-16">SL</th>
                                <th className="border-r border-slate-800 p-2.5 text-left">Particulars</th>
                                <th className="p-2.5 text-right w-40">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.particulars.map((item, index) => (
                                <tr key={index} className="border-b border-slate-800 last:border-b-0">
                                    <td className="border-r border-slate-800 p-2.5 font-medium">{index + 1}</td>
                                    <td className="border-r border-slate-800 p-2.5 uppercase">{item.name}</td>
                                    <td className="p-2.5 text-right font-black">₹{item.amount.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Payment Mode & Totals */}
                <div className="w-full border border-slate-800 text-xs md:text-sm font-bold text-slate-800 mb-6 grid grid-cols-2">
                    <div className="border-r border-slate-800 p-2.5">
                        <span className="text-slate-600 block text-[10px] uppercase tracking-wider mb-1">Mode of Payment</span>
                        <span className="uppercase text-slate-800 font-bold">{data.paymentMode}</span>
                    </div>
                    <div className="p-2.5 flex flex-col justify-between">
                        <span className="text-slate-600 block text-[10px] uppercase tracking-wider mb-1">Grand Total</span>
                        <span className="text-base md:text-lg font-black text-slate-900">₹{data.totalAmount.toFixed(2)}</span>
                    </div>
                </div>

                {/* Dues Summary Section */}
                <div className="w-full border border-slate-800 text-[10px] md:text-xs font-bold text-slate-800 mb-6 bg-slate-50/30">
                    <div className="border-b border-slate-800 p-2 bg-slate-100/50 flex justify-between items-center">
                        <span className="text-[9px] uppercase tracking-wider text-slate-700">Dues Summary Balance</span>
                        <span className="text-[8px] bg-slate-700 text-white px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Live Status</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-x divide-slate-800 border-slate-800">
                        <div className="p-2 flex flex-col justify-between">
                            <span className="text-slate-600 text-[8px] uppercase tracking-wider mb-0.5">Old Due Collected</span>
                            <span className="text-xs font-bold text-slate-800">₹{(data.oldDueCollected || 0).toFixed(2)}</span>
                        </div>
                        <div className="p-2 flex flex-col justify-between">
                            <span className="text-slate-600 text-[8px] uppercase tracking-wider mb-0.5">Current Year Collected</span>
                            <span className="text-xs font-bold text-slate-800">₹{(data.currentYearCollected || 0).toFixed(2)}</span>
                        </div>
                        <div className="p-2 flex flex-col justify-between bg-red-50/10">
                            <span className="text-red-700 text-[8px] uppercase tracking-wider mb-0.5">Remaining Old Due</span>
                            <span className="text-xs font-black text-red-700">₹{(data.remainingOldDue || 0).toFixed(2)}</span>
                        </div>
                        <div className="p-2 flex flex-col justify-between bg-red-50/10">
                            <span className="text-red-700 text-[8px] uppercase tracking-wider mb-0.5">Remaining Current Year</span>
                            <span className="text-xs font-black text-red-700">₹{(data.remainingCurrentYearBalance || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Words, Narration & Sign */}
                <div className="text-xs md:text-sm font-bold text-slate-800 space-y-3 mt-6">
                    <p>
                        Amount in Words : <span className="italic font-medium text-slate-700 underline decoration-slate-400 decoration-dashed">{numberToWords(Math.floor(data.totalAmount))} Rupees Only</span>
                    </p>
                    <p>
                        Narration : <span className="font-semibold text-slate-600">{data.narration || 'Fee payment received.'}</span>
                    </p>
                </div>

                {/* Disclaimer Disclaimer */}
                <div className="text-center text-[10px] md:text-xs text-slate-500 font-semibold italic border-t border-slate-200 pt-4 mt-8 print:border-t-0">
                    This is a computer-generated receipt and does not require a physical signature.
                </div>

            </Card>

            {/* Print Styling overrides */}
            <style>{`
                @media print {
                    @page { margin: 0.5cm; }
                    body { 
                        background: white; 
                        -webkit-print-color-adjust: exact !important; 
                    }
                    .no-print { display: none !important; }
                }
            `}</style>
        </div>
    );
}
