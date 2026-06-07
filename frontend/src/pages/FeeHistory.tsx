import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  History,
  Search,
  Download,
  Printer,
  IndianRupee,
  FileText
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/dashboard/StatCard';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useAcademicYear } from '@/contexts/AcademicYearContext';

interface Payment {
  id: string;
  receipt_number: string;
  amount_paid: number;
  payment_method: string;
  payment_date: string;
  fee_type: 'course' | 'books' | 'transport' | 'accessory' | 'accessories' | 'left_student';
  student_name: string;
  term?: number;
  month?: number;
  item_name?: string;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function FeeHistory() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('monthly');
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [selectedWeek, setSelectedWeek] = useState('1');
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const { currentAcademicYear } = useAcademicYear();
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(currentAcademicYear || '');

  const getAcademicYearOptions = (currentYearStr: string) => {
    if (!currentYearStr) return [];
    const options = ["all"];
    try {
      const parts = currentYearStr.split("-");
      const currentStart = parseInt(parts[0]);
      for (let y = currentStart; y >= 2025; y--) {
        const endSuffix = String((y + 1) % 100).padStart(2, '0');
        options.push(`${y}-${endSuffix}`);
      }
    } catch (e) {
      options.push(currentYearStr);
    }
    return options;
  };

  useEffect(() => {
    if (currentAcademicYear && !selectedAcademicYear) {
      setSelectedAcademicYear(currentAcademicYear);
    }
  }, [currentAcademicYear]);

  useEffect(() => {
    fetchPayments();
  }, [selectedAcademicYear]);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      
      // Fetch course payments
      let courseQuery = supabase
        .from('course_payments')
        .select('id, receipt_number, amount_paid, payment_method, payment_date, term, student_id, students(full_name)');
      if (selectedAcademicYear && selectedAcademicYear !== 'all') {
        courseQuery = courseQuery.eq('academic_year', selectedAcademicYear);
      }
      const { data: coursePayments } = await courseQuery.order('payment_date', { ascending: false });

      // Fetch books payments
      let booksQuery = supabase
        .from('books_payments')
        .select('id, receipt_number, amount_paid, payment_method, payment_date, student_id, students(full_name)');
      if (selectedAcademicYear && selectedAcademicYear !== 'all') {
        booksQuery = booksQuery.eq('academic_year', selectedAcademicYear);
      }
      const { data: booksPayments } = await booksQuery.order('payment_date', { ascending: false });

      // Fetch transport payments
      let transportQuery = supabase
        .from('transport_payments')
        .select('id, receipt_number, amount_paid, payment_method, payment_date, month, student_id, students(full_name)');
      if (selectedAcademicYear && selectedAcademicYear !== 'all') {
        transportQuery = transportQuery.eq('academic_year', selectedAcademicYear);
      }
      const { data: transportPayments } = await transportQuery.order('payment_date', { ascending: false });

      // Fetch accessory sales (Item-based issues)
      let accessorySalesQuery = supabase
        .from('accessory_sales')
        .select('id, receipt_number, total_amount, payment_method, created_at, student_id, students(full_name), accessories(item_name)');
      if (selectedAcademicYear && selectedAcademicYear !== 'all') {
        accessorySalesQuery = accessorySalesQuery.eq('academic_year', selectedAcademicYear);
      }
      const { data: accessorySales } = await accessorySalesQuery.order('created_at', { ascending: false });

      // Fetch accessories fees (Category-based student payments)
      let studentAccessoryPaymentsQuery = supabase
        .from('student_accessory_payments')
        .select('id, receipt_number, amount_paid, payment_method, payment_date, student_id, students(full_name), accessory_categories(name)');
      if (selectedAcademicYear && selectedAcademicYear !== 'all') {
        studentAccessoryPaymentsQuery = studentAccessoryPaymentsQuery.eq('academic_year', selectedAcademicYear);
      }
      const { data: studentAccessoryPayments } = await studentAccessoryPaymentsQuery.order('payment_date', { ascending: false });

      // Fetch left student recovery payments
      const { data: leftStudentPayments } = await supabase
        .from('left_student_recovery_payments')
        .select('id, receipt_number, amount_paid, payment_method, payment_date, left_student_fee_records(students(full_name))')
        .order('payment_date', { ascending: false });

      let filteredLeftPayments = leftStudentPayments || [];
      if (selectedAcademicYear && selectedAcademicYear !== 'all') {
        try {
          const parts = selectedAcademicYear.split("-");
          const startYear = parseInt(parts[0]);
          const startDate = new Date(startYear, 3, 1).toISOString(); // April 1st of startYear
          const endDate = new Date(startYear + 1, 2, 31, 23, 59, 59).toISOString(); // March 31st of startYear + 1
          filteredLeftPayments = (leftStudentPayments || []).filter(p => {
            return p.payment_date >= startDate && p.payment_date <= endDate;
          });
        } catch (e) {
          console.error("Error filtering left student payments by academic year:", e);
        }
      }

