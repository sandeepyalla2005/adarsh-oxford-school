import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  Search, 
  Download, 
  Printer, 
  QrCode, 
  Eye, 
  Loader2, 
  AlertCircle,
  FileText,
  Settings,
  Calendar,
  Share2,
  Trash2,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { apiFetch } from '@/lib/api';

interface QRPaymentRecord {
  id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  parent_name?: string;
  mobile_number?: string;
  amount: number;
  screenshot_url?: string;
  status: string; // 'Awaiting Verification', 'Approved', 'Rejected'
  receipt_number?: string;
  preferred_qr?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  allocation?: any;
}

function renderAllocation(allocation: any) {
  if (!allocation) return null;
  const items: string[] = [];

  // Course
  const course = allocation.course || {};
  Object.keys(course).forEach(term => {
    const amt = Number(course[term] || 0);
    if (amt > 0) {
      items.push(term === '0' ? `Course Prev: ₹${amt}` : `Course T${term}: ₹${amt}`);
    }
  });

  // Books
  const books = Number(allocation.books || 0);
  if (books > 0) {
    items.push(`Books: ₹${books}`);
  }

  // Transport
  const transport = allocation.transport || {};
  const transportMonths = Object.keys(transport).filter(m => Number(transport[m]) > 0);
  if (transportMonths.length > 0) {
    const monthNames = {
      '6': 'Jun', '7': 'Jul', '8': 'Aug', '9': 'Sep', '10': 'Oct', 
      '11': 'Nov', '12': 'Dec', '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr'
    } as any;
    const sumTrans = transportMonths.reduce((s, m) => s + Number(transport[m]), 0);
    const monthsStr = transportMonths.map(m => monthNames[m] || m).join(',');
    items.push(`Trans (${monthsStr}): ₹${sumTrans}`);
  }

  // Accessories
  const accessories = allocation.accessories || {};
  const accSum = Object.values(accessories).reduce((s: number, a: any) => s + Number(a || 0), 0) as number;
  if (accSum > 0) {
    items.push(`Accessories: ₹${accSum}`);
  }

  // Fine
  const fine = Number(allocation.fine || 0);
  if (fine > 0) {
    items.push(`Fine: ₹${fine}`);
  }

  // Misc
  const misc = Number(allocation.misc || 0);
  if (misc > 0) {
    items.push(`Misc: ₹${misc}`);
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
      {items.map((item, idx) => (
        <span key={idx} className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded">
          {item}
        </span>
      ))}
    </div>
  );
}

const getReprintReceiptItems = (payment: QRPaymentRecord) => {
  const items: { label: string; amount: number }[] = [];
  const alloc = payment.allocation || {};
  
  // Course
  const course = alloc.course || {};
  Object.keys(course).forEach(term => {
    const amt = Number(course[term] || 0);
    if (amt > 0) {
      items.push({
        label: term === '0' ? 'COURSE TERM FEE (PREVIOUS DUES)' : `COURSE TERM FEE - TERM ${term}`,
        amount: amt
      });
    }
  });

  // Books
  const books = Number(alloc.books || 0);
  if (books > 0) {
    items.push({ label: 'BOOKS & MATERIAL FEE', amount: books });
  }

  // Transport
  const transport = alloc.transport || {};
  const months = Object.keys(transport).filter(m => Number(transport[m]) > 0);
  if (months.length > 0) {
    const monthNames = {
      '6': 'JUN', '7': 'JUL', '8': 'AUG', '9': 'SEP', '10': 'OCT', 
      '11': 'NOV', '12': 'DEC', '1': 'JAN', '2': 'FEB', '3': 'MAR', '4': 'APR'
    } as any;
    const sumTrans = months.reduce((s, m) => s + Number(transport[m]), 0);
    const labels = months.map(m => monthNames[m] || `MONTH ${m}`).join(', ');
    items.push({ label: `TRANSPORT FEE (${labels})`, amount: sumTrans });
  }

  // Accessories
  const accessories = alloc.accessories || {};
  const accSum = Object.values(accessories).reduce((s: number, a: any) => s + Number(a || 0), 0) as number;
  if (accSum > 0) {
    items.push({ label: 'SCHOOL ACCESSORIES & UNIFORM FEE', amount: accSum });
  }

  // Fine
  const fine = Number(alloc.fine || 0);
  if (fine > 0) {
    items.push({ label: 'FINE & PENALTY CHARGES', amount: fine });
  }

  // Misc
  const misc = Number(alloc.misc || 0);
  if (misc > 0) {
    items.push({ label: 'MISCELLANEOUS DUES', amount: misc });
  }

  // Fallback if empty
  if (items.length === 0 && payment.amount > 0) {
    items.push({
      label: 'SCHOOL FEE PAYMENT (STATIC QR TRANS)',
      amount: Number(payment.amount)
    });
  }

  return items;
};

