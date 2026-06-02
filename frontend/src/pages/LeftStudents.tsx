import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { motion } from 'framer-motion';
import { Search, IndianRupee, FileText, Download, CheckCircle, AlertTriangle, UserMinus, Pencil, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

export default function LeftStudents() {
  const { userRole, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('CASH');
  const [collectRemarks, setCollectRemarks] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditingFee, setIsEditingFee] = useState(false);
  const [editFeeForm, setEditFeeForm] = useState({
    pending_term_fee: '',
    pending_transport_fee: '',
    pending_books_fee: '',
    old_due: ''
  });

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

      toast({ title: 'Success', description: 'Fee details updated successfully' });
      setIsEditModalOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['left-students-dashboard'] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setIsEditingFee(false);
    }
  };

  const { data: leftStudents = [], isLoading, refetch } = useQuery({
    queryKey: ['left-students', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      
      const resp = await apiFetch(`/api/left-students?${params.toString()}`);
      if (!resp.ok) throw new Error('Failed to fetch left students');
      const data = await resp.json();
      return data.data;
    },
    refetchOnWindowFocus: false,
    refetchInterval: 5000,
  });

  const { data: dashboardStats, refetch: refetchStats } = useQuery({
    queryKey: ['left-students-dashboard'],
    queryFn: async () => {
      const resp = await apiFetch('/api/left-students/dashboard');
      if (!resp.ok) return null;
      const json = await resp.json();
      return json.data;
    },
    refetchOnWindowFocus: false,
    refetchInterval: 5000,
  });

  const handleCollect = async () => {
    if (!selectedRecord) return;
    const amount = parseFloat(collectAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount greater than 0.' });
      return;
    }

    const pending = parseFloat(selectedRecord.total_pending_amount || 0) - parseFloat(selectedRecord.recovered_amount || 0);
    if (amount > pending) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: `Amount cannot exceed the pending balance (₹${pending.toLocaleString('en-IN')})` });
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
      
      // Reset form
      setCollectAmount('');
      setCollectRemarks('');
      
      refetch();
      queryClient.invalidateQueries({ queryKey: ['left-students-dashboard'] });

      // Redirect directly to receipt view
      navigate(`/receipt?receiptNo=${result.receipt_number}&type=left_student`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Collection Failed', description: err.message });
    } finally {
      setIsCollecting(false);
    }
  };

  const openCollectModal = (record: any) => {
    setSelectedRecord(record);
    const pending = parseFloat(record.total_pending_amount || 0) - parseFloat(record.recovered_amount || 0);
    setCollectAmount(pending.toString());
    setIsCollectModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'UNPAID': return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">Unpaid</Badge>;
      case 'PARTIALLY_PAID': return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Partial</Badge>;
      case 'FULLY_PAID': return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Cleared</Badge>;
      case 'WAIVED': return <Badge variant="secondary">Waived</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (val: number) => `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#002147] font-display flex items-center gap-3">
              <UserMinus className="h-8 w-8 text-blue-600" />
              Left Students & Dropouts
            </h1>
            <p className="text-slate-500 mt-2 text-sm">Manage fee recovery for students who have left the institution.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or admission no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl border-slate-200 bg-white"
                onKeyDown={(e) => e.key === 'Enter' && refetch()}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 rounded-xl bg-white border-slate-200">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leaving Status</SelectItem>
                <SelectItem value="dropout">Dropout</SelectItem>
                <SelectItem value="tc_issued">TC Issued / Eligible (0 Due)</SelectItem>
                <SelectItem value="completed_10th">Completed 10th</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { refetch(); refetchStats(); }} className="rounded-xl btn-oxford h-10 px-6">
              Search
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                refetch();
                refetchStats();
              }}
              className="rounded-xl border-slate-200 bg-white h-10 px-4 flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium"
              title="Manual Refresh"
            >
              <RefreshCw className="h-4 w-4 text-slate-500" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {dashboardStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Left Students</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{dashboardStats.total_left_students}</p>
              </div>
              <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <UserMinus className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Pending Dues</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(dashboardStats.unpaid_amount || 0)}</p>
              </div>
              <div className="h-12 w-12 bg-red-50 rounded-xl flex items-center justify-center">
                <IndianRupee className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total T.C Issued</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{dashboardStats.tc_issued_count || 0}</p>
              </div>
              <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <FileText className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Student Details</th>
                  <th className="px-6 py-4">Leaving Info</th>
                  <th className="px-6 py-4">Pending Dues</th>
                  <th className="px-6 py-4">Recovery Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading records...</td>
                  </tr>
                ) : leftStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                        <p className="text-lg font-medium text-slate-700">No Pending Records Found</p>
                        <p className="text-sm">All left students have cleared their dues or none exist matching your search.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  leftStudents.map((record: any) => {
                    const student = record.students || {};
                    const pending = parseFloat(record.total_pending_amount || 0);
                    const recovered = parseFloat(record.recovered_amount || 0);
                    const currentDue = pending - recovered;
                    
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">{student.full_name}</div>
                          <div className="text-xs text-slate-500 mt-1">Adm No: {student.admission_number}</div>
                          <div className="text-xs text-slate-500">Class: {student.classes?.name || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="capitalize font-medium text-slate-700">{record.leaving_status.replace('_', ' ')}</div>
                          {record.leaving_status === 'tc_issued' && record.students?.dropout_reason && (
                            <div className="text-xs font-semibold text-amber-600 mt-0.5">
                              Prev: {record.students.dropout_reason.toLowerCase().includes('graduated') ? '10th Completed' : 'Dropout'}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 mt-1">{new Date(record.leaving_date).toLocaleDateString('en-IN')}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-red-600">{formatCurrency(currentDue)}</div>
                          <div className="text-xs text-slate-500 mt-1">Total: {formatCurrency(pending)}</div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(record.recovery_status)}
                          {recovered > 0 && <div className="text-xs font-medium text-emerald-600 mt-1">Paid: {formatCurrency(recovered)}</div>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {record.leaving_status !== 'tc_issued' && currentDue <= 0 && (
                              <Button
                                onClick={async () => {
                                  if (window.confirm(`Issue T.C to ${student.full_name}?`)) {
                                    try {
                                      const resp = await apiFetch('/api/left-students/issue-tc', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ record_id: record.id })
                                      });
                                      if (!resp.ok) throw new Error('Failed to issue T.C');
                                      toast({ title: 'Success', description: 'T.C issued successfully' });
                                      refetch();
                                    } catch (e: any) {
                                      toast({ variant: 'destructive', title: 'Error', description: e.message });
                                    }
                                  }
                                }}
                                size="sm"
                                variant="outline"
                                className="rounded-lg px-4 border-slate-300 text-slate-700 hover:bg-slate-100"
                              >
                                Issue T.C
                              </Button>
                            )}
                            <Button
                              onClick={() => openCollectModal(record)}
                              disabled={currentDue <= 0}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4"
                            >
                              <IndianRupee className="h-4 w-4 mr-2" />
                              Collect
                            </Button>
                            {(isAdmin || userRole === 'feeInCharge') && (
                              <Button
                                onClick={() => openEditModal(record)}
                                size="sm"
                                variant="outline"
                                className="rounded-lg px-3 border-slate-300 text-slate-700 hover:bg-slate-100"
                                title="Edit Fee"
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

      <Dialog open={isCollectModalOpen} onOpenChange={setIsCollectModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 rounded-2xl shadow-2xl">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <IndianRupee className="h-6 w-6 opacity-80" />
                Collect Recovery Fee
              </DialogTitle>
              <DialogDescription className="text-emerald-50">
                Collect pending dues for left student
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-5 bg-white">
            {selectedRecord && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-slate-500">Student</div>
                  <div className="font-bold text-slate-800">{selectedRecord.students?.full_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-500">Pending Amount</div>
                  <div className="font-bold text-red-600 text-lg">
                    {formatCurrency(parseFloat(selectedRecord.total_pending_amount) - parseFloat(selectedRecord.recovered_amount))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Amount Paying (₹)</label>
                <Input
                  type="number"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="h-12 text-lg font-bold"
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Payment Method</label>
                <Select value={collectMethod} onValueChange={setCollectMethod}>
                  <SelectTrigger className="h-12">
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
                <label className="text-sm font-semibold text-slate-700">Remarks (Optional)</label>
                <Input
                  value={collectRemarks}
                  onChange={(e) => setCollectRemarks(e.target.value)}
                  placeholder="E.g., Transaction ID, Cheque No..."
                  className="h-11"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 sm:justify-end">
            <Button variant="outline" onClick={() => setIsCollectModalOpen(false)} className="rounded-xl px-6">
              Cancel
            </Button>
            <Button onClick={handleCollect} disabled={isCollecting} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8 font-bold shadow-md shadow-emerald-600/20">
              {isCollecting ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 rounded-2xl shadow-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <Pencil className="h-6 w-6 opacity-80" />
                Edit Pending Fee
              </DialogTitle>
              <DialogDescription className="text-blue-50">
                Modify fee breakdown for {selectedRecord?.students?.full_name}
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-4 bg-white">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Pending Term Fee</label>
              <Input
                type="number"
                value={editFeeForm.pending_term_fee}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, pending_term_fee: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Pending Transport Fee</label>
              <Input
                type="number"
                value={editFeeForm.pending_transport_fee}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, pending_transport_fee: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Pending Books Fee</label>
              <Input
                type="number"
                value={editFeeForm.pending_books_fee}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, pending_books_fee: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Old Dues</label>
              <Input
                type="number"
                value={editFeeForm.old_due}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, old_due: e.target.value })}
              />
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-lg font-bold">
              <span>New Total:</span>
              <span className="text-blue-600">
                {formatCurrency(
                  (parseFloat(editFeeForm.pending_term_fee) || 0) +
                  (parseFloat(editFeeForm.pending_transport_fee) || 0) +
                  (parseFloat(editFeeForm.pending_books_fee) || 0) +
                  (parseFloat(editFeeForm.old_due) || 0)
                )}
              </span>
            </div>
          </div>
          
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 sm:justify-end">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl px-6">
              Cancel
            </Button>
            <Button onClick={handleEditFee} disabled={isEditingFee} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 font-bold shadow-md shadow-blue-600/20">
              {isEditingFee ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
