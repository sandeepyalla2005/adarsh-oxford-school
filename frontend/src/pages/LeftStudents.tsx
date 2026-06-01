import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  IndianRupee, 
  FileText, 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  UserMinus, 
  Pencil, 
  RefreshCw, 
  Filter, 
  Calendar, 
  GraduationCap, 
  Check, 
  X, 
  Eye, 
  Layers,
  ArrowRight,
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

// Custom interfaces
interface DocumentDetails {
  reason: string;
  marksheet_issued: boolean;
  tc_issued: boolean;
  tc_number: string;
}

export default function LeftStudents() {
  const { userRole, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'tc_issued' | 'all_leaving' | 'class_10'>('tc_issued');

  // Filter States
  const [search, setSearch] = useState('');
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [classFilter, setClassFilter] = useState('all');
  const [feeStatusFilter, setFeeStatusFilter] = useState('all');
  const [leavingTypeFilter, setLeavingTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  
  // Document status tracking modal state
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState<DocumentDetails>({
    reason: '',
    marksheet_issued: false,
    tc_issued: false,
    tc_number: ''
  });
  const [isUpdatingDocs, setIsUpdatingDocs] = useState(false);

  // Fee collection modal state
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('CASH');
  const [collectRemarks, setCollectRemarks] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  // Fee editing modal state (Admin/Fee In-Charge only)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditingFee, setIsEditingFee] = useState(false);
  const [editFeeForm, setEditFeeForm] = useState({
    pending_term_fee: '',
    pending_transport_fee: '',
    pending_books_fee: '',
    old_due: ''
  });

  // Query to fetch all records (we do filtering client-side for maximum speed and accuracy)
  const { data: rawLeftStudents = [], isLoading, refetch } = useQuery({
    queryKey: ['left-students-all'],
    queryFn: async () => {
      const resp = await apiFetch('/api/left-students?status=all');
      if (!resp.ok) throw new Error('Failed to fetch left students');
      const data = await resp.json();
      return data.data || [];
    },
    refetchOnWindowFocus: false,
    refetchInterval: 10000,
  });

  // Zero-migration JSON parse helper
  const parseRecord = (record: any) => {
    let reasonText = record.leaving_reason || '';
    let marksheetIssued = false;
    let tcIssued = record.leaving_status === 'tc_issued';
    let tcNumber = record.leaving_status === 'tc_issued' ? `TC-${record.id.slice(0, 6).toUpperCase()}` : '';

    if (record.leaving_reason && record.leaving_reason.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(record.leaving_reason);
        reasonText = parsed.reason || '';
        marksheetIssued = !!parsed.marksheet_issued;
        tcIssued = !!parsed.tc_issued;
        tcNumber = parsed.tc_number || '';
      } catch (e) {
        // Fallback
      }
    }

    const pending = parseFloat(record.total_pending_amount || 0);
    const recovered = parseFloat(record.recovered_amount || 0);
    const currentDue = Math.max(0, pending - recovered);

    // Derive calculated fee status
    let derivedFeeStatus: 'CLEARED' | 'PARTIAL' | 'PENDING' = 'PENDING';
    if (currentDue <= 0) {
      derivedFeeStatus = 'CLEARED';
    } else if (recovered > 0) {
      derivedFeeStatus = 'PARTIAL';
    }

    return {
      ...record,
      reasonText,
      marksheetIssued,
      tcIssued,
      tcNumber,
      currentDue,
      derivedFeeStatus
    };
  };

  const parsedStudents = rawLeftStudents.map(parseRecord);

  // Tab division filtering logic
  const getTabFilteredStudents = () => {
    return parsedStudents.filter((student: any) => {
      // 1. Tab Level Filters
      if (activeTab === 'tc_issued') {
        // T.C Issued Tab shows any student with a T.C. issued, regardless of fee status.
        return student.tcIssued === true;
      }
      
      if (activeTab === 'all_leaving') {
        // All Leaving Tab shows dropouts and left students (excluding Class 10 completed) who have pending dues > 0.
        // Dues fully cleared students are NOT shown here.
        return student.leaving_status !== 'completed_10th' && student.currentDue > 0;
      }

      if (activeTab === 'class_10') {
        // Class 10 Completed Tab shows all Class 10 graduates regardless of fee status.
        return student.leaving_status === 'completed_10th';
      }

      return true;
    });
  };

  // Advanced Filters logic applied on top of tab filtered list
  const getFullyFilteredStudents = () => {
    const tabFiltered = getTabFilteredStudents();

    return tabFiltered.filter((student: any) => {
      const studentDetails = student.students || {};
      const className = studentDetails.classes?.name || '';
      const fullName = (studentDetails.full_name || '').toLowerCase();
      const admNum = (studentDetails.admission_number || '').toLowerCase();

      // Search by Name or Admission Number
      if (search) {
        const query = search.toLowerCase();
        if (!fullName.includes(query) && !admNum.includes(query)) return false;
      }

      // Class Filter
      if (classFilter !== 'all') {
        if (className.toLowerCase() !== classFilter.toLowerCase()) return false;
      }

      // Fee Status Filter
      if (feeStatusFilter !== 'all') {
        if (student.derivedFeeStatus.toLowerCase() !== feeStatusFilter.toLowerCase()) return false;
      }

      // Leaving Type Filter
      if (leavingTypeFilter !== 'all') {
        if (student.leaving_status.toLowerCase() !== leavingTypeFilter.toLowerCase()) return false;
      }

      // Academic Year Filter
      if (academicYear && academicYear !== 'all') {
        // If the record does not have academic year info, we skip check or match against student metadata
        // For safe measure, we can compare if academic year is defined
      }

      // Date Range Filter
      if (startDate) {
        const leaveDate = new Date(student.leaving_date);
        const start = new Date(startDate);
        if (leaveDate < start) return false;
      }
      if (endDate) {
        const leaveDate = new Date(student.leaving_date);
        const end = new Date(endDate);
        // Make end date inclusive of the day
        end.setHours(23, 59, 59, 999);
        if (leaveDate > end) return false;
      }

      return true;
    });
  };

  const finalFilteredStudents = getFullyFilteredStudents();

  // Summary Cards Calculations
  const getSummaryStats = () => {
    if (activeTab === 'tc_issued') {
      const tcList = parsedStudents.filter((s: any) => s.tcIssued === true);
      const cleared = tcList.filter((s: any) => s.currentDue <= 0).length;
      const pending = tcList.filter((s: any) => s.currentDue > 0).length;
      return {
        card1: { title: 'Total T.C. Issued', val: tcList.length, color: 'text-blue-600 bg-blue-50', desc: 'Active Transfer Certificates' },
        card2: { title: 'Cleared Fee Students', val: cleared, color: 'text-emerald-600 bg-emerald-50', desc: 'No Outstanding Dues' },
        card3: { title: 'Pending Fee Students', val: pending, color: 'text-rose-600 bg-rose-50', desc: 'Outstanding Recoveries' }
      };
    }

    if (activeTab === 'all_leaving') {
      const leavingList = parsedStudents.filter((s: any) => s.leaving_status !== 'completed_10th' && s.currentDue > 0);
      const totalPendingDues = leavingList.reduce((sum: number, s: any) => sum + s.currentDue, 0);
      const pendingRecovery = leavingList.filter((s: any) => s.derivedFeeStatus === 'PENDING').length;
      const totalRecovered = leavingList.reduce((sum: number, s: any) => sum + s.recovered_amount, 0);

      return {
        card1: { title: 'Total Leaving Students', val: leavingList.length, color: 'text-amber-600 bg-amber-50', desc: 'With outstanding recoveries' },
        card2: { title: 'Total Pending Dues', val: `₹${totalPendingDues.toLocaleString('en-IN')}`, color: 'text-rose-600 bg-rose-50', desc: 'Awaiting fee collection' },
        card3: { title: 'Pending Recovery Cases', val: pendingRecovery, color: 'text-blue-600 bg-blue-50', desc: 'No recovery payment made' },
        card4: { title: 'Recovered Amount', val: `₹${totalRecovered.toLocaleString('en-IN')}`, color: 'text-emerald-600 bg-emerald-50', desc: 'Recovered so far' }
      };
    }

    // Default to 'class_10'
    const class10List = parsedStudents.filter((s: any) => s.leaving_status === 'completed_10th');
    const marksheetCount = class10List.filter((s: any) => s.marksheetIssued === true).length;
    const tcCount = class10List.filter((s: any) => s.tcIssued === true).length;
    const pendingDocs = class10List.filter((s: any) => !s.marksheetIssued || !s.tcIssued).length;

    return {
      card1: { title: 'Total Class 10 Students', val: class10List.length, color: 'text-indigo-600 bg-indigo-50', desc: 'Graduated Batch' },
      card2: { title: 'Mark Sheets Issued', val: marksheetCount, color: 'text-emerald-600 bg-emerald-50', desc: 'Handed over to students' },
      card3: { title: 'T.C. Issued', val: tcCount, color: 'text-blue-600 bg-blue-50', desc: 'Transfer Certificates given' },
      card4: { title: 'Pending Documents', val: pendingDocs, color: 'text-amber-600 bg-amber-50', desc: 'Outstanding issuance' }
    };
  };

  const stats = getSummaryStats();

  // Document issuance and details handlers
  const openDocModal = (record: any) => {
    setSelectedRecord(record);
    setDocForm({
      reason: record.reasonText || '',
      marksheet_issued: record.marksheetIssued || false,
      tc_issued: record.tcIssued || false,
      tc_number: record.tcNumber || ''
    });
    setIsDocModalOpen(true);
  };

  const handleUpdateDocuments = async () => {
    if (!selectedRecord) return;
    setIsUpdatingDocs(true);

    try {
      const structuredReason = JSON.stringify({
        reason: docForm.reason,
        marksheet_issued: docForm.marksheet_issued,
        tc_issued: docForm.tc_issued,
        tc_number: docForm.tc_issued ? docForm.tc_number : ''
      });

      // Update both database fields: leaving_reason and leaving_status (if T.C. is marked as issued)
      const derivedLeavingStatus = docForm.tc_issued ? 'tc_issued' : selectedRecord.leaving_status;

      const resp = await apiFetch('/api/left-students/update-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: selectedRecord.id,
          leaving_reason: structuredReason,
          leaving_status: derivedLeavingStatus
        })
      });

      if (!resp.ok) {
        const error = await resp.json();
        throw new Error(error.detail || 'Failed to update documents');
      }

      toast({ title: '🎉 Record Updated', description: 'Student leaving details and document status saved.' });
      setIsDocModalOpen(false);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setIsUpdatingDocs(false);
    }
  };

  // Fee collection handler
  const openCollectModal = (record: any) => {
    setSelectedRecord(record);
    setCollectAmount(record.currentDue.toString());
    setIsCollectModalOpen(true);
  };

  const handleCollect = async () => {
    if (!selectedRecord) return;
    const amount = parseFloat(collectAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount greater than 0.' });
      return;
    }

    if (amount > selectedRecord.currentDue) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: `Amount cannot exceed the pending balance of ₹${selectedRecord.currentDue.toLocaleString('en-IN')}` });
      return;
    }

    if (collectMethod === 'QR_CODE') {
      setIsCollectModalOpen(false);
      navigate('/payment-gateway', {
        state: {
          studentId: selectedRecord.students?.id,
          studentName: selectedRecord.students?.full_name,
          className: selectedRecord.students?.classes?.name || 'N/A',
          amount: amount,
          paymentType: 'left_student',
          academicYear: getCurrentAcademicYear(),
          leftRecordId: selectedRecord.id
        }
      });
      return;
    }

    setIsCollecting(true);
    try {
      const resp = await apiFetch('/api/left-students/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: selectedRecord.id,
          amount,
          method: collectMethod,
          remarks: collectRemarks
        })
      });

      if (!resp.ok) {
        const error = await resp.json();
        throw new Error(error.detail || 'Collection failed');
      }

      const result = await resp.json();
      toast({ title: '✅ Payment Collected', description: `Receipt Number: ${result.receipt_number}` });
      setIsCollectModalOpen(false);
      
      setCollectAmount('');
      setCollectRemarks('');
      refetch();

      if (result.receipt_number) {
        navigate(`/receipt?receiptNo=${encodeURIComponent(result.receipt_number)}&type=left_student`);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Collection Failed', description: err.message });
    } finally {
      setIsCollecting(false);
    }
  };

  // Fee editing handlers (Admin only)
  const openEditModal = (record: any) => {
    setSelectedRecord(record);
    setEditFeeForm({
      pending_term_fee: record.pending_term_fee || '0',
      pending_transport_fee: record.pending_transport_fee || '0',
      pending_books_fee: record.pending_books_fee || '0',
      old_due: record.old_due || '0'
    });
    setIsEditModalOpen(true);
  };

  const handleEditFee = async () => {
    if (!selectedRecord) return;
    setIsEditingFee(true);
    try {
      const resp = await apiFetch('/api/left-students/edit-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: selectedRecord.id,
          pending_term_fee: parseFloat(editFeeForm.pending_term_fee) || 0,
          pending_transport_fee: parseFloat(editFeeForm.pending_transport_fee) || 0,
          pending_books_fee: parseFloat(editFeeForm.pending_books_fee) || 0,
          old_due: parseFloat(editFeeForm.old_due) || 0
        })
      });

      if (!resp.ok) {
        const error = await resp.json();
        throw new Error(error.detail || 'Failed to update fee');
      }

      toast({ title: 'Success', description: 'Outstanding fee details updated successfully' });
      setIsEditModalOpen(false);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setIsEditingFee(false);
    }
  };

  // Helper colors mapping
  const getFeeStatusColor = (status: 'CLEARED' | 'PARTIAL' | 'PENDING') => {
    switch (status) {
      case 'CLEARED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'PARTIAL': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'PENDING': return 'bg-rose-100 text-rose-700 border-rose-200';
    }
  };

  const getDocStatusBadge = (issued: boolean) => {
    return issued ? (
      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit rounded-full px-2 py-0.5">
        <Check className="h-3 w-3" /> Issued
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 flex items-center gap-1 w-fit rounded-full px-2 py-0.5">
        <X className="h-3 w-3" /> Not Issued
      </Badge>
    );
  };

  const handleDownloadPlaceholder = (docName: string, studentName: string) => {
    toast({
      title: '📥 Download Started',
      description: `Downloading ${docName} for ${studentName} (ERP template).`
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 bg-[#F8FAFC] min-h-screen -m-6 p-6">
        
        {/* Module Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#002147] font-display flex items-center gap-3">
              <UserMinus className="h-9 w-9 text-blue-600" />
              Left Students & TC Management
            </h1>
            <p className="text-slate-500 mt-2 text-sm max-w-2xl">
              Track Transfer Certificates (T.C.), manage Mark Sheets, and follow up on outstanding fee recoveries in a secure school ERP environment.
            </p>
          </div>
          
          <div className="flex items-center gap-3 self-end">
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="rounded-xl border-slate-200 bg-white h-11 px-4 flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-semibold shadow-sm"
              title="Sync Latest Data"
            >
              <RefreshCw className={`h-4 w-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </Button>
          </div>
        </div>

        {/* Dashboard Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatePresence mode="wait">
            {Object.entries(stats).map(([key, stat]: [string, any]) => (
              <motion.div
                key={`${activeTab}-${key}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs uppercase font-extrabold tracking-wider text-slate-400">{stat.title}</p>
                    <p className="text-2xl font-black text-slate-800 mt-2">{stat.val}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    {key === 'card1' && <UserMinus className="h-5 w-5" />}
                    {key === 'card2' && <CheckCircle className="h-5 w-5" />}
                    {key === 'card3' && <AlertTriangle className="h-5 w-5" />}
                    {key === 'card4' && <TrendingUp className="h-5 w-5" />}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3 font-medium">{stat.desc}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Modular Top Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-1 bg-white p-1 rounded-2xl border w-fit shadow-sm">
          {[
            { id: 'tc_issued', label: 'T.C. Issued Students', icon: FileCheck },
            { id: 'all_leaving', label: 'All Leaving Students', icon: UserMinus },
            { id: 'class_10', label: 'Class 10 Completed', icon: GraduationCap }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearch(''); // clear search when switching tabs
                }}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
                  isSelected 
                    ? 'bg-[#002147] text-white shadow-md' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Advanced Filters Panel */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Filter className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm">Advanced Search & Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search name / adm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl border-slate-200 bg-[#F8FAFC] text-slate-800 focus:bg-white text-xs font-semibold"
              />
            </div>

            {/* Academic Year Selector */}
            <div>
              <Select value={academicYear} onValueChange={setAcademicYear}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-700">
                  <SelectValue placeholder="Academic Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2025-2026">2025-2026</SelectItem>
                  <SelectItem value="2024-2025">2024-2025</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Class Selector */}
            <div>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-700">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'].map(cls => (
                    <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Leaving Type Selector */}
            <div>
              <Select value={leavingTypeFilter} onValueChange={setLeavingTypeFilter}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-700">
                  <SelectValue placeholder="Leaving Reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leaving Types</SelectItem>
                  <SelectItem value="dropout">Dropout</SelectItem>
                  <SelectItem value="tc_issued">TC Issued</SelectItem>
                  <SelectItem value="completed_10th">Completed Class 10</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fee Status Selector */}
            <div>
              <Select value={feeStatusFilter} onValueChange={setFeeStatusFilter}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-700">
                  <SelectValue placeholder="Fee Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fee Status</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Picker Controls */}
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded-xl border-slate-200 bg-[#F8FAFC] text-[10px] font-semibold p-2"
                title="Start Date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded-xl border-slate-200 bg-[#F8FAFC] text-[10px] font-semibold p-2"
                title="End Date"
              />
            </div>

          </div>
        </div>

        {/* Compact ERP Data Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#002147] text-white font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Student Details</th>
                  
                  {activeTab === 'tc_issued' && (
                    <>
                      <th className="px-6 py-4">Leaving Date</th>
                      <th className="px-6 py-4">T.C. Number</th>
                      <th className="px-6 py-4">Fee Status</th>
                      <th className="px-6 py-4 text-right">Pending Amount</th>
                      <th className="px-6 py-4 text-center">T.C. Document</th>
                    </>
                  )}

                  {activeTab === 'all_leaving' && (
                    <>
                      <th className="px-6 py-4">Leaving Reason</th>
                      <th className="px-6 py-4">Leaving Date</th>
                      <th className="px-6 py-4 text-right">Total Due</th>
                      <th className="px-6 py-4 text-right">Amount Paid</th>
                      <th className="px-6 py-4 text-right">Balance Due</th>
                      <th className="px-6 py-4">Recovery Status</th>
                    </>
                  )}

                  {activeTab === 'class_10' && (
                    <>
                      <th className="px-6 py-4">Completion Date</th>
                      <th className="px-6 py-4">Fee Status</th>
                      <th className="px-6 py-4 text-right">Pending Amount</th>
                      <th className="px-6 py-4">Mark Sheet Status</th>
                      <th className="px-6 py-4">T.C. Status</th>
                      <th className="px-6 py-4 text-center">Downloads</th>
                    </>
                  )}

                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-bold">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                      Loading records from ERP database...
                    </td>
                  </tr>
                ) : finalFilteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                        <p className="text-sm font-black text-slate-800">No Records Found</p>
                        <p className="text-xs text-slate-400">All left students are accounted for or none match your current filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  finalFilteredStudents.map((record: any) => {
                    const studentDetails = record.students || {};
                    const isCleared = record.currentDue <= 0;
                    
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                        
                        {/* Student Column (Constant) */}
                        <td className="px-6 py-4">
                          <div className="font-extrabold text-slate-800 text-sm">{studentDetails.full_name}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-0.5">Adm No: {studentDetails.admission_number}</div>
                          <div className="text-[10px] font-bold text-slate-500">Class: {studentDetails.classes?.name || 'N/A'}</div>
                        </td>

                        {/* Tab Specific Columns */}
                        
                        {/* 1. TC Issued Tab */}
                        {activeTab === 'tc_issued' && (
                          <>
                            <td className="px-6 py-4 text-slate-600 font-bold">
                              {new Date(record.leaving_date).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-blue-700">
                              {record.tcNumber || 'N/A'}
                            </td>
                            <td className="px-6 py-4">
                              <Badge className={`rounded-full px-2.5 py-0.5 text-[10px] ${getFeeStatusColor(record.derivedFeeStatus)}`}>
                                {record.derivedFeeStatus}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-700 font-bold">
                              ₹{record.currentDue.toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDownloadPlaceholder('Transfer Certificate', studentDetails.full_name)}
                                className="h-8 rounded-lg text-[10px] font-bold border-slate-200 text-slate-600 hover:text-blue-600 px-3 flex gap-1.5 mx-auto"
                              >
                                <Download className="h-3 w-3" /> Download
                              </Button>
                            </td>
                          </>
                        )}

                        {/* 2. All Leaving Students Tab */}
                        {activeTab === 'all_leaving' && (
                          <>
                            <td className="px-6 py-4 text-slate-700">
                              <span className="capitalize font-bold">{record.leaving_status.replace('_', ' ')}</span>
                              {record.reasonText && <div className="text-[10px] text-slate-400 font-bold italic mt-0.5">"{record.reasonText}"</div>}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {new Date(record.leaving_date).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-700">
                              ₹{(parseFloat(record.total_pending_amount) || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-right text-emerald-600">
                              ₹{(parseFloat(record.recovered_amount) || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-right text-rose-600 font-black">
                              ₹{record.currentDue.toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4">
                              <Badge className={`rounded-full px-2.5 py-0.5 text-[10px] ${getFeeStatusColor(record.derivedFeeStatus)}`}>
                                {record.derivedFeeStatus}
                              </Badge>
                            </td>
                          </>
                        )}

                        {/* 3. Class 10 Completed Tab */}
                        {activeTab === 'class_10' && (
                          <>
                            <td className="px-6 py-4 text-slate-600">
                              {new Date(record.leaving_date).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-6 py-4">
                              <Badge className={`rounded-full px-2.5 py-0.5 text-[10px] ${getFeeStatusColor(record.derivedFeeStatus)}`}>
                                {record.derivedFeeStatus}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-700 font-black">
                              ₹{record.currentDue.toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4">
                              {getDocStatusBadge(record.marksheetIssued)}
                            </td>
                            <td className="px-6 py-4">
                              {getDocStatusBadge(record.tcIssued)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1 items-center">
                                <button 
                                  onClick={() => handleDownloadPlaceholder('10th Mark Sheet', studentDetails.full_name)}
                                  disabled={!record.marksheetIssued}
                                  className="text-[10px] font-extrabold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed hover:underline flex items-center gap-1"
                                >
                                  <Download className="h-2.5 w-2.5" /> Marksheet
                                </button>
                                <button 
                                  onClick={() => handleDownloadPlaceholder('Class 10 T.C.', studentDetails.full_name)}
                                  disabled={!record.tcIssued}
                                  className="text-[10px] font-extrabold text-emerald-600 disabled:text-slate-300 disabled:cursor-not-allowed hover:underline flex items-center gap-1"
                                >
                                  <Download className="h-2.5 w-2.5" /> T.C.
                                </button>
                              </div>
                            </td>
                          </>
                        )}

                        {/* Actions (Common to all tabs) */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            
                            {/* Document Tracking Action */}
                            <Button
                              onClick={() => openDocModal(record)}
                              size="sm"
                              variant="outline"
                              className="rounded-lg h-8 border-slate-200 bg-white text-slate-600 hover:text-blue-600 px-2.5"
                              title="Update Document & Leaving Status"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* Collect Dues Action (Active if balance > 0) */}
                            <Button
                              onClick={() => openCollectModal(record)}
                              disabled={isCleared}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-8 px-3 font-bold disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <IndianRupee className="h-3.5 w-3.5 mr-1" />
                              Collect
                            </Button>

                            {/* Edit outstanding balance action (Admin/feeInCharge only) */}
                            {(isAdmin || userRole === 'feeInCharge') && (
                              <Button
                                onClick={() => openEditModal(record)}
                                size="sm"
                                variant="outline"
                                className="rounded-lg h-8 border-slate-200 text-slate-600 hover:text-indigo-600 px-2.5"
                                title="Edit Fee Balance Breakdown"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}

                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 1. Document & Status Management Modal */}
      <Dialog open={isDocModalOpen} onOpenChange={setIsDocModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 rounded-2xl shadow-2xl">
          <div className="bg-gradient-to-r from-blue-700 to-[#002147] p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6 opacity-80" />
                Document & Status Tracker
              </DialogTitle>
              <DialogDescription className="text-blue-100 text-xs">
                Track and update Transfer Certificates, Marksheets, and leaving reasons.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-5 bg-white text-xs">
            {selectedRecord && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Student Name:</span>
                  <span className="font-extrabold text-slate-800 text-right">{selectedRecord.students?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Admission No:</span>
                  <span className="font-bold text-slate-700">{selectedRecord.students?.admission_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Current Balance:</span>
                  <span className="font-black text-rose-600">₹{selectedRecord.currentDue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              
              {/* Document Toggles */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-2">
                  <label className="font-extrabold text-slate-600 block">Mark Sheet Status</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="doc-marksheet"
                      checked={docForm.marksheet_issued}
                      onChange={(e) => setDocForm({ ...docForm, marksheet_issued: e.target.checked })}
                      className="h-4 w-4 text-blue-600 border-slate-300 rounded"
                    />
                    <label htmlFor="doc-marksheet" className="font-bold text-slate-700 cursor-pointer">
                      Mark as Issued
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-extrabold text-slate-600 block">T.C. Issued Status</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="doc-tc"
                      checked={docForm.tc_issued}
                      onChange={(e) => setDocForm({ ...docForm, tc_issued: e.target.checked })}
                      className="h-4 w-4 text-emerald-600 border-slate-300 rounded"
                    />
                    <label htmlFor="doc-tc" className="font-bold text-slate-700 cursor-pointer">
                      Mark as Issued
                    </label>
                  </div>
                </div>
              </div>

              {/* T.C. Number (Visible only if T.C is checked) */}
              {docForm.tc_issued && (
                <div className="space-y-2">
                  <label className="font-extrabold text-slate-700">Transfer Certificate (T.C.) Number</label>
                  <Input
                    value={docForm.tc_number}
                    onChange={(e) => setDocForm({ ...docForm, tc_number: e.target.value })}
                    placeholder="Enter TC Number (e.g. TC/1004)"
                    className="h-10 rounded-xl"
                  />
                </div>
              )}

              {/* Leaving Reason (Stored safely in metadata JSON) */}
              <div className="space-y-2">
                <label className="font-extrabold text-slate-700">Official Leaving Remarks / Reason</label>
                <Input
                  value={docForm.reason}
                  onChange={(e) => setDocForm({ ...docForm, reason: e.target.value })}
                  placeholder="Specify official reasons or notes..."
                  className="h-10 rounded-xl"
                />
              </div>

            </div>
          </div>
          
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 sm:justify-end">
            <Button variant="outline" onClick={() => setIsDocModalOpen(false)} className="rounded-xl px-5 text-xs font-bold">
              Cancel
            </Button>
            <Button onClick={handleUpdateDocuments} disabled={isUpdatingDocs} className="bg-[#002147] hover:bg-[#002147]/90 text-white rounded-xl px-7 font-bold shadow-md">
              {isUpdatingDocs ? 'Updating...' : 'Save Document Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Fee Collection Modal */}
      <Dialog open={isCollectModalOpen} onOpenChange={setIsCollectModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 rounded-2xl shadow-2xl">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <IndianRupee className="h-6 w-6 opacity-80" />
                Collect Recovery Dues
              </DialogTitle>
              <DialogDescription className="text-emerald-50 text-xs">
                Record a recovery payment directly into the ERP accounting ledger.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-5 bg-white text-xs">
            {selectedRecord && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-slate-400">Student</div>
                  <div className="font-black text-slate-800 text-sm">{selectedRecord.students?.full_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-400">Outstanding Due</div>
                  <div className="font-black text-rose-600 text-base">
                    ₹{selectedRecord.currentDue.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-extrabold text-slate-700">Amount Paying (₹)</label>
                <Input
                  type="number"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="h-11 text-lg font-black text-slate-800"
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <label className="font-extrabold text-slate-700">Payment Method</label>
                <Select value={collectMethod} onValueChange={setCollectMethod}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="QR_CODE">Scanner (QR Code)</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="font-extrabold text-slate-700">Remarks (Optional)</label>
                <Input
                  value={collectRemarks}
                  onChange={(e) => setCollectRemarks(e.target.value)}
                  placeholder="E.g. Transaction ID, remarks..."
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 sm:justify-end">
            <Button variant="outline" onClick={() => setIsCollectModalOpen(false)} className="rounded-xl px-5 text-xs font-bold">
              Cancel
            </Button>
            <Button onClick={handleCollect} disabled={isCollecting} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-7 font-bold shadow-md">
              {isCollecting ? 'Processing...' : 'Confirm Collection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Edit Fee Balance Breakdown Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 rounded-2xl shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <Pencil className="h-6 w-6 opacity-80" />
                Edit Recovery Fee Structure
              </DialogTitle>
              <DialogDescription className="text-indigo-50 text-xs">
                Modify the actual outstanding balance details for the student.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-4 bg-white text-xs">
            <div className="space-y-2">
              <label className="font-extrabold text-slate-700">Pending Term Fee (₹)</label>
              <Input
                type="number"
                value={editFeeForm.pending_term_fee}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, pending_term_fee: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="font-extrabold text-slate-700">Pending Transport Fee (₹)</label>
              <Input
                type="number"
                value={editFeeForm.pending_transport_fee}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, pending_transport_fee: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="font-extrabold text-slate-700">Pending Books Fee (₹)</label>
              <Input
                type="number"
                value={editFeeForm.pending_books_fee}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, pending_books_fee: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="font-extrabold text-slate-700">Old Outstanding Dues (₹)</label>
              <Input
                type="number"
                value={editFeeForm.old_due}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, old_due: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-sm font-black">
              <span className="text-slate-600">Calculated New Total Dues:</span>
              <span className="text-indigo-600 text-base">
                ₹{(
                  (parseFloat(editFeeForm.pending_term_fee) || 0) +
                  (parseFloat(editFeeForm.pending_transport_fee) || 0) +
                  (parseFloat(editFeeForm.pending_books_fee) || 0) +
                  (parseFloat(editFeeForm.old_due) || 0)
                ).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 sm:justify-end">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl px-5 text-xs font-bold">
              Cancel
            </Button>
            <Button onClick={handleEditFee} disabled={isEditingFee} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-7 font-bold shadow-md">
              {isEditingFee ? 'Saving...' : 'Confirm Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
