import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Calendar,
  IndianRupee,
  Search,
  Filter,
  ArrowLeft,
  Receipt,
  User,
  ShoppingCart,
  FileText
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SaleRecord {
  id: string;
  student_name: string;
  student_class: string;
  item_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  receipt_number: string;
  created_at: string;
}

export default function AccessoriesHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'uniform', label: 'School Uniform' },
    { value: 'exam_booklet', label: 'Exam Booklet' },
    { value: 'belts', label: 'Belts' },
    { value: 'id_card', label: 'ID Card' },
    { value: 'cultural', label: 'Cultural Activity' }
  ];

  const paymentStatuses = [
    { value: 'all', label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('accessory_sales')
        .select('id, receipt_number, quantity, unit_price, total_amount, payment_method, payment_status, created_at, accessories(item_name, category), students(full_name, classes(name))')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((sale: any) => ({
        id: sale.id,
        student_name: sale.students?.full_name || 'Unknown',
        student_class: sale.students?.classes?.name || 'Unknown',
        item_name: sale.accessories?.item_name || 'Unknown',
        category: sale.accessories?.category || 'unknown',
        quantity: Number(sale.quantity) || 0,
        unit_price: Number(sale.unit_price) || 0,
        total_amount: Number(sale.total_amount) || 0,
        payment_method: sale.payment_method,
        payment_status: sale.payment_status,
        receipt_number: sale.receipt_number,
        created_at: sale.created_at,
      }));

      setSales(mapped);
    } catch (error: any) {
      console.error('Error fetching sales data:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load sales',
        description: error.message || 'Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default">Paid</Badge>;
      case 'pending':
        return <Badge variant="destructive">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const categoryMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      uniform: { label: 'Uniform', variant: 'default' },
      exam_booklet: { label: 'Exam Booklet', variant: 'secondary' },
      belts: { label: 'Belts', variant: 'outline' },
      id_card: { label: 'ID Card', variant: 'default' },
      cultural: { label: 'Cultural', variant: 'secondary' }
    };

    const config = categoryMap[category] || { label: category, variant: 'outline' };
    return <Badge variant={config.variant} className="capitalize">{config.label}</Badge>;
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch =
      sale.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.item_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = filterCategory === 'all' || sale.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || sale.payment_status === filterStatus;
    const matchesYear = new Date(sale.created_at).getFullYear().toString() === filterYear;

    return matchesSearch && matchesCategory && matchesStatus && matchesYear;
  });

  const totalRevenue = filteredSales
    .filter(sale => sale.payment_status === 'paid')
    .reduce((sum, sale) => sum + sale.total_amount, 0);

  const pendingAmount = filteredSales
    .filter(sale => sale.payment_status === 'pending')
    .reduce((sum, sale) => sum + sale.total_amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-header"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/accessories')}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="page-title flex items-center gap-3">
                  <Receipt className="h-8 w-8 text-primary" />
                  Accessories Transaction History
                </h1>
                <p className="page-description">View all accessories transactions and history</p>
              </div>
            </div>
            <Button onClick={() => navigate('/accessories')} variant="outline">
              <Package className="mr-2 h-4 w-4" />
              Back to Accessories
            </Button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredSales.length}</div>
                <p className="text-xs text-muted-foreground">Filtered records</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">From paid transactions</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(pendingAmount)}</div>
                <p className="text-xs text-muted-foreground">Awaiting payment</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredSales.length > 0
                    ? `${Math.round((filteredSales.filter(s => s.payment_status === 'paid').length / filteredSales.length) * 100)}%`
                    : '0%'
                  }
                </div>
                <p className="text-xs text-muted-foreground">Payment completion</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by student or receipt..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Payment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={() => {
                  setSearchQuery('');
                  setFilterCategory('all');
                  setFilterStatus('all');
                  setFilterYear(new Date().getFullYear().toString());
                }}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sales Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="table-header">
                      <TableHead>Receipt No.</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8">
                          <div className="h-6 w-6 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </TableCell>
                      </TableRow>
                    ) : filteredSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                          No sales records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSales.map((sale) => (
                        <TableRow key={sale.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{sale.receipt_number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {sale.student_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sale.student_class}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{sale.item_name}</TableCell>
                          <TableCell>{getCategoryBadge(sale.category)}</TableCell>
                          <TableCell className="text-right">{sale.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(sale.unit_price)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(sale.total_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {sale.payment_method.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{getPaymentStatusBadge(sale.payment_status)}</TableCell>
                          <TableCell>{formatDate(sale.created_at)}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/receipt?receiptNo=${sale.receipt_number}&type=accessory`)}
                            >
                              <FileText className="h-4 w-4 text-primary" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
