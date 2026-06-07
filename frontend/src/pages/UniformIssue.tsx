import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shirt, Save, Printer, ArrowLeft, Loader2, Check, Search, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Student {
    id: string;
    full_name: string;
    admission_number: string;
    class_id: string;
    classes?: { name: string };
    gender?: 'Male' | 'Female' | 'Other';
}

interface UniformItem {
    id: string;
    item_name: string;
    unit_price: number;
    quantity: number;
}

interface OrderItem {
    type: string; // 'Shirt', 'Pant', etc.
    active: boolean;
    selectedItemId: string;
    quantity: number;
    price: number;
}

export default function UniformIssue() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [students, setStudents] = useState<Student[]>([]);
    const [uniformItems, setUniformItems] = useState<UniformItem[]>([]);

    // Selection State
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Order State
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountPaid, setAmountPaid] = useState<number>(0);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    // Dynamic Lines based on gender
    const [orderLines, setOrderLines] = useState<Record<string, OrderItem>>({});

    const uniformTypes = {
        Male: ['Shirt', 'Short', 'Pant', 'Cloth'],
        Female: ['Shirt', 'Skirt', 'Pant', 'Top', 'Chunni', 'Cloth'],
        Other: ['Shirt', 'Short', 'Pant', 'Skirt', 'Top', 'Chunni', 'Cloth']
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedStudentId) {
            const student = students.find(s => s.id === selectedStudentId);
            setSelectedStudent(student || null);
            if (student) {
                initializeOrderLines(student.gender || 'Male');
                // Ensure search query matches selected student if not already
                if (!searchQuery) {
                    setSearchQuery(student.full_name);
                }
            }
        } else {
            setSelectedStudent(null);
            setOrderLines({});
        }
    }, [selectedStudentId, students]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Students with gender
            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select('id, full_name, admission_number, class_id, gender, classes(name)')
                .eq('is_active', true)
                .order('full_name');

            if (studentsError) throw studentsError;

            // Fetch Uniform Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('accessories')
                .select('id, item_name, unit_price, quantity')
                .eq('category', 'uniform')
                .eq('is_active', true)
                .gt('quantity', 0); // Only show in-stock items? Or show all but disable?

            if (itemsError) throw itemsError;

            setStudents(studentsData || []);
            setUniformItems((itemsData as any[])?.map(item => ({
                id: item.id,
                item_name: item.item_name,
                unit_price: item.unit_price,
                quantity: item.quantity
            })) || []);
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to load data");
        } finally {
            setIsLoading(false);
        }
    };

    const initializeOrderLines = (gender: string) => {
        const types = uniformTypes[gender as keyof typeof uniformTypes] || uniformTypes.Male;
        const initialLines: Record<string, OrderItem> = {};

        types.forEach(type => {
            initialLines[type] = {
                type,
                active: false,
                selectedItemId: '',
                quantity: 1,
                price: 0
            };
        });
        setOrderLines(initialLines);
    };

    const handleLineChange = (type: string, field: keyof OrderItem, value: any) => {
        setOrderLines(prev => {
            const line = { ...prev[type] };

            if (field === 'active') {
                line.active = value;
                if (!value) {
                    // Reset if unchecked? Maybe keep values
                }
            } else if (field === 'selectedItemId') {
                line.selectedItemId = value;
                const item = uniformItems.find(i => i.id === value);
                if (item) {
                    line.price = item.unit_price;
                }
            } else if (field === 'quantity') {
                line.quantity = Number(value);
            } else if (field === 'price') {
                line.price = Number(value);
            }

            return { ...prev, [type]: line };
        });
    };

    // Filter items for a specific type (simple keyword matching)
    const getItemsForType = (type: string) => {
        return uniformItems.filter(item =>
            item.item_name.toLowerCase().includes(type.toLowerCase())
        );
    };

    const calculateTotal = () => {
        return Object.values(orderLines).reduce((sum, line) => {
            if (line.active) {
                return sum + (line.quantity * line.price);
            }
            return sum;
        }, 0);
    };

    const grandTotal = calculateTotal();
    const balance = grandTotal - amountPaid;

    // Use effect to auto-update amount paid to full amount initially?
    useEffect(() => {
        setAmountPaid(grandTotal);
    }, [grandTotal]); // Optional: remove if manual entry preferred

    const handleSubmit = async () => {
        if (!selectedStudent || !user) return;

        // Filter active lines
        const activeLines = Object.values(orderLines).filter(l => l.active);

        if (activeLines.length === 0) {
            toast.error("Please select at least one item");
            return;
        }

        setIsSubmitting(true);
        try {
            const receiptNumber = `UNI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const year = getCurrentAcademicYear();

            // Insert sales records
            for (const line of activeLines) {
                const total = line.quantity * line.price;
                const accessoryId = line.selectedItemId || null;

                const { error: saleError } = await supabase.from('accessory_sales').insert({
                    student_id: selectedStudent.id,
                    accessory_id: accessoryId,
                    academic_year: year,
                    quantity: line.quantity,
                    unit_price: line.price,
                    total_amount: total,
                    payment_method: paymentMethod,
                    payment_status: 'paid', // Assuming immediate payment for issue
                    receipt_number: receiptNumber,
                    collected_by: user.id,
                    uniform_type: 'readymade', // Defaulting or could use selected item info
                    created_at: new Date(paymentDate).toISOString()
                });

                if (saleError) throw saleError;

                // Update stock ONLY if a specific item was selected
                if (accessoryId) {
                    const item = uniformItems.find(i => i.id === accessoryId);
                    if (item) {
                        const newQuantity = Math.max(0, item.quantity - line.quantity);
                        const status = newQuantity === 0 ? 'out_of_stock' : newQuantity <= 5 ? 'low_stock' : 'in_stock';

                        await supabase.from('accessories')
                            .update({ quantity: newQuantity, stock_status: status })
                            .eq('id', item.id);
                    }
                }
            }

            toast.success("Uniform Issued Successfully");
            navigate(`/receipt?receiptNo=${receiptNumber}&type=accessory`);

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to save transaction");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex h-96 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto space-y-6 pb-20">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/accessories')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-black text-[#002147] font-display flex items-center gap-2">
                            <Shirt className="h-8 w-8" />
                            School Uniform Issue
                        </h1>
                        <p className="text-slate-500">Issue uniform sets to students and generate receipts</p>
                    </div>
                    <div className="ml-auto">
                        <Button variant="outline" onClick={() => navigate('/accessories/history')}>
                            Transaction History
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Student Selection & Info */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="shadow-lg border-slate-200">
                            <CardHeader className="bg-slate-50 border-b border-slate-100">
                                <CardTitle className="text-lg font-bold text-[#002147]">Student Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="space-y-2">
                                    <Label>Select Student</Label>
                                    <div className="relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                placeholder="Search student by name..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    setIsDropdownOpen(true);
                                                    if (selectedStudentId) {
                                                        setSelectedStudentId('');
                                                        setSelectedStudent(null);
                                                    }
                                                }}
                                                onFocus={() => setIsDropdownOpen(true)}
                                                className="pl-9 h-11"
                                            />
                                            {searchQuery && (
                                                <button
                                                    onClick={() => {
                                                        setSearchQuery('');
                                                        setSelectedStudentId('');
                                                        setSelectedStudent(null);
                                                        setIsDropdownOpen(true);
                                                    }}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>

                                        {isDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                                {students.filter(s =>
                                                    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    s.admission_number.toLowerCase().includes(searchQuery.toLowerCase())
                                                ).length === 0 ? (
                                                    <div className="p-3 text-sm text-slate-500 text-center">No students found</div>
                                                ) : (
                                                    students.filter(s =>
                                                        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                        s.admission_number.toLowerCase().includes(searchQuery.toLowerCase())
                                                    ).map(s => (
                                                        <div
                                                            key={s.id}
                                                            className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center"
                                                            onClick={() => {
                                                                setSelectedStudentId(s.id);
                                                                setSearchQuery(s.full_name);
                                                                setIsDropdownOpen(false);
                                                            }}
                                                        >
                                                            <div>
                                                                <div className="font-medium text-slate-800">{s.full_name}</div>
                                                                <div className="text-xs text-slate-500">Adm: {s.admission_number} • Class: {s.classes?.name}</div>
                                                            </div>
                                                            {s.id === selectedStudentId && <Check className="h-4 w-4 text-green-600" />}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                        {isDropdownOpen && (
                                            <div
                                                className="fixed inset-0 z-0"
                                                onClick={() => setIsDropdownOpen(false)}
                                            />
                                        )}
                                    </div>
                                </div>

                                {selectedStudent && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3"
                                    >
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <span className="text-slate-500">Admission No:</span>
                                            <span className="font-semibold text-slate-800 text-right">{selectedStudent.admission_number}</span>

                                            <span className="text-slate-500">Class:</span>
                                            <span className="font-semibold text-slate-800 text-right">{selectedStudent.classes?.name}</span>

                                            <span className="text-slate-500">Gender:</span>
                                            <span className="font-semibold text-slate-800 text-right">{selectedStudent.gender || 'N/A'}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Payment Details */}
                        <Card className="shadow-lg border-slate-200">
                            <CardHeader className="bg-slate-50 border-b border-slate-100">
                                <CardTitle className="text-lg font-bold text-[#002147]">Payment Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="p-4 bg-slate-900 text-white rounded-xl mb-4">
                                    <div className="text-sm text-slate-400 mb-1">Grand Total</div>
                                    <div className="text-3xl font-bold font-mono">₹ {grandTotal.toLocaleString()}</div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Amount Paid</Label>
                                    <Input
                                        type="number"
                                        value={amountPaid}
                                        onChange={e => setAmountPaid(Number(e.target.value))}
                                        className="font-bold text-lg h-11"
                                    />
                                </div>

                                <div className="flex justify-between items-center text-sm font-medium pt-2 border-t text-slate-600">
                                    <span>Balance Due:</span>
                                    <span className={cn("text-lg", balance > 0 ? "text-red-600" : "text-green-600")}>
                                        ₹ {balance.toLocaleString()}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <Label>Payment Method</Label>
                                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="qr_code">UPI / Online</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input
                                        type="date"
                                        value={paymentDate}
                                        onChange={e => setPaymentDate(e.target.value)}
                                    />
                                </div>

                                <Button
                                    className="w-full h-12 text-lg font-bold bg-[#002147] hover:bg-[#002147]/90 mt-4 shadow-xl"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !selectedStudent || grandTotal === 0}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Printer className="mr-2 h-5 w-5" />
                                            Generate Receipt
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Dynamic Items */}
                    <div className="lg:col-span-2">
                        <Card className="shadow-lg border-slate-200 h-full">
                            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
                                <CardTitle className="text-lg font-bold text-[#002147]">Uniform Items</CardTitle>
                                {selectedStudent && <span className="text-sm font-medium text-slate-500">{selectedStudent.gender} Set</span>}
                            </CardHeader>
                            <CardContent className="p-0">
                                {!selectedStudent ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                        <Shirt className="h-12 w-12 mb-3 opacity-20" />
                                        <p>Select a student to view applicable items</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-500">
                                            <div className="col-span-1 text-center">Select</div>
                                            <div className="col-span-5">Item Type</div>
                                            <div className="col-span-2 text-center">Qty</div>
                                            <div className="col-span-2 text-right">Price</div>
                                            <div className="col-span-2 text-right">Total</div>
                                        </div>

                                        {Object.values(orderLines).map((line) => (
                                            <motion.div
                                                key={line.type}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className={cn(
                                                    "grid grid-cols-12 gap-4 p-4 items-center transition-colors",
                                                    line.active ? "bg-blue-50/30" : "hover:bg-slate-50"
                                                )}
                                            >
                                                {/* Checkbox */}
                                                <div className="col-span-1 flex justify-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={line.active}
                                                        onChange={(e) => handleLineChange(line.type, 'active', e.target.checked)}
                                                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </div>

                                                {/* Item Selection */}
                                                <div className="col-span-5 space-y-1">
                                                    <span className="text-sm font-semibold text-slate-700 block">{line.type}</span>
                                                    <Select
                                                        value={line.selectedItemId}
                                                        onValueChange={(val) => {
                                                            handleLineChange(line.type, 'selectedItemId', val);
                                                            handleLineChange(line.type, 'active', true);
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-9 text-xs">
                                                            <SelectValue placeholder={`Select ${line.type}`} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {getItemsForType(line.type).map(item => (
                                                                <SelectItem key={item.id} value={item.id}>
                                                                    {item.item_name} (₹{item.unit_price})
                                                                </SelectItem>
                                                            ))}
                                                            {getItemsForType(line.type).length === 0 && (
                                                                <SelectItem value="none" disabled>No items found</SelectItem>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Quantity */}
                                                <div className="col-span-2">
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={line.quantity}
                                                        onChange={(e) => handleLineChange(line.type, 'quantity', e.target.value)}
                                                        className="h-9 text-center"
                                                        disabled={!line.active}
                                                    />
                                                </div>

                                                {/* Price */}
                                                <div className="col-span-2">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        value={line.price}
                                                        onChange={(e) => handleLineChange(line.type, 'price', e.target.value)}
                                                        className="h-9 text-right"
                                                        disabled={!line.active}
                                                    />
                                                </div>

                                                {/* Subtotal */}
                                                <div className="col-span-2 text-right font-bold text-slate-700">
                                                    ₹ {(line.active ? line.quantity * line.price : 0).toLocaleString()}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

