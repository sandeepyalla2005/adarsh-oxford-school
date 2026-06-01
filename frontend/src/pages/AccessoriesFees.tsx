import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Search,
  Phone,
  Banknote,
  QrCode,
  Building2,
  CreditCard,
  GraduationCap,
  Bus,
  IndianRupee,
  Smartphone,
  BookOpen,
  Settings,
  Plus,
  Check,
  X,
  FileText,
  Users,
  Shirt,
  IdCard,
  UserPlus
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
  DialogClose,
  DialogDescription
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FeeCategoryCard } from '@/components/dashboard/FeeCategoryCard';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ClassSlider } from '@/components/dashboard/ClassSlider';
import { useAuth } from '@/lib/auth';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { getCurrentPortal, portalPath } from '@/lib/portal';

interface AccessoryCategory {
  id: string;
  name: string;
  default_price: number;
}

interface AssignedCategory {
  category_id: string;
  fee_amount: number;
  paid_amount: number;
  pending_amount: number;
  name: string;
}

interface StudentAccessoriesData {
  id: string;
  full_name: string;
  class_id: string;
  father_phone: string;
  mother_phone: string;
  classes?: { name: string };
  assignedCategories: AssignedCategory[];
  totalAssigned: number;
  totalPaid: number;
  totalPending: number;
}

