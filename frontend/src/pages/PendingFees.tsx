import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  Search,
  Phone,
  Printer,
  Download,
  BookOpen,
  Bus,
  ShoppingCart,
  GraduationCap
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
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { getCurrentAcademicYear } from '@/lib/academic-year';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function PendingFees() {
  const location = useLocation();
  const initialTab = location.state?.tab || 'all';
  const [activeTab, setActiveTab] = useState<'all' | 'course' | 'books' | 'transport' | 'accessories'>(initialTab);
  const [filterPeriod, setFilterPeriod] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [students, setStudents] = useState<any[]>([]);
  const [pendingSummary, setPendingSummary] = useState({
    totalPending: 0,
    coursePending: 0,
    booksPending: 0,
    transportPending: 0,
    accessoriesPending: 0,
  });
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const academicYear = getCurrentAcademicYear();

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchPendingData();
    setCurrentPage(1); // Reset pagination when filters change
  }, [activeTab, selectedClass]);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .order('sort_order');
    setClasses((data as any[]) || []);
  };

  const fetchPendingData = async () => {
    setIsLoading(true);
    try {
      let selectClause = 'id, admission_number, full_name, class_id, father_name, father_phone, mother_phone, term1_fee, term2_fee, term3_fee, old_dues, has_books, books_fee, has_transport, transport_fee, classes(name, sort_order)';
      if (selectedClass !== 'all') {
        selectClause = 'id, admission_number, full_name, class_id, father_name, father_phone, mother_phone, term1_fee, term2_fee, term3_fee, old_dues, has_books, books_fee, has_transport, transport_fee, classes!inner(name, sort_order)';
      }

      let query = supabase
        .from('students')
        .select(selectClause)
        .eq('is_active', true);

      if (selectedClass !== 'all') {
        query = query.eq('class_id', selectedClass);
      }
      
      const { data: studentsData } = await query.order('full_name');

      const [coursePaymentsRes, booksPaymentsRes, transportPaymentsRes, accessoriesPaymentsRes, studentAccessoryFeesRes] = await Promise.all([
        supabase
          .from('course_payments')
          .select('student_id, term, amount_paid, payment_date')
          .eq('academic_year', academicYear),
        supabase
          .from('books_payments')
          .select('student_id, amount_paid, payment_date')
          .eq('academic_year', academicYear),
        supabase
          .from('transport_payments')
          .select('student_id, month, payment_date')
          .eq('academic_year', academicYear),
        supabase
          .from('student_accessory_payments')
          .select('student_id, amount_paid, payment_date')
          .eq('academic_year', academicYear),
        supabase
          .from('student_accessory_fees')
          .select('student_id, fee_amount')
          .eq('academic_year', academicYear),
      ]);

      const coursePayments = (coursePaymentsRes.data || []) as any[];
      const booksPayments = (booksPaymentsRes.data || []) as any[];
      const transportPayments = (transportPaymentsRes.data || []) as any[];
      const accessoriesPayments = (accessoriesPaymentsRes.data || []) as any[];
      const studentAccessoryFees = (studentAccessoryFeesRes.data || []) as any[];

      const coursePaymentMap = new Map<string, { term1: number; term2: number; term3: number; oldDues: number }>();
      coursePayments.forEach(p => {
        const studentId = p.student_id as string;
        const existing = coursePaymentMap.get(studentId) || { term1: 0, term2: 0, term3: 0, oldDues: 0 };
        if (p.term === 1) existing.term1 += Number(p.amount_paid);
        if (p.term === 2) existing.term2 += Number(p.amount_paid);
        if (p.term === 3) existing.term3 += Number(p.amount_paid);
        if (p.term === 0) existing.oldDues += Number(p.amount_paid);
        coursePaymentMap.set(studentId, existing);
      });

      const booksPaymentMap = new Map<string, number>();
      booksPayments.forEach(p => {
        const studentId = p.student_id as string;
        const existing = booksPaymentMap.get(studentId) || 0;
        booksPaymentMap.set(studentId, existing + Number(p.amount_paid));
      });

      const transportPaymentMap = new Map<string, number[]>();
      transportPayments.forEach(p => {
        const studentId = p.student_id as string;
        const existing = transportPaymentMap.get(studentId) || [];
        if (!existing.includes(p.month)) existing.push(p.month);
        transportPaymentMap.set(studentId, existing);
      });

      const accessoriesPaymentMap = new Map<string, number>();
      accessoriesPayments.forEach(p => {
        const studentId = p.student_id as string;
        const existing = accessoriesPaymentMap.get(studentId) || 0;
        accessoriesPaymentMap.set(studentId, existing + Number(p.amount_paid));
      });

      const accessoryFeeMap = new Map<string, number>();
      studentAccessoryFees.forEach(f => {
        const studentId = f.student_id as string;
        const existing = accessoryFeeMap.get(studentId) || 0;
        accessoryFeeMap.set(studentId, existing + Number(f.fee_amount));
      });

      const lastPaymentMap = new Map<string, Date>();
      const updateLastPayment = (studentId: string, dateStr: string) => {
        if (!dateStr) return;
        const date = new Date(dateStr);
        const existing = lastPaymentMap.get(studentId);
        if (!existing || date > existing) {
          lastPaymentMap.set(studentId, date);
        }
      };

      coursePayments.forEach(p => updateLastPayment(p.student_id, p.payment_date));
      booksPayments.forEach(p => updateLastPayment(p.student_id, p.payment_date));
      transportPayments.forEach(p => updateLastPayment(p.student_id, p.payment_date));
      accessoriesPayments.forEach(p => updateLastPayment(p.student_id, p.payment_date));

      const currentMonth = new Date().getMonth() + 1;

      const enriched = (studentsData as any[] || []).map(student => {
        const studentId = student.id as string;
        const paid = coursePaymentMap.get(studentId) || { term1: 0, term2: 0, term3: 0, oldDues: 0 };
        const term1Pending = Math.max(0, (student.term1_fee || 0) - paid.term1);
        const term2Pending = Math.max(0, (student.term2_fee || 0) - paid.term2);
        const term3Pending = Math.max(0, (student.term3_fee || 0) - paid.term3);
        const oldDues = Number(student.old_dues) || 0;
        const oldDuesPending = Math.max(0, oldDues - paid.oldDues);
        const coursePending = term1Pending + term2Pending + term3Pending + oldDuesPending;

        const booksPaid = booksPaymentMap.get(student.id) || 0;
        const booksPending = student.has_books ? Math.max(0, (student.books_fee || 0) - booksPaid) : 0;

        const paidQuarters = transportPaymentMap.get(student.id) || [];
        const getElapsedQuarters = (month: number): number[] => {
          if (month >= 4 && month <= 6) return [1];
          if (month >= 7 && month <= 9) return [1, 2];
          if (month >= 10 && month <= 12) return [1, 2, 3];
          return [1, 2, 3, 4];
        };
        const elapsedQuarters = getElapsedQuarters(currentMonth);
        const pendingQuarters = elapsedQuarters.filter(q => !paidQuarters.includes(q));
        const monthlyFee = student.has_transport ? (student.transport_fee || 0) : 0;
        const transportPending = pendingQuarters.length * (monthlyFee * 3);

        const accessoriesPaid = accessoriesPaymentMap.get(student.id) || 0;
        const accessoriesAssigned = accessoryFeeMap.get(student.id) || 0;
        const accessoriesPending = Math.max(0, accessoriesAssigned - accessoriesPaid);

        const totalPending = coursePending + booksPending + transportPending + accessoriesPending;
        const termFeePending = term1Pending + term2Pending + term3Pending;
        const lastPayment = lastPaymentMap.get(studentId);

        return {
          ...student,
          term1Pending,
          term2Pending,
          term3Pending,
          termFeePending,
          oldDuesPending,
          coursePending,
          booksPending,
          transportPending,
          accessoriesPending,
          pendingQuarters,
          totalPending,
          lastPaymentDate: lastPayment ? lastPayment.toISOString() : null,
        };
      }).filter(s => s.totalPending > 0);

      // Sort by class order then by name
      enriched.sort((a, b) => {
        const orderA = a.classes?.sort_order || 0;
        const orderB = b.classes?.sort_order || 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.full_name.localeCompare(b.full_name);
      });

      setStudents(enriched);

      const summary = enriched.reduce((acc, s) => {
        acc.coursePending += s.coursePending || 0;
        acc.booksPending += s.booksPending || 0;
        acc.transportPending += s.transportPending || 0;
        acc.accessoriesPending += s.accessoriesPending || 0;
        acc.totalPending += s.totalPending || 0;
        return acc;
      }, {
        totalPending: 0,
        coursePending: 0,
        booksPending: 0,
        transportPending: 0,
        accessoriesPending: 0,
      });

      setPendingSummary(summary);
    } catch (error) {
      console.error('Error fetching pending data:', error);
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

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || student.class_id === selectedClass;

    // Filter by category if not showing all
    let matchesCategory = true;
    if (activeTab !== 'all') {
      switch (activeTab) {
        case 'course':
          matchesCategory = student.coursePending > 0;
          break;
        case 'books':
          matchesCategory = student.booksPending > 0;
          break;
        case 'transport':
          matchesCategory = student.transportPending > 0;
          break;
        case 'accessories':
          matchesCategory = student.accessoriesPending > 0;
          break;
      }
    } else {
      matchesCategory = student.totalPending > 0;
    }

    return matchesSearch && matchesClass && matchesCategory;
  });

  // Also reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalPending = filteredStudents.reduce((sum, s) =>
    sum + (s.totalPending || 0), 0
  );

  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const handleExportCSV = () => {
    const headers = ['Student Name', 'Admission No', 'Class', 'Parent Name', 'Parent Mobile', 'Term Fee Pending', 'Old Due', 'Transport Pending', 'Books Pending', 'Accessories Pending', 'Total Pending', 'Last Payment', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredStudents.map(s => [
        `"${s.full_name}"`,
        `"${s.admission_number || ''}"`,
        `"${s.classes?.name || ''}"`,
        `"${s.father_name || ''}"`,
        `"${s.father_phone || s.mother_phone || ''}"`,
        s.termFeePending || 0,
        s.oldDuesPending || 0,
        s.transportPending || 0,
        s.booksPending || 0,
        s.accessoriesPending || 0,
        s.totalPending || 0,
        s.lastPaymentDate ? new Date(s.lastPaymentDate).toLocaleDateString() : '',
        s.lastPaymentDate ? 'Partial Paid' : 'Pending'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pending_fees_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      {/* Print Only Header */}
      <div className="hidden print:flex flex-col items-center border-b-2 border-slate-900 pb-4 mb-6 relative w-full">
          <div className="flex flex-col text-center">
              <h1 className="text-xl md:text-3xl font-black text-[#002147] tracking-tight uppercase font-serif">ADARSH OXFORD</h1>
              <p className="text-[10px] md:text-sm font-bold text-slate-600 uppercase tracking-[0.2em] -mt-1">English Medium School</p>
          </div>
          <div className="mt-4">
              <span className="border-b-2 border-slate-900 text-lg md:text-xl font-bold uppercase tracking-widest px-2">Pending Fees Report</span>
          </div>
          {selectedClass !== 'all' && (
             <div className="mt-2 text-sm font-semibold">Class: {classes.find(c => c.id === selectedClass)?.name}</div>
          )}
      </div>

      <div className="space-y-8 print:space-y-4 print:p-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden"
        >
          <div className="page-header mb-0">
            <h1 className="page-title">Pending Fees</h1>
            <p className="page-description">View and manage pending fee collections</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handlePrint} size="sm">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" onClick={handleExportCSV} size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </motion.div>



        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs value={filterPeriod} onValueChange={setFilterPeriod}>
            <TabsList className="print:hidden">
              <TabsTrigger value="monthly">Monthly View</TabsTrigger>
              <TabsTrigger value="yearly">Yearly View</TabsTrigger>
            </TabsList>

            <TabsContent value="monthly" className="mt-4">
              {/* Summary Cards Row */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6 print:hidden">
                {/* Total Pending Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${activeTab === 'all' ? 'ring-2 ring-destructive border-destructive' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Pending</p>
                      <p className="text-lg font-display font-semibold text-destructive">
                        {formatCurrency(pendingSummary.totalPending)}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Course Pending Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${activeTab === 'course' ? 'ring-2 ring-primary border-primary' : ''}`}
                  onClick={() => setActiveTab('course')}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Course</p>
                      <p className="text-lg font-display font-semibold text-primary">
                        {formatCurrency(pendingSummary.coursePending)}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Books Pending Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${activeTab === 'books' ? 'ring-2 ring-secondary border-secondary' : ''}`}
                  onClick={() => setActiveTab('books')}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                      <BookOpen className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Books</p>
                      <p className="text-lg font-display font-semibold text-secondary">
                        {formatCurrency(pendingSummary.booksPending)}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Transport Pending Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${activeTab === 'transport' ? 'ring-2 ring-success border-success' : ''}`}
                  onClick={() => setActiveTab('transport')}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                      <Bus className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Transport</p>
                      <p className="text-lg font-display font-semibold text-success">
                        {formatCurrency(pendingSummary.transportPending)}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Accessories Pending Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${activeTab === 'accessories' ? 'ring-2 ring-info border-info' : ''}`}
                  onClick={() => setActiveTab('accessories')}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                      <ShoppingCart className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Accessories</p>
                      <p className="text-lg font-display font-semibold text-info">
                        {formatCurrency(pendingSummary.accessoriesPending)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Filter Row */}
              <div className="flex flex-col gap-4 sm:flex-row mb-6 print:hidden">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by student name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Table Section */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-3 print:hidden">
                    Pending Fees Overview
                    <Badge variant="outline" className="text-destructive border-destructive">{filteredStudents.length} Students Pending</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="table-header">
                          <TableHead>Student Name</TableHead>
                          <TableHead>Adm No.</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Parent Name</TableHead>
                          <TableHead>Parent Mobile</TableHead>
                          <TableHead className="text-right">Term 1</TableHead>
                          <TableHead className="text-right">Term 2</TableHead>
                          <TableHead className="text-right">Term 3</TableHead>
                          <TableHead className="text-right">Old Due</TableHead>
                          <TableHead className="text-right">Transport</TableHead>
                          <TableHead className="text-right">Books</TableHead>
                          <TableHead className="text-right">Accessories</TableHead>
                          <TableHead className="text-right">Total Pending</TableHead>
                          <TableHead>Last Payment</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={15} className="text-center py-12">
                              <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            </TableCell>
                          </TableRow>
                        ) : filteredStudents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={15} className="text-center py-12 text-muted-foreground">
                              No pending fees found
                            </TableCell>
                          </TableRow>
                        ) : (
                          (isPrinting ? filteredStudents : paginatedStudents).map((student) => (
                            <TableRow key={student.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium">{student.full_name}</TableCell>
                              <TableCell className="font-mono text-sm">{student.admission_number || 'N/A'}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{student.classes?.name}</Badge>
                              </TableCell>
                              <TableCell>{student.father_name || 'N/A'}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                  {student.father_phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {student.father_phone}
                                    </div>
                                  )}
                                  {student.mother_phone && !student.father_phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {student.mother_phone}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cn("font-semibold", student.term1Pending > 0 ? "text-destructive" : "text-muted-foreground")}>
                                  {formatCurrency(student.term1Pending || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cn("font-semibold", student.term2Pending > 0 ? "text-destructive" : "text-muted-foreground")}>
                                  {formatCurrency(student.term2Pending || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cn("font-semibold", student.term3Pending > 0 ? "text-destructive" : "text-muted-foreground")}>
                                  {formatCurrency(student.term3Pending || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cn("font-semibold", student.oldDuesPending > 0 ? "text-destructive" : "text-muted-foreground")}>
                                  {formatCurrency(student.oldDuesPending || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cn("font-semibold", student.transportPending > 0 ? "text-destructive" : "text-muted-foreground")}>
                                  {formatCurrency(student.transportPending || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cn("font-semibold", student.booksPending > 0 ? "text-destructive" : "text-muted-foreground")}>
                                  {formatCurrency(student.booksPending || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cn("font-semibold", student.accessoriesPending > 0 ? "text-destructive" : "text-muted-foreground")}>
                                  {formatCurrency(student.accessoriesPending || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-semibold text-destructive">
                                  {formatCurrency(student.totalPending || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {student.lastPaymentDate ? new Date(student.lastPaymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No payments'}
                              </TableCell>
                              <TableCell>
                                {student.lastPaymentDate ? (
                                  <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-none">Partial Paid</Badge>
                                ) : (
                                  <Badge className="bg-destructive hover:bg-destructive/90 text-white border-none">Pending</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-4 border-t print:hidden">
                      <div className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} students
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="yearly" className="mt-4">
              <div className="mb-4 flex justify-end print:hidden">
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
              </div>

              {/* Total Pending Amount Master Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 print:hidden"
              >
                <Card className="border-l-4 border-l-destructive">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pending Amount</p>
                      <p className="text-2xl font-display font-semibold text-destructive">
                        {formatCurrency(pendingSummary.totalPending)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Pending Category Cards */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6 print:hidden">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`rounded-xl border bg-card p-6 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${activeTab === 'course' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setActiveTab('course')}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <GraduationCap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Course Pending</p>
                      <p className="text-2xl font-display font-semibold text-primary">
                        {formatCurrency(pendingSummary.coursePending)}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`rounded-xl border bg-card p-6 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${activeTab === 'books' ? 'ring-2 ring-secondary' : ''}`}
                  onClick={() => setActiveTab('books')}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
                      <BookOpen className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Books Pending</p>
                      <p className="text-2xl font-display font-semibold text-secondary">
                        {formatCurrency(pendingSummary.booksPending)}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`rounded-xl border bg-card p-6 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${activeTab === 'transport' ? 'ring-2 ring-success' : ''}`}
                  onClick={() => setActiveTab('transport')}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                      <Bus className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Transport Pending</p>
                      <p className="text-2xl font-display font-semibold text-success">
                        {formatCurrency(pendingSummary.transportPending)}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`rounded-xl border bg-card p-6 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${activeTab === 'accessories' ? 'ring-2 ring-info' : ''}`}
                  onClick={() => setActiveTab('accessories')}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-info/10">
                      <ShoppingCart className="h-6 w-6 text-info" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Accessories Pending</p>
                      <p className="text-2xl font-display font-semibold text-info">
                        {formatCurrency(pendingSummary.accessoriesPending)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="font-display print:hidden">Pending Fees Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-center py-8">
                    Select a category above to view detailed pending fees
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
      <style>{`
        @media print {
          @page { margin: 1cm; size: landscape; }
          body { 
            background: white; 
            -webkit-print-color-adjust: exact !important; 
          }
          .card-elevated { box-shadow: none !important; border: none !important; }
          .table-header th { background-color: #f1f5f9 !important; border-bottom: 2px solid #cbd5e1 !important; color: #000 !important; }
          td, th { padding: 8px 4px !important; font-size: 11px !important; }
          .badge { border: 1px solid #ccc !important; }
          * { text-shadow: none !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}

