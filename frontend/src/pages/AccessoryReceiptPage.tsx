import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AccessoryReceipt } from '@/components/AccessoryReceipt'; // Adjust path if needed
import { ArrowLeft, Loader2 } from 'lucide-react';
// import { useReactToPrint } from 'react-to-print';

export default function AccessoryReceiptPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const componentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id) fetchReceipt();
    }, [id]);

    const fetchReceipt = async () => {
        try {
            // Check both ID and Receipt No for flexibility
            const { data: receipts, error } = await supabase
                .from('accessory_transactions')
                .select('*')
                .or(`id.eq.${id},receipt_no.eq.${id}`);

            if (error) throw error;
            if (!receipts || receipts.length === 0) throw new Error("Receipt not found");

            const receipt = receipts[0];

            // Cast to any since the table is new and types might not be generated yet
            const r = receipt as any;

            setData({
                receiptNo: r.receipt_no,
                date: r.transaction_date,
                studentName: r.student_name,
                className: r.class_name,
                accessoryType: r.accessory_type,
                quantity: r.quantity,
                price: r.price,
                totalAmount: r.total_amount,
                amountPaid: r.amount_paid,
                balance: r.balance,
                paymentMethod: r.payment_method
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );

    if (!data) return (
        <div className="flex h-screen flex-col items-center justify-center gap-4">
            <h2 className="text-xl font-bold">Receipt Not Found</h2>
            <Button onClick={() => navigate('/accessories')}>Go Back</Button>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white flex flex-col items-center">
            {/* Actions Header */}
            <div className="w-full max-w-md mb-6 flex justify-between items-center print:hidden">
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <div className="text-sm text-muted-foreground">
                    Receipt #{data.receiptNo}
                </div>
            </div>

            {/* Printable Area */}
            <div className="printable-area w-full flex justify-center">
                <AccessoryReceipt
                    ref={componentRef}
                    data={data}
                    onPrint={handlePrint}
                />
            </div>

            <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding-top: 2cm;
          }
          /* Hide the print button inside the component when printing */
          button {
             display: none !important;
          }
        }
      `}</style>
        </div>
    );
}