export default function AccessoriesFees() {
  const { user, isStaff } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const portal = getCurrentPortal(location.pathname);

  const [categories, setCategories] = useState<AccessoryCategory[]>([]);
  const [students, setStudents] = useState<StudentAccessoriesData[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  
  // Manage Categories UI
  const [manageCategoriesDialogOpen, setManageCategoriesDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryPrice, setNewCategoryPrice] = useState('');

  // Assign to Student UI
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedStudentToAssign, setSelectedStudentToAssign] = useState<StudentAccessoriesData | null>(null);
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, { selected: boolean, fee: number }>>({});

  // Payment UI
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<StudentAccessoriesData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentSelections, setPaymentSelections] = useState<Record<string, { paying: boolean, amount: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [activeCategory, setActiveCategory] = useState<'course' | 'books' | 'transport' | 'accessories'>('accessories');

  const classNames = [
    'all', 'Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4',
    'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
  ];

  const academicYear = getCurrentAcademicYear();

  useEffect(() => {
    fetchClasses();
    fetchAllData();
  }, []);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name').order('sort_order');
    setClasses(data as { id: string; name: string }[] || []);
  };

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch categories first as others might depend on it (or just fetch all together)
      const catResp = await apiFetch('/api/accessories/categories');
      if (!catResp.ok) throw new Error('Failed to load categories');
      const categoriesData = await catResp.json();
      setCategories(categoriesData);

      // Fetch students, assignments, and payments in PARALLEL
      const [studentsRes, assignmentsRes, paymentsRes] = await Promise.all([
        supabase.from('students').select('id, full_name, class_id, father_phone, mother_phone, classes(name, sort_order)').eq('is_active', true),
        supabase.from('student_accessory_fees').select('*').eq('academic_year', academicYear),
        supabase.from('student_accessory_payments').select('student_id, category_id, amount_paid').eq('academic_year', academicYear)
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const studentsData = studentsRes.data || [];
      const assignmentsData = assignmentsRes.data || [];
      const paymentsData = paymentsRes.data || [];

      // Process Data
      const enrichedStudents: StudentAccessoriesData[] = (studentsData as any[] || []).map(student => {
        
        // Find assigned categories for this student
        const studentAssignments = (assignmentsData as any[] || []).filter(a => a.student_id === student.id);
        const studentPayments = (paymentsData as any[] || []).filter(p => p.student_id === student.id);
        
        const assignedCategories: AssignedCategory[] = studentAssignments.map(assign => {
            const catName = categoriesData.find((c: any) => c.id === assign.category_id)?.name || 'Unknown';
            const categoryPayments = studentPayments.filter(p => p.category_id === assign.category_id);
            const totalPaidForCat = categoryPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
            const pending = Math.max(0, Number(assign.fee_amount) - totalPaidForCat);
            
            return {
                category_id: assign.category_id,
                name: catName,
                fee_amount: Number(assign.fee_amount),
                paid_amount: totalPaidForCat,
                pending_amount: pending
            };
        });

        const totalAssigned = assignedCategories.reduce((sum, cat) => sum + cat.fee_amount, 0);
        const totalPaid = assignedCategories.reduce((sum, cat) => sum + cat.paid_amount, 0);
        const totalPending = assignedCategories.reduce((sum, cat) => sum + cat.pending_amount, 0);

        return {
          ...student,
          assignedCategories,
          totalAssigned,
          totalPaid,
          totalPending,
        };
      });

      // Sort class-wise then by name
      enrichedStudents.sort((a, b) => {
        const orderA = (a as any).classes?.sort_order || 0;
        const orderB = (b as any).classes?.sort_order || 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.full_name.localeCompare(b.full_name);
      });

      setStudents(enrichedStudents);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openAssignDialog = (student: StudentAccessoriesData) => {
    const initialSelections: Record<string, { selected: boolean, fee: number }> = {};
    
    // Default all existing categories
    categories.forEach(cat => {
        const existingAssigned = student.assignedCategories.find(ac => ac.category_id === cat.id);
        initialSelections[cat.id] = {
            selected: !!existingAssigned,
            fee: existingAssigned ? existingAssigned.fee_amount : cat.default_price
        };
    });
    
    setAssignmentSelections(initialSelections);
    setSelectedStudentToAssign(student);
    setAssignDialogOpen(true);
  };
  
  const saveAssignments = async () => {
    if (!selectedStudentToAssign) return;
    setIsSubmitting(true);
    
    try {
        // Delete all prior assignments for this student for the academic year 
        // to simplify the "sync" process (could be optimized later)
        await supabase
            .from('student_accessory_fees')
            .delete()
            .eq('student_id', selectedStudentToAssign.id)
            .eq('academic_year', academicYear);
            
        // Insert new ones
        const toInsert = categories
            .filter(cat => assignmentSelections[cat.id]?.selected)
            .map(cat => ({
                student_id: selectedStudentToAssign.id,
                category_id: cat.id,
                fee_amount: assignmentSelections[cat.id].fee,
                academic_year: academicYear
            }));
            
        if (toInsert.length > 0) {
            const { error } = await supabase.from('student_accessory_fees').insert(toInsert);
            if (error) throw error;
        }
        
        toast({ title: 'Assignments Saved', description: 'Student categories updated successfully.' });
        setAssignDialogOpen(false);
        fetchAllData();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openPaymentDialog = (student: StudentAccessoriesData) => {
    setSelectedStudentForPayment(student);
    
    const initialPayments: Record<string, { paying: boolean, amount: number }> = {};
    student.assignedCategories.forEach(ac => {
        if (ac.pending_amount > 0) {
            initialPayments[ac.category_id] = {
                paying: true,
                amount: ac.pending_amount // Default to full pending amount
            };
        }
    });
    
    setPaymentSelections(initialPayments);
    setPaymentMethod('cash');
    setPaymentDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedStudentForPayment) return;
    
    // Gather categories being paid
    const payingCategories = Object.keys(paymentSelections)
        .filter(catId => paymentSelections[catId].paying && paymentSelections[catId].amount > 0);
        
    if (payingCategories.length === 0) {
        toast({ variant: 'destructive', title: 'Invalid Payment', description: 'Select at least one category to pay for.'});
        return;
    }

    // Validate no category is overpaid
    for (const catId of payingCategories) {
        const catAmount = paymentSelections[catId].amount;
        const assignedCat = selectedStudentForPayment.assignedCategories.find(ac => ac.category_id === catId);
        const maxPending = assignedCat ? assignedCat.pending_amount : 0;
        if (catAmount <= 0) {
            toast({
                variant: 'destructive',
                title: 'Invalid Amount',
                description: `Payment amount for ${assignedCat?.name || 'Category'} must be greater than zero.`,
            });
            return;
        }
        if (catAmount > maxPending) {
            const catName = assignedCat ? assignedCat.name : 'Category';
            toast({
                variant: 'destructive',
                title: 'Overpayment Blocked',
                description: `Payment amount for ${catName} (${formatCurrency(catAmount)}) cannot exceed the pending amount (${formatCurrency(maxPending)}).`,
            });
            return;
        }
    }

    if (paymentMethod === 'qr_code') {
      setPaymentDialogOpen(false);
      
      const enrichedPayingCats = payingCategories.map(catId => ({
        categoryId: catId,
        amount: paymentSelections[catId].amount,
        name: categories.find(c => c.id === catId)?.name || 'Accessory Item'
      }));

      navigate('/payment-gateway', {
        state: {
          studentId: selectedStudentForPayment.id,
          studentName: selectedStudentForPayment.full_name,
          className: selectedStudentForPayment.classes?.name,
          paymentType: 'accessories',
          academicYear: academicYear,
          payingCategories: enrichedPayingCats
        }
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Process payments sequentially via FastAPI
      for (const catId of payingCategories) {
        const response = await apiFetch('/api/payments/accessories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: selectedStudentForPayment.id,
            category_id: catId,
            amount_paid: paymentSelections[catId].amount,
            payment_method: paymentMethod,
            remarks: `Payment for ${categories.find(c => c.id === catId)?.name}`
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Payment failed');
        }
      }

      toast({
        title: 'Payment Successful',
        description: 'All payments recorded via Python Backend.',
      });

      setPaymentDialogOpen(false);
      fetchAllData();
      
      // Navigate to home dashboard or history
      navigate(portalPath(portal, '/dashboard'));
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
  
  const handleAddCategory = async () => {
      if (!newCategoryName) return;
      try {
          const { error } = await supabase.from('accessory_categories').insert({
              name: newCategoryName,
              default_price: Number(newCategoryPrice) || 0
          });
          if (error) throw error;
          setNewCategoryName('');
          setNewCategoryPrice('');
          toast({ title: 'Category Created' });
          fetchAllData();
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
      }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  };

  const totalCollected = students.reduce((sum, student) => sum + student.totalPaid, 0);
  const totalPending = students.reduce((sum, student) => sum + student.totalPending, 0);

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || student.class_id === selectedClass;
    
    let matchesCategory = true;
    if (selectedCategoryTab !== 'all') {
      matchesCategory = student.assignedCategories.some(cat => 
        cat.category_id === selectedCategoryTab
      );
    }
    
    return matchesSearch && matchesClass && matchesCategory;
  });

  const classCounts = classNames.reduce((acc, cls) => {
    if (cls === 'all') {
      acc[cls] = students.filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase())).length;
      return acc;
    }
    acc[cls] = students.filter(s => 
      (s.classes?.name === cls) && s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    ).length;
    return acc;
  }, {} as Record<string, number>);
  
  const totalPaymentAmount = Object.values(paymentSelections)
    .filter(p => p.paying)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 page-header">
          <div>
            <h1 className="page-title">Accessories Management</h1>
            <p className="page-description">Manage category-based payments like Uniforms, ID Cards, Field Trips</p>
          </div>
          <Button variant="outline" className="border-primary/20 bg-white" onClick={() => setManageCategoriesDialogOpen(true)}>
              <Settings className="w-4 h-4 mr-2 text-primary" /> Manage Categories
          </Button>
        </motion.div>

        {/* Category Navigation Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.15 }}
          className="bg-white p-2 rounded-2xl shadow-md border border-slate-100 flex flex-wrap gap-2"
        >
          {[
            { id: 'all', label: 'All Students', icon: Users },
            ...categories.map(cat => ({
              id: cat.id,
              label: cat.name,
              icon: cat.name.toLowerCase().includes('uniform') ? Shirt :
                    cat.name.toLowerCase().includes('id') ? IdCard :
                    cat.name.toLowerCase().includes('bus') || cat.name.toLowerCase().includes('trip') ? Bus :
                    cat.name.toLowerCase().includes('book') || cat.name.toLowerCase().includes('pad') ? BookOpen :
                    cat.name.toLowerCase().includes('admission') ? UserPlus :
                    ShoppingBag
            }))
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={selectedCategoryTab === tab.id ? "default" : "ghost"}
              onClick={() => setSelectedCategoryTab(tab.id)}
              className={cn(
                "rounded-xl gap-2 h-11 px-6 transition-all font-semibold",
                selectedCategoryTab === tab.id ? "bg-[#002147] text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <tab.icon className={cn("h-4 w-4", selectedCategoryTab === tab.id ? "text-white" : "text-slate-400")} />
              {tab.label}
            </Button>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by student name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
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
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Category-based Accessories - {academicYear}
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
                      <TableHead>Assigned Categories</TableHead>
                      <TableHead className="text-right">Total Fee</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12"><div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" /></TableCell></TableRow>
                    ) : filteredStudents.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No students found or Backend not migrated.</TableCell></TableRow>
                    ) : (
                      filteredStudents.map((student) => (
                        <TableRow key={student.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                              {student.full_name}
                          </TableCell>
                          <TableCell>
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                                {student.classes?.name}
                              </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /><span className="font-medium">{student.father_phone || 'N/A'}</span> <span className="text-[9px] uppercase font-bold tracking-widest opacity-50">(F)</span></div>
                              <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /><span className="font-medium">{student.mother_phone || 'N/A'}</span> <span className="text-[9px] uppercase font-bold tracking-widest opacity-50">(M)</span></div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {student.assignedCategories.length > 0 ? (
                                    student.assignedCategories.map(cat => (
                                        <Badge key={cat.category_id} variant={cat.pending_amount > 0 ? "outline" : "default"} className={cat.pending_amount > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : ""}>
                                            {cat.name}
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="text-xs text-slate-400 italic">No categories assigned</span>
                                )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(student.totalAssigned)}</TableCell>
                          <TableCell className="text-right"><span className="text-success font-medium">{formatCurrency(student.totalPaid)}</span></TableCell>
                          <TableCell className="text-right">
                            <span className={cn("font-semibold", student.totalPending > 0 ? "text-destructive" : "text-success")}>
                              {formatCurrency(student.totalPending)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex gap-2 justify-center">
                                <Button size="sm" variant="outline" className="border-slate-200 text-slate-600" onClick={() => openAssignDialog(student)} disabled={isStaff}>
                                    <Settings className="w-3.5 h-3.5 mr-1" /> Assign
                                </Button>
                                <Button size="sm" className="btn-oxford" onClick={() => openPaymentDialog(student)} disabled={student.totalPending <= 0 || isStaff}>
                                <IndianRupee className="mr-1 h-3.5 w-3.5" /> Pay
                                </Button>
                            </div>
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
      </div>

      {/* Dialog 1: Manage Global Categories */}
      <Dialog open={manageCategoriesDialogOpen} onOpenChange={setManageCategoriesDialogOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle className="text-xl">Accessory Categories Master</DialogTitle>
                  <DialogDescription>Define the available items like Uniforms, Field Trips, Books.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                  {/* Add New Category */}
                  <div className="flex gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex-1 space-y-1">
                          <Label className="text-xs uppercase text-slate-500 font-bold">Category Name</Label>
                          <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="e.g. Field Trip to Museum" />
                      </div>
                      <div className="w-[120px] space-y-1">
                          <Label className="text-xs uppercase text-slate-500 font-bold">Default Price</Label>
                          <Input type="number" value={newCategoryPrice} onChange={e => setNewCategoryPrice(e.target.value)} placeholder="0.00" />
                      </div>
                      <Button onClick={handleAddCategory} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-1" /> Add</Button>
                  </div>
                  
                  {/* List Existing Categories */}
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                       {categories.map((cat, i) => (
                           <div key={cat.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors">
                               <div className="flex items-center gap-3">
                                   <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">{i+1}</div>
                                   <span className="font-semibold text-slate-700">{cat.name}</span>
                               </div>
                               <Badge variant="secondary" className="font-mono">{formatCurrency(cat.default_price)}</Badge>
                           </div>
                       ))}
                       {categories.length === 0 && <p className="text-center text-sm text-slate-400 py-4">No categories configured yet.</p>}
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {/* Dialog 2: Assign Categories to Student */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle className="text-xl">Assign Categories</DialogTitle>
                  <DialogDescription>Select which fees {selectedStudentToAssign?.full_name} needs to pay.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {categories.map(cat => {
                      const isSelected = assignmentSelections[cat.id]?.selected || false;
                      const fee = assignmentSelections[cat.id]?.fee ?? cat.default_price;
                      
                      return (
                          <div key={cat.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${isSelected ? 'border-primary/50 bg-primary/5' : 'border-slate-100 bg-white'}`}>
                              <Checkbox 
                                id={`assign-${cat.id}`} 
                                checked={isSelected} 
                                onCheckedChange={(c) => setAssignmentSelections(p => ({...p, [cat.id]: { ...p[cat.id], selected: !!c }}))} 
                                className="mt-1"
                              />
                              <div className="flex-1">
                                  <Label htmlFor={`assign-${cat.id}`} className="font-semibold text-base cursor-pointer">{cat.name}</Label>
                              </div>
                              <div className="w-[120px]">
                                  <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                      <Input 
                                          type="number" 
                                          className="pl-7 h-10 font-semibold" 
                                          value={fee ?? 0} 
                                          onChange={(e) => {
                                              const val = e.target.value === '' ? 0 : Number(e.target.value);
                                              setAssignmentSelections(p => ({...p, [cat.id]: { ...p[cat.id], fee: val }}));
                                          }}
                                          disabled={!isSelected}
                                      />
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button onClick={saveAssignments} disabled={isSubmitting} className="btn-oxford">{isSubmitting ? 'Saving...' : 'Save Assignments'}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      {/* Dialog 3: Payment */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle className="text-xl">Fee Collection Form</DialogTitle>
                  <DialogDescription>Collecting for {selectedStudentForPayment?.full_name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                   <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                       <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider">Select Categories to Pay</h4>
                       {selectedStudentForPayment?.assignedCategories.filter(c => c.pending_amount > 0).map(cat => (
                           <div key={cat.category_id} className="flex items-center gap-3">
                               <Checkbox 
                                  checked={paymentSelections[cat.category_id]?.paying || false}
                                  onCheckedChange={(c) => setPaymentSelections(p => ({...p, [cat.category_id]: {...p[cat.category_id], paying: !!c}}))}
                               />
                               <span className="flex-1 text-sm font-medium">{cat.name}</span>
                               <span className="text-xs text-muted-foreground mr-2">(Pending: {formatCurrency(cat.pending_amount)})</span>
                               <div className="w-[100px] relative">
                                    <Input 
                                        type="number" 
                                        className="h-8 pl-2 text-right text-sm font-semibold" 
                                        value={paymentSelections[cat.category_id]?.amount || 0}
                                        max={cat.pending_amount}
                                        disabled={!paymentSelections[cat.category_id]?.paying}
                                        onChange={(e) => setPaymentSelections(p => ({...p, [cat.category_id]: {...p[cat.category_id], amount: Number(e.target.value)}}))}
                                    />
                               </div>
                           </div>
                       ))}
                   </div>
                   
                   <div className="flex justify-between items-center px-2 border-b pb-4">
                       <span className="text-slate-500 font-bold">Total Collection Amount</span>
                       <span className="text-2xl font-black text-primary">{formatCurrency(totalPaymentAmount)}</span>
                   </div>

                  <div className="space-y-3">
                      <Label className="text-xs uppercase font-bold tracking-widest text-slate-500">Payment Method</Label>
                      <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                        <div className="grid grid-cols-3 gap-2">
                          <Label htmlFor="pay-cash" className={cn("flex flex-col cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 hover:bg-slate-50", paymentMethod === 'cash' && "border-primary bg-primary/5 ring-1 ring-primary/20")}><RadioGroupItem value="cash" id="pay-cash" className="sr-only" /><Banknote className="h-5 w-5 text-slate-600" /><span className="text-xs font-semibold">Cash</span></Label>
                          <Label htmlFor="pay-qr" className={cn("flex flex-col cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 hover:bg-slate-50", paymentMethod === 'qr_code' && "border-primary bg-primary/5 ring-1 ring-primary/20")}><RadioGroupItem value="qr_code" id="pay-qr" className="sr-only" /><QrCode className="h-5 w-5 text-slate-600" /><span className="text-xs font-semibold">QR Code</span></Label>
                          <Label htmlFor="pay-bank" className={cn("flex flex-col cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 hover:bg-slate-50", paymentMethod === 'bank_transfer' && "border-primary bg-primary/5 ring-1 ring-primary/20")}><RadioGroupItem value="bank_transfer" id="pay-bank" className="sr-only" /><Building2 className="h-5 w-5 text-slate-600" /><span className="text-xs font-semibold">Bank</span></Label>
                        </div>
                      </RadioGroup>
                  </div>
              </div>
              <DialogFooter>
                  <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                  <Button onClick={handlePayment} disabled={isSubmitting || totalPaymentAmount <= 0} className="btn-oxford px-8">
                    {paymentMethod === 'qr_code' ? 'Proceed to QR Pay' : 'Confirm & Receipt'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