      const allPayments: Payment[] = [
        ...(coursePayments || []).map(p => ({
          id: p.id,
          receipt_number: p.receipt_number,
          amount_paid: Number(p.amount_paid),
          payment_method: p.payment_method,
          payment_date: p.payment_date,
          fee_type: 'course' as const,
          student_name: (p.students as any)?.full_name || 'Unknown',
          term: p.term,
        })),
        ...(booksPayments || []).map(p => ({
          id: p.id,
          receipt_number: p.receipt_number,
          amount_paid: Number(p.amount_paid),
          payment_method: p.payment_method,
          payment_date: p.payment_date,
          fee_type: 'books' as const,
          student_name: (p.students as any)?.full_name || 'Unknown',
        })),
        ...(transportPayments || []).map(p => ({
          id: p.id,
          receipt_number: p.receipt_number,
          amount_paid: Number(p.amount_paid),
          payment_method: p.payment_method,
          payment_date: p.payment_date,
          fee_type: 'transport' as const,
          student_name: (p.students as any)?.full_name || 'Unknown',
          month: p.month,
        })),
        ...(accessorySales || []).map(p => ({
          id: p.id,
          receipt_number: p.receipt_number,
          amount_paid: Number(p.total_amount),
          payment_method: p.payment_method,
          payment_date: p.created_at,
          fee_type: 'accessory' as const,
          student_name: (p.students as any)?.full_name || 'Unknown',
          item_name: (p as any).accessories?.item_name || 'Unknown Item',
        })),
        ...(studentAccessoryPayments || []).map(p => ({
          id: p.id,
          receipt_number: p.receipt_number,
          amount_paid: Number(p.amount_paid),
          payment_method: p.payment_method,
          payment_date: p.payment_date,
          fee_type: 'accessories' as const,
          student_name: (p.students as any)?.full_name || 'Unknown',
          item_name: (p as any).accessory_categories?.name || 'Accessory Fee',
        })),
        ...(filteredLeftPayments || []).map(p => ({
          id: p.id,
          receipt_number: p.receipt_number,
          amount_paid: Number(p.amount_paid),
          payment_method: p.payment_method,
          payment_date: p.payment_date,
          fee_type: 'left_student' as const,
          student_name: (p.left_student_fee_records as any)?.students?.full_name || 'Unknown',
          item_name: 'Dues Recovery',
        })),
      ].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

