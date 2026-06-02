import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  User, 
  Smartphone, 
  IndianRupee, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ArrowLeft,
  XCircle,
  QrCode,
  ShieldCheck,
  Loader2,
  Search,
  Printer,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/api';

interface StudentDetails {
  id: string;
  full_name: string;
  admission_number: string;
  class_name: string;
  parent_name: string;
  mobile_number: string;
}

interface StudentDues {
  course: { [key: string]: number }; // term 0, 1, 2, 3
  books: number;
  transport: { [key: string]: number }; // month-wise (string index)
  accessories: { [key: string]: number }; // category_id -> amount
  fine: number;
  misc: number;
  total: number;
}

export default function PublicFeePayment() {
  const [step, setStep] = useState<'search' | 'dues' | 'payment'>('search');
  
  // Search state
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Loaded student & dues state
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null);
  const [dues, setDues] = useState<StudentDues | null>(null);
  const [isLeftStudent, setIsLeftStudent] = useState(false);
  const [leftRecordId, setLeftRecordId] = useState<string | null>(null);

  // Selection method
  const [paymentMode, setPaymentMode] = useState<'complete' | 'selected'>('complete');

  // Selected fee heads
  const [selectedCourseTerms, setSelectedCourseTerms] = useState<string[]>([]);
  const [selectedBooks, setSelectedBooks] = useState(false);
  const [selectedTransportMonths, setSelectedTransportMonths] = useState<string[]>([]);
  const [selectedAccessoriesCats, setSelectedAccessoriesCats] = useState<string[]>([]);
  const [selectedFine, setSelectedFine] = useState(false);
  const [selectedMisc, setSelectedMisc] = useState(false);
  
  // Screenshot & submit state
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentRecordId, setPaymentRecordId] = useState<string | null>(null);
  const [isWaitingForAdmin, setIsWaitingForAdmin] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'Approved' | 'Rejected' | null>(null);
  const [generatedReceiptNo, setGeneratedReceiptNo] = useState<string | null>(null);
  const [approvedAllocation, setApprovedAllocation] = useState<any>(null);
  const [approvedAmount, setApprovedAmount] = useState<number>(0);

  // Timer State
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

  // Custom QR Path
  const customPhonePe = '/qr-official.png';

  // Handle countdown timer inside payment step
  useEffect(() => {
    if (step !== 'payment' || isWaitingForAdmin) return;

    setTimeLeft(300);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSessionExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step, isWaitingForAdmin]);

  // Live polling for admin verification when waiting
  useEffect(() => {
    if (!isWaitingForAdmin || !paymentRecordId) return;

    const pollInterval = setInterval(async () => {
      try {
        const resp = await fetch(buildApiUrl(`/api/public-payments/${paymentRecordId}`));
        if (resp.ok) {
          const result = await resp.json();
          const payment = result.data;
          
          if (payment.status === 'Approved') {
            clearInterval(pollInterval);
            setGeneratedReceiptNo(payment.receipt_number);
            setApprovedAllocation(payment.allocation);
            setApprovedAmount(payment.amount);
            setVerificationResult('Approved');
            toast.success("Payment verified! Receipt generated.");
            
            // Automatically open print dialog for receipt
            setTimeout(() => {
              window.print();
            }, 1000);
          } else if (payment.status === 'Rejected') {
            clearInterval(pollInterval);
            setVerificationResult('Rejected');
            toast.error("Payment could not be verified by Admin.");
          }
        }
      } catch (err) {
        console.error("Error polling payment status:", err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isWaitingForAdmin, paymentRecordId]);

  // Handle post-print redirect for successful print on approved polling
  useEffect(() => {
    if (verificationResult === 'Approved' && generatedReceiptNo) {
      const handleAfterPrint = () => {
        toast.success("Redirecting to Home...");
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1500);
      };
      
      window.addEventListener('afterprint', handleAfterPrint);
      return () => {
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [verificationResult, generatedReceiptNo]);

  const handleSessionExpired = () => {
    toast.error("Payment Session Expired", {
      description: "You did not complete the payment within 5 minutes. Session cancelled.",
      duration: 8000
    });
    setStep('search');
    setScreenshot(null);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSearchStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionNumber.trim()) {
      return toast.error("Please enter admission number");
    }
    
    setIsSearching(true);
    try {
      const resp = await fetch(buildApiUrl(`/api/public-payments/lookup/${encodeURIComponent(admissionNumber.trim())}`));
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.detail || "Student not found");
      }
      const data = await resp.json();
      setStudentDetails(data.student);
      setDues(data.dues);
      setIsLeftStudent(data.is_left);
      setLeftRecordId(data.left_record_id);
      
      // Select all by default
      selectAllDues(data.dues);
      setPaymentMode('complete');
      setStep('dues');
      toast.success("Student records fetched successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to find student record");
      setStudentDetails(null);
      setDues(null);
    } finally {
      setIsSearching(false);
    }
  };

  const selectAllDues = (duesData: StudentDues) => {
    const terms = Object.keys(duesData.course).filter(term => duesData.course[term] > 0);
    setSelectedCourseTerms(terms);
    setSelectedBooks(duesData.books > 0);
    
    const trMonths = Object.keys(duesData.transport).filter(m => duesData.transport[m] > 0);
    setSelectedTransportMonths(trMonths);
    
    const accCats = Object.keys(duesData.accessories).filter(cat => duesData.accessories[cat] > 0);
    setSelectedAccessoriesCats(accCats);
    
    setSelectedFine(duesData.fine > 0);
    setSelectedMisc(duesData.misc > 0);
  };

  const clearAllSelections = () => {
    setSelectedCourseTerms([]);
    setSelectedBooks(false);
    setSelectedTransportMonths([]);
    setSelectedAccessoriesCats([]);
    setSelectedFine(false);
    setSelectedMisc(false);
  };

  const handleModeChange = (mode: 'complete' | 'selected') => {
    setPaymentMode(mode);
    if (mode === 'complete' && dues) {
      selectAllDues(dues);
    } else {
      clearAllSelections();
    }
  };

  const calculateSelectedTotal = (): number => {
    if (!dues) return 0;
    let sum = 0;
    selectedCourseTerms.forEach(t => sum += dues.course[t] || 0);
    if (selectedBooks) sum += dues.books || 0;
    selectedTransportMonths.forEach(m => sum += dues.transport[m] || 0);
    selectedAccessoriesCats.forEach(cat => sum += dues.accessories[cat] || 0);
    if (selectedFine) sum += dues.fine || 0;
    if (selectedMisc) sum += dues.misc || 0;
    return sum;
  };

  const buildAllocation = () => {
    if (!dues) return {};
    const courseAlloc: { [key: string]: number } = {};
    selectedCourseTerms.forEach(t => courseAlloc[t] = dues.course[t] || 0);
    
    const transportAlloc: { [key: string]: number } = {};
    selectedTransportMonths.forEach(m => transportAlloc[m] = dues.transport[m] || 0);

    const accessoriesAlloc: { [key: string]: number } = {};
    selectedAccessoriesCats.forEach(cat => accessoriesAlloc[cat] = dues.accessories[cat] || 0);

    return {
      course: courseAlloc,
      books: selectedBooks ? dues.books : 0,
      transport: transportAlloc,
      accessories: accessoriesAlloc,
      fine: selectedFine ? dues.fine : 0,
      misc: selectedMisc ? dues.misc : 0
    };
  };

  const handleProceedToPayment = () => {
    const total = calculateSelectedTotal();
    if (total <= 0) {
      return toast.error("Please select at least one fee head to pay");
    }
    setStep('payment');
  };

  const handleHavePaidSubmit = async () => {
    if (!studentDetails) return;
    setIsSubmitting(true);
    try {
      const totalAmount = calculateSelectedTotal();
      const allocation = buildAllocation();
      
      const payload = {
        student_name: studentDetails.full_name,
        admission_number: studentDetails.admission_number,
        class_name: studentDetails.class_name,
        parent_name: studentDetails.parent_name,
        mobile_number: studentDetails.mobile_number,
        amount: totalAmount,
        screenshot_url: screenshot,
        preferred_qr: 'PhonePe',
        allocation: allocation,
        left_record_id: leftRecordId
      };

      const resp = await fetch(buildApiUrl('/api/public-payments/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) throw new Error("Submission failed");
      const result = await resp.json();
      
      setPaymentRecordId(result.data.id);
      setIsWaitingForAdmin(true);
      toast.success("Payment registered! Awaiting admin approval.");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to submit payment verification request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPayment = () => {
    setStep('search');
    setScreenshot(null);
    setIsWaitingForAdmin(false);
    setPaymentRecordId(null);
    setVerificationResult(null);
    setStudentDetails(null);
    setDues(null);
    toast.info("Transaction cancelled.");
  };

  const handleCheckboxToggle = (type: string, key?: string) => {
    if (paymentMode === 'complete') return; // Readonly when paying full
    
    if (type === 'course' && key) {
      setSelectedCourseTerms(prev => 
        prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
      );
    } else if (type === 'books') {
      setSelectedBooks(prev => !prev);
    } else if (type === 'transport' && key) {
      setSelectedTransportMonths(prev => 
        prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
      );
    } else if (type === 'accessories' && key) {
      setSelectedAccessoriesCats(prev => 
        prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
      );
    } else if (type === 'fine') {
      setSelectedFine(prev => !prev);
    } else if (type === 'misc') {
      setSelectedMisc(prev => !prev);
    }
  };

  // Receipt formatting helper
  const getReceiptItems = () => {
    if (!approvedAllocation && dues) {
      // Fallback to active selection if Approved Allocation is missing
      return getActiveReceiptItems();
    }
    
    const items: { label: string; amount: number }[] = [];
    const alloc = approvedAllocation || {};
    
    // Course
    const course = alloc.course || {};
    Object.keys(course).forEach(term => {
      const amt = Number(course[term] || 0);
      if (amt > 0) {
        items.push({
          label: term === '0' ? 'Course Fee (Previous Dues)' : `Course Fee - Term ${term}`,
          amount: amt
        });
      }
    });

    // Books
    const books = Number(alloc.books || 0);
    if (books > 0) {
      items.push({ label: 'Books Fee', amount: books });
    }

    // Transport
    const transport = alloc.transport || {};
    const months = Object.keys(transport).filter(m => Number(transport[m]) > 0);
    if (months.length > 0) {
      const monthNames = {
        '6': 'Jun', '7': 'Jul', '8': 'Aug', '9': 'Sep', '10': 'Oct', 
        '11': 'Nov', '12': 'Dec', '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr'
      } as any;
      const sumTrans = months.reduce((s, m) => s + Number(transport[m]), 0);
      const labels = months.map(m => monthNames[m] || `Month ${m}`).join(', ');
      items.push({ label: `Transport Fee (${labels})`, amount: sumTrans });
    }

    // Accessories
    const accessories = alloc.accessories || {};
    const accSum = Object.values(accessories).reduce((s: number, a: any) => s + Number(a || 0), 0) as number;
    if (accSum > 0) {
      items.push({ label: 'Accessories Fee', amount: accSum });
    }

    // Fine
    const fine = Number(alloc.fine || 0);
    if (fine > 0) {
      items.push({ label: 'Fine / Penalty Charges', amount: fine });
    }

    // Misc
    const misc = Number(alloc.misc || 0);
    if (misc > 0) {
      items.push({ label: 'Miscellaneous Fee Dues', amount: misc });
    }

    return items;
  };

  const getActiveReceiptItems = () => {
    const items: { label: string; amount: number }[] = [];
    if (!dues) return items;

    selectedCourseTerms.forEach(term => {
      items.push({
        label: term === '0' ? 'Course Fee (Previous Dues)' : `Course Fee - Term ${term}`,
        amount: dues.course[term] || 0
      });
    });
    if (selectedBooks) {
      items.push({ label: 'Books Fee', amount: dues.books });
    }
    if (selectedTransportMonths.length > 0) {
      const sumTrans = selectedTransportMonths.reduce((s, m) => s + (dues.transport[m] || 0), 0);
      items.push({ label: `Transport Fee (${selectedTransportMonths.join(', ')})`, amount: sumTrans });
    }
    if (selectedAccessoriesCats.length > 0) {
      const sumAcc = selectedAccessoriesCats.reduce((s, cat) => s + (dues.accessories[cat] || 0), 0);
      items.push({ label: 'Accessories Fee', amount: sumAcc });
    }
    if (selectedFine) {
      items.push({ label: 'Fine / Penalty Charges', amount: dues.fine });
    }
    if (selectedMisc) {
      items.push({ label: 'Miscellaneous Fee Dues', amount: dues.misc });
    }
    return items;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans print:bg-white print:p-0">
      
      {/* Header */}
      <header className="bg-[#002147] text-white py-4 px-6 sticky top-0 z-50 print:hidden shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white rounded-xl overflow-hidden flex items-center justify-center p-1">
              <img src="/school-logo-official.png" alt="Oxford Logo" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <h1 className="text-xl font-serif font-black tracking-tight text-white uppercase">Adarsh Oxford</h1>
              <span className="text-[9px] font-bold text-[#B8860B] uppercase tracking-widest mt-0.5">Fee Payment Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-white bg-white/10 px-3 py-1.5 rounded-full">
            <ShieldCheck className="h-4 w-4 text-[#B8860B]" />
            <span>Secure UPI QR Checkout</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center py-10 px-4 print:p-0 print:block">
        <div className="w-full max-w-2xl print:max-w-none">
          <AnimatePresence mode="wait">

            {/* STEP 1: SEARCH STUDENT */}
            {step === 'search' && (
              <motion.div
                key="student-search"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-serif font-black text-[#002147] uppercase">Student Dues Lookup</h2>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Enter Admission Number to review pending fee heads
                  </p>
                </div>

                <Card className="border-slate-200/80 shadow-2xl rounded-3xl bg-white overflow-hidden">
                  <CardContent className="p-8">
                    <form onSubmit={handleSearchStudent} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="admNo" className="text-xs font-bold uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
                          <GraduationCap className="h-4.5 w-4.5 text-[#002147]" /> Admission Number
                        </Label>
                        <div className="relative">
                          <Input 
                            id="admNo"
                            value={admissionNumber}
                            onChange={(e) => setAdmissionNumber(e.target.value)}
                            placeholder="e.g. OXF-2024-0123"
                            className="h-13 rounded-2xl border-slate-200 focus-visible:ring-[#002147] pl-11 text-base font-medium font-mono"
                          />
                          <Search className="absolute left-4 top-4.5 h-4.5 w-4.5 text-slate-400" />
                        </div>
                      </div>

                      <Button 
                        type="submit"
                        disabled={isSearching}
                        className="w-full h-13 bg-[#002147] hover:bg-[#002147]/95 text-white font-bold rounded-2xl shadow-lg transition-transform hover:scale-[1.01] flex items-center justify-center gap-2"
                      >
                        {isSearching ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" /> Fetching Dues...
                          </>
                        ) : (
                          <>
                            Find Dues <ChevronRight className="h-5 w-5" />
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* STEP 2: DUES CHECKBOX SELECTION */}
            {step === 'dues' && studentDetails && dues && (
              <motion.div
                key="dues-selection"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <Button variant="ghost" onClick={() => setStep('search')} className="h-10 w-10 rounded-full bg-slate-100 p-0 text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h2 className="text-2xl font-serif font-black text-[#002147] uppercase">Fee Heads Selection</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Select the categories you wish to clear</p>
                  </div>
                </div>

                {/* Profile Card */}
                <Card className="border-none shadow-lg rounded-2xl bg-white overflow-hidden">
                  <CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Student Name</span>
                      <span className="text-[#002147] uppercase text-sm block">{studentDetails.full_name}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Admission Number</span>
                      <span className="text-slate-800 text-sm font-mono block">{studentDetails.admission_number}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Class & Section</span>
                      <span className="text-slate-800 text-sm block">{studentDetails.class_name}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Leaving Clearance</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full inline-block mt-0.5 font-bold ${
                        isLeftStudent ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isLeftStudent ? 'DROPOUT / LEFT' : 'ACTIVE STUDENT'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Select Pay Option */}
                <Card className="border-none shadow-md rounded-2xl bg-white overflow-hidden">
                  <CardContent className="p-5 flex justify-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs uppercase text-slate-700">
                      <input 
                        type="radio" 
                        name="payMode"
                        checked={paymentMode === 'complete'}
                        onChange={() => handleModeChange('complete')}
                        className="h-4.5 w-4.5 text-[#002147] border-slate-300 focus:ring-[#002147]"
                      />
                      Pay Complete Fee
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs uppercase text-slate-700">
                      <input 
                        type="radio" 
                        name="payMode"
                        checked={paymentMode === 'selected'}
                        onChange={() => handleModeChange('selected')}
                        className="h-4.5 w-4.5 text-[#002147] border-slate-300 focus:ring-[#002147]"
                      />
                      Pay Selected Fee Heads
                    </label>
                  </CardContent>
                </Card>

                {/* Dues Breakdown Grid */}
                <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
                  <CardContent className="p-6 md:p-8 space-y-4">
                    <div className="border-b pb-3 mb-4">
                      <h3 className="font-serif font-black text-slate-700 text-sm uppercase tracking-wider">Breakdown of Outstanding Dues</h3>
                    </div>

                    <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-2">
                      
                      {/* Course Fees */}
                      {Object.keys(dues.course).map(term => {
                        const amt = dues.course[term];
                        if (amt <= 0) return null;
                        const key = `course-${term}`;
                        const label = term === '0' ? 'Course Fee (Previous Dues)' : `Course Fee - Term ${term}`;
                        const isChecked = selectedCourseTerms.includes(term);
                        return (
                          <div 
                            key={key} 
                            onClick={() => handleCheckboxToggle('course', term)}
                            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                              isChecked ? 'bg-slate-50/80 border-[#002147] shadow-sm' : 'border-slate-100 hover:bg-slate-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                readOnly
                                className="h-4.5 w-4.5 rounded border-slate-300 text-[#002147] focus:ring-[#002147]"
                              />
                              <span className="text-xs font-bold text-slate-700">{label}</span>
                            </div>
                            <span className="font-mono font-black text-[#002147] text-sm">₹{amt.toFixed(2)}</span>
                          </div>
                        );
                      })}

                      {/* Books Fee */}
                      {dues.books > 0 && (
                        <div 
                          onClick={() => handleCheckboxToggle('books')}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                            selectedBooks ? 'bg-slate-50/80 border-[#002147] shadow-sm' : 'border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox"
                              checked={selectedBooks}
                              readOnly
                              className="h-4.5 w-4.5 rounded border-slate-300 text-[#002147] focus:ring-[#002147]"
                            />
                            <span className="text-xs font-bold text-slate-700">Books & Stationary Fee</span>
                          </div>
                          <span className="font-mono font-black text-[#002147] text-sm">₹{dues.books.toFixed(2)}</span>
                        </div>
                      )}

                      {/* Transport Fee Monthwise */}
                      {Object.keys(dues.transport).map(month => {
                        const amt = dues.transport[month];
                        if (amt <= 0) return null;
                        const key = `transport-${month}`;
                        const monthNames = {
                          '6': 'Jun', '7': 'Jul', '8': 'Aug', '9': 'Sep', '10': 'Oct', 
                          '11': 'Nov', '12': 'Dec', '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr'
                        } as any;
                        const label = `Transport Fee - ${monthNames[month] || `Month ${month}`}`;
                        const isChecked = selectedTransportMonths.includes(month);
                        return (
                          <div 
                            key={key} 
                            onClick={() => handleCheckboxToggle('transport', month)}
                            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                              isChecked ? 'bg-slate-50/80 border-[#002147] shadow-sm' : 'border-slate-100 hover:bg-slate-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                readOnly
                                className="h-4.5 w-4.5 rounded border-slate-300 text-[#002147] focus:ring-[#002147]"
                              />
                              <span className="text-xs font-bold text-slate-700">{label}</span>
                            </div>
                            <span className="font-mono font-black text-[#002147] text-sm">₹{amt.toFixed(2)}</span>
                          </div>
                        );
                      })}

                      {/* Accessories categories */}
                      {Object.keys(dues.accessories).map(catId => {
                        const amt = dues.accessories[catId];
                        if (amt <= 0) return null;
                        const key = `accessories-${catId}`;
                        const label = catId === 'all' ? 'Accessories & Uniform Dues' : `Accessories Fee (${catId.substring(0,8).toUpperCase()})`;
                        const isChecked = selectedAccessoriesCats.includes(catId);
                        return (
                          <div 
                            key={key} 
                            onClick={() => handleCheckboxToggle('accessories', catId)}
                            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                              isChecked ? 'bg-slate-50/80 border-[#002147] shadow-sm' : 'border-slate-100 hover:bg-slate-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                readOnly
                                className="h-4.5 w-4.5 rounded border-slate-300 text-[#002147] focus:ring-[#002147]"
                              />
                              <span className="text-xs font-bold text-slate-700">{label}</span>
                            </div>
                            <span className="font-mono font-black text-[#002147] text-sm">₹{amt.toFixed(2)}</span>
                          </div>
                        );
                      })}

                      {/* Fine */}
                      {dues.fine > 0 && (
                        <div 
                          onClick={() => handleCheckboxToggle('fine')}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                            selectedFine ? 'bg-slate-50/80 border-[#002147] shadow-sm' : 'border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox"
                              checked={selectedFine}
                              readOnly
                              className="h-4.5 w-4.5 rounded border-slate-300 text-[#002147] focus:ring-[#002147]"
                            />
                            <span className="text-xs font-bold text-slate-700">Fines / Penalty Amount</span>
                          </div>
                          <span className="font-mono font-black text-red-600 text-sm">₹{dues.fine.toFixed(2)}</span>
                        </div>
                      )}

                      {/* Miscellaneous */}
                      {dues.misc > 0 && (
                        <div 
                          onClick={() => handleCheckboxToggle('misc')}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                            selectedMisc ? 'bg-slate-50/80 border-[#002147] shadow-sm' : 'border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox"
                              checked={selectedMisc}
                              readOnly
                              className="h-4.5 w-4.5 rounded border-slate-300 text-[#002147] focus:ring-[#002147]"
                            />
                            <span className="text-xs font-bold text-slate-700">Miscellaneous Dues</span>
                          </div>
                          <span className="font-mono font-black text-[#002147] text-sm">₹{dues.misc.toFixed(2)}</span>
                        </div>
                      )}

                    </div>

                    {/* Selection Summary and checkout button */}
                    <div className="pt-6 border-t mt-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Payable Amount</span>
                        <span className="text-2xl font-mono font-black text-[#002147]">
                          ₹{calculateSelectedTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <Button
                        onClick={handleProceedToPayment}
                        className="bg-[#002147] hover:bg-[#002147]/95 text-white font-bold h-12 px-6 rounded-xl shadow-lg flex items-center gap-2 uppercase tracking-wider text-xs"
                      >
                        Checkout QR <ChevronRight className="h-4.5 w-4.5" />
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* STEP 3: DIRECT PHONEPE QR DISPLAY */}
            {step === 'payment' && studentDetails && (
              <motion.div
                key="payment-screen"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6 print:hidden"
              >
                {!isWaitingForAdmin ? (
                  <>
                    {/* Top Alert Banner */}
                    <div className="bg-[#002147] text-white p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-[#B8860B]/10 blur-xl pointer-events-none" />
                      <div className="space-y-0.5 text-center md:text-left">
                        <h3 className="font-serif font-black tracking-wide text-sm md:text-base uppercase text-[#B8860B]">Scan PhonePe QR</h3>
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Please scan QR below to complete transfer</p>
                      </div>
                      
                      {/* Countdown Timer */}
                      <div className={`px-4 py-2 rounded-xl text-xl font-mono font-black tracking-widest flex items-center gap-1.5 shadow-inner ${
                        timeLeft < 60 ? 'bg-red-500 text-white animate-bounce' : 'bg-white/10 text-white'
                      }`}>
                        <Clock className="h-5 w-5 animate-pulse" />
                        <span>{formatTime(timeLeft)}</span>
                      </div>
                    </div>

                    {/* central QR Code Display */}
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col items-center justify-center space-y-4 shadow-inner">
                      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xl w-3/4 max-w-xs flex flex-col items-center">
                        <img 
                          src={customPhonePe} 
                          alt="PhonePe QR scanner" 
                          className="w-full object-contain rounded-xl"
                        />
                      </div>
                      
                      <div className="text-center space-y-1">
                        <h4 className="font-black text-[#002147] uppercase text-sm tracking-wide">
                          RAMADEVI YALLA (PhonePe QR)
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Scan with PhonePe, GPay, Paytm or Any standard UPI App
                        </p>
                        <p className="text-xs text-[#B8860B] font-bold italic pt-1">
                          "You have 5 minutes to complete this payment."
                        </p>
                      </div>
                    </div>

                    {/* Allocation breakdown confirmation panel */}
                    <div className="bg-white border border-slate-100 shadow-md p-6 rounded-2xl space-y-3.5">
                      <div className="flex justify-between items-baseline border-b border-slate-100 pb-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selected checkout dues</span>
                        <span className="text-2xl font-black text-[#002147] font-mono">
                          ₹{calculateSelectedTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs font-bold border-b pb-3.5 mb-2">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Student Name</span>
                          <span className="text-slate-800 uppercase block mt-0.5">{studentDetails.full_name}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Admission Number</span>
                          <span className="text-slate-800 font-mono block mt-0.5">{studentDetails.admission_number}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Allocation breakdown:</span>
                        <div className="max-h-[120px] overflow-y-auto text-xs font-semibold text-slate-500 space-y-1">
                          {getActiveReceiptItems().map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>• {it.label}</span>
                              <span className="font-mono text-slate-700">₹{it.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Submit & Cancel Buttons */}
                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={handleHavePaidSubmit}
                        disabled={isSubmitting}
                        className="w-full h-13 bg-[#002147] hover:bg-[#002147]/95 text-white font-bold rounded-xl shadow-lg text-sm uppercase tracking-wider animate-pulse hover:animate-none"
                      >
                        {isSubmitting ? "Submitting..." : "I Have Paid"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleCancelPayment}
                        className="text-slate-400 hover:text-red-500 font-bold text-xs uppercase tracking-wider h-10 w-fit mx-auto mt-1"
                      >
                        Cancel Payment
                      </Button>
                    </div>
                  </>
                ) : (
                  /* LIVE WAITING FOR ADMIN POLING SCREEN */
                  <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white text-center p-8 space-y-6">
                    {verificationResult === null ? (
                      <div className="space-y-6 py-6">
                        <div className="h-20 w-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto shadow-inner animate-pulse">
                          <Loader2 className="h-10 w-10 text-amber-600 animate-spin" />
                        </div>
                        <div className="space-y-2">
                          <span className="bg-amber-100 text-amber-800 font-bold uppercase tracking-wider text-xs px-3 py-1 rounded-full">
                            Awaiting verification check
                          </span>
                          <h3 className="text-2xl font-black font-serif text-[#002147] pt-2">Verifying bank ledger...</h3>
                          <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto leading-relaxed">
                            Do not close or refresh this window. The fee administrator is matching this transaction reference against the bank ledger.
                          </p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-left max-w-xs mx-auto space-y-2 text-xs font-semibold">
                          <div className="flex justify-between"><span className="text-slate-400">Student</span><span className="text-slate-800 uppercase">{studentDetails.full_name}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Adm No</span><span className="text-slate-800 font-mono">{studentDetails.admission_number}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Total Amount</span><span className="text-[#002147] font-bold font-mono">₹{calculateSelectedTotal().toFixed(2)}</span></div>
                        </div>
                      </div>
                    ) : verificationResult === 'Approved' ? (
                      /* Success Receipt State */
                      <div className="space-y-6 py-6">
                        <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                          <CheckCircle className="h-10 w-10 text-emerald-500" />
                        </div>
                        <div className="space-y-2">
                          <span className="bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider text-xs px-3 py-1 rounded-full">
                            Verified & Approved
                          </span>
                          <h3 className="text-2xl font-black font-serif text-[#002147] pt-2">Transaction Cleared!</h3>
                          <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto">
                            The bank statement has matched successfully. Your official school receipt is printing automatically. Redirecting shortly...
                          </p>
                        </div>
                        <Button 
                          onClick={() => window.print()}
                          className="bg-[#002147] hover:bg-[#002147]/95 text-white font-bold w-full max-w-xs h-12 rounded-xl shadow-lg gap-2"
                        >
                          <Printer className="h-4 w-4" /> Reprint Receipt
                        </Button>
                      </div>
                    ) : (
                      /* Failure Rejected State */
                      <div className="space-y-6 py-6">
                        <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                          <XCircle className="h-10 w-10 text-red-500" />
                        </div>
                        <div className="space-y-2">
                          <span className="bg-red-100 text-red-800 font-bold uppercase tracking-wider text-xs px-3 py-1 rounded-full">
                            Verification Rejected
                          </span>
                          <h3 className="text-2xl font-black font-serif text-[#002147] pt-2">Approval Refused</h3>
                          <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto">
                            The administrator could not verify this transaction reference. Please verify your reference or contact accounts.
                          </p>
                        </div>
                        <Button 
                          onClick={() => {
                            setStep('search');
                            setVerificationResult(null);
                            setIsWaitingForAdmin(false);
                            setPaymentRecordId(null);
                            setScreenshot(null);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold w-full max-w-xs h-12 rounded-xl shadow-lg"
                        >
                          Retry Payment
                        </Button>
                      </div>
                    )}
                  </Card>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* RENDER PRINT RECEIPT STRUCTURE ON SUCCESS */}
      {verificationResult === 'Approved' && generatedReceiptNo && studentDetails && (
        <div className="fixed inset-0 z-[9999] bg-white text-slate-900 font-sans p-6 md:p-12 block print:block overflow-y-auto">
          <div className="w-[800px] mx-auto bg-white border-2 border-slate-950 p-8 rounded-xl shadow-none">
            
            {/* Header branding */}
            <div className="flex flex-col items-center border-b-4 border-slate-950 pb-6 mb-6">
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 shrink-0">
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
                  OFFICIAL FEE RECEIPT (ITEMIZED)
                </span>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-3 mb-6 text-sm font-bold border-b-2 border-dashed border-slate-400 pb-6">
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Receipt No</span>
                <span className="text-slate-900 font-mono">: {generatedReceiptNo}</span>
              </div>
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Date</span>
                <span className="text-slate-900">: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Student Name</span>
                <span className="text-slate-900 uppercase">: {studentDetails.full_name}</span>
              </div>
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Admission No</span>
                <span className="text-slate-900 font-mono">: {studentDetails.admission_number}</span>
              </div>
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Class / Section</span>
                <span className="text-slate-900 uppercase">: {studentDetails.class_name}</span>
              </div>
              <div className="grid grid-cols-[100px_auto] gap-2">
                <span className="text-slate-500 uppercase text-xs">Parent Name</span>
                <span className="text-slate-900 uppercase">: {studentDetails.parent_name}</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="mb-8 min-h-[180px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-950 text-left">
                    <th className="py-2 w-16 text-slate-500 uppercase text-xs font-black">SL</th>
                    <th className="py-2 text-slate-500 uppercase text-xs font-black">Fee Category / Description</th>
                    <th className="py-2 text-right w-40 text-slate-500 uppercase text-xs font-black">Allocated Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {getReceiptItems().map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="py-3 font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-3 font-black uppercase text-slate-800">
                        {it.label}
                      </td>
                      <td className="py-3 text-right font-mono font-black text-slate-900 text-sm">
                        ₹{it.amount.toFixed(2)}
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
                  <span>Provider: <span className="uppercase text-[#002147] font-bold">PhonePe QR</span></span>
                  <span>Status: <span className="text-emerald-600 uppercase font-black">Verified & Received</span></span>
                </div>
                <div className="text-xl font-black font-mono text-[#002147] bg-slate-50 px-4 py-1 border border-slate-200 rounded">
                  GRAND TOTAL: ₹{approvedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="font-bold border-t border-dashed border-slate-400 pt-3 text-xs uppercase tracking-wide">
                Amount In Words: <span className="italic text-slate-700">
                  {numberToWords(Math.floor(approvedAmount))} Rupees Only
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
              <span>System: Oxford ERP UPI static QR Ledger</span>
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

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 px-6 border-t border-slate-800 mt-auto text-center text-xs md:text-sm font-medium print:hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} Adarsh Oxford School. All Rights Reserved.</p>
          <div className="flex gap-4">
            <span className="hover:text-white transition-colors cursor-default">Terms of Use</span>
            <span className="h-4 w-px bg-slate-800" />
            <span className="hover:text-white transition-colors cursor-default">Privacy Policy</span>
          </div>
        </div>
      </footer>
    </div>
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
