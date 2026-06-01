import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {

  Search,
  Phone,
  CreditCard,
  Banknote,
  QrCode,
  Building2,
  GraduationCap,
  BookOpen,
  Bus,
  IndianRupee,
  Smartphone
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeeCategoryCard } from '@/components/dashboard/FeeCategoryCard';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ClassSlider } from '@/components/dashboard/ClassSlider';
import { useAuth } from '@/lib/auth';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/api';

interface Student {
  id: string;
  admission_number: string;
  full_name: string;
  class_id: string;
  father_phone: string;
  mother_phone: string;
  term1_fee: number;
  term2_fee: number;
  term3_fee: number;
  old_dues: number;
  classes?: { name: string };
}

interface Payment {
  term: number;
  amount_paid: number;
}

interface StudentFeeData extends Student {
  totalFee: number;
  term1Paid: number;
  term2Paid: number;
  term3Paid: number;
  oldDuesPaid: number;
  pendingFee: number;
}

export default function CourseFees() {
  const { user, isStaff } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentFeeData[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentFeeData | null>(null);
  const [paymentSelections, setPaymentSelections] = useState<Record<string, { paying: boolean; amount: number }>>({
    '0': { paying: false, amount: 0 },
    '1': { paying: false, amount: 0 },
    '2': { paying: false, amount: 0 },
    '3': { paying: false, amount: 0 }
  });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [activeCategory, setActiveCategory] = useState<'course' | 'books' | 'transport'>('course');

  const classNames = ['all', ...classes.map(c => c.name)];

  const academicYear = getCurrentAcademicYear();

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStudentsWithFees();
  }, [selectedClass]); // Refetch when class changes

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .order('sort_order');
    setClasses((data as any[]) || []);
  };

  const fetchStudentsWithFees = async () => {
    setIsLoading(true);
    try {
      // Fetch only students for the selected class if not "all"
      let selectClause = 'id, admission_number, full_name, class_id, father_phone, mother_phone, term1_fee, term2_fee, term3_fee, old_dues, classes(name)';
      if (selectedClass !== 'all') {
        selectClause = 'id, admission_number, full_name, class_id, father_phone, mother_phone, term1_fee, term2_fee, term3_fee, old_dues, classes!inner(name)';
      }

      let query = supabase
        .from('students')
        .select(selectClause)
        .eq('is_active', true);

      if (selectedClass !== 'all') {
        query = query.eq('classes.name', selectedClass);
      }
      
      const { data: studentsData, error: studentsError } = await query.order('full_name');

      if (studentsError) throw studentsError;

      // Fetch all course payments
      const { data: payments } = await supabase
        .from('course_payments')
        .select('student_id, term, amount_paid')
        .eq('academic_year', academicYear);

      const paymentMap = new Map<string, Payment[]>();
      (payments as any[])?.forEach(p => {
        const existing = paymentMap.get(p.student_id) || [];
        existing.push({ term: p.term as number, amount_paid: Number(p.amount_paid) });
        paymentMap.set(p.student_id as string, existing);
      });

      const enrichedStudents: StudentFeeData[] = (studentsData as any[] || []).map(student => {
        const studentPayments = paymentMap.get(student.id) || [];

        const term1Paid = studentPayments
          .filter(p => p.term === 1)
          .reduce((sum, p) => sum + p.amount_paid, 0);
        const term2Paid = studentPayments
          .filter(p => p.term === 2)
          .reduce((sum, p) => sum + p.amount_paid, 0);
        const term3Paid = studentPayments
          .filter(p => p.term === 3)
          .reduce((sum, p) => sum + p.amount_paid, 0);
        const oldDuesPaid = studentPayments
          .filter(p => p.term === 0)
          .reduce((sum, p) => sum + p.amount_paid, 0);

        // Use student's own fees
        const term1Fee = Number(student.term1_fee) || 0;
        const term2Fee = Number(student.term2_fee) || 0;
        const term3Fee = Number(student.term3_fee) || 0;
        const oldDues = Number(student.old_dues) || 0;

        const totalFee = term1Fee + term2Fee + term3Fee + oldDues;
        const totalPaid = term1Paid + term2Paid + term3Paid + oldDuesPaid;

        return {
          ...student,
          term1_fee: term1Fee,
          term2_fee: term2Fee,
          term3_fee: term3Fee,
          old_dues: oldDues,
          totalFee,
          term1Paid,
          term2Paid,
          term3Paid,
          oldDuesPaid,
          pendingFee: totalFee - totalPaid,
        };
      });

      setStudents(enrichedStudents);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch fee data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openPaymentDialog = (student: StudentFeeData) => {
    setSelectedStudent(student);
    
    // Find terms and populate paymentSelections
    const selections: Record<string, { paying: boolean; amount: number }> = {
      '0': { paying: false, amount: 0 },
      '1': { paying: false, amount: 0 },
      '2': { paying: false, amount: 0 },
      '3': { paying: false, amount: 0 }
    };

    const oldDuePending = Math.max(0, student.old_dues - student.oldDuesPaid);
    const term1Pending = Math.max(0, student.term1_fee - student.term1Paid);
    const term2Pending = Math.max(0, student.term2_fee - student.term2Paid);
    const term3Pending = Math.max(0, student.term3_fee - student.term3Paid);

    if (oldDuePending > 0) {
      selections['0'] = { paying: true, amount: oldDuePending };
    } else if (term1Pending > 0) {
      selections['1'] = { paying: true, amount: term1Pending };
    } else if (term2Pending > 0) {
      selections['2'] = { paying: true, amount: term2Pending };
    } else if (term3Pending > 0) {
      selections['3'] = { paying: true, amount: term3Pending };
    }

    setPaymentSelections(selections);
    setPaymentMethod('cash');
    setPaymentDialogOpen(true);
  };

  const handleSelectionChange = (termId: string, checked: boolean) => {
    if (!selectedStudent) return;
    
    const pending = getTermPendingAmount(termId);
    
    setPaymentSelections(prev => ({
      ...prev,
      [termId]: {
        paying: checked,
        amount: checked ? pending : 0
      }
    }));
  };

  const handleAmountChange = (termId: string, amount: number) => {
    setPaymentSelections(prev => ({
      ...prev,
      [termId]: {
        ...prev[termId],
        amount: amount
      }
    }));
  };

  const getTermPendingAmount = (termId: string) => {
    if (!selectedStudent) return 0;
    const term = parseInt(termId);
    const termFee = term === 1
      ? selectedStudent.term1_fee
      : term === 2
        ? selectedStudent.term2_fee
        : term === 3
          ? selectedStudent.term3_fee
          : selectedStudent.old_dues;
    const termPaid = term === 1
      ? selectedStudent.term1Paid
      : term === 2
        ? selectedStudent.term2Paid
        : term === 3
          ? selectedStudent.term3Paid
          : selectedStudent.oldDuesPaid;
    return Math.max(0, termFee - termPaid);
  };

  const getTermName = (termId: string) => {
    if (termId === '0') return 'Old Outstanding Dues';
    return `Term ${termId}`;
  };

  const handlePayment = async () => {
    if (!selectedStudent || !user || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    // Gather terms being paid
    const termsToPay = Object.keys(paymentSelections)
      .filter(termId => paymentSelections[termId].paying && paymentSelections[termId].amount > 0);

    if (termsToPay.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Payment',
        description: 'Select at least one term to pay for.',
      });
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    // Validate overpayments and non-zero payments
    for (const termId of termsToPay) {
      const payingAmount = paymentSelections[termId].amount;
      const pendingAmount = getTermPendingAmount(termId);

      if (payingAmount <= 0) {
        toast({
          variant: 'destructive',
          title: 'Invalid Amount',
          description: `Payment amount for ${getTermName(termId)} must be greater than zero.`,
        });
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      if (payingAmount > pendingAmount) {
        toast({
          variant: 'destructive',
          title: 'Overpayment Blocked',
          description: `Payment amount for ${getTermName(termId)} (${formatCurrency(payingAmount)}) cannot exceed the pending amount (${formatCurrency(pendingAmount)}).`,
        });
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }
    }

    const totalAmount = termsToPay.reduce((sum, termId) => sum + paymentSelections[termId].amount, 0);

    if (paymentMethod === 'qr_code') {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setPaymentDialogOpen(false);
      
      const payingTerms = termsToPay.map(termId => ({
        term: parseInt(termId),
        amount: paymentSelections[termId].amount
      }));

      navigate('/payment-gateway', {
        state: {
          studentId: selectedStudent.id,
          studentName: selectedStudent.full_name,
          className: selectedStudent.classes?.name,
          amount: totalAmount,
          paymentType: 'course',
          academicYear: academicYear,
          payingTerms: payingTerms
        }
      });
      return;
    }

    try {
      const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { data: { session } } = await supabase.auth.getSession();

      // Process payments sequentially via FastAPI using the same receipt number
      for (const termId of termsToPay) {
        const response = await fetch(`${getApiBaseUrl()}/api/payments/collect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            student_id: selectedStudent.id,
            type: 'course',
            academic_year: academicYear,
            amount: paymentSelections[termId].amount,
            method: paymentMethod,
            term: parseInt(termId),
            receipt_number: receiptNumber,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to record payment');
        }
      }

      toast({
        title: 'Payment Recorded',
        description: `Receipt: ${receiptNumber}. Notifications sent.`,
      });

      setPaymentDialogOpen(false);
      fetchStudentsWithFees();

      // Redirect to Receipt Page
      navigate(`/receipt?receiptNo=${receiptNumber}&type=course`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Payment Failed',
        description: error.message,
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getTermStatus = (paid: number, fee: number) => {
    if (fee === 0) return 'secondary';
    if (paid >= fee) return 'success';
    if (paid > 0) return 'warning';
    return 'outline';
  };

  // Calculate total collected and pending amounts
  const totalCollected = students.reduce((sum, student) => sum + (student.totalFee - student.pendingFee), 0);
  const totalPending = students.reduce((sum, student) => sum + student.pendingFee, 0);

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.admission_number.toLowerCase().includes(searchQuery.toLowerCase());

    const className = student.classes?.name || '';
    const matchesClass = selectedClass === 'all' || className === selectedClass;

    return matchesSearch && matchesClass;
  });

  // Count students per class
  const classCounts = classNames.reduce((acc, cls) => {
    if (cls === 'all') {
      // Filter for 'all' should only account for search
      acc[cls] = students.filter(s =>
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.admission_number.toLowerCase().includes(searchQuery.toLowerCase())
      ).length;
      return acc;
    }
    acc[cls] = students.filter(s =>
      (s.classes?.name === cls) &&
      (s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.admission_number.toLowerCase().includes(searchQuery.toLowerCase()))
    ).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-header"
        >
          <h1 className="page-title">Course Fees</h1>
          <p className="page-description">Manage term-based course fee collection</p>
        </motion.div>

        {/* Fee Category Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeeCategoryCard
              title="Course Fees"
              amount={totalCollected}
              pending={totalPending}
              icon={<GraduationCap className="h-6 w-6 text-primary" />}
              onClick={() => setActiveCategory('course')}
              className={activeCategory === 'course' ? 'ring-2 ring-primary' : ''}
            />
            <FeeCategoryCard
              title="Books Fees"
              amount={0}
              pending={0}
              icon={<BookOpen className="h-6 w-6 text-secondary" />}
              onClick={() => {
                navigate('/books-fees');
              }}
            />
            <FeeCategoryCard
              title="Transport Fees"
              amount={0}
              pending={0}
              icon={<Bus className="h-6 w-6 text-success" />}
              onClick={() => {
                navigate('/transport-fees');
              }}
            />
          </div>
        </motion.div>

        {/* Class Slider */}
        <ClassSlider
          activeClass={selectedClass}
          onClassChange={setSelectedClass}
          classCounts={classCounts}
          classNames={classNames}
        />

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-4 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or admission number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display">Course Fee Collection - {academicYear}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="table-header">
                      <TableHead>Student Name</TableHead>

                      <TableHead>Parent Phones</TableHead>
                      <TableHead className="text-right">Total Fee</TableHead>
                      <TableHead className="text-center">Term 1</TableHead>
                      <TableHead className="text-center">Term 2</TableHead>
                      <TableHead className="text-center">Term 3</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <div className="flex items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          No students found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student) => (
                        <TableRow key={student.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{student.full_name}</TableCell>

                          <TableCell>
                            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1.5" title="Father's Phone">
                                <Phone className="h-3 w-3" />
                                <span className="font-medium">{student.father_phone || 'N/A'}</span> <span className="text-[9px] uppercase font-bold tracking-widest opacity-50">(F)</span>
                              </div>
                              <div className="flex items-center gap-1.5" title="Mother's Phone">
                                <Phone className="h-3 w-3" />
                                <span className="font-medium">{student.mother_phone || 'N/A'}</span> <span className="text-[9px] uppercase font-bold tracking-widest opacity-50">(M)</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(student.totalFee)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total: {formatCurrency(student.term1_fee)}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "w-full justify-center",
                                  getTermStatus(student.term1Paid, student.term1_fee) === 'success' && 'badge-success',
                                  getTermStatus(student.term1Paid, student.term1_fee) === 'warning' && 'badge-warning'
                                )}
                              >
                                {formatCurrency(student.term1Paid)}
                              </Badge>
                              {student.term1_fee - student.term1Paid > 0 && (
                                <span className="text-[10px] text-destructive font-bold uppercase tracking-tight">Due: {formatCurrency(student.term1_fee - student.term1Paid)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total: {formatCurrency(student.term2_fee)}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "w-full justify-center",
                                  getTermStatus(student.term2Paid, student.term2_fee) === 'success' && 'badge-success',
                                  getTermStatus(student.term2Paid, student.term2_fee) === 'warning' && 'badge-warning'
                                )}
                              >
                                {formatCurrency(student.term2Paid)}
                              </Badge>
                              {student.term2_fee - student.term2Paid > 0 && (
                                <span className="text-[10px] text-destructive font-bold uppercase tracking-tight">Due: {formatCurrency(student.term2_fee - student.term2Paid)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total: {formatCurrency(student.term3_fee)}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "w-full justify-center",
                                  getTermStatus(student.term3Paid, student.term3_fee) === 'success' && 'badge-success',
                                  getTermStatus(student.term3Paid, student.term3_fee) === 'warning' && 'badge-warning'
                                )}
                              >
                                {formatCurrency(student.term3Paid)}
                              </Badge>
                              {student.term3_fee - student.term3Paid > 0 && (
                                <span className="text-[10px] text-destructive font-bold uppercase tracking-tight">Due: {formatCurrency(student.term3_fee - student.term3Paid)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-semibold",
                              student.pendingFee > 0 ? "text-destructive" : "text-success"
                            )}>
                              {formatCurrency(student.pendingFee)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              className="btn-oxford"
                              onClick={() => {
                                if (isStaff) {
                                  toast({
                                    variant: 'destructive',
                                    title: 'Permission Denied',
                                    description: 'Staff users cannot collect fees.',
                                  });
                                  return;
                                }
                                openPaymentDialog(student);
                              }}
                              disabled={student.pendingFee <= 0 || isStaff}
                            >
                              <IndianRupee className="mr-1 h-4 w-4" />
                              Pay
                              {isStaff && (
                                <span className="ml-1 text-xs">(Admin only)</span>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Collect Course Fee</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-6">
                <div className="rounded-lg bg-muted/50 p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{selectedStudent.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedStudent.classes?.name}</p>
                  </div>
                  <Badge variant="outline" className="border-slate-300">
                    Total Pending: {formatCurrency(selectedStudent.pendingFee)}
                  </Badge>
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-3 shadow-inner">
                  <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider">Pending Breakdown</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-slate-500">Old Due:</span>
                      <span className={cn("font-semibold", selectedStudent.old_dues - selectedStudent.oldDuesPaid > 0 ? "text-destructive" : "text-slate-400")}>
                        {formatCurrency(selectedStudent.old_dues - selectedStudent.oldDuesPaid)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-slate-500">Term 1:</span>
                      <span className={cn("font-semibold", selectedStudent.term1_fee - selectedStudent.term1Paid > 0 ? "text-primary" : "text-slate-400")}>
                        {formatCurrency(selectedStudent.term1_fee - selectedStudent.term1Paid)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-slate-500">Term 2:</span>
                      <span className={cn("font-semibold", selectedStudent.term2_fee - selectedStudent.term2Paid > 0 ? "text-secondary" : "text-slate-400")}>
                        {formatCurrency(selectedStudent.term2_fee - selectedStudent.term2Paid)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-slate-500">Term 3:</span>
                      <span className={cn("font-semibold", selectedStudent.term3_fee - selectedStudent.term3Paid > 0 ? "text-info" : "text-slate-400")}>
                        {formatCurrency(selectedStudent.term3_fee - selectedStudent.term3Paid)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="font-semibold text-sm">Select Terms & Enter Amounts</Label>
                  <div className="rounded-lg border bg-card p-3 space-y-3 shadow-inner max-h-[220px] overflow-y-auto">
                    {['0', '1', '2', '3'].map((termId) => {
                      const pending = getTermPendingAmount(termId);
                      const isChecked = paymentSelections[termId]?.paying || false;
                      const isPaid = pending <= 0;
                      let displayName = '';
                      if (termId === '0') displayName = 'Old Outstanding Dues';
                      else displayName = `Term ${termId} Fee`;

                      return (
                        <div key={termId} className={cn("flex items-center justify-between gap-4 p-2 rounded-md hover:bg-slate-50 transition-colors", isPaid && "opacity-60")}>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`pay-term-${termId}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => handleSelectionChange(termId, !!checked)}
                              disabled={isPaid}
                            />
                            <div className="flex flex-col">
                              <Label htmlFor={`pay-term-${termId}`} className={cn("text-xs font-semibold cursor-pointer", isPaid && "line-through text-slate-400")}>
                                {displayName}
                              </Label>
                              <span className="text-[10px] text-muted-foreground">
                                {isPaid ? 'Fully Paid' : `Pending: ${formatCurrency(pending)}`}
                              </span>
                            </div>
                          </div>
                          <div className="w-[120px]">
                            <Input
                              type="number"
                              value={isChecked ? (paymentSelections[termId]?.amount || '') : ''}
                              onChange={(e) => handleAmountChange(termId, parseFloat(e.target.value) || 0)}
                              disabled={!isChecked || isPaid}
                              placeholder="Amount"
                              className="h-8 text-right font-medium text-xs"
                              max={pending}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total Selected Amount */}
                <div className="flex justify-between items-center bg-slate-100/80 p-3 rounded-lg border">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Payment Amount</span>
                  <span className="text-lg font-black text-primary">
                    {formatCurrency(
                      Object.keys(paymentSelections)
                        .filter(termId => paymentSelections[termId]?.paying)
                        .reduce((sum, termId) => sum + (paymentSelections[termId]?.amount || 0), 0)
                    )}
                  </span>
                </div>

                <div className="space-y-3">
                  <Label>Payment Method</Label>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                    <div className="grid grid-cols-2 gap-3">
                      <Label
                        htmlFor="cash"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                          paymentMethod === 'cash' && "border-primary bg-primary/5"
                        )}
                      >
                        <RadioGroupItem value="cash" id="cash" />
                        <Banknote className="h-4 w-4" />
                        Cash
                      </Label>
                      <Label
                        htmlFor="qr_code"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                          paymentMethod === 'qr_code' && "border-primary bg-primary/5"
                        )}
                      >
                        <RadioGroupItem value="qr_code" id="qr_code" />
                        <QrCode className="h-4 w-4" />
                        QR Code
                      </Label>
                      <Label
                        htmlFor="bank_transfer"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                          paymentMethod === 'bank_transfer' && "border-primary bg-primary/5"
                        )}
                      >
                        <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                        <Building2 className="h-4 w-4" />
                        Bank
                      </Label>
                      <Label
                        htmlFor="card"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                          paymentMethod === 'card' && "border-primary bg-primary/5"
                        )}
                      >
                        <RadioGroupItem value="card" id="card" />
                        <CreditCard className="h-4 w-4" />
                        Card
                      </Label>
                      <Label
                        htmlFor="swiping"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                          paymentMethod === 'swiping' && "border-primary bg-primary/5"
                        )}
                      >
                        <RadioGroupItem value="swiping" id="swiping" />
                        <Smartphone className="h-4 w-4" />
                        Swiping
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    className="btn-oxford"
                    onClick={() => {
                      if (isStaff) {
                        toast({
                          variant: 'destructive',
                          title: 'Permission Denied',
                          description: 'Staff users cannot collect fees.',
                        });
                        return;
                      }
                      handlePayment();
                    }}
                    disabled={
                      isSubmitting ||
                      Object.keys(paymentSelections)
                        .filter(termId => paymentSelections[termId]?.paying)
                        .reduce((sum, termId) => sum + (paymentSelections[termId]?.amount || 0), 0) <= 0 ||
                      isStaff
                    }
                  >
                    {isSubmitting ? 'Processing...' : paymentMethod === 'qr_code' ? 'Proceed to QR Pay' : 'Confirm Payment'}
                    {isStaff && (
                      <span className="ml-2 text-xs">(Admin only)</span>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

