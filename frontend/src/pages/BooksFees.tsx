import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Search,
  Phone,

  Banknote,
  QrCode,
  Building2,
  CreditCard,
  GraduationCap,
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
import { QrScannerSelect } from '@/components/dashboard/QrScannerSelect';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ClassSlider } from '@/components/dashboard/ClassSlider';
import { useAuth } from '@/lib/auth';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/api';

interface StudentBooksFee {
  id: string;
  full_name: string;
  class_id: string;
  father_phone: string;
  mother_phone: string;
  has_books: boolean;
  books_fee: number;
  classes?: { name: string };
  booksFee: number;
  booksPaid: number;
  booksPending: number;
}

export default function BooksFees() {
  const { user, isStaff } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentBooksFee[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentBooksFee | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'course' | 'books' | 'transport'>('books');

  const classNames = ['all', ...classes.map(c => c.name)];

  const academicYear = getCurrentAcademicYear();

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStudentsWithBooksFees();
  }, [selectedClass]); // Refetch when class changes

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .order('sort_order');
    setClasses(data as { id: string; name: string }[] || []);
  };

  const fetchStudentsWithBooksFees = async () => {
    setIsLoading(true);
    try {
      let selectClause = 'id, full_name, class_id, father_phone, mother_phone, has_books, books_fee, classes(name)';
      if (selectedClass !== 'all') {
        selectClause = 'id, full_name, class_id, father_phone, mother_phone, has_books, books_fee, classes!inner(name)';
      }

      let query = supabase
        .from('students')
        .select(selectClause)
        .eq('is_active', true);

      if (selectedClass !== 'all') {
        query = query.eq('classes.name', selectedClass);
      }
      
      const { data: studentsData } = await query.order('full_name');

      const { data: payments } = await supabase
        .from('books_payments')
        .select('student_id, amount_paid')
        .eq('academic_year', academicYear) as { data: { student_id: string; amount_paid: number }[] };

      const paymentMap = new Map<string, number>();
      payments?.forEach(p => {
        const existing = paymentMap.get(p.student_id) || 0;
        paymentMap.set(p.student_id, existing + Number(p.amount_paid));
      });

      const enrichedStudents: StudentBooksFee[] = (studentsData as any[] || []).map(student => {
        // Use student's own books_fee column
        const booksFee = (student as any).has_books ? Number((student as any).books_fee) || 0 : 0;
        const booksPaid = paymentMap.get(student.id) || 0;

        return {
          ...student,
          has_books: (student as any).has_books || false,
          books_fee: Number((student as any).books_fee) || 0,
          booksFee,
          booksPaid,
          booksPending: Math.max(0, booksFee - booksPaid),
        };
      });

      setStudents(enrichedStudents);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openPaymentDialog = (student: StudentBooksFee) => {
    setSelectedStudent(student);
    setPaymentAmount(student.booksPending > 0 ? student.booksPending.toString() : '');
    setPaymentMethod('cash');
    setPaymentDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedStudent || !paymentAmount || !user) return;

    const payingAmount = parseFloat(paymentAmount);
    if (payingAmount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Payment amount must be greater than zero.',
      });
      return;
    }

    if (payingAmount > selectedStudent.booksPending) {
      toast({
        variant: 'destructive',
        title: 'Overpayment Blocked',
        description: `Payment amount (${formatCurrency(payingAmount)}) cannot exceed the pending amount (${formatCurrency(selectedStudent.booksPending)}) for books.`,
      });
      return;
    }

    if (paymentMethod === 'qr_code') {
      setPaymentDialogOpen(false);
      navigate('/payment-gateway', {
        state: {
          studentId: selectedStudent.id,
          studentName: selectedStudent.full_name,
          className: selectedStudent.classes?.name,
          amount: parseFloat(paymentAmount),
          paymentType: 'books',
          academicYear: academicYear
        }
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const receiptNumber = `BKS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${getApiBaseUrl()}/api/payments/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          student_id: selectedStudent.id,
          type: 'books',
          academic_year: academicYear,
          amount: parseFloat(paymentAmount),
          method: paymentMethod,
          receipt_number: receiptNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to record payment');
      }

      toast({
        title: 'Payment Recorded',
        description: `Receipt: ${receiptNumber}. Notifications sent.`,
      });

      setPaymentDialogOpen(false);
      fetchStudentsWithBooksFees();

      // Redirect to Receipt Page
      navigate(`/receipt?receiptNo=${receiptNumber}&type=books`);
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

  // Calculate total collected and pending amounts
  const totalCollected = students.reduce((sum, student) => sum + student.booksPaid, 0);
  const totalPending = students.reduce((sum, student) => sum + student.booksPending, 0);

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const className = student.classes?.name || '';
    const matchesClass = selectedClass === 'all' || className === selectedClass;
    return matchesSearch && matchesClass;
  });

  // Count students per class
  const classCounts = classNames.reduce((acc, cls) => {
    if (cls === 'all') {
      acc[cls] = students.filter(s =>
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
      ).length;
      return acc;
    }
    acc[cls] = students.filter(s =>
      (s.classes?.name === cls) &&
      (s.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    ).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-header"
        >
          <h1 className="page-title">Books Fees</h1>
          <p className="page-description">Manage books fee collection</p>
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
              amount={0}
              pending={0}
              icon={<GraduationCap className="h-6 w-6 text-primary" />}
              onClick={() => {
                navigate('/course-fees');
              }}
            />
            <FeeCategoryCard
              title="Books Fees"
              amount={totalCollected}
              pending={totalPending}
              icon={<BookOpen className="h-6 w-6 text-secondary" />}
              onClick={() => setActiveCategory('books')}
              className={activeCategory === 'books' ? 'ring-2 ring-secondary' : ''}
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
              placeholder="Search by student name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Books Fee Collection - {academicYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="table-header">
                      <TableHead>Student Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Parent Phones</TableHead>
                      <TableHead className="text-right">Books Fee</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </TableCell>
                      </TableRow>
                    ) : filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          No students found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student) => (
                        <TableRow key={student.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{student.full_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{student.classes?.name}</Badge>
                          </TableCell>
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
                            {formatCurrency(student.booksFee)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-success font-medium">
                              {formatCurrency(student.booksPaid)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-semibold",
                              student.booksPending > 0 ? "text-destructive" : "text-success"
                            )}>
                              {formatCurrency(student.booksPending)}
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
                              disabled={student.booksPending <= 0 || isStaff}
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

        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Collect Books Fee</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-6">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="font-medium">{selectedStudent.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedStudent.classes?.name}</p>
                  <p className="mt-2 text-sm">
                    Pending: <span className="font-semibold text-destructive">{formatCurrency(selectedStudent.booksPending)}</span>
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
                    max={selectedStudent.booksPending}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Payment Method</Label>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                    <div className="grid grid-cols-2 gap-3">
                      <Label
                        htmlFor="books-cash"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                          paymentMethod === 'cash' && "border-primary bg-primary/5"
                        )}
                      >
                        <RadioGroupItem value="cash" id="books-cash" />
                        <Banknote className="h-4 w-4" />
                        Cash
                      </Label>
                      <Label
                        htmlFor="books-qr"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                          paymentMethod === 'qr_code' && "border-primary bg-primary/5"
                        )}
                      >
                        <RadioGroupItem value="qr_code" id="books-qr" />
                        <QrCode className="h-4 w-4" />
                        QR Code
                      </Label>
                      <Label
                        htmlFor="books-bank"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                          paymentMethod === 'bank_transfer' && "border-primary bg-primary/5"
                        )}
                      >
                        <RadioGroupItem value="bank_transfer" id="books-bank" />
                        <Building2 className="h-4 w-4" />
                        Bank
                      </Label>
                      <Label
                        htmlFor="books-card"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                          paymentMethod === 'card' && "border-primary bg-primary/5"
                        )}
                      >
                        <RadioGroupItem value="card" id="books-card" />
                        <CreditCard className="h-4 w-4" />
                        Card
                      </Label>
                      <Label
                        htmlFor="books-swiping"
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                          paymentMethod === 'swiping' && "border-primary bg-primary/5"
                        )}
                      >
                        <RadioGroupItem value="swiping" id="books-swiping" />
                        <Smartphone className="h-4 w-4" />
                        Swiping
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {paymentMethod === 'qr_code' && <QrScannerSelect />}

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

