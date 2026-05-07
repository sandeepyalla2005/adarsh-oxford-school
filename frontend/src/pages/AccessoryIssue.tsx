import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import {
    Save,
    Printer,
    ArrowLeft,
    CreditCard,
    User,
    GraduationCap,
    ShoppingBag,
    IndianRupee,
    Calendar as CalendarIcon
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AccessoryReceipt } from '@/components/AccessoryReceipt';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Search } from 'lucide-react';

// Helper to capitalize hyphenated strings
const formatTitle = (str: string) => {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export default function AccessoryIssue() {
    const { type } = useParams<{ type: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [receiptData, setReceiptData] = useState<any | null>(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const [students, setStudents] = useState<any[]>([]);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        studentId: '',
        studentName: '',
        className: '',
        quantity: 1,
        price: 0,
        amountPaid: 0,
        paymentMethod: 'Cash',
        date: format(new Date(), 'yyyy-MM-dd')
    });

    // Derived State
    const subtotal = formData.quantity * formData.price;
    const balance = subtotal - formData.amountPaid;

    useEffect(() => {
        // Default prices based on type
        let defaultPrice = 0;
        if (type === 'exam-pads') defaultPrice = 100;
        if (type === 'id-card-belts') defaultPrice = 200;
        if (type === 'uniform') defaultPrice = 600;
        if (type === 'field-trips') defaultPrice = 500;

        setFormData(prev => ({ ...prev, price: defaultPrice }));
        fetchStudents();
    }, [type]);

    const fetchStudents = async () => {
        setIsFetchingStudents(true);
        try {
            const { data, error } = await supabase
                .from('students')
                .select('id, full_name, classes(name)')
                .order('full_name');
            if (error) throw error;
            setStudents(data || []);
        } catch (err) {
            console.error('Error fetching students:', err);
        } finally {
            setIsFetchingStudents(false);
        }
    };

    const handleStudentSelect = (studentId: string) => {
        const student = students.find(s => s.id === studentId);
        if (student) {
            setFormData(prev => ({
                ...prev,
                studentId: student.id,
                studentName: student.full_name,
                className: student.classes?.name || 'Unknown'
            }));
            setStudentSearch('');
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'quantity' || name === 'price' || name === 'amountPaid'
                ? parseFloat(value) || 0
                : value
        }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                accessory_type: type || 'unknown',
                student_name: formData.studentName,
                class_name: formData.className,
                quantity: formData.quantity,
                price: formData.price,
                total_amount: subtotal,
                amount_paid: formData.amountPaid,
                balance: balance,
                payment_method: formData.paymentMethod,
                transaction_date: formData.date
            };

            const { data, error } = await supabase
                .from('accessory_transactions')
                .insert(payload)
                .select()
                .single();

            if (error) throw error;

            const transaction = data as any;

            toast({
                title: "Transaction Successful",
                description: `Receipt ${transaction.receipt_no} generated.`,
            });

            // Show Receipt
            setReceiptData({
                receiptNo: transaction.receipt_no,
                date: transaction.transaction_date,
                studentName: transaction.student_name,
                className: transaction.class_name,
                accessoryType: transaction.accessory_type,
                quantity: transaction.quantity,
                price: transaction.price,
                totalAmount: transaction.total_amount,
                amountPaid: transaction.amount_paid,
                balance: transaction.balance,
                paymentMethod: transaction.payment_method
            });
            setShowReceipt(true);

        } catch (error: any) {
            console.error('Error issuing accessory:', error);

            if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
                toast({
                    variant: "destructive",
                    title: "Database Setup Required",
                    description: "The 'accessory_transactions' table is missing. Please run the SQL migration script in Supabase."
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Transaction Failed",
                    description: error.message || "Could not save transaction."
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = () => {
        // Open receipt in new window for clean printing
        // OR use the Receipt Page route
        if (receiptData) {
            // We can navigate to the dedicated receipt page which is cleaner
            // But for now, let's just window.print() if the modal is full screen or similar.
            // Better: Open a popup window with just the receipt component.
            // Actually, let's keep it simple: Print the current window, but use CSS to hide everything else.
            window.print();
        }
    };

    if (!type) return <div>Invalid Access</div>;

    const title = `${formatTitle(type)} Issue`;

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-6 print:hidden">

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/accessories')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                            {title}
                        </h1>
                        <p className="text-muted-foreground">Manual Student Entry & Receipt Generation</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Form */}
                    <Card className="lg:col-span-2 border-t-4 border-t-primary shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-primary" />
                                Student Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form id="issue-form" onSubmit={handleSubmit} className="space-y-6">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2 relative">
                                        <Label htmlFor="studentSearch">Search & Select Student</Label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="studentSearch"
                                                placeholder="Type student name..."
                                                className="pl-9"
                                                value={studentSearch}
                                                onChange={(e) => setStudentSearch(e.target.value)}
                                            />
                                        </div>
                                        {studentSearch && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {students
                                                    .filter(s => s.full_name.toLowerCase().includes(studentSearch.toLowerCase()))
                                                    .map(s => (
                                                        <div
                                                            key={s.id}
                                                            className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm border-b last:border-0"
                                                            onClick={() => handleStudentSelect(s.id)}
                                                        >
                                                            <div className="font-bold">{s.full_name}</div>
                                                            <div className="text-xs text-muted-foreground">{s.classes?.name}</div>
                                                        </div>
                                                    ))
                                                }
                                                {students.filter(s => s.full_name.toLowerCase().includes(studentSearch.toLowerCase())).length === 0 && (
                                                    <div className="px-4 py-2 text-sm text-muted-foreground">No students found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="studentName">Student Name (Current)</Label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="studentName"
                                                name="studentName"
                                                required
                                                readOnly
                                                className="pl-9 bg-slate-50"
                                                value={formData.studentName}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="className">Class</Label>
                                        <div className="relative">
                                            <GraduationCap className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="className"
                                                name="className"
                                                required
                                                readOnly
                                                className="pl-9 bg-slate-50"
                                                value={formData.className}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Transaction Date</Label>
                                    <div className="relative">
                                        <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="date"
                                            name="date"
                                            required
                                            className="pl-9"
                                            value={formData.date}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                        <ShoppingBag className="h-4 w-4 text-primary" />
                                        Item Details
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="quantity">Quantity</Label>
                                            <Input
                                                id="quantity"
                                                name="quantity"
                                                type="number"
                                                min="1"
                                                required
                                                value={formData.quantity}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="price">Unit Price (₹)</Label>
                                            <Input
                                                id="price"
                                                name="price"
                                                type="number"
                                                min="0"
                                                required
                                                value={formData.price}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Subtotal</Label>
                                            <div className="h-10 px-3 py-2 bg-muted rounded-md font-mono text-right flex items-center justify-end">
                                                ₹ {subtotal.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-4 bg-slate-50 -mx-6 px-6 pb-2">
                                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 mt-4">
                                        <CreditCard className="h-4 w-4 text-primary" />
                                        Payment
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="amountPaid">Amount Paid (₹)</Label>
                                            <Input
                                                id="amountPaid"
                                                name="amountPaid"
                                                type="number"
                                                min="0"
                                                required
                                                className="text-lg font-bold text-green-700"
                                                value={formData.amountPaid}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="paymentMethod">Payment Method</Label>
                                            <Select
                                                value={formData.paymentMethod}
                                                onValueChange={(val) => handleSelectChange('paymentMethod', val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select method" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Cash">Cash</SelectItem>
                                                    <SelectItem value="UPI">UPI</SelectItem>
                                                    <SelectItem value="Card">Card</SelectItem>
                                                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                            </form>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t p-6">
                            <div className="text-sm text-muted-foreground">
                                Balance: <span className={balance > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                                    ₹ {balance.toFixed(2)}
                                </span>
                            </div>
                            <Button
                                type="submit"
                                form="issue-form"
                                className="bg-primary hover:bg-primary/90 min-w-[150px]"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">Saving...</span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Save className="h-4 w-4" /> Save & Generate Receipt
                                    </span>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Quick Stats / Info Side Panel */}
                    <div className="space-y-6">
                        <Card className="bg-blue-50/50 border-blue-100">
                            <CardHeader>
                                <CardTitle className="text-base text-blue-900">Transaction Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Item</span>
                                    <span className="font-medium capitalize">{formatTitle(type)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Total Qty</span>
                                    <span className="font-medium">{formData.quantity}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm pt-2 border-t">
                                    <span className="font-bold text-lg">Total</span>
                                    <span className="font-bold text-lg">₹ {subtotal}</span>
                                </div>

                                {receiptData && (
                                    <div className="pt-4">
                                        <Button variant="outline" className="w-full" onClick={() => setShowReceipt(true)}>
                                            <Printer className="mr-2 h-4 w-4" /> View Last Receipt
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>

            {/* Receipt Dialog/Modal */}
            <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    {receiptData && (
                        <div className="printable-area">
                            <AccessoryReceipt data={receiptData} onPrint={handlePrint} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Print Styles */}
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
          }
          /* Hide Dialog overlay/close button if they are captured */
          .fixed, [role="dialog"] > button {
             display: none !important;
          }
        }
      `}</style>
        </DashboardLayout>
    );
}
