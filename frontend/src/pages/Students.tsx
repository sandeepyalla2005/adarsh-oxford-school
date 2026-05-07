import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  GraduationCap,
  School,
  Users,
  BookOpen,
  Upload,
  Download,
  Trash2,
  AlertTriangle,
  Plus,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logStudentAction } from '@/lib/history';
import { apiFetch } from '@/lib/api';
import { getCurrentPortal, portalPath } from '@/lib/portal';

type Student = {
  id: string | number;
  class_id?: string;
  classes?: { name?: string };
};

type ClassRow = {
  id: string;
  name: string;
  sort_order?: number;
};


export default function Students() {
  const { user, profile, userRole, isAdmin } = useAuth();
  const isFeeAdmin = isAdmin; // Only admin can manage students
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const portal = getCurrentPortal(location.pathname);

  const queryClient = useQueryClient();
  const { data: classCounts = {}, isLoading } = useQuery({
    queryKey: ['student-counts'],
    queryFn: async () => {
      const resp = await apiFetch('/api/students/counts');
      if (!resp.ok) throw new Error('Backend error');
      return resp.json();
    }
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  const academicYears = Array.from({ length: 2040 - currentYear + 5 }, (_, i) => {
    const startYear = currentYear - 1 + i;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  });
  const [selectedYear, setSelectedYear] = useState(academicYears[1]);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  useEffect(() => {
    const fetchClasses = async () => {
      const { data, error } = await supabase.from('classes').select('*').order('sort_order');
      if (!error && data) setClasses(data as ClassRow[]);
    };
    fetchClasses();
  }, []);

  const classNames = ['all', ...classes.map(c => c.name)];


  const handleRemoveAllStudents = async () => {
    setIsRemoving(true);
    setShowRemoveConfirm(false);
    try {
      const { error } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;

      // Log the mass deletion
      await logStudentAction({
        studentName: 'All Students',
        actionType: 'DELETE',
        moduleName: 'Student Info',
        oldValues: { detail: 'Mass removal of all student records' },
        performedBy: user?.id || '',
        performedByName: profile?.full_name || 'Admin',
        role: userRole || 'admin'
      });

      // Force clear backend cache
      await apiFetch('/api/students/clear-cache', { method: 'POST' });
      
      toast({ title: '🗑️ All Students Removed', description: 'All student records have been deleted successfully.' });
      queryClient.invalidateQueries({ queryKey: ['student-counts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: err.message || 'Could not remove students.' });
    } finally {
      setIsRemoving(false);
    }
  };

  // ── Bulk upload all classes ───────────────────────────────────────────────
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');
    const isCsv = fileName.endsWith('.csv');
    if (!isExcel && !isCsv) {
      toast({ variant: 'destructive', title: 'Invalid File', description: 'Please upload a .csv, .xls, or .xlsx file.' });
      return;
    }

    setIsUploading(true);

    // Fetch all classes once
    const { data: classRowsRaw, error: classErr } = await supabase.from('classes').select('*');
    if (classErr || !classRowsRaw) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load classes from database.' });
      setIsUploading(false);
      return;
    }
    const classRows = classRowsRaw as ClassRow[];

    // Helper: normalize date to YYYY-MM-DD
    const normalizeDate = (value: any): string | null => {
      if (!value) return null;
      if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        return value.toISOString().split('T')[0];
      }
      const str = String(value).trim();
      if (!str) return null;
      if (/^\d{5,}$/.test(str)) {
        const excelEpoch = new Date(1899, 11, 30);
        const d = new Date(excelEpoch.getTime() + parseInt(str) * 86400000);
        return d.toISOString().split('T')[0];
      }
      const dmyFull = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
      if (dmyFull) { const [, d, m, y] = dmyFull; return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
      const dmyShort = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/);
      if (dmyShort) { const [, d, m, y] = dmyShort; const fy = parseInt(y) >= 50 ? `19${y}` : `20${y}`; return `${fy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
      return null;
    };

    const normalizeClassName = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const normalizeClassToken = (raw: string): string => {
      const normalized = normalizeClassName(raw).replace(/^class/, '');
      if (!normalized) return '';
      if (['nursery', 'lkg', 'ukg'].includes(normalized)) return normalized;

      const romanMap: Record<string, string> = {
        i: '1',
        ii: '2',
        iii: '3',
        iv: '4',
        v: '5',
        vi: '6',
        vii: '7',
        viii: '8',
        ix: '9',
        x: '10',
      };
      if (romanMap[normalized]) return romanMap[normalized];

      const digits = normalized.match(/\d+/)?.[0];
      if (digits) return String(parseInt(digits, 10));
      return normalized;
    };

    const parseBooleanLike = (value: string): boolean => {
      const v = String(value || '').trim().toLowerCase();
      return ['yes', 'y', 'true', '1', 'auto', 'bus', 'van', 'schoolbus', 'transport'].includes(v);
    };

    const stableHash = (input: string): string => {
      let hash = 2166136261;
      for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
      return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(0, 7);
    };

    const buildAdmissionNumber = ({
      rawAdmission,
      fullName,
      fatherPhone,
      dob,
      classLabel,
      sheetName,
      rowNumber,
    }: {
      rawAdmission: string;
      fullName: string;
      fatherPhone: string;
      dob: string | null;
      classLabel: string;
      sheetName: string;
      rowNumber: number;
    }): { value: string; wasGenerated: boolean } => {
      const cleaned = String(rawAdmission || '').trim();
      if (cleaned) return { value: cleaned, wasGenerated: false };

      const cls = normalizeClassToken(classLabel || sheetName || 'gen').toUpperCase() || 'GEN';
      const seed = [
        cls,
        String(fullName || '').toLowerCase().trim(),
        String(fatherPhone || '').trim(),
        String(dob || '').trim(),
        String(sheetName || '').toLowerCase().trim(),
        String(rowNumber),
      ].join('|');
      return { value: `AUTO-${cls}-${stableHash(seed)}`, wasGenerated: true };
    };

    // Match a class name string to a DB class row
    const matchClass = (classNameVal: string, sheetName?: string, preferSheetName = false): ClassRow | undefined => {
      const candidates = preferSheetName ? [sheetName, classNameVal] : [classNameVal, sheetName];

      for (const candidate of candidates) {
        if (!candidate) continue;
        const raw = String(candidate).trim();
        if (!raw) continue;

        let classObj = classRows.find(c => c.name.toLowerCase() === raw.toLowerCase());
        if (!classObj) classObj = classRows.find(c => normalizeClassName(c.name) === normalizeClassName(raw));

        const token = normalizeClassToken(raw);
        if (!classObj && token) {
          classObj = classRows.find(c => normalizeClassToken(c.name) === token);
        }

        if (classObj) return classObj;
      }

      return undefined;
    };

    // Parse one sheet's object rows and return student records
    const parseSheet = (sheetRows: any[], sheetName: string): { students: any[]; errors: string[]; autoGeneratedCount: number } => {
      const students: any[] = [];
      const errors: string[] = [];
      let autoGeneratedCount = 0;

      sheetRows.forEach((row: any, idx: number) => {
        // Normalize all keys: lowercase, remove non-alphanumeric
        const r: Record<string, string> = {};
        Object.keys(row).forEach(k => {
          const nk = k.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const v = row[k];
          r[nk] = v !== undefined && v !== null ? String(v).trim() : '';
        });

        // Map exact columns from the school's Excel file
        const admissionNumberRaw =
          r['admissionnumber'] || r['admno'] || r['admissionno'] || r['id'] || r['srno'] || r['regno'];
        const fullName =
          r['studentname'] || r['fullname'] || r['name'] || r['nameofstudent'];
        const classNameVal = r['class'] || r['grade'] || r['standard'] || r['classname'] || '';
        const rollNumber = r['rollnumber'] || r['roll'] || r['rollno'] || '';
        const dob = normalizeDate(r['dateofbirth'] || r['dob'] || r['birthdate']);
        const fatherName = r['fathername'] || r['fathersname'] || r['father'] || r['parentname'] || 'N/A';
        const fatherPhone = r['fathermobilenumber'] || r['fathermobile'] || r['fatherphone'] ||
          r['mobile'] || r['contactnumber'] || r['mobilenumber'] || '0000000000';
        const motherName = r['mothername'] || r['mothersname'] || '';
        const motherPhone = r['mothermobilenumber'] || r['mothermobile'] || r['motherphone'] || '';
        const parentEmail = r['parentemailid'] || r['parentemail'] || r['email'] || '';
        const address = r['address'] || '';
        const studentType = (['old', 'new'].includes((r['studenttypeoldnew'] || r['studenttype'] || '').toLowerCase()))
          ? (r['studenttypeoldnew'] || r['studenttype']).toLowerCase() : 'new';
        const joiningDate = normalizeDate(r['dateofjoining'] || r['joiningdate']) || new Date().toISOString().split('T')[0];
        const totalFees = parseFloat(r['totalfee'] || r['totalfees'] || r['fees'] || '0') || 0;
        const hasBooks = parseBooleanLike(r['booksyesno'] || r['books'] || r['hasbooks'] || 'no');
        const hasTransport = parseBooleanLike(r['transportyesno'] || r['transport'] || r['hastransport'] || 'no');
        const oldDues = parseFloat(r['olddues'] || '0') || 0;

        // Skip blank rows
        if (!admissionNumberRaw && !fullName) return;

        if (!fullName) {
          const missing = [];
          if (!fullName) missing.push('Student Name');
          errors.push(`${sheetName} row ${idx + 2}: Missing ${missing.join(', ')}`);
          return;
        }

        // Match class: prefer cell value, fall back to sheet name
        const classObj = matchClass(classNameVal, sheetName, true);
        if (!classObj) {
          errors.push(`${sheetName} row ${idx + 2}: Class "${classNameVal || sheetName}" not found in DB. Available: ${classRows.map(c => c.name).join(', ')}`);
          return;
        }

        const admissionInfo = buildAdmissionNumber({
          rawAdmission: String(admissionNumberRaw || ''),
          fullName,
          fatherPhone,
          dob,
          classLabel: classObj.name,
          sheetName,
          rowNumber: idx + 2,
        });
        if (admissionInfo.wasGenerated) autoGeneratedCount++;

        students.push({
          admission_number: admissionInfo.value,
          full_name: fullName,
          class_id: classObj.id,
          roll_number: rollNumber || null,
          gender: 'Male',
          father_name: fatherName,
          father_phone: fatherPhone,
          mother_name: motherName || null,
          mother_phone: motherPhone || null,
          dob: dob || null,
          address: address || null,
          parent_email: parentEmail || null,
          student_type: studentType as 'old' | 'new',
          joining_date: joiningDate,
          term1_fee: totalFees,
          term2_fee: 0,
          term3_fee: 0,
          has_books: hasBooks,
          books_fee: 0,
          has_transport: hasTransport,
          transport_fee: 0,
          old_dues: oldDues,
          is_active: true,
          status: 'active',
        });
      });

      return { students, errors, autoGeneratedCount };
    };

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const allStudents: any[] = [];
        const allErrors: string[] = [];
        const classesFound = new Set<string>();
        let autoGeneratedAdmissions = 0;

        // ── Helper: parse an array-of-arrays sheet (header:1 mode) ──
        const parseArraySheet = (rawRows: any[][], sheetName: string) => {
          // Find the header row (first row containing "Admission Number" or "Student Name")
          let hIdx = 0;
          for (let i = 0; i < Math.min(5, rawRows.length); i++) {
            if (rawRows[i].some(c => String(c || '').toLowerCase().includes('admission') || String(c || '').toLowerCase().includes('student name'))) {
              hIdx = i; break;
            }
          }
          const headers = rawRows[hIdx].map(h => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));

          for (let i = hIdx + 1; i < rawRows.length; i++) {
            const vals = rawRows[i];
            if (!vals || vals.every(c => c === null || c === '' || c === undefined)) continue;

            // Build normalized key→value map
            const r: Record<string, string> = {};
            headers.forEach((h, idx) => {
              if (h) r[h] = vals[idx] !== undefined && vals[idx] !== null ? String(vals[idx]).trim() : '';
            });

            const admissionNumberRaw = r['admissionnumber'] || r['admno'] || r['admissionno'] || r['id'] || r['srno'] || r['regno'];
            const fullName = r['studentname'] || r['fullname'] || r['name'] || r['nameofstudent'];
            const classNameVal = r['class'] || r['grade'] || r['standard'] || r['classname'] || '';
            const rollNumber = r['rollnumber'] || r['roll'] || r['rollno'] || '';
            const dob = normalizeDate(r['dateofbirth'] || r['dob'] || r['birthdate']);
            const fatherName = r['fathername'] || r['fathersname'] || r['father'] || r['parentname'] || 'N/A';
            const fatherPhone = r['fathermobilenumber'] || r['fathermobile'] || r['fatherphone'] || r['mobile'] || r['contactnumber'] || '0000000000';
            const motherName = r['mothername'] || r['mothersname'] || '';
            const motherPhone = r['mothermobilenumber'] || r['mothermobile'] || r['motherphone'] || '';
            const parentEmail = r['parentemailid'] || r['parentemail'] || r['email'] || '';
            const address = r['address'] || '';
            const rawType = (r['studenttypeoldnew'] || r['studenttype'] || 'new').toLowerCase();
            const studentType = ['old', 'new'].includes(rawType) ? rawType : 'new';
            const joiningDate = normalizeDate(r['dateofjoining'] || r['joiningdate']) || new Date().toISOString().split('T')[0];
            const totalFees = parseFloat(r['totalfee'] || r['totalfees'] || r['fees'] || '0') || 0;
            const hasBooks = parseBooleanLike(r['booksyesno'] || r['books'] || r['hasbooks'] || 'no');
            const hasTransport = parseBooleanLike(r['transportyesno'] || r['transport'] || r['hastransport'] || 'no');
            const oldDues = parseFloat(r['olddues'] || '0') || 0;

            if (!admissionNumberRaw && !fullName) continue;
            if (!fullName) {
              const miss = [];
              if (!fullName) miss.push('Student Name');
              allErrors.push(`${sheetName} row ${i + 1}: Missing ${miss.join(', ')}`);
              continue;
            }

            // For multi-sheet Excel uploads, sheet name is the most reliable class source.
            const classObj = matchClass(classNameVal, sheetName, true);
            if (!classObj) {
              allErrors.push(`${sheetName} row ${i + 1}: Class "${classNameVal || sheetName}" not found in DB.`);
              continue;
            }

            const admissionInfo = buildAdmissionNumber({
              rawAdmission: String(admissionNumberRaw || ''),
              fullName,
              fatherPhone,
              dob,
              classLabel: classObj.name,
              sheetName,
              rowNumber: i + 1,
            });
            if (admissionInfo.wasGenerated) autoGeneratedAdmissions++;

            allStudents.push({
              admission_number: admissionInfo.value,
              full_name: fullName,
              class_id: classObj.id,
              roll_number: rollNumber || null,
              gender: 'Male',
              father_name: fatherName,
              father_phone: fatherPhone,
              mother_name: motherName || null,
              mother_phone: motherPhone || null,
              dob: dob || null,
              address: address || null,
              parent_email: parentEmail || null,
              student_type: studentType as 'old' | 'new',
              joining_date: joiningDate,
              term1_fee: totalFees,
              term2_fee: 0,
              term3_fee: 0,
              has_books: hasBooks,
              books_fee: 0,
              has_transport: hasTransport,
              transport_fee: 0,
              old_dues: oldDues,
              is_active: true,
              status: 'active',
            });

            if (allStudents[allStudents.length - 1]) classesFound.add(classObj.name);
          }
        };

        if (isExcel) {
          const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: 'array', cellDates: true });
          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            // Use header:1 (array mode) — object mode returns 0 rows on some sheets
            const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
            if (rawRows.length < 2) { console.log(`Sheet "${sheetName}": empty, skipping`); continue; }
            const beforeCount = allStudents.length;
            parseArraySheet(rawRows, sheetName);
            console.log(`Sheet "${sheetName}": ${allStudents.length - beforeCount} students added`);
          }
        } else {
          // CSV: parse into array-of-arrays first
          const text = (ev.target?.result as string).replace(/^\uFEFF/, '');
          const parseLine = (line: string) => {
            const vals: string[] = []; let cur = ''; let inQ = false;
            for (const ch of line) {
              if (ch === '"') { inQ = !inQ; }
              else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
              else cur += ch;
            }
            vals.push(cur.trim());
            return vals.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
          };
          const rawLines = text.split('\n').map(r => r.trim()).filter(r => r).map(parseLine);
          if (rawLines.length < 2) throw new Error('CSV file is empty or has no data rows.');
          parseArraySheet(rawLines, 'CSV');
        }

        // ── Upsert all parsed students ──────────────────────────────────────
        if (allStudents.length === 0) {
          throw new Error(allErrors.length > 0
            ? `No valid rows found. First error: ${allErrors[0]}`
            : 'No student data found. Check that sheet names match your class names in the database.');
        }

        // Deduplicate by (class_id + admission_number) so same admission numbers can exist in different classes.
        const uniqueMap = new Map<string, any>();
        allStudents.forEach(s => uniqueMap.set(`${s.class_id}::${String(s.admission_number).toLowerCase()}`, s));
        const finalStudents = Array.from(uniqueMap.values());

        const BATCH = 100;
        for (let b = 0; b < finalStudents.length; b += BATCH) {
          const batch = finalStudents.slice(b, b + BATCH);
          const { error: upsertErr } = await supabase
            .from('students')
            .upsert(batch, { onConflict: 'class_id,admission_number' });
          if (upsertErr) {
            if (upsertErr.code === '42P10') {
              throw new Error('Database schema is outdated. Please apply migration 20260220000003 before bulk upload.');
            }
            throw upsertErr;
          }
        }

        // Log the bulk upload action
        await logStudentAction({
          studentName: `Bulk Upload: ${finalStudents.length} students`,
          actionType: 'ADD',
          moduleName: 'Student Info',
          newValues: { count: finalStudents.length, fileName: file.name },
          performedBy: user?.id || '',
          performedByName: profile?.full_name || 'Admin',
          role: userRole || 'admin'
        });

        toast({
          title: `✅ Upload Complete`,
          description: `${finalStudents.length} students saved across ${classesFound.size} class(es).${autoGeneratedAdmissions > 0 ? ` ${autoGeneratedAdmissions} admission number(s) auto-generated.` : ''}${allErrors.length > 0 ? ` ${allErrors.length} rows skipped.` : ''}`,
        });

        if (allErrors.length > 0) {
          console.warn('Bulk upload skipped rows:', allErrors);
          const preview = allErrors.slice(0, 3).join(' | ');
          toast({ variant: 'destructive', title: `⚠️ ${allErrors.length} Rows Skipped`, description: preview + (allErrors.length > 3 ? ` ...and ${allErrors.length - 3} more` : '') });
        }

        // Force clear backend cache to ensure new counts reflect immediately
        await apiFetch('/api/students/clear-cache', { method: 'POST' });

        queryClient.invalidateQueries({ queryKey: ['student-counts'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      } catch (err: any) {
        console.error('Bulk upload error:', err);
        toast({ variant: 'destructive', title: 'Upload Failed', description: err.message });
      } finally {
        setIsUploading(false);
        if (bulkFileRef.current) bulkFileRef.current.value = '';
      }
    };
    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'admission_number', 'full_name', 'class', 'roll_number', 'gender',
      'father_name', 'father_phone', 'mother_name', 'mother_phone',
      'parent_mail_id', 'aadhaar_number', 'student_type', 'date_of_joining',
      'dob', 'address', 'term1_fee', 'term2_fee', 'term3_fee',
      'book_fee_option', 'books_fee', 'transport_fee_option', 'transport_fee', 'old_dues'
    ];
    const sample = [
      'ADM001', 'John Doe', 'Class 1', '1', 'Male',
      'Robert Doe', '9876543210', 'Mary Doe', '9876543211',
      'parent@example.com', '123456789012', 'new', '2024-06-01',
      '2018-05-15', '123 Main St', '15000', '15000', '15000',
      'yes', '2500', 'yes', '5000', '0'
    ];
    const csv = [headers.join(','), sample.map(v => `"${v}"`).join(',')].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
    a.download = 'students_bulk_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#002147] font-display">Student Portal</h1>
            <p className="text-slate-500 mt-2 text-lg">Select a class to view and manage student records</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  ref={bulkFileRef}
                  className="hidden"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleBulkUpload}
                />
                <Button
                  variant="outline"
                  onClick={() => bulkFileRef.current?.click()}
                  disabled={isUploading}
                  className="rounded-xl border-slate-200 h-11 px-6 font-bold text-slate-700 hover:bg-slate-50 transition-all hover:shadow-md active:scale-95"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2 text-blue-600" />}
                  Bulk Upload CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  className="rounded-xl border-slate-200 h-11 px-6 font-bold text-slate-700 hover:bg-slate-50 transition-all hover:shadow-md active:scale-95"
                >
                  <Download className="h-4 w-4 mr-2 text-emerald-600" />
                  Template
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRemoveConfirm(true)}
                  className="rounded-xl h-11 px-6 font-bold shadow-lg shadow-red-500/10 hover:shadow-red-500/20 transition-all active:scale-95"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Wipe All
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
              <School className="h-4 w-4" />
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[130px] border-none bg-transparent shadow-none focus:ring-0 text-blue-700 font-medium h-auto p-0">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>


        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {/* All Students Card */}
          <motion.div
            key="all"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate(portalPath(portal, '/students/all'))}
            className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-[#002147] to-[#003366] p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ring-1 ring-white/10"
          >
            {/* Abstract Background Shapes */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />

            <div className="relative flex flex-col items-center gap-4 text-white">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm shadow-inner ring-1 ring-white/20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <Users className="h-8 w-8 text-blue-100" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="font-display text-xl font-bold tracking-tight text-white">
                  All Students
                </h3>
                <div className="flex items-center justify-center gap-2">
                  <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold tracking-wider text-blue-50 backdrop-blur-md">
                    {classCounts['all'] || 0} TOTAL
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Class Cards */}
          {classNames.filter(c => c !== 'all').map((className, index) => (
            <motion.div
              key={className}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(portalPath(portal, `/students/${className}`))}
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-blue-200/50"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 opacity-0 blur-xl transition-all duration-500 group-hover:opacity-100 group-hover:scale-150" />

              <div className="relative flex flex-col items-center gap-4">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 shadow-sm ring-1 ring-slate-100 transition-all duration-500 group-hover:bg-[#002147] group-hover:text-white group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-blue-900/20">
                  {['Nursery', 'LKG', 'UKG'].includes(className) ? (
                    <BookOpen className="h-6 w-6 transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <GraduationCap className="h-6 w-6 transition-transform duration-500 group-hover:scale-110" />
                  )}
                </div>

                <div className="text-center space-y-1 z-10">
                  <h3 className="font-display text-lg font-bold tracking-tight text-slate-700 transition-colors group-hover:text-[#002147]">
                    {className}
                  </h3>
                  <div className="flex justify-center">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full ring-1 ring-slate-100 transition-all group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:ring-blue-100">
                      {classCounts[className] || 0} Students
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-red-100">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Remove All Students?</h2>
              <p className="text-slate-500 text-sm">
                This will permanently delete <span className="font-bold text-red-600">{classCounts['all'] || 0} student records</span> from the database.
                This action <span className="font-bold">cannot be undone</span>.
              </p>
              <div className="flex gap-3 w-full mt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRemoveConfirm(false)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRemoveAllStudents}
                  className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Yes, Remove All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