export default function FeeVerifications() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<QRPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'Awaiting Verification' | 'Approved' | 'Rejected'>('Awaiting Verification');
  
  // Custom QR Settings
  const [customPhonePe, setCustomPhonePe] = useState(() => localStorage.getItem('oxford_custom_qr_phonepe') || '/qr-phonepe.png');
  const [customIcici, setCustomIcici] = useState(() => localStorage.getItem('oxford_custom_qr_icici') || '/qr-icici.png');
  const [showQrSettings, setShowQrSettings] = useState(false);

  // Selected Screenshot Modal
  const [viewScreenshotUrl, setViewScreenshotUrl] = useState<string | null>(null);

  // Printing State for Auto Print Flow
  const [printingPayment, setPrintingPayment] = useState<QRPaymentRecord | null>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const resp = await apiFetch('/api/public-payments/all');
      if (!resp.ok) throw new Error("Failed to fetch payments from backend");
      const result = await resp.json();
      setPayments(result.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load QR fee payments", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const filtered = filteredPayments();
    if (filtered.length === 0) {
      toast.info("No records to export.");
      return;
    }

    const headers = ['Date', 'Receipt No', 'Student Name', 'Admission No', 'Class & Section', 'Parent Name', 'Mobile', 'Amount', 'QR Mode', 'Status'];
    const rows = filtered.map(p => [
      new Date(p.created_at).toLocaleDateString(),
      p.receipt_number || 'N/A',
      p.student_name,
      p.admission_number,
      p.class_name,
      p.parent_name || 'N/A',
      p.mobile_number || 'N/A',
      p.amount,
      p.preferred_qr || 'N/A',
      p.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Oxford_QR_Payments_${activeTab.replace(' ', '_')}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Report exported successfully!");
  };

  // Change QR Code Uploads
  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>, provider: 'phonepe' | 'icici') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File too large", { description: "Please upload an image smaller than 2MB." });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (provider === 'phonepe') {
          setCustomPhonePe(base64);
          localStorage.setItem('oxford_custom_qr_phonepe', base64);
        } else {
          setCustomIcici(base64);
          localStorage.setItem('oxford_custom_qr_icici', base64);
        }
        toast.success(`Static ${provider === 'phonepe' ? 'PhonePe' : 'ICICI'} QR code updated successfully!`);
      };
      reader.readAsDataURL(file);
    }
  };

  // Restore Default QR Codes
  const handleResetQr = (provider: 'phonepe' | 'icici') => {
    if (provider === 'phonepe') {
      setCustomPhonePe('/qr-phonepe.png');
      localStorage.removeItem('oxford_custom_qr_phonepe');
    } else {
      setCustomIcici('/qr-icici.png');
      localStorage.removeItem('oxford_custom_qr_icici');
    }
    toast.success(`${provider === 'phonepe' ? 'PhonePe' : 'ICICI'} QR reset to official default.`);
  };

  // Verify Actions
  const handleVerify = async (paymentId: string, isApproved: boolean) => {
    const status = isApproved ? 'Approved' : 'Rejected';
    const reason = isApproved ? '' : 'Payment could not be verified.';
    
    try {
      const resp = await apiFetch(`/api/public-payments/verify/${paymentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejection_reason: reason })
      });

      if (!resp.ok) throw new Error("Verification failed on server");
      const result = await resp.json();

      toast.success(isApproved ? "Payment Approved" : "Payment Rejected");
      
      // Update local states
      const updatedPayments = payments.map(p => {
        if (p.id === paymentId) {
          const finalRecord = { ...p, status, receipt_number: result.data.receipt_number };
          if (isApproved) {
            // Trigger automatic printing flow for approved payment
            setPrintingPayment(finalRecord);
          }
          return finalRecord;
        }
        return p;
      });
      setPayments(updatedPayments);

      if (!isApproved) {
        toast.error("Payment could not be verified.", {
          description: "The payment has been marked as Rejected and session cancelled."
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Action failed", { description: err.message });
    }
  };

  // Automatic printer trigger hook
  useEffect(() => {
    if (printingPayment) {
      // Set up automatic redirect on print finished
      const handleAfterPrint = () => {
        setPrintingPayment(null);
        toast.success("Printing completed successfully!");
        
        // Wait a short bit before redirecting automatically to ERP Home Page
        setTimeout(() => {
          navigate('/dashboard');
        }, 500);
      };

      window.addEventListener('afterprint', handleAfterPrint);
      
      // Trigger browser print dialog automatically
      setTimeout(() => {
        window.print();
      }, 500);

      return () => {
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [printingPayment, navigate]);

  const filteredPayments = () => {
    return payments.filter(p => {
      const matchStatus = p.status === activeTab;
      const matchSearch = searchQuery.trim() === '' || p.admission_number.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  };

  const getStats = () => {
    return {
      pending: payments.filter(p => p.status === 'Awaiting Verification').length,
      approved: payments.filter(p => p.status === 'Approved').length,
      rejected: payments.filter(p => p.status === 'Rejected').length,
      totalIncome: payments.filter(p => p.status === 'Approved').reduce((acc, p) => acc + Number(p.amount), 0)
    };
  };

  const statsObj = getStats();

  return (
    <DashboardLayout>
      <div className="space-y-8 print:hidden">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-black tracking-tight text-[#002147] uppercase">QR Fee Verification</h1>
            <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider mt-1">
              Verify payments made via PhonePe and ICICI bank static QR codes
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={() => setShowQrSettings(true)}
              className="bg-white border border-slate-200 text-[#002147] hover:bg-slate-50 font-bold gap-2"
            >
              <QrCode className="h-4 w-4 text-[#B8860B]" />
              Manage QR Codes
            </Button>
            
            <Button
              onClick={handleExportCSV}
              className="bg-[#002147] hover:bg-[#002147]/90 text-white font-bold gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              Export {activeTab} Report
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-[1.5rem] bg-white border border-slate-100 shadow-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Awaiting Verification</span>
                <p className="text-3xl font-black font-display text-amber-500 mt-1">{statsObj.pending}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-amber-600 animate-spin" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] bg-white border border-slate-100 shadow-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Approved Payments</span>
                <p className="text-3xl font-black font-display text-emerald-500 mt-1">{statsObj.approved}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] bg-white border border-slate-100 shadow-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Rejected Payments</span>
                <p className="text-3xl font-black font-display text-red-500 mt-1">{statsObj.rejected}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] bg-white border border-slate-100 shadow-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Income Verified</span>
                <p className="text-2xl font-black font-mono text-[#002147] mt-1">
                  ₹{statsObj.totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Table & Filters */}
        <Card className="border-none shadow-lg rounded-2xl bg-white overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 p-6">
            <Tabs 
              value={activeTab} 
              onValueChange={(val) => setActiveTab(val as any)}
              className="w-full md:w-auto"
            >
              <TabsList className="bg-slate-50 p-1 rounded-xl">
                <TabsTrigger value="Awaiting Verification" className="rounded-lg font-bold text-xs uppercase tracking-wide">
                  Pending ({statsObj.pending})
                </TabsTrigger>
                <TabsTrigger value="Approved" className="rounded-lg font-bold text-xs uppercase tracking-wide">
                  Approved ({statsObj.approved})
                </TabsTrigger>
                <TabsTrigger value="Rejected" className="rounded-lg font-bold text-xs uppercase tracking-wide">
                  Rejected ({statsObj.rejected})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by Admission No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 rounded-xl border-slate-200 focus-visible:ring-[#002147]"
              />
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-[#002147]" />
                <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">Querying offline requests...</p>
              </div>
            ) : filteredPayments().length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center text-slate-400 gap-2">
                <AlertCircle className="h-10 w-10 text-slate-300" />
                <p className="font-bold text-sm uppercase tracking-wide">No payment records found</p>
                <p className="text-xs text-slate-400">There are no records matching your selected tab or search query.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wide text-xs">Student Details</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wide text-xs">Parent Details</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wide text-xs">Amount</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wide text-xs">QR Chosen</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wide text-xs">Attachment</TableHead>
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wide text-xs">Date & Time</TableHead>
                    {activeTab !== 'Awaiting Verification' && (
                      <TableHead className="font-bold text-slate-500 uppercase tracking-wide text-xs">Receipt No</TableHead>
                    )}
                    <TableHead className="font-bold text-slate-500 uppercase tracking-wide text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments().map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-bold text-slate-800 uppercase">{p.student_name}</p>
                          <p className="text-xs font-bold text-slate-500 tracking-wider mt-0.5">Adm: {p.admission_number}</p>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">{p.class_name}</p>
                          {p.allocation && renderAllocation(p.allocation)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-bold text-slate-800 uppercase">{p.parent_name || 'N/A'}</p>
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">{p.mobile_number || 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-black text-[#002147] font-mono">
                        ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          p.preferred_qr === 'PhonePe' 
                            ? 'bg-[#5f259f]/10 text-[#5f259f]' 
                            : 'bg-[#f26522]/10 text-[#f26522]'
                        }`}>
                          {p.preferred_qr || 'Static QR'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {p.screenshot_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewScreenshotUrl(p.screenshot_url || null)}
                            className="text-blue-500 hover:text-blue-700 font-bold text-xs gap-1.5 p-0"
                          >
                            <Eye className="h-4 w-4" /> View Capture
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-500">
                        {new Date(p.created_at).toLocaleString()}
                      </TableCell>
                      {activeTab !== 'Awaiting Verification' && (
                        <TableCell className="font-mono text-xs font-black text-slate-700 uppercase">
                          {p.receipt_number || 'N/A'}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {p.status === 'Awaiting Verification' ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleVerify(p.id, true)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs"
                              >
                                Payment Received
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleVerify(p.id, false)}
                                className="font-bold rounded-lg text-xs"
                              >
                                Payment Not Received
                              </Button>
                            </>
                          ) : p.status === 'Approved' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPrintingPayment(p)}
                              className="border-slate-200 text-[#002147] hover:bg-slate-50 font-bold rounded-lg text-xs gap-1.5"
                            >
                              <Printer className="h-4 w-4 text-[#B8860B]" /> Reprint
                            </Button>
                          ) : (
                            <span className="text-xs text-red-500 font-bold uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded border border-red-100">
                              Rejected
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Change QR Codes Dialog */}
        <Dialog open={showQrSettings} onOpenChange={setShowQrSettings}>
          <DialogContent className="max-w-2xl bg-white rounded-3xl p-6 border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-serif font-black text-[#002147] uppercase">Dynamic QR Code Config</DialogTitle>
              <DialogDescription className="text-slate-400 font-semibold text-xs uppercase tracking-wider">
                Upload new static QR scanner screenshots to update the parent payment page dynamically
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              
              {/* PhonePe QR Configuration */}
              <div className="border border-slate-100 rounded-2xl bg-slate-50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#002147] uppercase tracking-wide">PhonePe Static QR</h4>
                  <Button variant="ghost" size="sm" onClick={() => handleResetQr('phonepe')} className="text-slate-400 hover:text-red-500 font-bold text-xs p-0">
                    Reset Official
                  </Button>
                </div>
                
                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm flex flex-col items-center justify-center">
                  <img src={customPhonePe} alt="PhonePe QR" className="h-40 w-40 object-contain rounded-lg" />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="upload-phonepe" className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Upload Custom QR image
                  </Label>
                  <Input
                    id="upload-phonepe"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleQrUpload(e, 'phonepe')}
                    className="h-10 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* ICICI QR Configuration */}
              <div className="border border-slate-100 rounded-2xl bg-slate-50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#002147] uppercase tracking-wide">ICICI Bank Static QR</h4>
                  <Button variant="ghost" size="sm" onClick={() => handleResetQr('icici')} className="text-slate-400 hover:text-red-500 font-bold text-xs p-0">
                    Reset Official
                  </Button>
                </div>
                
                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm flex flex-col items-center justify-center">
                  <img src={customIcici} alt="ICICI QR" className="h-40 w-40 object-contain rounded-lg" />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="upload-icici" className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Upload Custom QR image
                  </Label>
                  <Input
                    id="upload-icici"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleQrUpload(e, 'icici')}
                    className="h-10 rounded-lg text-xs"
                  />
                </div>
              </div>

            </div>
          </DialogContent>
        </Dialog>

        {/* View Attachment Screenshot Dialog */}
        <Dialog open={!!viewScreenshotUrl} onOpenChange={() => setViewScreenshotUrl(null)}>
          <DialogContent className="max-w-xl bg-white border-none shadow-2xl p-4 flex flex-col items-center">
            <DialogHeader className="w-full">
              <DialogTitle className="text-lg font-bold text-[#002147]">Payment Screenshot Attachment</DialogTitle>
            </DialogHeader>
            <div className="w-full bg-slate-50 p-2 rounded-2xl border mt-2 max-h-[70vh] overflow-y-auto flex items-center justify-center">
              {viewScreenshotUrl ? (
                <img src={viewScreenshotUrl} alt="Attached Receipt Screenshot" className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md" />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

      </div>

      {/* RENDER DEDICATED PRINT PAGE IF PRINTING IS ACTIVE */}
      {printingPayment && (
        <div className="fixed inset-0 z-[9999] bg-white text-slate-900 font-sans p-6 md:p-12 block print:block overflow-y-auto">
          <div className="w-[800px] mx-auto bg-white border-2 border-slate-950 p-8 rounded-xl shadow-none">
            
            {/* Header branding */}
            <div className="flex flex-col items-center border-b-4 border-slate-950 pb-6 mb-6">
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 shrink-0">
                  {/* Absolute path to ensure logo shows in print dialog */}
                  <img src="/school-logo-official.png" alt="Oxford School Logo" className="h-full w-full object-contain" />
                </div>
                <div className="text-center md:text-left leading-none">
                  <h1 className="text-3xl md:text-4xl font-serif font-black tracking-tighter text-[#002147] uppercase">
                    ADARSH OXFORD
                  </h1>
                  <p className="text-xs md:text-sm font-bold text-slate-600 uppercase tracking-[0.2em] mt-1">
                    English Medium School & Junior College
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                    Oxford Street, Guntur, Andhra Pradesh, India
                  </p>
                </div>
              </div>
              <div className="mt-6">
                <span className="border-y-2 border-slate-950 text-xl font-bold uppercase tracking-[0.3em] px-8 py-1">
                  OFFICIAL FEE RECEIPT
                </span>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-3 mb-6 text-sm font-bold border-b-2 border-dashed border-slate-400 pb-6">
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Receipt No</span>
                <span className="text-slate-900 font-mono">: {printingPayment.receipt_number}</span>
              </div>
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Date</span>
                <span className="text-slate-900">: {new Date(printingPayment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Student Name</span>
                <span className="text-slate-900 uppercase">: {printingPayment.student_name}</span>
              </div>
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Admission No</span>
                <span className="text-slate-900 font-mono">: {printingPayment.admission_number}</span>
              </div>
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Class / Course</span>
                <span className="text-slate-900 uppercase">: {printingPayment.class_name}</span>
              </div>
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Parent Name</span>
                <span className="text-slate-900 uppercase">: {printingPayment.parent_name || 'N/A'}</span>
              </div>
            </div>

            {/* Table */}
            <div className="mb-8 min-h-[120px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-950 text-left">
                    <th className="py-2 w-16 text-slate-500 uppercase text-xs font-black">SL</th>
                    <th className="py-2 text-slate-500 uppercase text-xs font-black">Particulars</th>
                    <th className="py-2 text-right w-40 text-slate-500 uppercase text-xs font-black">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {getReprintReceiptItems(printingPayment).map((item, index) => (
                    <tr key={index} className="border-b border-slate-200">
                      <td className="py-2 font-bold text-slate-500">{index + 1}</td>
                      <td className="py-2 font-black uppercase text-slate-800 text-xs">
                        {item.label}
                      </td>
                      <td className="py-2 text-right font-mono font-black text-slate-900 text-sm">
                        {item.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Section */}
            <div className="border-t-2 border-slate-950 pt-4 mb-8">
              <div className="flex justify-between items-center mb-4 font-bold text-sm">
                <div className="flex gap-6">
                  <span>Payment Mode: <span className="uppercase text-[#002147]">{printingPayment.preferred_qr || 'Static QR'}</span></span>
                  <span>Verification: <span className="text-emerald-600 uppercase font-black">Verified & Received</span></span>
                </div>
                <div className="text-xl font-black font-mono text-[#002147] bg-slate-50 px-4 py-1 border border-slate-200 rounded">
                  GRAND TOTAL: ₹{Number(printingPayment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="font-bold border-t border-dashed border-slate-400 pt-3 text-xs uppercase tracking-wide">
                Amount In Words: <span className="italic text-slate-700">
                  {numberToWords(Math.floor(printingPayment.amount))} Rupees Only
                </span>
              </div>
            </div>

            {/* Signature & Seal Block */}
            <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-dashed border-slate-300">
              <div className="flex flex-col justify-end items-start min-h-[100px]">
                <div className="h-16 w-16 border-2 border-dashed border-[#B8860B]/30 rounded-full flex items-center justify-center shrink-0 mb-2 opacity-80">
                  <span className="text-[8px] font-black text-[#B8860B] text-center leading-none uppercase">
                    Oxford School<br/>Seal
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">School Seal</span>
              </div>
              <div className="flex flex-col justify-end items-end min-h-[100px] text-right">
                <span className="font-serif italic font-bold text-[#002147] border-b border-slate-300 pb-1 mb-2 px-6">
                  Authorized Signatory
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Authorized Signature</span>
              </div>
            </div>

            {/* Final disclaimer */}
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider border-t border-slate-200 pt-6 mt-8 flex justify-between">
              <span>System: Oxford ERP QR-Payment Ledger</span>
              <span>Generations Time: {new Date().toLocaleString()}</span>
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
              .print\\:hidden {
                display: none !important;
              }
              @page {
                size: A4 portrait;
                margin: 0.5cm;
              }
            }
          `}</style>
        </div>
      )}
    </DashboardLayout>
  );
}

// Number to Words Converter helper
function numberToWords(num: number): string {
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
}
