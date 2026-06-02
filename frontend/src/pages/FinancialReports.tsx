import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Printer,
  RefreshCw,
  Wallet,
  QrCode,
  Building2,
  CreditCard,
  Smartphone,
  TrendingUp,
  IndianRupee,
  ReceiptText,
  AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

interface Breakdown {
  total: number;
  cash: number;
  upi: number;
  bank: number;
  cards: number;
  swiping: number;
}

interface FinancialData {
  financial_year: string;
  total_income: number;
  previous_year: Breakdown;
  normal: Breakdown;
  next_year: Breakdown;
  all_splits: {
    cash: number;
    upi: number;
    bank: number;
    cards: number;
    swiping: number;
  };
  pending_dues: number;
}

export default function FinancialReports() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const currentFYStart = currentMonth >= 3 ? currentYear : currentYear - 1;
  const currentFYStr = `${currentFYStart}-${String((currentFYStart + 1) % 100).padStart(2, '0')}`;

  const [selectedFY, setSelectedFY] = useState<string>(currentFYStr);
  const [data, setData] = useState<FinancialData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Generate available financial years for dropdown (e.g. from 2023-24 to 2029-30)
  const years = Array.from({ length: 7 }, (_, i) => {
    const start = 2023 + i;
    const endSuffix = String((start + 1) % 100).padStart(2, '0');
    return `${start}-${endSuffix}`;
  });

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/reports/financial-year?year=${selectedFY}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to fetch financial report');
      }
      const resJson = await response.json();
      setData(resJson.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Server connection failed.');
      toast.error(err.message || 'Failed to load report data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedFY]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  const paymentModesList = [
    { key: 'cash', label: 'Cash', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'upi', label: 'UPI / Online', icon: QrCode, color: 'text-amber-600', bg: 'bg-amber-50' },
    { key: 'bank', label: 'Bank Transfer', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'cards', label: 'Cards', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
    { key: 'swiping', label: 'Swiping', icon: Smartphone, color: 'text-rose-600', bg: 'bg-rose-50' }
  ];

  return (
    <DashboardLayout>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #financial-report-print, #financial-report-print * { visibility: visible !important; }
          #financial-report-print { position: fixed; inset: 0; background: white; z-index: 9999; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="financial-report-print" className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-6"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-12 w-12 rounded-2xl bg-[#002147] flex items-center justify-center shadow-md">
                <ReceiptText className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-black text-[#002147] font-display">Financial Year Reports</h1>
            </div>
            <p className="text-slate-500 text-sm pl-[60px] font-medium">
              Detailed audit-ready breakdown of total collections split by dues, current term, and advance payments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 no-print pl-[60px] md:pl-0">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border shadow-sm">
              <Calendar className="h-4 w-4 text-[#002147]" />
              <span className="text-xs font-bold text-[#002147]">FY Select:</span>
              <Select value={selectedFY} onValueChange={setSelectedFY}>
                <SelectTrigger className="w-32 border-none font-bold text-sm text-[#002147] h-8 p-0 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y} className="font-semibold">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="rounded-xl border-slate-200 gap-1.5 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl border-slate-200 gap-1.5 shadow-sm hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex flex-col h-[50vh] items-center justify-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#002147] border-t-transparent" />
            <p className="text-slate-400 text-sm font-medium">Compiling audit-level transactions...</p>
          </div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl bg-red-50 border border-red-100 p-8 text-center max-w-lg mx-auto"
          >
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-red-900 mb-2">Failed to load report</h3>
            <p className="text-red-700 text-sm mb-6">{error}</p>
            <Button onClick={fetchData} className="bg-[#002147] hover:bg-[#003366] text-white rounded-xl">
              Try Again
            </Button>
          </motion.div>
        ) : data ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Grand Summary Grid */}
            <div className="grid gap-6 md:grid-cols-4">
              {/* Grand Total Income */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="col-span-full md:col-span-2 relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#002147] to-[#004080] p-8 shadow-xl text-white flex flex-col justify-between min-h-[200px]"
              >
                <div className="absolute top-0 right-0 h-40 w-40 bg-white/10 rounded-bl-full -mr-12 -mt-12 blur-2xl pointer-events-none" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Grand Summary</span>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white/80 mt-1">Total Income Collected</h2>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center">
                    <IndianRupee className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="mt-8">
                  <p className="text-5xl font-black font-display tracking-tight">{formatCurrency(data.total_income)}</p>
                  <p className="text-xs text-white/60 font-semibold mt-2">
                    Total fee collected during the financial year {data.financial_year} (Arrears + Current + Advance)
                  </p>
                </div>
              </motion.div>

              {/* Pending Dues Carry Forward */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="col-span-full md:col-span-2 relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200 p-8 shadow-md flex flex-col justify-between min-h-[200px]"
              >
                <div className="absolute top-0 right-0 h-40 w-40 bg-amber-500/10 rounded-bl-full -mr-12 -mt-12 blur-2xl pointer-events-none" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-800">Uncollected Revenue</span>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-amber-900 mt-1">Pending Dues (Carry-Forward)</h2>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-amber-100 flex items-center justify-center border border-amber-200">
                    <AlertCircle className="h-6 w-6 text-amber-700" />
                  </div>
                </div>
                <div className="mt-8">
                  <p className="text-5xl font-black font-display tracking-tight text-amber-900">{formatCurrency(data.pending_dues)}</p>
                  <p className="text-xs text-amber-700/80 font-semibold mt-2 leading-relaxed">
                    Informational: This represents outstanding unpaid fees for this year to be carried forward to the next year. It is not included in the total income.
                  </p>
                </div>
              </motion.div>

              {/* Mode Distribution Mini-Grid */}
              <Card className="col-span-full border-none shadow-lg rounded-[2.5rem] bg-white overflow-hidden p-6">
                <CardHeader className="pb-4 p-0">
                  <CardTitle className="text-lg font-bold text-[#002147]">Payment Mode Overview</CardTitle>
                  <CardDescription>Overall breakdown of the selected financial year income</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
                    {paymentModesList.map((mode) => {
                      const val = data.all_splits[mode.key as keyof typeof data.all_splits] || 0;
                      return (
                        <div key={mode.key} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-100/60">
                          <div className={`h-9 w-9 rounded-xl ${mode.bg} flex items-center justify-center mb-2`}>
                            <mode.icon className={`h-4.5 w-4.5 ${mode.color}`} />
                          </div>
                          <span className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider mb-0.5">{mode.label.split(' ')[0]}</span>
                          <span className="text-xs font-black text-slate-800">{formatCurrency(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Split Categories Details */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Category 1: Previous Year Collection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col justify-between h-full">
                  <div className="p-6 pb-4 border-b border-slate-50">
                    <div className="flex justify-between items-center mb-3">
                      <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-orange-600" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md">Arrears / Dues</span>
                    </div>
                    <h3 className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">Previous Year Collection</h3>
                    <p className="text-3xl font-black text-slate-800 font-display mt-2">{formatCurrency(data.previous_year.total)}</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">Outstanding fees from previous terms collected in this year</p>
                  </div>
                  
                  <div className="p-6 bg-slate-50/50 space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Collected Via</h4>
                    <div className="space-y-2">
                      {paymentModesList.map((mode) => {
                        const val = data.previous_year[mode.key as keyof Breakdown] || 0;
                        return (
                          <div key={mode.key} className="flex items-center justify-between text-xs py-1.5 border-b border-dashed border-slate-200/60 last:border-0">
                            <div className="flex items-center gap-2 text-slate-600">
                              <mode.icon className={`h-4 w-4 ${mode.color}`} />
                              <span>{mode.label}</span>
                            </div>
                            <span className="font-bold text-slate-800">{formatCurrency(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Category 2: Normal Fee Collection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col justify-between h-full">
                  <div className="p-6 pb-4 border-b border-slate-50">
                    <div className="flex justify-between items-center mb-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">Current Year</span>
                    </div>
                    <h3 className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">Normal Fee Collection</h3>
                    <p className="text-3xl font-black text-slate-800 font-display mt-2">{formatCurrency(data.normal.total)}</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">Normal course, books, and transport fees of this academic year</p>
                  </div>
                  
                  <div className="p-6 bg-slate-50/50 space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Collected Via</h4>
                    <div className="space-y-2">
                      {paymentModesList.map((mode) => {
                        const val = data.normal[mode.key as keyof Breakdown] || 0;
                        return (
                          <div key={mode.key} className="flex items-center justify-between text-xs py-1.5 border-b border-dashed border-slate-200/60 last:border-0">
                            <div className="flex items-center gap-2 text-slate-600">
                              <mode.icon className={`h-4 w-4 ${mode.color}`} />
                              <span>{mode.label}</span>
                            </div>
                            <span className="font-bold text-slate-800">{formatCurrency(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Category 3: Next Year Advance Collection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col justify-between h-full">
                  <div className="p-6 pb-4 border-b border-slate-50">
                    <div className="flex justify-between items-center mb-3">
                      <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-purple-600" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md">Advance Payments</span>
                    </div>
                    <h3 className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">Next Year Advance Collection</h3>
                    <p className="text-3xl font-black text-slate-800 font-display mt-2">{formatCurrency(data.next_year.total)}</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">Prepayments or booking collections received for the next year</p>
                  </div>
                  
                  <div className="p-6 bg-slate-50/50 space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Collected Via</h4>
                    <div className="space-y-2">
                      {paymentModesList.map((mode) => {
                        const val = data.next_year[mode.key as keyof Breakdown] || 0;
                        return (
                          <div key={mode.key} className="flex items-center justify-between text-xs py-1.5 border-b border-dashed border-slate-200/60 last:border-0">
                            <div className="flex items-center gap-2 text-slate-600">
                              <mode.icon className={`h-4 w-4 ${mode.color}`} />
                              <span>{mode.label}</span>
                            </div>
                            <span className="font-bold text-slate-800">{formatCurrency(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
