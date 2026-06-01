import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode,
  ArrowLeft,
  User,
  GraduationCap,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Upload,
  FileText,
  FileImage,
  Eye,
  Check,
  Building,
  CheckSquare,
  Square,
  Copy,
  Printer,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl } from '@/lib/api';
import { getCurrentPortal, portalPath } from '@/lib/portal';
import { useAuth } from '@/lib/auth';

interface PayingCategory {
  categoryId: string;
  amount: number;
  name: string;
}

interface PayingTerm {
  term: number;
  amount: number;
}

interface PaymentState {
  studentId: string;
  studentName: string;
  className: string;
  amount?: number;
  paymentType: 'course' | 'books' | 'transport' | 'accessories' | 'left_student';
  term?: number;
  academicYear: string;
  payingCategories?: PayingCategory[];
  payingTerms?: PayingTerm[];
  leftRecordId?: string;
}

export default function PaymentGateway() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const portal = getCurrentPortal(location.pathname);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const state = location.state as PaymentState | null;

  // Flow states
  const [selectedQR, setSelectedQR] = useState<'phonepe' | 'icici'>('phonepe');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes countdown
  const [isCompletedTicked, setIsCompletedTicked] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedReceiptNo, setGeneratedReceiptNo] = useState('');

  // Dynamically resolve amount with fallback tracking
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (state) {
      if (state.amount !== undefined) {
        setAmount(state.amount);
      } else if (state.paymentType === 'accessories' && state.payingCategories && state.payingCategories.length > 0) {
        const calculatedTotal = state.payingCategories.reduce((sum, cat) => sum + cat.amount, 0);
        setAmount(calculatedTotal);
      } else if (state.paymentType === 'course' && state.payingTerms && state.payingTerms.length > 0) {
        const calculatedTotal = state.payingTerms.reduce((sum, pt) => sum + pt.amount, 0);
        setAmount(calculatedTotal);
      }
    }
  }, [state]);

  // Protect route & validate state
  useEffect(() => {
    if (!state) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'No payment context found. Returning to previous page...',
      });
      const timer = setTimeout(() => {
        navigate(-1);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state, navigate, toast]);

  // Countdown timer
  useEffect(() => {
    if (!state || isSuccess) return;

    if (timeLeft <= 0) {
      toast({
        variant: 'destructive',
        title: 'Payment Expired',
        description: 'Payment session expired. Redirecting back...',
      });
      // Redirect to respective module
      const pType = state.paymentType || 'course';
      navigate(portalPath(portal, `/${pType}-fees`));
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, state, isSuccess, navigate, portal, toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Receipt file size must be less than 5MB.',
      });
      return;
    }

    setUploadedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview('file');
    }
  };

  const triggerFileSelect = () => {
    if (isSuccess) return;
    fileInputRef.current?.click();
  };

  const handleConfirmClick = () => {
    setShowConfirmDialog(true);
  };

  const handlePaymentSubmission = async () => {
    if (!state || !user) return;
    setIsSubmitting(true);
    setShowConfirmDialog(false);

    try {
      let receiptUrl = '';

      // 2. Determine prefix and generate receipt number
      const prefixMap = {
        course: 'RCP',
        books: 'BKS',
        transport: 'TRN',
        accessories: 'ACC',
        left_student: 'REC'
      };
      const prefix = prefixMap[state.paymentType] || 'RCP';
      let receiptNumber = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 3. Post to payment collection backend API
      const { data: { session } } = await supabase.auth.getSession();
      if (state.paymentType === 'left_student') {
        const response = await fetch(`${getApiBaseUrl()}/api/left-students/collect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            record_id: state.leftRecordId,
            amount: amount || state.amount || 0,
            method: 'UPI',
            remarks: 'Paid via QR Code Payment Gateway'
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to submit left student payment details.');
        }

        const result = await response.json();
        receiptNumber = result.receipt_number;
      } else if (state.paymentType === 'course' && state.payingTerms && state.payingTerms.length > 0) {
        for (const payingTerm of state.payingTerms) {
          const response = await fetch(`${getApiBaseUrl()}/api/payments/collect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              student_id: state.studentId,
              type: 'course',
              academic_year: state.academicYear,
              amount: payingTerm.amount,
              method: 'qr_code',
              term: payingTerm.term,
              receipt_number: receiptNumber
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to submit course payment details to backend.');
          }
        }
      } else if (state.paymentType === 'accessories' && state.payingCategories && state.payingCategories.length > 0) {
        for (const cat of state.payingCategories) {
          const response = await fetch(`${getApiBaseUrl()}/api/payments/accessories`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              student_id: state.studentId,
              category_id: cat.categoryId,
              amount_paid: cat.amount,
              payment_method: 'qr_code',
              receipt_number: receiptNumber,
              remarks: `QR Payment for ${cat.name}`
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to submit accessories payment details to backend.');
          }
        }
      } else {
        const response = await fetch(`${getApiBaseUrl()}/api/payments/collect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            student_id: state.studentId,
            type: state.paymentType,
            academic_year: state.academicYear,
            amount: amount || state.amount || 0,
            method: 'qr_code',
            term: state.term !== undefined ? state.term : 1,
            receipt_number: receiptNumber
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to submit payment details to backend.');
        }
      }

      // 4. Update the created row with receipt URL in the notes column
      const tableMap = {
        course: 'course_payments',
        books: 'books_payments',
        transport: 'transport_payments',
        left_student: 'left_student_recovery_payments'
      };
      const tableName = tableMap[state.paymentType];
      if (tableName && receiptUrl) {
        const updatePayload = state.paymentType === 'left_student'
          ? { remarks: `Paid via QR. Receipt URL: ${receiptUrl}` }
          : { notes: `Receipt URL: ${receiptUrl}` };
        await supabase
          .from(tableName)
          .update(updatePayload)
          .eq('receipt_number', receiptNumber);
      }

      // Success callback
      toast({
        title: 'Payment Successful',
        description: `Payment recorded. Receipt No: ${receiptNumber}`,
      });

      // Redirect directly to the official Receipt Page
      navigate(`/receipt?receiptNo=${receiptNumber}&type=${state.paymentType}`);
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: err.message || 'An unexpected error occurred during submission.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPayment = () => {
    if (!state) return;
    toast({
      variant: 'destructive',
      title: 'Payment Aborted',
      description: 'The payment process has been cancelled.',
    });
    const pType = state.paymentType || 'course';
    navigate(portalPath(portal, `/${pType}-fees`));
  };

  const copyReceiptNumber = () => {
    navigator.clipboard.writeText(generatedReceiptNo);
    toast({
      title: 'Copied!',
      description: 'Acknowledgement receipt number copied to clipboard.',
    });
  };

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090e1a] text-white">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-slate-400 text-sm">Loading secure payment gateway context...</p>
        </div>
      </div>
    );
  }

  // Format currency helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#090e1a] text-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-900/5 blur-[150px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-[#0c1322]/80 backdrop-blur-md sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-800"
              onClick={isSuccess ? () => navigate(portalPath(portal, `/${state.paymentType}-fees`)) : handleCancelPayment}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-xs uppercase font-semibold tracking-wider text-indigo-400">Adarsh Oxford School</span>
              <span className="text-sm font-bold text-slate-200">Secure Payment Checkout</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-slate-800 bg-slate-900/60 text-slate-300 py-1.5 px-3 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">Secured 256-Bit SSL</span>
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Checkout Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="payment-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Left Column: Student Detail Summary */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="border-slate-800 bg-[#0c1322] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />
                  <CardContent className="p-6 pt-8 space-y-6">
                    {/* Header */}
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 uppercase tracking-wide">
                        <TrendingUp className="h-4 w-4 text-indigo-400" />
                        Billing Details
                      </h2>
                      <p className="text-xs text-slate-400">Verify information before scanning</p>
                    </div>

                    <div className="h-px bg-slate-800" />

                    {/* Student Info Card */}
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                        <User className="h-5 w-5 text-indigo-400 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Student Name</p>
                          <p className="text-sm font-bold text-slate-200">{state.studentName}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                          <GraduationCap className="h-5 w-5 text-purple-400 mt-0.5" />
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Class</p>
                            <p className="text-sm font-bold text-slate-200">{state.className || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                          <Calendar className="h-5 w-5 text-emerald-400 mt-0.5" />
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Academic Year</p>
                            <p className="text-sm font-bold text-slate-200">{state.academicYear}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payment Info */}
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold uppercase tracking-wider">Payment Category</span>
                        <Badge className="bg-indigo-900/40 text-indigo-300 border-indigo-800 uppercase tracking-wide text-[10px] font-bold">
                          {state.paymentType}
                        </Badge>
                      </div>

                      {state.paymentType === 'course' && state.payingTerms && state.payingTerms.length > 0 && (
                        <div className="space-y-1.5 border-t border-slate-800 pt-3 mt-3">
                          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Terms Breakdown</p>
                          {state.payingTerms.map((pt, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-slate-400">
                              <span>{pt.term === 0 ? 'Old Outstanding Dues' : `Term ${pt.term}`}</span>
                              <span className="font-semibold text-slate-300">{formatCurrency(pt.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {state.paymentType === 'accessories' && state.payingCategories && state.payingCategories.length > 0 && (
                        <div className="space-y-1.5 border-t border-slate-800 pt-3 mt-3">
                          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Items Breakdown</p>
                          {state.payingCategories.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-slate-400">
                              <span>{cat.name}</span>
                              <span className="font-semibold text-slate-300">{formatCurrency(cat.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {state.paymentType === 'course' && state.term !== undefined && (!state.payingTerms || state.payingTerms.length === 0) && (
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold uppercase tracking-wider">Target Period</span>
                          <span className="font-bold text-slate-200">
                            {state.term === 0 ? 'Old Outstanding Dues' : `Term ${state.term}`}
                          </span>
                        </div>
                      )}

                      {state.paymentType === 'transport' && state.term !== undefined && (
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold uppercase tracking-wider">Billing Month</span>
                          <span className="font-bold text-slate-200">
                            {new Date(0, state.term - 1).toLocaleString('default', { month: 'long' })}
                          </span>
                        </div>
                      )}

                      <div className="h-px bg-slate-800" />

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-100 uppercase tracking-wide">Amount Due</span>
                        <span className="text-2xl font-black text-indigo-400 tracking-tight">
                          {formatCurrency(amount || state.amount || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Countdown Timer Block */}
                    <div className="bg-gradient-to-r from-red-950/20 to-amber-950/20 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Session Timeout</p>
                          <p className="text-xs text-slate-500">Timer refreshes automatically</p>
                        </div>
                      </div>
                      <div className="text-xl font-mono font-black text-amber-400 bg-amber-950/30 py-1.5 px-3.5 rounded-lg border border-amber-500/10 shadow-inner">
                        {formatTime(timeLeft)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Dynamic QRs & Upload Verification */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="border-slate-800 bg-[#0c1322] shadow-2xl relative">
                  <CardContent className="p-6 sm:p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
                      <div className="space-y-1">
                        <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
                          <QrCode className="h-5 w-5 text-indigo-400" />
                          Scan & Pay
                        </h2>
                        <p className="text-xs text-slate-400">Choose your preferred UPI merchant QR gateway to complete payment</p>
                      </div>

                      {/* Merchant QR Interactive Selector */}
                      <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex gap-2 w-fit">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`font-semibold text-xs py-1.5 px-4 rounded-md transition-all duration-200 ${
                            selectedQR === 'phonepe'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          onClick={() => setSelectedQR('phonepe')}
                        >
                          PhonePe UPI
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`font-semibold text-xs py-1.5 px-4 rounded-md transition-all duration-200 ${
                            selectedQR === 'icici'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          onClick={() => setSelectedQR('icici')}
                        >
                          ICICI QR Code
                        </Button>
                      </div>
                    </div>

                    {/* QR Display Area */}
                    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/80 rounded-2xl border border-slate-850 shadow-inner group">
                      <div className="relative p-4 bg-white rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.02] max-w-[280px] sm:max-w-[320px]">
                        {/* Dynamic QR Loading */}
                        {selectedQR === 'phonepe' ? (
                          <img
                            src="/phonepe-new-qr.png"
                            alt="PhonePe UPI Merchant QR Code"
                            className="w-full h-auto aspect-square object-contain rounded-lg"
                          />
                        ) : (
                          <img
                            src="/icici-qr.png"
                            alt="ICICI Bank Merchant QR Code"
                            className="w-full h-auto aspect-square object-contain rounded-lg"
                          />
                        )}
                        
                        <div className="absolute inset-0 border border-slate-200 rounded-2xl pointer-events-none" />
                      </div>

                      {/* Display Selected Merchant Details */}
                      <div className="mt-4 text-center space-y-1">
                        <span className="text-xs uppercase font-bold tracking-widest text-slate-500">Merchant Name</span>
                        <p className="text-sm font-black text-indigo-400 uppercase tracking-wide">
                          {selectedQR === 'phonepe' ? 'Adarsh Oxford English Medium School' : 'Adarsh Oxford School'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">UPI ID: {selectedQR === 'phonepe' ? 'adarshoxford@ybl' : 'adarshoxford@icici'}</p>
                      </div>
                    </div>

                    

                    {/* Action Footer Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-800">
                      <Button
                        type="button"
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm h-11 shadow-lg"
                        disabled={isSubmitting}
                        onClick={handleConfirmClick}
                      >
                        {isSubmitting ? 'Recording Transaction...' : 'Confirm Payment'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="sm:w-36 border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-bold text-sm h-11"
                        onClick={handleCancelPayment}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          ) : (
            /* Secure locked Success Ack Page */
            <motion.div
              key="payment-success"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="max-w-2xl w-full mx-auto"
            >
              <Card className="border-emerald-900/40 bg-[#0c1a17] shadow-2xl relative overflow-hidden text-center">
                <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
                <CardContent className="p-8 sm:p-10 space-y-8">
                  {/* Top Success Badge */}
                  <div className="space-y-4">
                    <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mx-auto text-emerald-400">
                      <CheckCircle2 className="h-10 w-10 animate-bounce" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Secure Submission Finalized</span>
                      <h2 className="text-2xl font-black text-slate-100 tracking-tight uppercase">Payment Completed Successfully!</h2>
                      <p className="text-sm text-slate-400 max-w-md mx-auto">
                        Your transaction details and receipt upload have been secured and locked inside the database register.
                      </p>
                    </div>
                  </div>

                  {/* Summary Block */}
                  <div className="bg-slate-950/60 rounded-2xl p-5 border border-emerald-950/30 text-left space-y-4">
                    <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-3">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Receipt No</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-emerald-400 text-sm bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-800/10">
                          {generatedReceiptNo}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-white"
                          onClick={copyReceiptNumber}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 uppercase tracking-wide text-[10px] font-bold block mb-0.5">Student</span>
                        <span className="font-bold text-slate-200">{state.studentName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase tracking-wide text-[10px] font-bold block mb-0.5">Class</span>
                        <span className="font-bold text-slate-200">{state.className || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs border-t border-slate-900 pt-3">
                      <div>
                        <span className="text-slate-500 uppercase tracking-wide text-[10px] font-bold block mb-0.5">Category</span>
                        <span className="font-bold text-slate-200 uppercase">{state.paymentType}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase tracking-wide text-[10px] font-bold block mb-0.5">Academic Year</span>
                        <span className="font-bold text-slate-200">{state.academicYear}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-900 pt-3">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Amount Paid</span>
                      <span className="text-xl font-mono font-black text-emerald-400">{formatCurrency(amount || state.amount || 0)}</span>
                    </div>
                  </div>

                  {/* Actions Success */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      className="flex-1 bg-[#002147] hover:bg-[#002147]/90 text-white font-bold text-sm h-11 shadow-lg gap-2"
                      onClick={() => navigate(`/receipt?receiptNo=${generatedReceiptNo}&type=${state.paymentType}`)}
                    >
                      <Printer className="h-4 w-4" /> Print PDF Receipt
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:w-44 border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-bold text-sm h-11"
                      onClick={() => navigate(portalPath(portal, `/${state.paymentType}-fees`))}
                    >
                      Return to Portal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Confirmation Dialog Alert */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="border-slate-800 bg-[#0c1322] text-slate-100 max-w-sm sm:max-w-md p-6">
          <DialogHeader className="space-y-3">
            <div className="h-10 w-10 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 text-amber-500">
              <AlertCircle className="h-5 w-5 animate-pulse" />
            </div>
            <DialogTitle className="text-lg font-bold uppercase tracking-wide">Finalize Submission?</DialogTitle>
            <p className="text-sm text-slate-400 leading-relaxed">
              Once submitted, the payment details cannot be modified and your record will be locked permanently. Do you wish to continue?
            </p>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-3 mt-5">
            <Button
              type="button"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 text-xs"
              onClick={handlePaymentSubmission}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Finalizing...' : 'Yes, Continue'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-slate-850 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-bold h-10 text-xs"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}