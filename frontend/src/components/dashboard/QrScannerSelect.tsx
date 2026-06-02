import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function QrScannerSelect() {
  const [preferredQr, setPreferredQr] = useState<'phonepe' | 'icici'>(() => {
    return (localStorage.getItem('oxford_preferred_qr') as 'phonepe' | 'icici') || 'phonepe';
  });

  return (
    <div className="mt-4 p-4 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Select QR Scanner</Label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={preferredQr === 'phonepe' ? 'default' : 'outline'}
          onClick={() => {
            setPreferredQr('phonepe');
            localStorage.setItem('oxford_preferred_qr', 'phonepe');
          }}
          className={cn(
            "h-10 text-xs font-bold rounded-xl transition-all",
            preferredQr === 'phonepe'
              ? "bg-[#5f259f] hover:bg-[#4b1c7e] text-white shadow-md border-transparent"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          PhonePe (Ramadevi)
        </Button>
        <Button
          type="button"
          variant={preferredQr === 'icici' ? 'default' : 'outline'}
          onClick={() => {
            setPreferredQr('icici');
            localStorage.setItem('oxford_preferred_qr', 'icici');
          }}
          className={cn(
            "h-10 text-xs font-bold rounded-xl transition-all",
            preferredQr === 'icici'
              ? "bg-[#f26522] hover:bg-[#da5012] text-white shadow-md border-transparent"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          ICICI Bank (Bellamkonda)
        </Button>
      </div>
      <div className="flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-slate-100 shadow-inner">
        <img
          src={preferredQr === 'phonepe' ? '/qr-phonepe.png' : '/qr-icici.png'}
          alt="UPI QR Scanner"
          className="h-48 object-contain rounded-lg border border-slate-50 bg-white shadow-sm"
        />
        <p className="mt-3 text-xs font-black tracking-tight text-slate-800 uppercase">
          {preferredQr === 'phonepe' ? 'RAMADEVI YALLA' : 'BELLAMKONDA EDUCATION SOCIETY'}
        </p>
        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
          {preferredQr === 'phonepe' ? 'Scan & Pay Using PhonePe App' : 'UPI ID: eazypay.6FKX4VAY81VEJXX@icici'}
        </p>
      </div>
    </div>
  );
}
