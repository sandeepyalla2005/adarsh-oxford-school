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
  FileCheck,
  TrendingUp,
  Printer,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, buildApiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

// Custom interfaces
interface DocumentDetails {
  reason: string;
  marksheet_status: string; // 'Pending', 'Generated', 'Printed', 'Issued'
  marksheet_remarks: string;
  tc_status: string; // 'Pending', 'Approved', 'Issued', 'Cancelled'
  tc_number: string;
  tc_remarks: string;
  tc_requested_date: string;
}

export default function LeftStudents() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'tc_issued' | 'all_leaving' | 'class_10'>('all_leaving');

  // Advanced Filters States
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [leavingTypeFilter, setLeavingTypeFilter] = useState('all');
  const [tcStatusFilter, setTcStatusFilter] = useState('all');
  const [feeStatusFilter, setFeeStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  
  // Document status & leaving details modal state
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState<DocumentDetails>({
    reason: '',
    marksheet_status: 'Pending',
    marksheet_remarks: '',
    tc_status: 'Pending',
    tc_number: '',
    tc_remarks: '',
    tc_requested_date: ''
  });
  const [leavingTypeForm, setLeavingTypeForm] = useState('dropout');
  const [isUpdatingDocs, setIsUpdatingDocs] = useState(false);

  // Clearance Certificate State
  const [clearanceCert, setClearanceCert] = useState<any>(null);
  const [isClearanceModalOpen, setIsClearanceModalOpen] = useState(false);
  const [isGeneratingClearance, setIsGeneratingClearance] = useState(false);

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
    old_due: '',
    pending_accessories_fee: '',
    pending_fine_fee: '',
    pending_misc_fee: ''
  });

  // Query to fetch all records
  const { data: rawLeftStudents = [], isLoading, refetch } = useQuery({
    queryKey: ['left-students-all-register-tabbed'],
    queryFn: async () => {
      const resp = await apiFetch('/api/left-students?status=all');
      if (!resp.ok) throw new Error('Failed to fetch left students');
      const data = await resp.json();
      return data.data || [];
    },
    refetchOnWindowFocus: false,
    refetchInterval: 10000,
  });

  const getAcademicYearFromDate = (dateStr: string) => {
    if (!dateStr) return '2025-26';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    if (month >= 3) { // April or later (school starts in April usually)
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  };

  const getTcStatusBadge = (status: string) => {
    switch (status) {
      case 'Issued':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            TC Issued
          </Badge>
        );
      case 'Approved':
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            TC Approved
          </Badge>
        );
      case 'Cancelled':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            TC Cancelled
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            TC Pending
          </Badge>
        );
    }
  };

  const getMarksheetStatusBadge = (status: string) => {
    switch (status) {
      case 'Issued':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            Marksheet Issued
          </Badge>
        );
      case 'Printed':
        return (
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            Printed
          </Badge>
        );
      case 'Generated':
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            Generated
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            Pending
          </Badge>
        );
    }
  };

  const parseRecord = (record: any) => {
    const pending_term = parseFloat(record.pending_term_fee || 0);
    const pending_transport = parseFloat(record.pending_transport_fee || 0);
    const pending_books = parseFloat(record.pending_books_fee || 0);
    const old_due = parseFloat(record.old_due || 0);
    const pending_acc = parseFloat(record.pending_accessories_fee || 0);
    const pending_fine = parseFloat(record.pending_fine_fee || 0);
    const pending_misc = parseFloat(record.pending_misc_fee || 0);

    const total_pending = pending_term + pending_transport + pending_books + old_due + pending_acc + pending_fine + pending_misc;
    const recovered = parseFloat(record.recovered_amount || 0);
    const currentDue = Math.max(0, total_pending - recovered);

    let derivedFeeStatus: 'CLEARED' | 'PARTIAL' | 'PENDING' = 'PENDING';
    if (currentDue <= 0.001) {
      derivedFeeStatus = 'CLEARED';
    } else if (recovered > 0) {
      derivedFeeStatus = 'PARTIAL';
    }

    let leavingTypeDisplay = 'Dropout';
    const statusLower = record.leaving_status.toLowerCase();
    if (statusLower === 'completed_10th') {
      leavingTypeDisplay = 'Class 10 Completed';
    } else if (statusLower === 'transfer' || statusLower === 'tc_issued') {
      leavingTypeDisplay = 'Transfer';
    } else if (statusLower === 'migration') {
      leavingTypeDisplay = 'Migration';
    } else if (statusLower === 'discontinued') {
      leavingTypeDisplay = 'Discontinued';
    }

    return {
      ...record,
      tc_status: record.tc_status || (record.leaving_status === 'tc_issued' ? 'Issued' : 'Pending'),
      marksheet_status: record.marksheet_status || 'Pending',
      currentDue,
      derivedFeeStatus,
      leavingTypeDisplay
    };
  };

  const parsedStudents = rawLeftStudents.map(parseRecord);

  // Tab division filtering logic
  const getTabFilteredStudents = () => {
    return parsedStudents.filter((student: any) => {
      if (activeTab === 'tc_issued') {
        return student.tc_status === 'Issued';
      }
      
      if (activeTab === 'all_leaving') {
        return student.currentDue > 0;
      }

      if (activeTab === 'class_10') {
        const className = student.students?.classes?.name || '';
        const isClass10 = className.toLowerCase().includes('class 10') || className.toLowerCase().includes('10th') || className.toLowerCase().includes('class x');
        return student.leaving_status === 'completed_10th' && isClass10;
      }

      return true;
    });
  };

  const getFullyFilteredStudents = () => {
    const tabFiltered = getTabFilteredStudents();

    return tabFiltered.filter((student: any) => {
      const studentDetails = student.students || {};
      const className = studentDetails.classes?.name || '';
      const fullName = (studentDetails.full_name || '').toLowerCase();
      const admNum = (studentDetails.admission_number || '').toLowerCase();

      // Search by Student Name or Admission Number
      if (search) {
        const query = search.toLowerCase();
        if (!fullName.includes(query) && !admNum.includes(query)) return false;
      }

      // Class Filter
      if (classFilter !== 'all') {
        if (className.toLowerCase() !== classFilter.toLowerCase()) return false;
      }

      // Leaving Type Filter
      if (leavingTypeFilter !== 'all') {
        if (student.leavingTypeDisplay.toLowerCase() !== leavingTypeFilter.toLowerCase()) return false;
      }

      // T.C. Status Filter
      if (tcStatusFilter !== 'all') {
        if (student.tc_status.toLowerCase() !== tcStatusFilter.toLowerCase()) return false;
      }

      // Fee Status Filter
      if (feeStatusFilter !== 'all') {
        if (student.derivedFeeStatus.toLowerCase() !== feeStatusFilter.toLowerCase()) return false;
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
        end.setHours(23, 59, 59, 999);
        if (leaveDate > end) return false;
      }

      return true;
    });
  };

  const finalFilteredStudents = getFullyFilteredStudents();

  // Summary Cards Calculations tailored to each active tab
  const getSummaryStats = () => {
    if (activeTab === 'tc_issued') {
      const tcList = parsedStudents.filter((s: any) => s.tc_status === 'Issued');
      const cleared = tcList.filter((s: any) => s.currentDue <= 0.001).length;
      const pending = tcList.filter((s: any) => s.currentDue > 0.001).length;
      return {
        card1: { title: 'Total T.C. Issued', val: tcList.length, color: 'text-blue-600 bg-blue-50', desc: 'Transfer Certificates given' },
        card2: { title: 'Cleared Fee Students', val: cleared, color: 'text-emerald-600 bg-emerald-50', desc: 'No Outstanding Dues' },
        card3: { title: 'Pending Fee Students', val: pending, color: 'text-rose-600 bg-rose-50', desc: 'Outstanding Recoveries' }
      };
    }

    if (activeTab === 'all_leaving') {
      const leavingList = parsedStudents.filter((s: any) => s.currentDue > 0.001);
      const totalPendingDues = leavingList.reduce((sum: number, s: any) => sum + s.currentDue, 0);
      const pendingRecovery = leavingList.length;
      const totalRecovered = parsedStudents.reduce((sum: number, s: any) => sum + s.recovered_amount, 0);

      return {
        card1: { title: 'Total Leaving Students', val: leavingList.length, color: 'text-amber-600 bg-amber-50', desc: 'Count of students having pending dues only' },
        card2: { title: 'Total Pending Dues', val: `₹${totalPendingDues.toLocaleString('en-IN')}`, color: 'text-rose-600 bg-rose-50', desc: 'Sum of all outstanding balances' },
        card3: { title: 'Pending Recovery Cases', val: pendingRecovery, color: 'text-blue-600 bg-blue-50', desc: 'Students with balance amount greater than zero' },
        card4: { title: 'Recovered Amount', val: `₹${totalRecovered.toLocaleString('en-IN')}`, color: 'text-emerald-600 bg-emerald-50', desc: 'Total amount recovered from leaving students' }
      };
    }

    const class10List = parsedStudents.filter((s: any) => {
      const className = s.students?.classes?.name || '';
      const isClass10 = className.toLowerCase().includes('class 10') || className.toLowerCase().includes('10th') || className.toLowerCase().includes('class x');
      return s.leaving_status === 'completed_10th' && isClass10;
    });
    const marksheetCount = class10List.filter((s: any) => s.marksheet_status === 'Issued').length;
    const tcCount = class10List.filter((s: any) => s.tc_status === 'Issued').length;
    const pendingDocs = class10List.filter((s: any) => s.tc_status !== 'Issued' || s.marksheet_status !== 'Issued').length;

    return {
      card1: { title: 'Total Class 10 Students', val: class10List.length, color: 'text-indigo-600 bg-indigo-50', desc: 'Total graduated class 10 students' },
      card2: { title: 'TC Issued', val: tcCount, color: 'text-blue-600 bg-blue-50', desc: 'Number of Transfer Certificates issued' },
      card3: { title: 'Marksheet Issued', val: marksheetCount, color: 'text-emerald-600 bg-emerald-50', desc: 'Number of marksheets issued' },
      card4: { title: 'Pending Documents', val: pendingDocs, color: 'text-amber-600 bg-amber-50', desc: 'Outstanding certificate and marksheet issuances' }
    };
  };

  const stats = getSummaryStats();

  const openDocModal = (record: any) => {
    setSelectedRecord(record);
    
    let statusVal = 'dropout';
    const statusLower = record.leaving_status.toLowerCase();
    if (statusLower === 'completed_10th') {
      statusVal = 'completed_10th';
    } else if (statusLower === 'transfer' || statusLower === 'tc_issued') {
      statusVal = 'transfer';
    } else if (statusLower === 'migration') {
      statusVal = 'migration';
    } else if (statusLower === 'discontinued') {
      statusVal = 'discontinued';
    }

    setLeavingTypeForm(statusVal);
    setDocForm({
      reason: record.leaving_reason || '',
      marksheet_status: record.marksheet_status || 'Pending',
      marksheet_remarks: record.marksheet_remarks || '',
      tc_status: record.tc_status || 'Pending',
      tc_number: record.tc_number || '',
      tc_remarks: record.tc_remarks || '',
      tc_requested_date: record.tc_requested_date ? new Date(record.tc_requested_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setIsDocModalOpen(true);
  };

  const handleUpdateDocuments = async () => {
    if (!selectedRecord) return;
    setIsUpdatingDocs(true);

    try {
      // 1. If TC is being marked as 'Issued', call the dedicated TC endpoint
      if (docForm.tc_status === 'Issued' && selectedRecord.tc_status !== 'Issued') {
        const tcResp = await apiFetch('/api/left-students/issue-tc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            record_id: selectedRecord.id,
            tc_number: docForm.tc_number,
            tc_remarks: docForm.tc_remarks,
            tc_requested_date: docForm.tc_requested_date
          })
        });
        if (!tcResp.ok) {
          const err = await tcResp.json();
          throw new Error(err.detail || 'Failed to issue TC. Check student dues!');
        }
      }

      // 2. If Marksheet is being modified, call dedicated Marksheet status endpoint
      if (docForm.marksheet_status !== selectedRecord.marksheet_status || docForm.marksheet_remarks !== selectedRecord.marksheet_remarks) {
        const msResp = await apiFetch('/api/left-students/update-marksheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            record_id: selectedRecord.id,
            status: docForm.marksheet_status,
            remarks: docForm.marksheet_remarks
          })
        });
        if (!msResp.ok) {
          const err = await msResp.json();
          throw new Error(err.detail || 'Failed to update Marksheet status.');
        }
      }

      // 3. Update general leaving details
      const resp = await apiFetch('/api/left-students/update-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: selectedRecord.id,
          leaving_reason: docForm.reason,
          leaving_status: leavingTypeForm
        })
      });

      if (!resp.ok) {
        const error = await resp.json();
        throw new Error(error.detail || 'Failed to update details');
      }

      toast({ title: '🎉 Exit Records Updated', description: 'Leaving classification and metadata saved successfully.' });
      setIsDocModalOpen(false);
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Blocked', description: err.message });
    } finally {
      setIsUpdatingDocs(false);
    }
  };

  const handleGenerateClearance = async (recordId: string) => {
    isGeneratingClearance;
    try {
      const resp = await apiFetch(`/api/left-students/generate-clearance/${recordId}`);
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Clearance blocked due to dues.');
      }
      const data = await resp.json();
      setClearanceCert(data.certificate);
      setIsClearanceModalOpen(true);
      
      // Auto open print
      setTimeout(() => {
        window.print();
      }, 800);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Clearance Certificate Blocked', description: err.message });
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
      toast({ variant: 'destructive', title: 'Invalid Amount', description: `Amount cannot exceed pending balance of ₹${selectedRecord.currentDue.toLocaleString('en-IN')}` });
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
      toast({ title: '✅ Payment Recorded', description: `Receipt Reference: ${result.receipt_number}` });
      setIsCollectModalOpen(false);
      
      setCollectAmount('');
      setCollectRemarks('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['left-students-dashboard'] });
      
      navigate(`/receipt?receiptNo=${result.receipt_number}&type=left_student`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Collection Failed', description: err.message });
    } finally {
      setIsCollecting(false);
    }
  };

  // Fee editing handlers (Admin/feeInCharge only)
  const openEditModal = (record: any) => {
    setSelectedRecord(record);
    setEditFeeForm({
      pending_term_fee: record.pending_term_fee?.toString() || '0',
      pending_transport_fee: record.pending_transport_fee?.toString() || '0',
      pending_books_fee: record.pending_books_fee?.toString() || '0',
      old_due: record.old_due?.toString() || '0',
      pending_accessories_fee: record.pending_accessories_fee?.toString() || '0',
      pending_fine_fee: record.pending_fine_fee?.toString() || '0',
      pending_misc_fee: record.pending_misc_fee?.toString() || '0'
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
          old_due: parseFloat(editFeeForm.old_due) || 0,
          pending_accessories_fee: parseFloat(editFeeForm.pending_accessories_fee) || 0,
          pending_fine_fee: parseFloat(editFeeForm.pending_fine_fee) || 0,
          pending_misc_fee: parseFloat(editFeeForm.pending_misc_fee) || 0
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

  const getFeeStatusColor = (status: 'CLEARED' | 'PARTIAL' | 'PENDING') => {
    switch (status) {
      case 'CLEARED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'PARTIAL': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'PENDING': return 'bg-rose-100 text-rose-700 border-rose-200';
    }
  };

  const getRecoveryStatusBadge = (status: 'CLEARED' | 'PARTIAL' | 'PENDING') => {
    switch (status) {
      case 'CLEARED':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            Recovered
          </Badge>
        );
      case 'PARTIAL':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            Partially Paid
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-rose-100 text-rose-700 border-rose-200 rounded-full px-2.5 py-0.5 text-[10px] border font-bold">
            Not Paid
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 bg-[#F8FAFC] min-h-screen -m-6 p-6">
        
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#002147] font-display flex items-center gap-3">
              <UserMinus className="h-9 w-9 text-blue-600" />
              Student Exit Register
            </h1>
            <p className="text-slate-500 mt-2 text-sm max-w-3xl font-medium">
              Manage exit clearances, print school clearance certificates, issue Transfer Certificates, and reconcile unpaid balances.
            </p>
          </div>
          
          <div className="flex items-center gap-3 self-end">
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="rounded-xl border-slate-200 bg-white h-11 px-4 flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-semibold shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-1 bg-white p-1 rounded-2xl border w-fit shadow-sm">
          {[
            { id: 'all_leaving', label: 'All Leaving Students', icon: UserMinus },
            { id: 'tc_issued', label: 'T.C. Issued Students', icon: FileCheck },
            { id: 'class_10', label: 'Class 10 Completed', icon: GraduationCap }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearch('');
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

        {/* Stats Grid */}
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

        {/* Advanced Filters Panel */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Filter className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm">Advanced Search & Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search Name or Adm No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl border-slate-200 bg-[#F8FAFC] text-slate-800 focus:bg-white text-xs font-semibold"
              />
            </div>

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

            <div>
              <Select value={leavingTypeFilter} onValueChange={setLeavingTypeFilter}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-700">
                  <SelectValue placeholder="Leaving Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exits</SelectItem>
                  <SelectItem value="dropout">Dropout</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="migration">Migration</SelectItem>
                  <SelectItem value="class 10 completed">Class 10 Completed</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={tcStatusFilter} onValueChange={setTcStatusFilter}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-700">
                  <SelectValue placeholder="T.C. Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All TC Status</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            <div className="flex gap-2 xl:col-span-2">
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

        {/* ERP Data Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#002147] text-white font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4">Student Details</th>
                  
                  {activeTab === 'all_leaving' && (
                    <>
                      <th className="px-5 py-4">Leaving Classification</th>
                      <th className="px-5 py-4">Leaving Date</th>
                      <th className="px-5 py-4 text-right">Outstanding Dues</th>
                      <th className="px-5 py-4 text-right">Cleared Balance</th>
                      <th className="px-5 py-4 text-right">Recovery Dues</th>
                      <th className="px-5 py-4 text-center">Status</th>
                    </>
                  )}

                  {activeTab === 'tc_issued' && (
                    <>
                      <th className="px-5 py-4">Leaving Date</th>
                      <th className="px-5 py-4 text-center">T.C. Number</th>
                      <th className="px-5 py-4 text-center">Clearance Status</th>
                      <th className="px-5 py-4 text-right">Current Dues</th>
                      <th className="px-5 py-4 text-center">T.C. Status</th>
                    </>
                  )}

                  {activeTab === 'class_10' && (
                    <>
                      <th className="px-5 py-4">Academic Details</th>
                      <th className="px-5 py-4 text-right">Financial Dues</th>
                      <th className="px-5 py-4 text-center">TC Status</th>
                      <th className="px-5 py-4 text-center">TC Number</th>
                      <th className="px-5 py-4 text-center">Marksheet Status</th>
                      <th className="px-5 py-4 text-center">Clearance</th>
                    </>
                  )}

                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-bold">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                      Loading Exit records...
                    </td>
                  </tr>
                ) : finalFilteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                        <p className="text-sm font-black text-slate-800">No Records Found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  finalFilteredStudents.map((record: any) => {
                    const studentDetails = record.students || {};
                    const isCleared = record.currentDue <= 0.001;
                    
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-extrabold text-slate-800 text-sm">{studentDetails.full_name}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-0.5">Adm No: {studentDetails.admission_number}</div>
                          {activeTab === 'class_10' ? (
                            <div className="text-[10px] font-bold text-blue-600 mt-0.5">Grad Batch: {new Date(record.leaving_date).getFullYear()}</div>
                          ) : (
                            <div className="text-[10px] font-bold text-slate-500">Class: {studentDetails.classes?.name || 'N/A'}</div>
                          )}
                        </td>

                        {activeTab === 'all_leaving' && (
                          <>
                            <td className="px-5 py-4 text-slate-700">
                              <span className="capitalize font-bold">{record.leavingTypeDisplay}</span>
                              {record.leaving_reason && <div className="text-[10px] text-slate-400 font-bold italic mt-0.5">"{record.leaving_reason}"</div>}
                            </td>
                            <td className="px-5 py-4 text-slate-600">
                              {new Date(record.leaving_date).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-5 py-4 text-right text-slate-700">
                              ₹{(parseFloat(record.total_pending_amount) || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-5 py-4 text-right text-emerald-600">
                              ₹{(parseFloat(record.recovered_amount) || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-5 py-4 text-right text-rose-600 font-black">
                              ₹{record.currentDue.toLocaleString('en-IN')}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {getRecoveryStatusBadge(record.derivedFeeStatus)}
                            </td>
                          </>
                        )}

                        {activeTab === 'tc_issued' && (
                          <>
                            <td className="px-5 py-4 text-slate-600">
                              {new Date(record.leaving_date).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-5 py-4 text-center font-mono font-bold text-slate-600">
                              {record.tc_number || '-'}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <Badge className={`rounded-full px-2.5 py-0.5 text-[10px] border ${getFeeStatusColor(record.derivedFeeStatus)}`}>
                                {record.derivedFeeStatus === 'CLEARED' ? 'Cleared' : record.derivedFeeStatus === 'PARTIAL' ? 'Partial' : 'Pending'}
                              </Badge>
                            </td>
                            <td className="px-5 py-4 text-right text-slate-700 font-black">
                              ₹{record.currentDue.toLocaleString('en-IN')}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {getTcStatusBadge(record.tc_status)}
                            </td>
                          </>
                        )}

                        {activeTab === 'class_10' && (
                          <>
                            <td className="px-5 py-4 text-slate-600">
                              <div className="font-bold text-slate-800">{new Date(record.leaving_date).toLocaleDateString('en-IN')}</div>
                              <div className="text-[10px] text-slate-400 font-bold mt-0.5">AY: {getAcademicYearFromDate(record.leaving_date)}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="space-y-1 text-right font-medium">
                                <div>Dues: <span className="font-extrabold text-slate-700">₹{(parseFloat(record.total_pending_amount) || 0).toLocaleString('en-IN')}</span></div>
                                <div className="text-[10px] text-[#002147] font-bold font-mono">Pending Dues: ₹{record.currentDue.toLocaleString('en-IN')}</div>
                                <div className="mt-1">
                                  <Badge className={`rounded-full px-2 py-0.25 text-[9px] font-bold border ${getFeeStatusColor(record.derivedFeeStatus)}`}>
                                    {record.derivedFeeStatus === 'CLEARED' ? 'Cleared' : record.derivedFeeStatus === 'PARTIAL' ? 'Partial' : 'Pending'}
                                  </Badge>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              {getTcStatusBadge(record.tc_status)}
                            </td>
                            <td className="px-5 py-4 text-center font-mono font-bold text-slate-600">
                              {record.tc_number || <span className="text-slate-300 font-normal italic">-</span>}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {getMarksheetStatusBadge(record.marksheet_status)}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {isCleared ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">CLEARED</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 border-red-200 animate-pulse">REQUIRED</Badge>
                              )}
                            </td>
                          </>
                        )}

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex flex-col gap-1.5 items-end">
                            <div className="flex flex-wrap gap-1.5 justify-end">
                              
                              {/* Edit details trigger modal */}
                              <Button
                                onClick={() => openDocModal(record)}
                                size="sm"
                                variant="outline"
                                className="h-8 border-slate-200 text-slate-600 rounded-lg text-[10px] px-3 font-bold hover:bg-slate-50"
                              >
                                Edit / Manage exit
                              </Button>

                              {/* Clearance cert trigger */}
                              {isCleared ? (
                                <Button
                                  onClick={() => handleGenerateClearance(record.id)}
                                  size="sm"
                                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] px-3 font-bold"
                                >
                                  Generate Certificate
                                </Button>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px] px-2.5 rounded-lg flex items-center justify-center font-black select-none border h-8">
                                  Dues pending
                                </Badge>
                              )}

                              {/* Collect recovery dues button */}
                              {!isCleared && (
                                <Button
                                  onClick={() => openCollectModal(record)}
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-8 text-[10px] px-3 font-bold shadow-sm"
                                >
                                  Collect Fee
                                </Button>
                              )}

                            </div>

                            {/* Additional Links */}
                            <div className="flex gap-2 text-[10px] font-bold text-slate-400 mr-1 mt-0.5">
                              {/* Admin edit dues structure */}
                              {(userRole === 'admin' || userRole === 'feeInCharge') && (
                                <>
                                  <button 
                                    onClick={() => openEditModal(record)}
                                    className="hover:text-blue-600 transition-colors flex items-center gap-0.5"
                                  >
                                    <Pencil className="h-2.5 w-2.5" /> Adjust Exit Dues
                                  </button>
                                  <span>•</span>
                                </>
                              )}
                              <button 
                                onClick={() => navigate(`/students?search=${studentDetails.admission_number}`)}
                                className="hover:text-blue-600 transition-colors"
                              >
                                Student Profile
                              </button>
                            </div>
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
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 rounded-3xl shadow-2xl">
          <div className="bg-gradient-to-r from-blue-700 to-[#002147] p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6 opacity-80" />
                Manage exiting student documents
              </DialogTitle>
              <DialogDescription className="text-blue-100 text-xs">
                Configure leaving classifications, TC tracking details, and marksheet transitions.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-5 bg-white text-xs">
            {selectedRecord && (
              <>
                {/* ⚠️ FEE CLEARANCE REQUIRED BANNER */}
                {selectedRecord.currentDue > 0.001 ? (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-red-700">Fee Clearance Required</h4>
                      <p className="font-bold leading-normal">
                        This student has outstanding exit dues of <span className="font-black text-red-600 text-sm">₹{selectedRecord.currentDue.toLocaleString('en-IN')}</span>. 
                        Official Transfer Certificate (TC) and Marksheet issuance is hard-blocked until dues are paid to ₹0.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-emerald-700">Clearance Status: Cleared</h4>
                      <p className="font-bold leading-normal">
                        This student has cleared all their financial dues. Issuance of Transfer Certificate (TC) and Marksheet is permitted.
                      </p>
                    </div>
                  </div>
                )}

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
                    <span className="font-bold text-slate-500">Class:</span>
                    <span className="font-bold text-slate-700">{selectedRecord.students?.classes?.name || 'N/A'}</span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-4">
              
              {/* Leaving Type Selector */}
              <div className="space-y-2">
                <label className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">Leaving Type / Classification</label>
                <Select value={leavingTypeForm} onValueChange={setLeavingTypeForm}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dropout">Dropout</SelectItem>
                    <SelectItem value="transfer">Transfer / Exit</SelectItem>
                    <SelectItem value="migration">Migration</SelectItem>
                    <SelectItem value="completed_10th">Class 10 Completed</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* TC Status and Metadata details */}
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center border-b pb-2 mb-2">
                  <span className="font-extrabold text-slate-700 text-xs">Transfer Certificate Details</span>
                  {selectedRecord?.currentDue > 0.001 && <span className="text-[10px] text-red-600 font-bold italic">TC blocked by dues</span>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 text-[10px]">TC Approval Status</label>
                    <Select 
                      value={docForm.tc_status} 
                      onValueChange={(val) => setDocForm({ ...docForm, tc_status: val })}
                    >
                      <SelectTrigger className="h-9 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Issued" disabled={selectedRecord?.currentDue > 0.001}>Issued (Clears Only)</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 text-[10px]">TC requested date</label>
                    <Input
                      type="date"
                      value={docForm.tc_requested_date}
                      onChange={(e) => setDocForm({ ...docForm, tc_requested_date: e.target.value })}
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>
                {docForm.tc_status === 'Issued' && (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-500 text-[10px]">TC certificate number</label>
                      <Input
                        value={docForm.tc_number}
                        onChange={(e) => setDocForm({ ...docForm, tc_number: e.target.value })}
                        placeholder="TC-XXXX"
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-500 text-[10px]">TC Issuance remarks</label>
                      <Input
                        value={docForm.tc_remarks}
                        onChange={(e) => setDocForm({ ...docForm, tc_remarks: e.target.value })}
                        placeholder="E.g. Good conduct remarks"
                        className="h-9 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Marksheet Status Transitions */}
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center border-b pb-2 mb-2">
                  <span className="font-extrabold text-slate-700 text-xs">Grad Marksheet Details</span>
                  {selectedRecord?.currentDue > 0.001 && <span className="text-[10px] text-red-600 font-bold italic">Marksheet blocked by dues</span>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 text-[10px]">Marksheet Status</label>
                    <Select 
                      value={docForm.marksheet_status} 
                      onValueChange={(val) => setDocForm({ ...docForm, marksheet_status: val })}
                    >
                      <SelectTrigger className="h-9 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Generated">Generated</SelectItem>
                        <SelectItem value="Printed">Printed</SelectItem>
                        <SelectItem value="Issued" disabled={selectedRecord?.currentDue > 0.001}>Issued (Clears Only)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 text-[10px]">Marksheet remarks / notes</label>
                    <Input
                      value={docForm.marksheet_remarks}
                      onChange={(e) => setDocForm({ ...docForm, marksheet_remarks: e.target.value })}
                      placeholder="Add marksheet remarks"
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Leaving reason text */}
              <div className="space-y-2">
                <label className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">Official Exit Remarks</label>
                <Input
                  value={docForm.reason}
                  onChange={(e) => setDocForm({ ...docForm, reason: e.target.value })}
                  placeholder="Specify exit remarks or reason"
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
              {isUpdatingDocs ? 'Updating...' : 'Save details'}
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
              <DialogDescription className="text-emerald-55 text-xs">
                Record a recovery payment directly into the school account.
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
                    <SelectItem value="UPI">UPI Payment</SelectItem>
                    <SelectItem value="QR_CODE">UPI QR Scanner (Static QR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="font-extrabold text-slate-700">Remarks (Optional)</label>
                <Input
                  value={collectRemarks}
                  onChange={(e) => setCollectRemarks(e.target.value)}
                  placeholder="E.g. reference ID, notes..."
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

      {/* 3. Adjust Outstanding Dues Structure Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 rounded-2xl shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <Pencil className="h-6 w-6 opacity-80" />
                Adjust outstanding dues structure
              </DialogTitle>
              <DialogDescription className="text-indigo-50 text-xs">
                Modify itemized balances details for student recovery records.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-4 bg-white text-xs max-h-[400px] overflow-y-auto">
            <div className="space-y-2">
              <label className="font-extrabold text-slate-700">Pending Term Course Fee (₹)</label>
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
              <label className="font-extrabold text-slate-700">Old Academic Outstanding Dues (₹)</label>
              <Input
                type="number"
                value={editFeeForm.old_due}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, old_due: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="font-extrabold text-slate-700">Pending Accessories Dues (₹)</label>
              <Input
                type="number"
                value={editFeeForm.pending_accessories_fee}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, pending_accessories_fee: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="font-extrabold text-slate-700">Pending Fine / Penalty (₹)</label>
              <Input
                type="number"
                value={editFeeForm.pending_fine_fee}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, pending_fine_fee: e.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="font-extrabold text-slate-700">Pending Miscellaneous Dues (₹)</label>
              <Input
                type="number"
                value={editFeeForm.pending_misc_fee}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, pending_misc_fee: e.target.value })}
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
                  (parseFloat(editFeeForm.old_due) || 0) +
                  (parseFloat(editFeeForm.pending_accessories_fee) || 0) +
                  (parseFloat(editFeeForm.pending_fine_fee) || 0) +
                  (parseFloat(editFeeForm.pending_misc_fee) || 0)
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

      {/* RENDER PRINT CLEARANCE CERTIFICATE STRUCTURE ON REQUEST */}
      {clearanceCert && (
        <div className="fixed inset-0 z-[9999] bg-white text-slate-900 font-sans p-12 hidden print:block overflow-y-auto">
          <div className="w-[750px] mx-auto bg-white border-8 double border-slate-950 p-10 text-center relative">
            <div className="border border-slate-950 p-6">
              
              {/* Logo & School Header */}
              <div className="flex flex-col items-center border-b-2 border-slate-900 pb-4 mb-8">
                <img src="/school-logo-official.png" alt="Adarsh Oxford Logo" className="h-16 w-16 object-contain mb-3" />
                <h1 className="text-3xl font-serif font-black tracking-tight text-[#002147] uppercase leading-none">
                  ADARSH OXFORD SCHOOL
                </h1>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                  Oxford Street, Guntur, Andhra Pradesh, India
                </p>
              </div>

              {/* Certificate Title */}
              <div className="my-6">
                <h2 className="text-2xl font-serif font-bold text-[#B8860B] uppercase tracking-wide">
                  SCHOOL FEE CLEARANCE CERTIFICATE
                </h2>
                <p className="text-slate-400 font-mono text-[9px] mt-1 font-bold">
                  Reference: {clearanceCert.certificate_number}
                </p>
              </div>

              {/* Certificate content */}
              <div className="my-10 text-sm leading-loose text-slate-800 text-justify px-4">
                <p className="mb-4">
                  This is to certify that student <span className="font-extrabold uppercase text-slate-950">{clearanceCert.student_name}</span>, 
                  bearing Admission Number <span className="font-bold text-slate-950 font-mono">{clearanceCert.admission_number}</span>, 
                  has cleared all outstanding financial dues, including Course Fees, Books, Transport, Accessories, Fines, and Miscellaneous charges, 
                  towards <span className="font-bold text-slate-950">Adarsh Oxford School</span>.
                </p>
                <p>
                  As of <span className="font-bold text-slate-950">{new Date(clearanceCert.clearance_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>, 
                  the institution has no outstanding financial claims against the student. This certificate is issued upon request to enable transfer documentation clearances.
                </p>
              </div>

              {/* Signature section */}
              <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-slate-200">
                <div className="flex flex-col justify-end items-start min-h-[80px]">
                  <div className="h-14 w-14 border border-dashed border-[#B8860B]/50 rounded-full flex items-center justify-center mb-1">
                    <span className="text-[6px] font-black text-[#B8860B] text-center leading-none uppercase">
                      OFFICIAL<br/>SEAL
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Office Seal</span>
                </div>
                <div className="flex flex-col justify-end items-end min-h-[80px] text-right">
                  <span className="font-serif italic font-bold text-[#002147] border-b border-slate-300 pb-0.5 mb-1 px-4">
                    Principal / Director
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorized Signatory</span>
                </div>
              </div>

            </div>
          </div>
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              body {
                background: white !important;
                color: black !important;
              }
              .fixed.inset-0.z-\\[9999\\], .fixed.inset-0.z-\\[9999\\] * {
                visibility: visible;
              }
              .fixed.inset-0.z-\\[9999\\] {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white;
                padding: 0;
              }
            }
          `}</style>
        </div>
      )}

    </DashboardLayout>
  );
}
