import { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Printer, Download } from 'lucide-react';

interface ReceiptProps {
    receiptNo: string;
    date: string;
    studentName: string;
    className: string;
    accessoryType: string;
    quantity: number;
    price: number;
    totalAmount: number;
    amountPaid: number;
    balance: number;
    paymentMethod: string;
}

export const AccessoryReceipt = forwardRef<HTMLDivElement, { data: ReceiptProps, onPrint: () => void }>(({ data, onPrint }, ref) => {
    return (
        <Card className="max-w-md mx-auto print:shadow-none print:border-none">
            <CardContent className="p-6 space-y-6" ref={ref}>
                <div className="text-center border-b pb-4">
                    <CardTitle className="font-bold text-xl uppercase">Adarsh Oxford</CardTitle>
                    <div className="text-sm font-semibold text-muted-foreground uppercase">Excellence in Education</div>
                    <div className="mt-2 text-xs text-muted-foreground">Original Receipt</div>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="font-semibold">Receipt No:</span>
                    <span>{data.receiptNo}</span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="text-muted-foreground">Accessory:</div>
                    <div className="font-medium capitalize">{data.accessoryType.replace(/-/g, ' ')}</div>

                    <div className="text-muted-foreground">Student:</div>
                    <div className="font-medium">{data.studentName}</div>

                    <div className="text-muted-foreground">Class:</div>
                    <div className="font-medium">{data.className}</div>

                    <div className="text-muted-foreground">Date:</div>
                    <div className="font-medium">{new Date(data.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>

                <div className="border-t border-b py-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Quantity</span>
                        <span>{data.quantity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span>Unit Price</span>
                        <span>₹{data.price}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 mt-2 border-t border-dashed">
                        <span>Total</span>
                        <span>₹{data.totalAmount}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Amount Paid</span>
                        <span className="font-medium text-green-600">₹{data.amountPaid}</span>
                    </div>
                    {data.balance > 0 && (
                        <div className="flex justify-between text-sm text-red-600 font-bold">
                            <span>Balance Due</span>
                            <span>₹{data.balance}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground pt-2">
                        <span>Payment Method: {data.paymentMethod}</span>
                    </div>
                </div>

                <div className="pt-8 text-center text-xs text-muted-foreground">
                    <p>Thank you for your payment!</p>
                    <p>Please keep this receipt for future reference.</p>
                </div>
            </CardContent>

            <div className="p-4 border-t bg-muted/20 flex gap-2 justify-end print:hidden">
                <Button variant="outline" size="sm" onClick={onPrint}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                </Button>
                <Button variant="ghost" size="sm" disabled>
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                </Button>
            </div>
        </Card>
    );
});

AccessoryReceipt.displayName = 'AccessoryReceipt';
