import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Shirt,
  Plus,
  Edit,
  Trash2,
  ShoppingCart,
  Search,
  Filter,
  ArrowLeft,
  Package,
  IndianRupee,
  Users,
  AlertTriangle,
  Smartphone
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UniformItem {
  id: string;
  item_name: string;
  description: string;
  unit_price: number;
  quantity: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  is_active: boolean;
  created_at: string;
}

interface StudentOption {
  id: string;
  full_name: string;
  admission_number: string;
  class_id: string;
  classes?: {
    name: string;
  };
}

interface ClassOption {
  id: string;
  name: string;
}

export default function AccessoriesUniform() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [uniformItems, setUniformItems] = useState<UniformItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UniformItem | null>(null);
  const [isSaleDialogOpen, setIsSaleDialogOpen] = useState(false);
  const [selectedItemForSale, setSelectedItemForSale] = useState<UniformItem | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [salePaymentMethod, setSalePaymentMethod] = useState('cash');
  const [salePaymentStatus, setSalePaymentStatus] = useState('paid');
  const [saleUniformType, setSaleUniformType] = useState<'cloth' | 'readymade'>('readymade');
  const [saleUniformSize, setSaleUniformSize] = useState('');
  const [isSaleSubmitting, setIsSaleSubmitting] = useState(false);

  const stockStatuses = [
    { value: 'all', label: 'All Status' },
    { value: 'in_stock', label: 'In Stock' },
    { value: 'low_stock', label: 'Low Stock' },
    { value: 'out_of_stock', label: 'Out of Stock' }
  ];

  useEffect(() => {
    fetchUniformItems();
    fetchClasses();
    fetchStudents();
  }, []);

  const fetchUniformItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('accessories')
        .select('*')
        .eq('category', 'uniform')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUniformItems((data as any[]) || []);
    } catch (error: any) {
      console.error('Error fetching uniform items:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load uniforms',
        description: error.message || 'Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .order('sort_order');

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to load classes',
        description: error.message || 'Please try again later.',
      });
      return;
    }

    setClasses((data as any[]) || []);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, admission_number, class_id, classes(name)')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to load students',
        description: error.message || 'Please try again later.',
      });
      return;
    }

    setStudents(data || []);
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

  const getStockStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge variant="default">In Stock</Badge>;
      case 'low_stock':
        return <Badge variant="destructive">Low Stock</Badge>;
      case 'out_of_stock':
        return <Badge variant="secondary">Out of Stock</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredItems = uniformItems.filter(item => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || item.stock_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalItems = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockItems = filteredItems.filter(item => item.stock_status === 'low_stock').length;
  const outOfStockItems = filteredItems.filter(item => item.stock_status === 'out_of_stock').length;

  const handleAddNewItem = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleEditItem = (item: UniformItem) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const openSaleDialog = (item: UniformItem) => {
    if (item.quantity <= 0) {
      toast({
        variant: 'destructive',
        title: 'Out of stock',
        description: 'This item is currently out of stock.',
      });
      return;
    }

    setSelectedItemForSale(item);
    setSelectedClassId('all');
    setSelectedStudentId('');
    setSaleQuantity('1');
    setSalePaymentMethod('cash');
    setSalePaymentStatus('paid');
    setSaleUniformType('readymade');
    setSaleUniformSize('');
    setIsSaleDialogOpen(true);
  };

  const filteredStudentsForSale = students.filter((student) => {
    if (selectedClassId === 'all') return true;
    return student.class_id === selectedClassId;
  });

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForSale || !selectedStudentId || !user) return;

    const quantity = Number(saleQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid quantity',
        description: 'Please enter a valid quantity.',
      });
      return;
    }

    if (quantity > selectedItemForSale.quantity) {
      toast({
        variant: 'destructive',
        title: 'Insufficient stock',
        description: `Only ${selectedItemForSale.quantity} units available.`,
      });
      return;
    }

    setIsSaleSubmitting(true);
    try {
      const receiptNumber = `ACC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const totalAmount = quantity * Number(selectedItemForSale.unit_price);
      const newQuantity = selectedItemForSale.quantity - quantity;
      const newStockStatus =
        newQuantity <= 0 ? 'out_of_stock' : newQuantity <= 5 ? 'low_stock' : 'in_stock';

      const { error: saleError } = await supabase
        .from('accessory_sales')
        .insert({
          student_id: selectedStudentId,
          accessory_id: selectedItemForSale.id,
          academic_year: getCurrentAcademicYear(),
          quantity,
          unit_price: selectedItemForSale.unit_price,
          total_amount: totalAmount,
          payment_method: salePaymentMethod,
          payment_status: salePaymentStatus,
          receipt_number: receiptNumber,
          uniform_type: saleUniformType,
          uniform_size: saleUniformType === 'readymade' ? saleUniformSize : null,
          collected_by: user.id,
        });

      if (saleError) throw saleError;

      const { error: stockError } = await supabase
        .from('accessories')
        .update({ quantity: newQuantity, stock_status: newStockStatus })
        .eq('id', selectedItemForSale.id);

      if (stockError) throw stockError;

      toast({
        title: 'Sale recorded',
        description: `Receipt: ${receiptNumber}`,
      });

      // Redirect to Receipt Page
      navigate(`/receipt?receiptNo=${receiptNumber}&type=accessory`);

      setIsSaleDialogOpen(false);
      setSelectedItemForSale(null);
      setSelectedStudentId('');
      setSaleQuantity('1');
      fetchUniformItems();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sale failed',
        description: error.message || 'Unable to complete this sale.',
      });
    } finally {
      setIsSaleSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('accessories')
        .update({ is_active: false })
        .eq('id', itemId);
      if (error) throw error;
      toast({
        title: 'Item Deleted',
        description: 'Uniform item has been removed successfully.',
      });
      fetchUniformItems();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: error.message || 'Unable to delete item.',
      });
    }
  };

  const getStockStatus = (quantity: number) => {
    if (quantity <= 0) return 'out_of_stock';
    if (quantity <= 5) return 'low_stock';
    return 'in_stock';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const itemName = String(formData.get('item_name') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const unitPrice = Number(formData.get('unit_price') || 0);
    const quantity = Number(formData.get('quantity') || 0);
    const stock_status = getStockStatus(quantity);

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('accessories')
          .update({ item_name: itemName, description, unit_price: unitPrice, quantity, stock_status })
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('accessories')
          .insert({ category: 'uniform', item_name: itemName, description, unit_price: unitPrice, quantity, stock_status, is_active: true });
        if (error) throw error;
      }

      toast({
        title: editingItem ? 'Item Updated' : 'Item Added',
        description: editingItem
          ? 'Uniform item has been updated successfully.'
          : 'New uniform item has been added successfully.',
      });
      setIsDialogOpen(false);
      setEditingItem(null);
      fetchUniformItems();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Unable to save item.',
      });
    }
  };

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
                  <Shirt className="h-8 w-8 text-primary" />
                  School Uniform Management
                </h1>
                <p className="page-description">Manage school uniform items and inventory</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/accessories/history')} variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Transaction History
              </Button>
              <Button onClick={handleAddNewItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Item
              </Button>
            </div>
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
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalItems}</div>
                <p className="text-xs text-muted-foreground">Units in stock</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{lowStockItems}</div>
                <p className="text-xs text-muted-foreground">Items need restocking</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{outOfStockItems}</div>
                <p className="text-xs text-muted-foreground">Items unavailable</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Items</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredItems.filter(item => item.is_active).length}
                </div>
                <p className="text-xs text-muted-foreground">Currently available</p>
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by item name or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Stock Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Uniform Items Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shirt className="h-5 w-5 text-primary" />
                Uniform Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="table-header">
                      <TableHead>Item Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <div className="h-6 w-6 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </TableCell>
                      </TableRow>
                    ) : filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No uniform items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.description}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.quantity === 0 ? 'text-destructive' : ''}>
                              {item.quantity}
                            </span>
                          </TableCell>
                          <TableCell>{getStockStatusBadge(item.stock_status)}</TableCell>
                          <TableCell>{formatDate(item.created_at)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openSaleDialog(item)}
                                disabled={item.quantity <= 0}
                              >
                                <ShoppingCart className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditItem(item)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
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

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {editingItem ? 'Edit Uniform Item' : 'Add New Uniform Item'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="item_name">Item Name</Label>
                  <Input
                    id="item_name"
                    defaultValue={editingItem?.item_name || ''}
                    placeholder="Enter item name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    defaultValue={editingItem?.description || ''}
                    placeholder="Enter description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="unit_price">Unit Price (₹)</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      defaultValue={editingItem?.unit_price || ''}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      defaultValue={editingItem?.quantity || ''}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-oxford">
                  {editingItem ? 'Update Item' : 'Add Item'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isSaleDialogOpen} onOpenChange={setIsSaleDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Sell Uniform to Student</DialogTitle>
            </DialogHeader>
            {selectedItemForSale && (
              <form onSubmit={handleSaleSubmit} className="space-y-4">
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{selectedItemForSale.item_name}</p>
                  <p className="text-muted-foreground">
                    Available: {selectedItemForSale.quantity} | Price: {formatCurrency(selectedItemForSale.unit_price)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Filter by Class</Label>
                  <Select value={selectedClassId} onValueChange={(value) => {
                    setSelectedClassId(value);
                    setSelectedStudentId('');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Select Student</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStudentsForSale.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.full_name} | {student.admission_number} | {student.classes?.name || 'Unknown'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Uniform Type</Label>
                    <Select value={saleUniformType} onValueChange={(value: 'cloth' | 'readymade') => setSaleUniformType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cloth">Cloth</SelectItem>
                        <SelectItem value="readymade">Readymade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {saleUniformType === 'readymade' && (
                    <div className="space-y-2">
                      <Label>Size</Label>
                      <Select value={saleUniformSize} onValueChange={setSaleUniformSize}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">Size 20</SelectItem>
                          <SelectItem value="22">Size 22</SelectItem>
                          <SelectItem value="24">Size 24</SelectItem>
                          <SelectItem value="26">Size 26</SelectItem>
                          <SelectItem value="28">Size 28</SelectItem>
                          <SelectItem value="30">Size 30</SelectItem>
                          <SelectItem value="32">Size 32</SelectItem>
                          <SelectItem value="34">Size 34</SelectItem>
                          <SelectItem value="36">Size 36</SelectItem>
                          <SelectItem value="38">Size 38</SelectItem>
                          <SelectItem value="40">Size 40</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sale-quantity">Quantity</Label>
                  <Input
                    id="sale-quantity"
                    type="number"
                    min={1}
                    max={selectedItemForSale.quantity}
                    value={saleQuantity}
                    onChange={(e) => setSaleQuantity(e.target.value)}
                    required
                  />
                </div>

                <div className="rounded-lg border bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Final Cost</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(Number(saleQuantity) * Number(selectedItemForSale.unit_price))}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={salePaymentMethod} onValueChange={setSalePaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="qr_code">QR Code</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Status</Label>
                    <Select value={salePaymentStatus} onValueChange={setSalePaymentStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsSaleDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="btn-oxford" disabled={isSaleSubmitting || !selectedStudentId}>
                    {isSaleSubmitting ? 'Saving...' : 'Confirm Sale'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

