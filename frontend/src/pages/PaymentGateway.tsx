import { useEffect, useState } from 'react';
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
  ShieldCheck,
  Check,
  Building,
  Copy,
  Printer,
  TrendingUp,
  Coins,
  Banknote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
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

  const state = location.state as PaymentState | null;

  // Flow states
  const [selectedQR, setSelectedQR] = useState<'phonepe' | 'icici'>('phonepe');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash' | 'card' | 'bank_transfer'>('upi');

  // UPI states
  const [upiNumber, setUpiNumber] = useState('');
  const [upiHandle, setUpiHandle] = useState('@ybl');
  const [upiUtr, setUpiUtr] = useState('');

  // Cash states
  const [denominations, setDenominations] = useState<Record<number, number>>({
    500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
  });

  // Card states
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Bank Transfer states
  const [bankUtr, setBankUtr] = useState('');

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

  const handleConfirmClick = () => {
    // Basic validation before show confirm dialog
    if (paymentMethod === 'upi') {
      if (!upiNumber) {
        toast({
          variant: 'destructive',
          title: 'UPI Details Required',
          description: 'Please submit the UPI ID or Mobile Number used for payment.',
        });
        return;
      }
    } else if (paymentMethod === 'cash') {
      const totalCash = Object.entries(denominations).reduce(
        (sum, [denom, count]) => sum + (count * parseInt(denom)),
        0
      );
      const dueAmount = amount || state?.amount || 0;
      if (totalCash < dueAmount) {
        toast({
          variant: 'destructive',
          title: 'Insufficient Cash Amount',
          description: `Total cash counted (${formatCurrency(totalCash)}) is less than amount due (${formatCurrency(dueAmount)}).`,
        });
        return;
      }
    } else if (paymentMethod === 'card') {
      if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
        toast({
          variant: 'destructive',
          title: 'Card Details Required',
          description: 'Please enter all debit/credit card fields to proceed.',
        });
        return;
      }
    } else if (paymentMethod === 'bank_transfer') {
      if (!bankUtr) {
        toast({
          variant: 'destructive',
          title: 'Bank Reference Required',
          description: 'Please submit the bank transfer reference UTR number.',
        });
        return;
      }
    }
    setShowConfirmDialog(true);
  };

  const handlePaymentSubmission = async () => {
    if (!state || !user) return;
    setIsSubmitting(true);
    setShowConfirmDialog(false);

    try {
      // 1. Prepare detailed notes based on payment method
      let notesDetails = '';
      if (paymentMethod === 'upi') {
        notesDetails = `UPI Payment. UPI ID/No: ${upiNumber}${upiUtr ? `. UTR: ${upiUtr}` : ''}`;
      } else if (paymentMethod === 'cash') {
        const cashList = Object.entries(denominations)
          .filter(([_, count]) => count > 0)
          .map(([denom, count]) => `${count}x₹${denom}`)
          .join(', ');
        notesDetails = `Cash Payment. Denominations: ${cashList || 'None'}`;
      } else if (paymentMethod === 'card') {
        const maskedCard = `•••• •••• •••• ${cardNumber.slice(-4)}`;
        notesDetails = `Card Payment. Card: ${maskedCard}. Holder: ${cardHolder}`;
      } else if (paymentMethod === 'bank_transfer') {
        notesDetails = `Bank Transfer. UTR/Ref: ${bankUtr}`;
      }

      // 2. Map frontend payment method to API expectations
      const methodMap = {
        upi: 'qr_code',
        cash: 'cash',
        card: 'card',
        bank_transfer: 'bank_transfer'
      };
      const apiMethod = methodMap[paymentMethod];

      // 3. Determine prefix and generate receipt number
      const prefixMap = {
        course: 'RCP',
        books: 'BKS',
        transport: 'TRN',
        accessories: 'ACC',
        left_student: 'REC'
      };
      const prefix = prefixMap[state.paymentType] || 'RCP';
      let receiptNumber = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 4. Post to payment collection backend API
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
            method: paymentMethod === 'upi' ? 'UPI' : (paymentMethod === 'bank_transfer' ? 'Bank' : paymentMethod.toUpperCase()),
            remarks: notesDetails
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
              method: apiMethod,
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
              payment_method: apiMethod,
              receipt_number: receiptNumber,
              remarks: `Paid via ${paymentMethod.toUpperCase()}. ${notesDetails}`
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
            method: apiMethod,
            term: state.term !== undefined ? state.term : 1,
            receipt_number: receiptNumber
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to submit payment details to backend.');
        }
      }

      // 5. Update the created rows with payment details in the notes/remarks column
      const tableMap = {
        course: 'course_payments',
        books: 'books_payments',
        transport: 'transport_payments',
        left_student: 'left_student_recovery_payments'
      };
      const tableName = tableMap[state.paymentType];
      if (tableName) {
        const updatePayload = state.paymentType === 'left_student'
          ? { remarks: notesDetails }
          : { notes: notesDetails };
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
                      <p className="text-xs text-slate-400">Verify information before checkout</p>
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
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Dynamic QRs & Upload Verification */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="border-slate-800 bg-[#0c1322] shadow-2xl relative">
                  <CardContent className="p-6 sm:p-8 space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
                      <div className="space-y-1">
                        <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
                          <QrCode className="h-5 w-5 text-indigo-400" />
                          Checkout Gate
                        </h2>
                        <p className="text-xs text-slate-400">Choose your payment mode to finalize the checkout</p>
                      </div>
                    </div>

                    {/* Payment Mode Selector Tabs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800/80">
                      {(['upi', 'cash', 'bank_transfer', 'card'] as const).map((method) => {
                        const label = {
                          upi: 'UPI Scanner',
                          cash: 'Cash Denom',
                          bank_transfer: 'Bank Transfer',
                          card: 'Card Payment'
                        }[method];
                        const Icon = {
                          upi: QrCode,
                          cash: Coins,
                          bank_transfer: Building,
                          card: CreditCard
                        }[method];
                        const isActive = paymentMethod === method;
                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            className={`flex items-center justify-center gap-2 py-3 px-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Tabs Content */}
                    <AnimatePresence mode="wait">
                      {paymentMethod === 'upi' && (
                        <motion.div
                          key="upi-panel"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-6"
                        >
                          {/* QR Selector */}
                          <div className="flex items-center justify-between gap-4 bg-slate-950 p-3 rounded-xl border border-slate-850">
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-300">Select Merchant QR</p>
                              <p className="text-[10px] text-slate-500">Toggle scanner provider</p>
                            </div>
                            <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex gap-2 w-fit shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={`font-semibold text-xs py-1 px-3.5 rounded-md transition-all duration-200 ${
                                  selectedQR === 'phonepe'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                                onClick={() => setSelectedQR('phonepe')}
                              >
                                PhonePe
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={`font-semibold text-xs py-1 px-3.5 rounded-md transition-all duration-200 ${
                                  selectedQR === 'icici'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                                onClick={() => setSelectedQR('icici')}
                              >
                                ICICI Bank
                              </Button>
                            </div>
                          </div>

                          {/* QR scanner image display */}
                          <div className="flex flex-col items-center justify-center p-6 bg-slate-950/80 rounded-2xl border border-slate-850 shadow-inner group">
                            <div className="relative p-3 bg-white rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.02] max-w-[220px]">
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

                            {/* Merchant Details */}
                            <div className="mt-4 text-center space-y-1">
                              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Merchant Account</span>
                              <p className="text-sm font-black text-indigo-400 uppercase tracking-wide">
                                {selectedQR === 'phonepe' ? 'Adarsh Oxford English Medium School' : 'Adarsh Oxford School'}
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono">UPI ID: {selectedQR === 'phonepe' ? 'adarshoxford@ybl' : 'adarshoxford@icici'}</p>
                            </div>
                          </div>

                          {/* UPI Inputs */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-300">Payer's UPI ID / Mobile Number</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={upiNumber}
                                  onChange={(e) => setUpiNumber(e.target.value)}
                                  placeholder="e.g. 9876543210 or user@upi"
                                  className="flex-1 h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
                                />
                                <select
                                  value={upiHandle}
                                  onChange={(e) => {
                                    setUpiHandle(e.target.value);
                                    if (upiNumber && !upiNumber.includes('@') && e.target.value) {
                                      setUpiNumber(prev => prev.split('@')[0] + e.target.value);
                                    }
                                  }}
                                  className="h-10 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-300 cursor-pointer"
                                >
                                  <option value="">Custom</option>
                                  <option value="@ybl">@ybl</option>
                                  <option value="@paytm">@paytm</option>
                                  <option value="@okicici">@okicici</option>
                                  <option value="@okhdfcbank">@okhdfcbank</option>
                                  <option value="@okaxis">@okaxis</option>
                                </select>
                              </div>
                              <p className="text-[10px] text-slate-500">Sender's UPI ID or phone number used for transfer</p>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-300">Transaction ID / UTR (Optional)</label>
                              <input
                                type="text"
                                value={upiUtr}
                                onChange={(e) => setUpiUtr(e.target.value.replace(/\D/g, ''))}
                                placeholder="12-digit UTR number"
                                maxLength={12}
                                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 text-slate-200 font-mono"
                              />
                              <p className="text-[10px] text-slate-500">Provide the 12-digit bank reference number</p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {paymentMethod === 'cash' && (
                        <motion.div
                          key="cash-panel"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-6"
                        >
                          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                              <Coins className="h-4 w-4 text-amber-500" />
                              Cash Denomination Calculator
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {[500, 200, 100, 50, 20, 10, 5, 2, 1].map((denom) => (
                                <div key={denom} className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-850 justify-between">
                                  <span className="text-xs font-bold text-slate-300 w-10 text-right">₹{denom}</span>
                                  <span className="text-slate-600 text-xs">x</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={denominations[denom] || ''}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      setDenominations(prev => ({ ...prev, [denom]: val }));
                                    }}
                                    placeholder="0"
                                    className="w-14 h-8 text-center bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                  />
                                  <span className="text-[11px] font-mono text-slate-500 w-16 text-right truncate">
                                    ₹{(denominations[denom] || 0) * denom}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Dynamic Match Feedback */}
                          {(() => {
                            const totalCash = Object.entries(denominations).reduce(
                              (sum, [denom, count]) => sum + (count * parseInt(denom)),
                              0
                            );
                            const dueAmount = amount || state.amount || 0;
                            const difference = totalCash - dueAmount;

                            return (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-slate-900/20 border-slate-800">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Total Cash Counted</span>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-black text-indigo-400">{formatCurrency(totalCash)}</span>
                                    <span className="text-xs text-slate-400">of {formatCurrency(dueAmount)} due</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {difference === 0 ? (
                                    <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-emerald-400 text-xs font-bold">
                                      <Check className="h-4 w-4" /> Perfect Match!
                                    </div>
                                  ) : difference > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[9px] uppercase font-bold text-slate-500">Return Change</span>
                                      <span className="text-xs font-black text-emerald-400">+{formatCurrency(difference)}</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[9px] uppercase font-bold text-slate-500">Shortage Due</span>
                                      <span className="text-xs font-black text-red-400">-{formatCurrency(Math.abs(difference))}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </motion.div>
                      )}

                      {paymentMethod === 'card' && (
                        <motion.div
                          key="card-panel"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-6"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                            {/* Card mockup */}
                            <div className="md:col-span-5 flex justify-center">
                              <div className="w-full max-w-[260px] aspect-[1.586/1] bg-gradient-to-br from-indigo-750 via-purple-750 to-indigo-900 rounded-xl p-5 shadow-2xl relative text-white overflow-hidden border border-white/10 flex flex-col justify-between">
                                <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none" />
                                <div className="flex justify-between items-start">
                                  <div className="h-8 w-10 bg-amber-400/20 rounded-md border border-amber-400/30 flex items-center justify-center relative">
                                    <div className="absolute inset-2 border border-amber-400/10 rounded-sm" />
                                  </div>
                                  <span className="font-extrabold italic text-[11px] text-white/50 tracking-wider">SECURE DEBIT</span>
                                </div>
                                <div className="space-y-0.5 mt-3">
                                  <span className="text-[7px] uppercase tracking-widest text-white/40 block">Card Number</span>
                                  <p className="font-mono text-sm font-bold tracking-[0.2em] whitespace-nowrap">
                                    {cardNumber ? cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                                  </p>
                                </div>
                                <div className="flex justify-between items-end mt-3">
                                  <div className="space-y-0.5 min-w-0 flex-1 mr-2">
                                    <span className="text-[7px] uppercase tracking-widest text-white/40 block">Card Holder</span>
                                    <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                                      {cardHolder || 'CARDHOLDER NAME'}
                                    </p>
                                  </div>
                                  <div className="space-y-0.5 text-right shrink-0">
                                    <span className="text-[7px] uppercase tracking-widest text-white/40 block">Expires</span>
                                    <p className="text-[10px] font-bold font-mono">
                                      {cardExpiry || 'MM/YY'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Card inputs */}
                            <div className="md:col-span-7 space-y-3.5">
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-300">Cardholder Name</label>
                                <input
                                  type="text"
                                  value={cardHolder}
                                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                                  placeholder="Name as printed on card"
                                  className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-300">Card Number</label>
                                <input
                                  type="text"
                                  value={cardNumber}
                                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                                  placeholder="16-digit card number"
                                  className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 text-slate-200 font-mono"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-semibold text-slate-300">Expiry Date</label>
                                  <input
                                    type="text"
                                    value={cardExpiry}
                                    onChange={(e) => {
                                      let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                      if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                                      setCardExpiry(val);
                                    }}
                                    placeholder="MM/YY"
                                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 text-slate-200 font-mono text-center"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-semibold text-slate-300">CVV</label>
                                  <input
                                    type="password"
                                    value={cardCvv}
                                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                    placeholder="•••"
                                    maxLength={3}
                                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 text-slate-200 font-mono text-center"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {paymentMethod === 'bank_transfer' && (
                        <motion.div
                          key="bank-panel"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-6"
                        >
                          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                              <Building className="h-4 w-4 text-emerald-400" />
                              School Bank Account Details
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {[
                                { label: 'Account Holder Name', value: 'ADARSH OXFORD EDUCATION SOCIETY', key: 'name' },
                                { label: 'Bank Name', value: 'ICICI Bank Ltd', key: 'bank' },
                                { label: 'Account Number', value: '634232987654', key: 'acc_no', copyable: true },
                                { label: 'IFSC Code', value: 'ICIC0006342', key: 'ifsc', copyable: true },
                                { label: 'Branch Name', value: 'Seethammadhara Branch, Visakhapatnam', key: 'branch' },
                                { label: 'Account Type', value: 'Current Account', key: 'type' }
                              ].map((field) => (
                                <div key={field.key} className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex justify-between items-center">
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] uppercase font-bold text-slate-500">{field.label}</span>
                                    <p className="text-xs font-bold text-slate-200 break-all">{field.value}</p>
                                  </div>
                                  {field.copyable && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-400 hover:text-white"
                                      onClick={() => {
                                        navigator.clipboard.writeText(field.value);
                                        toast({
                                          title: 'Copied!',
                                          description: `${field.label} copied.`,
                                        });
                                      }}
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-2 max-w-md">
                            <label className="text-xs font-semibold text-slate-300 block">Bank Transaction UTR / Ref Number</label>
                            <input
                              type="text"
                              value={bankUtr}
                              onChange={(e) => setBankUtr(e.target.value)}
                              placeholder="Enter IMPS/NEFT/RTGS Reference UTR Number"
                              className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
                            />
                            <p className="text-[10px] text-slate-500">Submit reference ID generated after initiating bank transfer</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

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