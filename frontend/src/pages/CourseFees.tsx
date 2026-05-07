import { useEffect, useState } from 'react';
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
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'course' | 'books' | 'transport'>('course');

  const classNames = [
    'all', 'Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4',
    'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
  ];

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

        // Use student's own fees
        const term1Fee = Number(student.term1_fee) || 0;
        const term2Fee = Number(student.term2_fee) || 0;
        const term3Fee = Number(student.term3_fee) || 0;
        const oldDues = Number(student.old_dues) || 0;

        const totalFee = term1Fee + term2Fee + term3Fee + oldDues;
        const totalPaid = term1Paid + term2Paid + term3Paid;

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
    setPaymentAmount('');
    setSelectedTerm('1');
    setPaymentMethod('cash');
    setPaymentDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedStudent || !paymentAmount || !user) return;

    setIsSubmitting(true);
    try {
      const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const { error } = await supabase
        .from('course_payments')
        .insert({
          student_id: selectedStudent.id,
          academic_year: academicYear,
          term: parseInt(selectedTerm),
          amount_paid: parseFloat(paymentAmount),
          payment_method: paymentMethod,
          receipt_number: receiptNumber,
          collected_by: user.id,
        });

      if (error) throw error;

      toast({
        title: 'Payment Recorded',
        description: `Receipt: ${receiptNumber}`,
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

  const getPendingTermAmount = () => {
    if (!selectedStudent) return 0;
    const term = parseInt(selectedTerm);
    const termFee = term === 1
      ? selectedStudent.term1_fee
      : term === 2
        ? selectedStudent.term2_fee
        : selectedStudent.term3_fee;
    const termPaid = term === 1
      ? selectedStudent.term1Paid
      : term === 2
        ? selectedStudent.term2Paid
        : selectedStudent.term3Paid;
    return Math.max(0, termFee - termPaid);
  };

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
                            <Badge
                              variant="outline"
                              className={cn(
                                getTermStatus(student.term1Paid, student.term1_fee) === 'success' && 'badge-success',
                                getTermStatus(student.term1Paid, student.term1_fee) === 'warning' && 'badge-warning'
                              )}
                            >
                              {formatCurrency(student.term1Paid)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                getTermStatus(student.term2Paid, student.term2_fee) === 'success' && 'badge-success',
                                getTermStatus(student.term2Paid, student.term2_fee) === 'warning' && 'badge-warning'
                              )}
                            >
                              {formatCurrency(student.term2Paid)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                getTermStatus(student.term3Paid, student.term3_fee) === 'success' && 'badge-success',
                                getTermStatus(student.term3Paid, student.term3_fee) === 'warning' && 'badge-warning'
                              )}
                            >
                              {formatCurrency(student.term3Paid)}
                            </Badge>
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Collect Course Fee</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-6">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="font-medium">{selectedStudent.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedStudent.classes?.name}</p>
                </div>

                <div className="space-y-2">
                  <Label>Select Term</Label>
                  <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Term 1</SelectItem>
                      <SelectItem value="2">Term 2</SelectItem>
                      <SelectItem value="3">Term 3</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Pending: {formatCurrency(getPendingTermAmount())}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Payment Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount"
                  />
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
                    disabled={isSubmitting || !paymentAmount || isStaff}
                  >
                    {isSubmitting ? 'Processing...' : 'Confirm Payment'}
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