      setPayments(allPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPaymentMethodBadge = (method: string) => {
    const variants: Record<string, string> = {
      cash: 'bg-success/10 text-success',
      qr_code: 'bg-info/10 text-info',
      bank_transfer: 'bg-primary/10 text-primary',
      card: 'bg-secondary/10 text-secondary-foreground',
    };
    const labels: Record<string, string> = {
      cash: 'Cash',
      qr_code: 'QR Code',
      bank_transfer: 'Bank',
      card: 'Card',
    };
    return (
      <Badge variant="outline" className={variants[method] || ''}>
        {labels[method] || method}
      </Badge>
    );
  };

  const getFeeTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      course: 'bg-primary/10 text-primary',
      books: 'bg-secondary/10 text-secondary-foreground',
      transport: 'bg-success/10 text-success',
      accessories: 'bg-info/10 text-info',
      accessory: 'bg-warning/10 text-warning-foreground',
      left_student: 'bg-rose-100 text-rose-700 border-rose-200',
    };
    return (
      <Badge variant="outline" className={variants[type] || ''}>
        {type === 'left_student' ? 'Exit Recovery' : type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const handleExportCSV = () => {
    const headers = ['Receipt No', 'Student Name', 'Fee Type', 'Details', 'Amount (INR)', 'Payment Method', 'Date'];
    
    const rows = filteredPayments.map((payment) => {
      const feeType = payment.fee_type === 'left_student' 
        ? 'Exit Recovery' 
        : payment.fee_type.charAt(0).toUpperCase() + payment.fee_type.slice(1);
        
      let details = '-';
      if (payment.term !== undefined && payment.term !== null) {
        details = payment.term === 0 ? 'Old Due' : `Term ${payment.term}`;
      } else if (payment.month) {
        details = MONTHS[payment.month - 1];
      } else if (payment.item_name) {
        details = payment.item_name;
      }
      
      const dateStr = format(new Date(payment.payment_date), 'dd MMM yyyy hh:mm a');
      
      return [
        payment.receipt_number,
        payment.student_name,
        feeType,
        details,
        payment.amount_paid,
        payment.payment_method,
        dateStr
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const cell = String(val).replace(/"/g, '""');
        return `"${cell}"`;
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `fee_history_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.receipt_number.toLowerCase().includes(searchQuery.toLowerCase());

    // Date filtering based on selected period
    const paymentDate = new Date(payment.payment_date);
    let matchesPeriod = true;

    if (filterPeriod === 'daily' && selectedDay) {
      // Daily filtering logic
      const paymentDayStr = payment.payment_date.split('T')[0];
      matchesPeriod = paymentDayStr === selectedDay;
    } else if (filterPeriod === 'weekly' && selectedWeek) {
      // Weekly filtering logic
      const weekOfMonth = Math.ceil(paymentDate.getDate() / 7);
      matchesPeriod =
        weekOfMonth.toString() === selectedWeek &&
        (paymentDate.getMonth() + 1).toString() === selectedMonth &&
        paymentDate.getFullYear().toString() === selectedYear;
    } else if (filterPeriod === 'monthly' && selectedMonth) {
      matchesPeriod =
        (paymentDate.getMonth() + 1).toString() === selectedMonth &&
        paymentDate.getFullYear().toString() === selectedYear;
    } else if (filterPeriod === 'yearly' && selectedYear) {
      matchesPeriod = paymentDate.getFullYear().toString() === selectedYear;
    }

    return matchesSearch && matchesPeriod;
  });

  const totalIncome = filteredPayments.reduce((sum, p) => sum + p.amount_paid, 0);
  const courseIncome = filteredPayments
    .filter(p => p.fee_type === 'course')
    .reduce((sum, p) => sum + p.amount_paid, 0);
  const booksIncome = filteredPayments
    .filter(p => p.fee_type === 'books')
    .reduce((sum, p) => sum + p.amount_paid, 0);
  const transportIncome = filteredPayments
    .filter(p => p.fee_type === 'transport')
    .reduce((sum, p) => sum + p.amount_paid, 0);
  const accessoriesIncome = filteredPayments
    .filter(p => p.fee_type === 'accessories')
    .reduce((sum, p) => sum + p.amount_paid, 0);
  const leftStudentIncome = filteredPayments
    .filter(p => p.fee_type === 'left_student')
    .reduce((sum, p) => sum + p.amount_paid, 0);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="page-header mb-0">
            <h1 className="page-title">Fee History</h1>
            <p className="page-description">View and export payment records</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        >
          <StatCard
            title="Total Income"
            value={formatCurrency(totalIncome)}
            icon={<IndianRupee className="h-6 w-6" />}
            variant="primary"
          />
          <StatCard
            title="Course Fees"
            value={formatCurrency(courseIncome)}
            icon={<IndianRupee className="h-6 w-6" />}
          />
          <StatCard
            title="Books Fees"
            value={formatCurrency(booksIncome)}
            icon={<IndianRupee className="h-6 w-6" />}
          />
          <StatCard
            title="Transport Fees"
            value={formatCurrency(transportIncome)}
            icon={<IndianRupee className="h-6 w-6" />}
          />
          <StatCard
            title="Accessories Fees"
            value={formatCurrency(accessoriesIncome)}
            icon={<IndianRupee className="h-6 w-6" />}
          />
          <StatCard
            title="Exit Recovery"
            value={formatCurrency(leftStudentIncome)}
            icon={<IndianRupee className="h-6 w-6" />}
          />
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="print:hidden"
        >
          <Tabs value={filterPeriod} onValueChange={setFilterPeriod} className="w-full">
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by student or receipt..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                  <SelectTrigger className="w-48 bg-white border-slate-200">
                    <SelectValue placeholder="Academic Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Academic Years</SelectItem>
                    {getAcademicYearOptions(currentAcademicYear).filter(y => y !== "all").map(year => (
                      <SelectItem key={year} value={year}>
                        Year: {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <TabsContent value="daily" className="mt-0">
                <Input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-40"
                />
              </TabsContent>

              <TabsContent value="weekly" className="mt-0">
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select week" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Week 1</SelectItem>
                    <SelectItem value="2">Week 2</SelectItem>
                    <SelectItem value="3">Week 3</SelectItem>
                    <SelectItem value="4">Week 4</SelectItem>
                  </SelectContent>
                </Select>
              </TabsContent>

              <TabsContent value="monthly" className="mt-0">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>

              <TabsContent value="yearly" className="mt-0">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
            </div>
          </Tabs>
        </motion.div>

        {/* Transactions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Payment Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="table-header">
                      <TableHead>Receipt No.</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Fee Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center print:hidden">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </TableCell>
                      </TableRow>
                    ) : filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPayments.slice(0, 50).map((payment) => (
                        <TableRow key={payment.id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-sm">
                            {payment.receipt_number}
                          </TableCell>
                          <TableCell className="font-medium">
                            {payment.student_name}
                          </TableCell>
                          <TableCell>{getFeeTypeBadge(payment.fee_type)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {payment.term !== undefined && payment.term !== null
                              ? (payment.term === 0 ? 'Old Due' : `Term ${payment.term}`)
                              : payment.month ? MONTHS[payment.month - 1] :
                                payment.item_name ? payment.item_name : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(payment.amount_paid)}
                          </TableCell>
                          <TableCell>{getPaymentMethodBadge(payment.payment_method)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(payment.payment_date), 'dd MMM yyyy, hh:mm a')}
                          </TableCell>
                          <TableCell className="text-center print:hidden">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/receipt?receiptNo=${payment.receipt_number}&type=${payment.fee_type}`)}
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
            </CardContent>
          </Card>
        </motion.div>
        <style>{`
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page {
              margin: 15mm 10mm 15mm 10mm;
            }
            body {
              background: white !important;
              color: black !important;
            }
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
