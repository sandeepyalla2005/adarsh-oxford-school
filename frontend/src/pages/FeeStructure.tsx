import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Plus,
  Edit3,
  Trash2,
  GraduationCap,
  BookOpen,
  Bus,
  AlertCircle,
  Upload,
  Download
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { getApiBaseUrl } from '@/lib/api';

interface Class {
  id: string;
  name: string;
  sort_order: number;
}

interface FeeStructure {
  id: string;
  class_id: string;
  academic_year: string;
  term1_fee: number;
  term2_fee: number;
  term3_fee: number;
  books_fee: number;
  transport_monthly_fee: number;
  classes?: {
    name: string;
    sort_order: number;
  };
}

export default function FeeStructure() {
  const { user, isAdmin, isStaff, userRole } = useAuth();
  const { toast } = useToast();
  const academicYear = getCurrentAcademicYear();

  const isFeeAdmin = isAdmin || userRole === 'feeInCharge';

  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<FeeStructure | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    class_id: '',
    academic_year: academicYear,
    term1_fee: '',
    term2_fee: '',
    term3_fee: '',
    books_fee: '',
    transport_monthly_fee: '',
  });

  useEffect(() => {
    fetchClasses();
    fetchFeeStructures();
  }, []);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setClasses((data as any) || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load classes',
      });
    }
  };

  const fetchFeeStructures = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('fee_structure')
        .select(`
          *,
          classes (name, sort_order)
        `)
        .order('academic_year', { ascending: false });

      if (error) throw error;
      
      // Sort in-memory to ensure class-wise ordering based on sort_order
      const sorted = [...(data || [])].sort((a, b) => {
        const orderA = a.classes?.sort_order ?? 999;
        const orderB = b.classes?.sort_order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return b.academic_year.localeCompare(a.academic_year);
      });
      
      setFeeStructures(sorted);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load fee structures',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      class_id: '',
      academic_year: academicYear,
      term1_fee: '',
      term2_fee: '',
      term3_fee: '',
      books_fee: '',
      transport_monthly_fee: '',
    });
    setSelectedStructure(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFeeAdmin) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'Only admins can modify fee structures.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const feeData = {
        class_id: formData.class_id,
        academic_year: formData.academic_year,
        term1_fee: parseFloat(formData.term1_fee) || 0,
        term2_fee: parseFloat(formData.term2_fee) || 0,
        term3_fee: parseFloat(formData.term3_fee) || 0,
        books_fee: parseFloat(formData.books_fee) || 0,
        transport_monthly_fee: parseFloat(formData.transport_monthly_fee) || 0,
      };

      if (selectedStructure) {
        const { error } = await supabase
          .from('fee_structure')
          .update(feeData)
          .eq('id', selectedStructure.id);

        if (error) throw error;

        toast({
          title: 'Fee Structure Updated',
          description: 'Fee structure has been updated successfully.',
        });
      } else {
        const { error } = await supabase
          .from('fee_structure')
          .insert(feeData);

        if (error) throw error;

        toast({
          title: 'Fee Structure Added',
          description: 'New fee structure has been added successfully.',
        });
      }

      setIsAddDialogOpen(false);
      resetForm();
      fetchFeeStructures();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save fee structure',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (structure: FeeStructure) => {
    if (!isFeeAdmin) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'Only admins can modify fee structures.',
      });
      return;
    }

    setSelectedStructure(structure);
    setFormData({
      class_id: structure.class_id,
      academic_year: structure.academic_year || academicYear,
      term1_fee: structure.term1_fee.toString(),
      term2_fee: structure.term2_fee.toString(),
      term3_fee: structure.term3_fee.toString(),
      books_fee: structure.books_fee.toString(),
      transport_monthly_fee: structure.transport_monthly_fee.toString(),
    });
    setIsAddDialogOpen(true);
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isStaff || !isFeeAdmin) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');
    const isCsv = fileName.endsWith('.csv');

    if (!isExcel && !isCsv) {
      toast({ variant: 'destructive', title: 'Invalid File', description: 'Please upload a .csv, .xls, or .xlsx file.' });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        let rowsData: any[][];

        if (isExcel) {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          rowsData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as any[][];
        } else {
          const text = (e.target?.result as string).replace(/^\uFEFF/, '');
          const rows = text.split(/\r?\n/).map(row => row.trim()).filter(row => row);

          const parseLine = (line: string) => {
            const values: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') inQuotes = !inQuotes;
              else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
              else current += char;
            }
            values.push(current.trim());
            return values.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
          };
          rowsData = rows.map(r => parseLine(r));
        }

        let headerRowIndex = -1;
        for (let i = 0; i < rowsData.length; i++) {
          if (rowsData[i] && rowsData[i].some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1 || headerRowIndex === rowsData.length - 1) {
          throw new Error('The file is empty or missing headers.');
        }

        const rawHeaders = rowsData[headerRowIndex] as string[];
        const normalizedHeaders = rawHeaders.map(h =>
          String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')
        );

        const allFields = {
          class: ['class', 'classname', 'grade', 'standard'],
          academic_year: ['academicyear', 'year', 'session', 'academic'],
          term1_fee: ['term1fee', 'term1', 'coursefee1', 'firstterm'],
          term2_fee: ['term2fee', 'term2', 'coursefee2', 'secondterm'],
          term3_fee: ['term3fee', 'term3', 'coursefee3', 'thirdterm'],
          books_fee: ['booksfee', 'bookfee', 'books'],
          transport_monthly_fee: ['transportmonthlyfee', 'transportfee', 'transport', 'monthlytransport']
        };

        const headerIndices: Record<string, number> = {};
        Object.entries(allFields).forEach(([field, aliases]) => {
          const index = normalizedHeaders.findIndex(h => aliases.includes(h));
          if (index !== -1) headerIndices[field] = index;
        });

        if (headerIndices['class'] === undefined || headerIndices['academic_year'] === undefined) {
          throw new Error(`Required columns missing. Your file needs "Class" and "Academic Year" headers.`);
        }

        const structuresToUpsert: any[] = [];
        const errors: string[] = [];

        for (let i = headerRowIndex + 1; i < rowsData.length; i++) {
          const vals = rowsData[i];
          if (!vals || vals.length === 0 || (vals.length === 1 && vals[0] === '')) continue;

          const getValue = (field: string) => {
            const index = headerIndices[field];
            return index !== undefined ? String(vals[index] || '').trim() : '';
          };

          const classNameStr = getValue('class');
          const academicYearStr = getValue('academic_year');

          if (!classNameStr && !academicYearStr) continue;

          const classObj = classes.find(c =>
            c.name.toLowerCase().trim() === classNameStr.toLowerCase().trim()
          );

          if (!classObj) {
            errors.push(`Row ${i + 1}: Class "${classNameStr}" not found in system`);
            continue;
          }

          structuresToUpsert.push({
            class_id: classObj.id,
            academic_year: academicYearStr,
            term1_fee: parseFloat(getValue('term1_fee') || '0') || 0,
            term2_fee: parseFloat(getValue('term2_fee') || '0') || 0,
            term3_fee: parseFloat(getValue('term3_fee') || '0') || 0,
            books_fee: parseFloat(getValue('books_fee') || '0') || 0,
            transport_monthly_fee: parseFloat(getValue('transport_monthly_fee') || '0') || 0,
          });
        }

        if (structuresToUpsert.length > 0) {
          const { error } = await supabase
            .from('fee_structure')
            .upsert(structuresToUpsert, { onConflict: 'class_id,academic_year' });

          if (error) throw error;

          toast({
            title: 'Bulk Upload Successful',
            description: `Successfully processed ${structuresToUpsert.length} classes.`
          });

          fetchFeeStructures();
        }

      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: error.message || 'Check your file format and headers.'
        });
      } finally {
        setIsUploading(false);
      }
    };

    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const downloadSampleCSV = () => {
    const headers = ['class', 'academic_year', 'term1_fee', 'term2_fee', 'term3_fee', 'books_fee', 'transport_monthly_fee'];
    const rows = [headers.join(',')];
    const sampleRows = classes.slice(0, 3).map(c => [c.name, academicYear, '15000', '15000', '15000', '3000', '1200']);
    sampleRows.forEach(row => rows.push(row.map(v => `"${v}"`).join(',')));
    const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "fee_structure_template.csv");
    link.click();
  };

  const deleteStructure = async (id: string) => {
    if (!isFeeAdmin) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'Only admins can delete fee structures.' });
      return;
    }

    if (!window.confirm('Are you sure you want to delete this fee structure?')) return;

    const previousStructures = [...feeStructures];
    setFeeStructures(prev => prev.filter(s => s.id !== id));

    try {
      // Use the backend API to bypass RLS issues
      const token = localStorage.getItem('supabase.auth.token');
      // Actually, use auth.getSession() or the session object if available.
      // But we can just use the supabase client's current session for the header.
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${getApiBaseUrl()}/api/fee-structure/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete fee structure');
      }

      toast({ title: 'Fee Structure Deleted', description: 'Fee structure has been deleted successfully.' });
      fetchFeeStructures();
    } catch (error: any) {
      setFeeStructures(previousStructures);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete fee structure' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Fee Structure</h1>
            <p className="text-muted-foreground mt-1">
              Manage fixed class-wise fees for course terms, books, and transport only
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isFeeAdmin && (
              <>
                <Button variant="outline" className="gap-2" onClick={downloadSampleCSV}>
                  <Download className="h-4 w-4" /> Template
                </Button>

                <div className="relative">
                  <input
                    id="bulk-fee-upload"
                    type="file"
                    className="hidden"
                    accept=".csv,text/csv"
                    onChange={handleBulkUpload}
                    disabled={isUploading}
                  />
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => document.getElementById('bulk-fee-upload')?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="h-4 w-4" /> {isUploading ? 'Uploading...' : 'Bulk Upload'}
                  </Button>
                </div>
              </>
            )}

            <Button
              className="btn-oxford"
              disabled={!isFeeAdmin}
              onClick={() => {
                resetForm();
                setIsAddDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Fee Structure
            </Button>
          </div>
        </div>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" /> Fee Structures
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : feeStructures.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No fee structures found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="table-header">
                      <TableHead>Class</TableHead>
                      <TableHead>Academic Year</TableHead>
                      <TableHead className="text-right">Term 1</TableHead>
                      <TableHead className="text-right">Term 2</TableHead>
                      <TableHead className="text-right">Term 3</TableHead>
                      <TableHead className="text-right font-bold text-primary">Total</TableHead>
                      <TableHead className="text-right">Books</TableHead>
                      <TableHead className="text-right">Transport (Monthly)</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeStructures.map((structure) => (
                      <TableRow key={structure.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {structure.classes?.name || 'Unknown Class'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{structure.academic_year}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(structure.term1_fee)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(structure.term2_fee)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(structure.term3_fee)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(structure.term1_fee + structure.term2_fee + structure.term3_fee)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(structure.books_fee)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(structure.transport_monthly_fee || 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(structure)}
                              disabled={!isFeeAdmin}
                              className="h-8 w-8 p-0"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteStructure(structure.id)}
                              disabled={!isFeeAdmin}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedStructure ? 'Edit Fee Structure' : 'Add New Fee Structure'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="class_id">Class *</Label>
                  <Select value={formData.class_id} onValueChange={(v) => setFormData({ ...formData, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academic_year">Academic Year *</Label>
                  <Input value={formData.academic_year} onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term1_fee">Term 1 Fee *</Label>
                  <Input type="number" value={formData.term1_fee} onChange={(e) => setFormData({ ...formData, term1_fee: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term2_fee">Term 2 Fee *</Label>
                  <Input type="number" value={formData.term2_fee} onChange={(e) => setFormData({ ...formData, term2_fee: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term3_fee">Term 3 Fee *</Label>
                  <Input type="number" value={formData.term3_fee} onChange={(e) => setFormData({ ...formData, term3_fee: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="books_fee">Books Fee *</Label>
                  <Input type="number" value={formData.books_fee} onChange={(e) => setFormData({ ...formData, books_fee: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transport_monthly_fee">Transport Monthly Fee *</Label>
                  <Input type="number" value={formData.transport_monthly_fee} onChange={(e) => setFormData({ ...formData, transport_monthly_fee: e.target.value })} required />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" className="btn-oxford" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
}
