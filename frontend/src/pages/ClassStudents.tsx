
import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import {
    GraduationCap,
    Search,
    Phone,
    MapPin,
    Plus,
    Edit2,
    Download,
    Upload,
    ChevronLeft,
    X,
    User,
    Calendar,
    Camera,
    Mail,
    Users,
    Trash2,
    AlertTriangle,
    History,
    Clock
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { getCurrentPortal, portalPath } from '@/lib/portal';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
    DialogDescription
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logStudentAction } from '@/lib/history';
import { format } from 'date-fns';

type ClassOption = {
    id: string;
    name: string;
    sort_order?: number;
};

type Student = {
    id: string | number;
    name?: string;
    admission_number?: string;
    full_name?: string;
    class_id?: string;
    classes?: { name?: string };
    gender?: 'Male' | 'Female' | 'Other';
    roll_number?: string;
    father_name?: string;
    father_phone?: string;
    father?: string;
    fatherPhone?: string;
    mother_name?: string;
    mother_phone?: string;
    dob?: string;
    aadhaar?: string;
    address?: string;
    is_active?: boolean;
    created_at?: string;
    status?: 'active' | 'dropout' | 'graduated' | 'dropout_pending';
    dropout_reason?: string | null;
    dropout_date?: string | null;
    term1_fee?: number;
    term2_fee?: number;
    term3_fee?: number;
    has_books?: boolean;
    books_fee?: number;
    has_transport?: boolean;
    transport_fee?: number;
    old_dues?: number;
    parent_email?: string;
    student_type?: 'old' | 'new';
    joining_date?: string;
    profile_photo?: string;
};

export default function ClassStudents() {
    const { className } = useParams<{ className: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const portal = getCurrentPortal(location.pathname);
    const { isAdmin, isStaff, userRole, user, profile } = useAuth();
    const { toast } = useToast();

    const isFeeAdmin = isAdmin || userRole === 'feeInCharge'; // Allow both admin and fee in-charge to manage students
    const canViewHistory = isAdmin || userRole === 'feeInCharge';

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDetailsPanel, setShowDetailsPanel] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMarkingDropout, setIsMarkingDropout] = useState(false);
    const [isDeletingDropout, setIsDeletingDropout] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'active' | 'dropout' | 'trash' | 'all'>('active');
    const [isRemoving, setIsRemoving] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
    const [showProfileDialog, setShowProfileDialog] = useState(false);
    const [studentHistory, setStudentHistory] = useState<any[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    const [showDeleteOtpDialog, setShowDeleteOtpDialog] = useState(false);
    const [deleteOtp, setDeleteOtp] = useState('');
    const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

    const [showRemoveClassOtpDialog, setShowRemoveClassOtpDialog] = useState(false);
    const [removeClassOtp, setRemoveClassOtp] = useState('');

    const [formData, setFormData] = useState({
        admission_number: '',
        full_name: '',
        class_id: '',
        roll_number: '',
        gender: 'Male',
        father_name: '',
        father_phone: '',
        mother_name: '',
        mother_phone: '',
        dob: '',
        aadhaar: '',
        address: '',
        term1_fee: '',
        term2_fee: '',
        term3_fee: '',
        has_books: false,
        books_fee: '',
        has_transport: false,
        transport_fee: '',
        old_dues: '',
        parent_email: '',
        student_type: 'new' as 'old' | 'new',
        joining_date: new Date().toISOString().split('T')[0],
        profile_photo: '',
    });

    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleApproveDropout = async (student: Student) => {
        if (!isAdmin || !student?.id) return;
        setIsSubmitting(true);
        try {
            const resp = await apiFetch(`/api/students/approve-dropout/${student.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Approval failed');
            toast({ title: 'Approved', description: data.message });
            fetchStudents();
            setSelectedStudent(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectDropout = async (student: Student) => {
        if (!isAdmin || !student?.id) return;
        setIsSubmitting(true);
        try {
            const resp = await apiFetch(`/api/students/reject-dropout/${student.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Rejection failed');
            toast({ title: 'Rejected', description: data.message });
            fetchStudents();
            setSelectedStudent(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        setIsLoading(true);
        fetchClasses();
        fetchStudents();
    }, [className]);

    const fetchClasses = async () => {
        const { data, error } = await supabase
            .from('classes')
            .select('*')
            .order('sort_order');

        if (error) {
            console.error('Error fetching classes:', error);
            toast({
                variant: 'destructive',
                title: 'Database Error',
                description: 'Could not load school classes. Please check your connection.',
            });
            return;
        }

        if (data && data.length > 0) {
            setClasses(data as ClassOption[]);
        } else if (isAdmin) {
            console.log('No classes found, initializing defaults...');
            const defaultClasses = [
                { name: 'Nursery', sort_order: 1 },
                { name: 'LKG', sort_order: 2 },
                { name: 'UKG', sort_order: 3 },
                { name: 'Class 1', sort_order: 4 },
                { name: 'Class 2', sort_order: 5 },
                { name: 'Class 3', sort_order: 6 },
                { name: 'Class 4', sort_order: 7 },
                { name: 'Class 5', sort_order: 8 },
                { name: 'Class 6', sort_order: 9 },
                { name: 'Class 7', sort_order: 10 },
                { name: 'Class 8', sort_order: 11 },
                { name: 'Class 9', sort_order: 12 },
                { name: 'Class 10', sort_order: 13 },
            ];

            const { data: inserted, error: insertError } = await supabase
                .from('classes')
                .insert(defaultClasses)
                .select();

            if (!insertError && inserted) {
                setClasses(inserted as ClassOption[]);
                toast({ title: 'System Initialized', description: 'School classes have been set up automatically.' });
            } else if (insertError) {
                console.error('Initialization error:', insertError);
                toast({
                    variant: 'destructive',
                    title: 'Setup Error',
                    description: `Found no classes and failed to create defaults: ${insertError.message}`,
                });
            }
        } else {
            toast({
                variant: 'default',
                title: 'No Classes Found',
                description: 'The school has no classes registered yet. Please contact an admin.',
            });
        }
    };

    const fetchStudents = async () => {
        try {
            const resp = await apiFetch(`/api/class-students?class_name=${encodeURIComponent(className || 'all')}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!resp.ok) {
                throw new Error(`Failed to load students (${resp.status})`);
            }

            const data = await resp.json();
            setStudents(data as Student[]);
        } catch (error: any) {
            console.error('Error fetching students:', error);
            toast({
                variant: 'destructive',
                title: 'Data Error',
                description: error.message || 'Failed to load students list.',
            });
            setStudents([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(false);
    };

    const enrichedStudents = students.filter((student) => {
        const studentStatus = student.status || (student.is_active ? 'active' : 'dropout');
        const isPendingDeletion = student.dropout_reason === 'DELETED_PENDING_PURGE';

        if (statusFilter === 'trash') {
            if (!isPendingDeletion) return false;
        } else {
            if (isPendingDeletion) return false;
            if (statusFilter === 'active' && studentStatus !== 'active' && studentStatus !== 'dropout_pending') return false;
            if (statusFilter === 'dropout' && studentStatus !== 'dropout') return false;
        }

        // We trust the backend to return students for the correct class, 
        // as the className comparison here is prone to case-sensitivity issues.
        const studentClass = student.classes?.name || '';
        if (className && className !== 'all' && studentClass) {
            if (studentClass.toLowerCase() !== className.toLowerCase()) return false;
        }

        const studentName = student.full_name || student.name || '';
        const fatherName = student.father_name || student.father || '';
        const fatherPhone = student.father_phone || student.fatherPhone || '';
        const matchesSearch =
            studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.admission_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            fatherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            fatherPhone.includes(searchQuery);

        return matchesSearch;
    });

    const getStudentName = (student: Student) => student.full_name || student.name || '-';
    const getClassName = (student: Student) => student.classes?.name || '-';
    const getAdmissionNumber = (student: Student) => student.admission_number || '-';
    const getFatherName = (student: Student) => student.father_name || student.father || '-';
    const getFatherPhone = (student: Student) => student.father_phone || student.fatherPhone || '-';
    const getAddress = (student: Student) => student.address || '-';
    const getAcademicYearStart = () => {
        const now = new Date();
        const year = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
        return new Date(year, 5, 1);
    };

    const formatDateSafe = (dateStr: string | undefined | null, formatStr: string = 'dd MMM yyyy') => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'N/A';
            return format(date, formatStr);
        } catch (e) {
            return 'N/A';
        }
    };

    const isNewAdmission = (student: Student) => {
        if (!student.created_at) return false;
        const createdAt = new Date(student.created_at);
        if (Number.isNaN(createdAt.getTime())) return false;
        return createdAt >= getAcademicYearStart();
    };

    // Helper functions for handleSubmit, etc. would go here - copied from Students.tsx
    // For brevity in this artifact explanation, I will include the core logic.

    // Helper: convert any date format into YYYY-MM-DD for the database
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
        if (dmyFull) {
            const [, d, m, y] = dmyFull;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        const dmyShort = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/);
        if (dmyShort) {
            const [, d, m, y] = dmyShort;
            const fullYear = parseInt(y) >= 50 ? `19${y}` : `20${y}`;
            return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
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
        sourceName,
        rowNumber,
    }: {
        rawAdmission: string;
        fullName: string;
        fatherPhone: string;
        dob: string | null;
        classLabel: string;
        sourceName: string;
        rowNumber: number;
    }): { value: string; wasGenerated: boolean } => {
        const cleaned = String(rawAdmission || '').trim();
        if (cleaned) return { value: cleaned, wasGenerated: false };

        const cls = normalizeClassToken(classLabel || sourceName || 'gen').toUpperCase() || 'GEN';
        const seed = [
            cls,
            String(fullName || '').toLowerCase().trim(),
            String(fatherPhone || '').trim(),
            String(dob || '').trim(),
            String(sourceName || '').toLowerCase().trim(),
            String(rowNumber),
        ].join('|');
        return { value: `AUTO-${cls}-${stableHash(seed)}`, wasGenerated: true };
    };

    const getClassByToken = (value: string): ClassOption | undefined => {
        const token = normalizeClassToken(value);
        if (!token) return undefined;
        return classes.find(c => normalizeClassToken(c.name) === token);
    };

    const matchClass = (classNameVal: string, sheetName?: string): ClassOption | undefined => {
        const candidates = [classNameVal, sheetName].filter(Boolean) as string[];

        for (const candidate of candidates) {
            const raw = String(candidate).trim();
            if (!raw) continue;

            let classObj = classes.find(c => c.name.toLowerCase() === raw.toLowerCase());
            if (!classObj) classObj = classes.find(c => normalizeClassName(c.name) === normalizeClassName(raw));

            const token = normalizeClassToken(raw);
            if (!classObj && token) classObj = classes.find(c => normalizeClassToken(c.name) === token);

            if (classObj) return classObj;
        }

        if (className && className !== 'all' && (!sheetName || sheetName === 'CSV')) {
            return getClassByToken(className);
        }

        return undefined;
    };

    const shouldIncludeClass = (resolvedClassName: string): boolean => {
        if (!className || className === 'all') return true;
        return normalizeClassToken(resolvedClassName) === normalizeClassToken(className);
    };

    const parseRowsData = (rowsData: any[][], sourceName: string): { studentsToInsert: any[]; errors: string[]; autoGeneratedCount: number } => {
        // Find the first non-empty row to use as headers
        let headerRowIndex = -1;
        for (let i = 0; i < rowsData.length; i++) {
            if (rowsData[i] && rowsData[i].some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1 || headerRowIndex === rowsData.length - 1) {
            return { studentsToInsert: [], errors: [`${sourceName}: File is empty or missing headers`], autoGeneratedCount: 0 };
        }

        // Normalize headers: lowercase and remove all non-alphanumeric characters
        const rawHeaders = rowsData[headerRowIndex] as string[];
        const headers = rawHeaders.map(h =>
            String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')
        );

        console.log('Detected Headers:', headers);

        const studentsToInsert: any[] = [];
        const errors: string[] = [];
        let autoGeneratedCount = 0;

        for (let i = headerRowIndex + 1; i < rowsData.length; i++) {
            const values = rowsData[i];
            if (!values || values.length === 0) continue;

            const row: any = {};
            headers.forEach((header, index) => {
                if (header) {
                    const val = values[index];
                    row[header] = val !== undefined && val !== null ? String(val).trim() : '';
                }
            });

            // Key mapping/aliases for common variations (normalized keys)
            const admissionNumberRaw = row.admissionnumber || row.admissionno || row.admno || row.id || row.studentidd || row.regno || row.admissionid || row.srno || row.studentregno;
            const fullName = row.fullname || row.studentname || row.name || row.fullnames || row.stname || row.nameofstudent;
            const classNameVal = row.class || row.grade || row.standard || row.classname || row.classsection || row.currentclass;
            const fatherName = row.fathername || row.fathersname || row.father || row.parentname || row.guardianname || row.fhname || row.fathersfullname;
            const fatherPhone = row.fatherphone || row.fathersphone || row.phone || row.mobile || row.contactnumber || row.fathermobile || row.mobilenumber || row.fathermobilenumber || row.mobileno || row.fathermobileno || row.parentmobile || row.parentphone || row.phno || row.contact || row.whatsappnumber || row.fathercontact;

            // Skip empty rows
            if (!admissionNumberRaw && !fullName) continue;

            // Validate only truly required fields
            if (!fullName) {
                const missing = [];
                if (!fullName) missing.push('Full Name');
                errors.push(`${sourceName} row ${i + 1}: Missing ${missing.join(', ')}`);
                continue;
            }

            // Find class ID with robust matching (supports values like "class3", "5", "IX", etc.)
            const classObj = matchClass(classNameVal, sourceName);
            if (!classObj) {
                errors.push(`${sourceName} row ${i + 1}: Class '${classNameVal || sourceName}' not found in system`);
                continue;
            }

            // In class-specific page, only import that class even if file has multiple classes.
            if (!shouldIncludeClass(classObj.name)) {
                continue;
            }

            const normalizedDob = normalizeDate(row.dob || row.dateofbirth);
            const admissionInfo = buildAdmissionNumber({
                rawAdmission: String(admissionNumberRaw || ''),
                fullName,
                fatherPhone: fatherPhone || '',
                dob: normalizedDob,
                classLabel: classObj.name,
                sourceName,
                rowNumber: i + 1,
            });
            if (admissionInfo.wasGenerated) autoGeneratedCount++;

            studentsToInsert.push({
                admission_number: admissionInfo.value,
                full_name: fullName,
                class_id: classObj.id,
                roll_number: row.rollnumber || row.roll || null,
                father_name: fatherName || 'N/A',
                father_phone: fatherPhone || '0000000000',
                mother_name: row.mothername || row.mothersname || null,
                mother_phone: row.motherphone || row.mothersphone || null,
                dob: normalizedDob,
                aadhaar: row.aadharnumber || row.aadhar || row.aadhaar || null,
                address: row.address || null,
                term1_fee: parseFloat(row.term1fee || row.termifee || row.term1 || '0') || 0,
                term2_fee: parseFloat(row.term2fee || row.termiifee || row.term2 || '0') || 0,
                term3_fee: parseFloat(row.term3fee || row.termiiifee || row.term3 || '0') || 0,
                has_books: parseBooleanLike(row.bookfeeoption || row.hasbooks || 'no'),
                books_fee: parseFloat(row.booksfee || row.bookfee || '0') || 0,
                has_transport: parseBooleanLike(row.transportfeeoption || row.hastransport || 'no'),
                transport_fee: parseFloat(row.transportfee || '0') || 0,
                old_dues: parseFloat(row.olddues || '0') || 0,
                parent_email: row.parentmailid || row.parentemail || row.email || null,
                student_type: (['old', 'new'].includes((row.studenttype || '').toLowerCase()) ? row.studenttype.toLowerCase() : 'new') as 'old' | 'new',
                joining_date: normalizeDate(row.dateofjoining || row.joiningdate) || new Date().toISOString().split('T')[0],
                is_active: true,
                status: 'active'
            });
        }

        return { studentsToInsert, errors, autoGeneratedCount };
    };

    const saveParsedStudents = async (studentsToInsert: any[], errors: string[], autoGeneratedCount: number) => {
        if (studentsToInsert.length > 0) {
            // Deduplicate rows by (class_id + admission_number) within the same file
            const uniqueStudentsMap = new Map();
            studentsToInsert.forEach(student => {
                uniqueStudentsMap.set(`${student.class_id}::${String(student.admission_number).toLowerCase()}`, student);
            });
            const finalStudentsToInsert = Array.from(uniqueStudentsMap.values());

            // Upsert in batches of 100 to avoid request size limits
            const BATCH = 100;
            for (let b = 0; b < finalStudentsToInsert.length; b += BATCH) {
                const batch = finalStudentsToInsert.slice(b, b + BATCH);
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

            toast({
                title: 'Bulk Upload Successful',
                description: `Successfully processed ${finalStudentsToInsert.length} students.${autoGeneratedCount > 0 ? ` ${autoGeneratedCount} admission number(s) auto-generated.` : ''}${errors.length > 0 ? ` ${errors.length} rows skipped.` : ''}`
            });

            if (errors.length > 0) {
                console.warn('Bulk upload row errors:', errors);
                const errorPreview = errors.slice(0, 3).join(' | ');
                toast({
                    variant: 'default',
                    title: `⚠️ ${errors.length} Rows Skipped`,
                    description: errorPreview + (errors.length > 3 ? ` ... and ${errors.length - 3} more.` : '')
                });
            }
            fetchStudents();
        } else if (errors.length > 0) {
            console.error('Validation Errors:', errors);
            toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: `No valid rows. First error: ${errors[0]}`
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'No Data Found',
                description: 'We couldn\'t find any student data in the file. Check if your headers match the template.'
            });
        }
    };

    const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!isFeeAdmin) return;
        const file = event.target.files?.[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');
        const isCsv = fileName.endsWith('.csv');

        if (!isExcel && !isCsv) {
            toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a .csv, .xls, or .xlsx file.' });
            return;
        }

        setIsSubmitting(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const allStudentsToInsert: any[] = [];
                const allErrors: string[] = [];
                let autoGeneratedCount = 0;

                if (isExcel) {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                    for (const sheetName of workbook.SheetNames) {
                        const sheet = workbook.Sheets[sheetName];
                        const rowsData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
                        if (!rowsData || rowsData.length === 0) continue;

                        const { studentsToInsert, errors, autoGeneratedCount: autoCount } = parseRowsData(rowsData, sheetName);
                        allStudentsToInsert.push(...studentsToInsert);
                        allErrors.push(...errors);
                        autoGeneratedCount += autoCount;
                    }
                } else {
                    const text = (e.target?.result as string).replace(/^\uFEFF/, ''); // Remove BOM
                    const rows = text.split('\n').map(r => r.trim()).filter(r => r);

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
                        return values.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
                    };

                    const rowsData = rows.map(r => parseLine(r));
                    const { studentsToInsert, errors, autoGeneratedCount: autoCount } = parseRowsData(rowsData, 'CSV');
                    allStudentsToInsert.push(...studentsToInsert);
                    allErrors.push(...errors);
                    autoGeneratedCount += autoCount;
                }

                await saveParsedStudents(allStudentsToInsert, allErrors, autoGeneratedCount);

            } catch (error: any) {
                console.error('Bulk upload error:', error);
                toast({ variant: 'destructive', title: 'Bulk Upload Failed', description: error.message });
            } finally {
                setIsSubmitting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        if (isExcel) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    };

    const downloadSampleCSV = () => {
        const headers = [
            'admission_number', 'full_name', 'class', 'roll_number',
            'father_name', 'father_phone', 'mother_name', 'mother_phone',
            'parent_mail_id', 'aadhaar_number', 'student_type', 'date_of_joining',
            'dob', 'address', 'term1_fee', 'term2_fee', 'term3_fee',
            'book_fee_option', 'books_fee', 'transport_fee_option',
            'transport_fee', 'old_dues'
        ];
        const rows = [headers.join(',')];
        const sampleRow = [
            'ADM001', 'John Doe', className === 'all' ? 'Class 1' : className, '101',
            'Robert Doe', '9876543210', 'Mary Doe', '9876543211',
            'parent@example.com', '123456789012', 'new', '2024-06-01',
            '2018-05-15', '123 Main St, City', '15000', '15000', '15000',
            'yes', '2500', 'yes', '5000', '0'
        ];
        rows.push(sampleRow.map(v => `"${v}"`).join(',')); // Quote all values for safety

        const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "students_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string);
                setFormData({ ...formData, profile_photo: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    useEffect(() => {
        if (isAddDialogOpen && className && className !== 'all' && !selectedStudent && classes && classes.length > 0) {
            try {
                const currentClass = classes.find(c => c.name?.toLowerCase() === className.toLowerCase());
                if (currentClass) {
                    setFormData(prev => ({ ...prev, class_id: currentClass.id }));
                }
            } catch (err) {
                console.warn('Race condition in pre-select effect:', err);
            }
        }
    }, [isAddDialogOpen, className, classes, selectedStudent]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFeeAdmin) return;

        // Validation
        if (!formData.full_name.trim()) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Full Name is required.' });
            return;
        }
        if (!formData.admission_number.trim()) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Admission Number is required.' });
            return;
        }
        if (!formData.class_id) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select a class for the student. If the list is empty, refresh the page.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const studentData = {
                admission_number: formData.admission_number.trim(),
                full_name: formData.full_name.trim(),
                class_id: formData.class_id,
                roll_number: formData.roll_number?.trim() || null,
                gender: formData.gender,
                father_name: formData.father_name.trim(),
                father_phone: formData.father_phone.trim(),
                mother_name: formData.mother_name?.trim() || null,
                mother_phone: formData.mother_phone?.trim() || null,
                dob: formData.dob || null,
                aadhaar: formData.aadhaar?.trim() || null,
                address: formData.address?.trim() || null,
                term1_fee: formData.term1_fee ? parseFloat(formData.term1_fee) : 0,
                term2_fee: formData.term2_fee ? parseFloat(formData.term2_fee) : 0,
                term3_fee: formData.term3_fee ? parseFloat(formData.term3_fee) : 0,
                has_books: formData.has_books,
                books_fee: formData.books_fee ? parseFloat(formData.books_fee) : 0,
                has_transport: formData.has_transport,
                transport_fee: formData.transport_fee ? parseFloat(formData.transport_fee) : 0,
                old_dues: formData.old_dues ? parseFloat(formData.old_dues) : 0,
                parent_email: formData.parent_email?.trim() || null,
                student_type: formData.student_type,
                joining_date: formData.joining_date || new Date().toISOString().split('T')[0],
                profile_photo: formData.profile_photo || null,
                is_active: true,
                status: 'active'
            };

            if (selectedStudent) {
                // Log EDIT action before updating
                await logStudentAction({
                    studentId: selectedStudent.id as string,
                    studentName: formData.full_name.trim(),
                    actionType: 'EDIT',
                    moduleName: 'Student Info',
                    oldValues: selectedStudent,
                    newValues: studentData,
                    performedBy: user?.id || '',
                    performedByName: profile?.full_name || 'Admin',
                    role: userRole || 'admin'
                });

                const resp = await apiFetch(`/api/students/${selectedStudent.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(studentData)
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.detail || 'Failed to update student');

                toast({ title: 'Student Updated', description: 'Student information updated successfully.' });
            } else {
                const resp = await apiFetch('/api/students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(studentData)
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.detail || 'Failed to add student');
                if (data.data) {
                    // Log ADD action after successful insertion
                    await logStudentAction({
                        studentId: data.data.id,
                        studentName: formData.full_name.trim(),
                        actionType: 'ADD',
                        moduleName: 'Student Info',
                        newValues: studentData,
                        performedBy: user?.id || '',
                        performedByName: profile?.full_name || 'Admin',
                        role: userRole || 'admin'
                    });
                }
                toast({ title: 'Student Added', description: 'New student added successfully.' });
            }
            setIsAddDialogOpen(false);
            setSelectedStudent(null);
            resetForm();
            fetchStudents();
        } catch (error: any) {
            console.error('Submit error:', error);
            toast({
                variant: 'destructive',
                title: 'Error Saving Student',
                description: error.message || 'An unexpected error occurred. Please check all fields.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };



    const resetForm = () => {
        setFormData({
            admission_number: '',
            full_name: '',
            class_id: '',
            roll_number: '',
            gender: 'Male',
            father_name: '',
            father_phone: '',
            mother_name: '',
            mother_phone: '',
            dob: '',
            aadhaar: '',
            address: '',
            term1_fee: '',
            term2_fee: '',
            term3_fee: '',
            has_books: false,
            books_fee: '',
            has_transport: false,
            transport_fee: '',
            old_dues: '',
            parent_email: '',
            student_type: 'new' as 'old' | 'new',
            joining_date: new Date().toISOString().split('T')[0],
            profile_photo: '',
        });
        setPhotoPreview(null);
    };

    const openEditDialog = (student: Student) => {
        // ... copy logic
        if (isStaff) {
            // Staff can edit basic info, but not fees.
            // We will hide fee fields in the form.
        }
        setSelectedStudent(student);
        setFormData({
            admission_number: student.admission_number || '',
            full_name: student.full_name || '',
            class_id: student.class_id || '',
            roll_number: student.roll_number || '',
            gender: student.gender || 'Male',
            father_name: student.father_name || '',
            father_phone: student.father_phone || '',
            mother_name: student.mother_name || '',
            mother_phone: student.mother_phone || '',
            dob: student.dob || '',
            aadhaar: student.aadhaar || '',
            address: student.address || '',
            term1_fee: student.term1_fee?.toString() || '',
            term2_fee: student.term2_fee?.toString() || '',
            term3_fee: student.term3_fee?.toString() || '',
            has_books: student.has_books || false,
            books_fee: student.books_fee?.toString() || '',
            has_transport: student.has_transport || false,
            transport_fee: student.transport_fee?.toString() || '',
            old_dues: student.old_dues?.toString() || '',
            parent_email: student.parent_email || '',
            student_type: student.student_type || 'new',
            joining_date: student.joining_date || '',
            profile_photo: student.profile_photo || '',
        });
        setPhotoPreview(student.profile_photo || null);
        setIsAddDialogOpen(true);
    };

    const handleMarkDropout = async (student: Student) => {
        if (!student?.id) return;
        const t1 = Number(student.term1_fee || 0);
        const t2 = Number(student.term2_fee || 0);
        const t3 = Number(student.term3_fee || 0);
        const books = student.has_books ? Number(student.books_fee || 0) : 0;
        const transport = student.has_transport ? Number(student.transport_fee || 0) : 0;
        const oldDues = Number(student.old_dues || 0);
        const totalPending = t1 + t2 + t3 + books + transport + oldDues;

        if (totalPending > 0) {
            toast({
                variant: 'destructive',
                title: 'Operation Blocked',
                description: `Cannot dropout student with pending fees (₹${totalPending.toLocaleString()}). Please clear or waive outstanding dues first!`,
            });
            return;
        }

        const reason = window.prompt('Reason for dropout:');
        if (reason === null) return; // Cancelled

        setIsMarkingDropout(true);
        try {
            if (isAdmin) {
                // Admin can mark directly
                await logStudentAction({
                    studentId: student.id as string,
                    studentName: student.full_name || student.name || '',
                    actionType: 'UPDATE',
                    moduleName: 'Student Info',
                    oldValues: { status: student.status, is_active: student.is_active },
                    newValues: { status: 'dropout', is_active: false, dropout_reason: reason },
                    performedBy: user?.id || '',
                    performedByName: profile?.full_name || 'Admin',
                    role: userRole || 'admin'
                });

                const resp = await apiFetch(`/api/students/dropout/${student.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.detail || 'Failed to mark student as dropout');
                toast({ title: 'Success', description: 'Student marked as dropout.' });
            } else {
                // Fee In Charge requests dropout via backend
                const resp = await apiFetch('/api/students/request-dropout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ student_id: student.id, reason })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.detail || 'Request failed');
                toast({ title: 'Request Sent', description: 'Dropout request submitted for Admin approval.' });
            }
            fetchStudents();
            setSelectedStudent(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsMarkingDropout(false);
        }
    };

    const handleDeleteDropout = async (student: Student, otpOverride?: string) => {
        if (isStaff) return;
        const t1 = Number(student.term1_fee || 0);
        const t2 = Number(student.term2_fee || 0);
        const t3 = Number(student.term3_fee || 0);
        const books = student.has_books ? Number(student.books_fee || 0) : 0;
        const transport = student.has_transport ? Number(student.transport_fee || 0) : 0;
        const oldDues = Number(student.old_dues || 0);
        const totalPending = t1 + t2 + t3 + books + transport + oldDues;

        if (totalPending > 0) {
            toast({
                variant: 'destructive',
                title: 'Operation Blocked',
                description: `Cannot delete student with pending fees (₹${totalPending.toLocaleString()}). Please clear or waive outstanding dues first!`,
            });
            return;
        }

        const isFeeInCharge = userRole === 'feeInCharge';

        if (isFeeInCharge && !otpOverride) {
            if (!confirm('Permanently delete? Admin permission (OTP) is required.')) return;
            setIsDeletingDropout(true);
            try {
                const resp = await apiFetch('/api/auth/request-wipe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ operation: 'delete_student' })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.detail || 'Failed to request OTP');
                setStudentToDelete(student);
                setShowDeleteOtpDialog(true);
                toast({ title: '🔐 OTP Sent', description: data.message || 'Please get the 6-digit verification code from Admin.' });
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'OTP Request Failed', description: err.message });
            } finally {
                setIsDeletingDropout(false);
            }
            return;
        }

        if (!isFeeInCharge) {
            if (!confirm('Permanently delete?')) return;
        }

        setIsDeletingDropout(true);
        try {
            // Log soft deletion
            await logStudentAction({
                studentId: student.id as string,
                studentName: student.full_name || student.name || '',
                actionType: 'DELETE',
                moduleName: 'Student Info',
                oldValues: student,
                performedBy: user?.id || '',
                performedByName: profile?.full_name || 'Admin',
                role: userRole || 'admin'
            });

            // Call backend delete student API
            const resp = await apiFetch(`/api/students/delete/${student.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp: otpOverride || null })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Deletion failed');

            toast({ title: 'Removed', description: data.message || 'Student moved to deletion queue (15-day retention).' });
            setShowDeleteOtpDialog(false);
            setDeleteOtp('');
            setStudentToDelete(null);
            fetchStudents();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsDeletingDropout(false);
        }
    };

    const handleRestoreStudent = async (student: Student) => {
        if (!isAdmin) return;
        setIsSubmitting(true);
        try {
            const resp = await apiFetch(`/api/students/restore/${student.id}`, {
                method: 'POST'
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Failed to restore student');
            toast({ title: 'Restored', description: `${getStudentName(student)} has been restored to active status.` });
            fetchStudents();
            setSelectedStudent(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Restore Failed', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchStudentHistory = async (studentId: string) => {
        setIsHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('student_history_logs' as any)
                .select('*')
                .eq('student_id', studentId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setStudentHistory(data || []);
        } catch (e) {
            console.error('History error:', e);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleRemoveClassStudents = async (otpOverride?: string) => {
        const isFeeInCharge = userRole === 'feeInCharge';

        if (isFeeInCharge && !otpOverride) {
            setShowRemoveConfirm(false);
            setIsRemoving(true);
            try {
                const resp = await apiFetch('/api/auth/request-wipe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ operation: 'remove_class' })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.detail || 'Failed to request OTP');
                setShowRemoveClassOtpDialog(true);
                toast({ title: '🔐 OTP Sent', description: data.message || 'Please get the 6-digit verification code from Admin.' });
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'OTP Request Failed', description: err.message });
            } finally {
                setIsRemoving(false);
            }
            return;
        }

        setIsRemoving(true);
        setShowRemoveConfirm(false);
        try {
            let classId: string | null = null;
            if (className !== 'all') {
                const classObj = classes.find(c => c.name.toLowerCase() === className.toLowerCase());
                if (!classObj) throw new Error('Class not found');
                classId = classObj.id;
            }

            // Log action
            await logStudentAction({
                studentName: className === 'all' ? 'All Students' : `Class ${className} Students`,
                actionType: 'DELETE',
                moduleName: 'Student Info',
                oldValues: { detail: `Mass removal of student class records via OTP confirmation` },
                performedBy: user?.id || '',
                performedByName: profile?.full_name || 'Admin',
                role: userRole || 'admin'
            });

            // Call backend remove class API
            const resp = await apiFetch('/api/students/remove-class', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    class_id: classId,
                    class_name: className,
                    otp: otpOverride || null
                })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Failed to remove students');

            toast({ title: 'Removed', description: data.message || `Students moved to deletion queue (15-day retention policy).` });
            setShowRemoveClassOtpDialog(false);
            setRemoveClassOtp('');
            fetchStudents();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: e.message || 'Could not remove students.' });
        } finally {
            setIsRemoving(false);
        }
    };


    return (
        <>
            <DashboardLayout>
                <div className="space-y-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => navigate(portalPath(portal, '/students'))}>
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-[#002147] font-display">
                                    {className === 'all' ? 'All Students' : `Students in ${className}`}
                                </h1>
                                <p className="text-slate-500 mt-1">Manage student records for {className}</p>
                            </div>
                        </div>

                        {isFeeAdmin && (
                            <div className="flex gap-2">
                                <Button variant="outline" className="gap-2" onClick={downloadSampleCSV}>
                                    <Download className="h-4 w-4" />
                                    Template
                                </Button>
                                <div className="relative">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleBulkUpload}
                                        accept=".csv,.xls,.xlsx"
                                        className="hidden"
                                    />
                                    <Button
                                        variant="outline"
                                        className="gap-2"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isSubmitting}
                                    >
                                        <Upload className="h-4 w-4" />
                                        {isSubmitting ? 'Uploading...' : 'Bulk Upload'}
                                    </Button>
                                </div>
                                <Button
                                    variant="outline"
                                    className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => setShowRemoveConfirm(true)}
                                    disabled={isRemoving || enrichedStudents.length === 0}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    {isRemoving ? 'Removing...' : 'Remove All'}
                                </Button>
                                <Button 
                                    className="gap-2 bg-[#002147] hover:bg-[#003366] text-white"
                                    onClick={() => {
                                        setSelectedStudent(null);
                                        resetForm();
                                        setIsAddDialogOpen(true);
                                    }}
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Student
                                </Button>
                                <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                                    setIsAddDialogOpen(open);
                                    if (!open) { setSelectedStudent(null); resetForm(); }
                                }}>

                                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>{selectedStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleSubmit} className="space-y-6">
                                            {/* Profile Photo */}
                                            <div className="flex flex-col items-center justify-center mb-6">
                                                <div className="relative group cursor-pointer">
                                                    <div className="h-28 w-28 rounded-full bg-slate-50 border-4 border-white shadow-lg flex items-center justify-center overflow-hidden ring-1 ring-slate-100">
                                                        {photoPreview ? (
                                                            <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                                                        ) : (
                                                            <User className="h-12 w-12 text-slate-300" />
                                                        )}
                                                    </div>
                                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-full z-10" onChange={handlePhotoChange} />
                                                    <div className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md border border-slate-200">
                                                        <Camera className="h-4 w-4 text-slate-600" />
                                                    </div>
                                                </div>
                                                <span className="text-xs text-slate-500 mt-2">Click to upload photo</span>
                                            </div>

                                            <div className="space-y-4">
                                                <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">Academic Information</h3>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label>Admission Number *</Label>
                                                        <Input required value={formData.admission_number} onChange={e => setFormData({ ...formData, admission_number: e.target.value })} placeholder="e.g. ADM001" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Full Name *</Label>
                                                        <Input required value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} placeholder="Student Name" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Roll Number</Label>
                                                        <Input value={formData.roll_number} onChange={e => setFormData({ ...formData, roll_number: e.target.value })} placeholder="Roll No" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Gender</Label>
                                                        <Select value={formData.gender} onValueChange={v => setFormData({ ...formData, gender: v })}>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Male">Male</SelectItem>
                                                                <SelectItem value="Female">Female</SelectItem>
                                                                <SelectItem value="Other">Other</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[11px] font-black uppercase tracking-widest text-[#002147]/40">Class *</Label>
                                                        <Select value={formData.class_id} onValueChange={v => setFormData({ ...formData, class_id: v })}>
                                                            <SelectTrigger className="rounded-xl border-slate-200 h-12 shadow-sm bg-white hover:border-[#002147]/30 transition-all">
                                                                <SelectValue placeholder="Select Class" />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl border-slate-100 shadow-2xl z-[100] max-h-[300px]">
                                                                {classes.length > 0 ? (
                                                                    classes.map(c => (
                                                                        <SelectItem key={c.id} value={c.id} className="rounded-lg my-1 font-medium">{c.name}</SelectItem>
                                                                    ))
                                                                ) : (
                                                                    <div className="p-4 text-center text-xs text-slate-400">Loading classes...</div>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Student Type</Label>
                                                        <Select value={formData.student_type} onValueChange={(v: 'old' | 'new') => setFormData({ ...formData, student_type: v })}>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="new">New</SelectItem>
                                                                <SelectItem value="old">Old</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Date of Joining</Label>
                                                        <Input type="date" value={formData.joining_date} onChange={e => setFormData({ ...formData, joining_date: e.target.value })} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">Personal Information</h3>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label>Date of Birth</Label>
                                                        <Input type="date" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Aadhar Number</Label>
                                                        <Input value={formData.aadhaar} onChange={e => setFormData({ ...formData, aadhaar: e.target.value })} placeholder="12-digit Aadhar" />
                                                    </div>
                                                    <div className="space-y-2 sm:col-span-2">
                                                        <Label>Address</Label>
                                                        <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Full Address" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">Parent Information</h3>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label>Father's Name *</Label>
                                                        <Input required value={formData.father_name} onChange={e => setFormData({ ...formData, father_name: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Father's Phone *</Label>
                                                        <Input required value={formData.father_phone} onChange={e => setFormData({ ...formData, father_phone: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Mother's Name</Label>
                                                        <Input value={formData.mother_name} onChange={e => setFormData({ ...formData, mother_name: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Mother's Phone</Label>
                                                        <Input value={formData.mother_phone} onChange={e => setFormData({ ...formData, mother_phone: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2 sm:col-span-2">
                                                        <Label>Parent Email</Label>
                                                        <Input type="email" value={formData.parent_email} onChange={e => setFormData({ ...formData, parent_email: e.target.value })} placeholder="parent@example.com" />
                                                    </div>
                                                </div>
                                            </div>

                                            {!isStaff && (
                                                <div className="space-y-4">
                                                    <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">Fee Details</h3>

                                                    <div className="space-y-2">
                                                        <Label>Total Term Fee (Auto-calculates Terms)</Label>
                                                        <Input
                                                            type="number"
                                                            placeholder="Enter Total Term Fee"
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                if (!isNaN(val)) {
                                                                    // Smart Rounding: Round Term 1 and Term 2 to nearest 100 for cleaner numbers
                                                                    // e.g., 47000 * 0.34 = 15980 -> rounds to 16000
                                                                    const roundToHundred = (num: number) => Math.round(num / 100) * 100;

                                                                    const t1 = roundToHundred(val * 0.34);
                                                                    const t2 = roundToHundred(val * 0.33);
                                                                    const t3 = val - t1 - t2; // Remainder ensures total matches exactly

                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        term1_fee: t1.toString(),
                                                                        term2_fee: t2.toString(),
                                                                        term3_fee: t3.toString()
                                                                    }));
                                                                } else {
                                                                    setFormData(prev => ({ ...prev, term1_fee: '', term2_fee: '', term3_fee: '' }));
                                                                }
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="grid gap-4 sm:grid-cols-3">
                                                        <div className="space-y-2">
                                                            <Label>Term 1 Fee</Label>
                                                            <Input type="number" value={formData.term1_fee} readOnly className="bg-slate-100" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Term 2 Fee</Label>
                                                            <Input type="number" value={formData.term2_fee} readOnly className="bg-slate-100" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Term 3 Fee</Label>
                                                            <Input type="number" value={formData.term3_fee} readOnly className="bg-slate-100" />
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label>Book Fee Option</Label>
                                                            <Select value={formData.has_books ? "yes" : "no"} onValueChange={(v) => setFormData({ ...formData, has_books: v === "yes" })}>
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="yes">Yes</SelectItem>
                                                                    <SelectItem value="no">No</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        {formData.has_books && (
                                                            <div className="space-y-2">
                                                                <Label>Book Fee Amount</Label>
                                                                <Input type="number" value={formData.books_fee} onChange={e => setFormData({ ...formData, books_fee: e.target.value })} placeholder="0.00" />
                                                            </div>
                                                        )}

                                                        <div className="space-y-2">
                                                            <Label>Transport Fee Option</Label>
                                                            <Select value={formData.has_transport ? "yes" : "no"} onValueChange={(v) => setFormData({ ...formData, has_transport: v === "yes" })}>
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="yes">Yes</SelectItem>
                                                                    <SelectItem value="no">No</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        {formData.has_transport && (
                                                            <div className="space-y-2">
                                                                <Label>Transport Fee Amount</Label>
                                                                <Input type="number" value={formData.transport_fee} onChange={e => setFormData({ ...formData, transport_fee: e.target.value })} placeholder="0.00" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label>Old Dues</Label>
                                                            <Input type="number" value={formData.old_dues} onChange={e => setFormData({ ...formData, old_dues: e.target.value })} placeholder="0.00" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Total Fee (Calculated)</Label>
                                                            <div className="flex h-10 w-full rounded-md border border-input bg-slate-50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                                                {((parseFloat(formData.term1_fee) || 0) +
                                                                    (parseFloat(formData.term2_fee) || 0) +
                                                                    (parseFloat(formData.term3_fee) || 0) +
                                                                    (formData.has_books ? (parseFloat(formData.books_fee) || 0) : 0) +
                                                                    (formData.has_transport ? (parseFloat(formData.transport_fee) || 0) : 0) +
                                                                    (parseFloat(formData.old_dues) || 0)).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">Sum of Terms + Books + Transport + Old Dues</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <DialogFooter>
                                                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                                                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Student'}</Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search students..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant={statusFilter === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('active')}>Active</Button>
                            <Button variant={statusFilter === 'dropout' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('dropout')}>Dropouts</Button>
                            <Button variant={statusFilter === 'trash' ? 'default' : 'destructive'} size="sm" onClick={() => setStatusFilter('trash')} className={statusFilter === 'trash' ? '' : 'border-red-200 text-red-600 hover:bg-red-50'}>
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Trash
                            </Button>
                            <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>All</Button>
                        </div>
                    </div>

                    {/* Stats */}
                    {/* Stats */}
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        <Card className="card-elevated">
                            <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mb-1">
                                    <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Total Students</p>
                                    <p className="text-3xl font-display font-bold text-[#002147]">{students.length}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="card-elevated">
                            <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mb-1">
                                    <User className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Active Students</p>
                                    <p className="text-3xl font-display font-bold text-[#002147]">{students.filter(s => (s.status || 'active') === 'active').length}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="card-elevated">
                            <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center mb-1">
                                    <GraduationCap className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Old Students</p>
                                    <p className="text-3xl font-display font-bold text-[#002147]">{students.filter(s => s.student_type === 'old').length}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="card-elevated">
                            <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center mb-1">
                                    <Plus className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">New Students</p>
                                    <p className="text-3xl font-display font-bold text-[#002147]">{students.filter(s => s.student_type === 'new').length}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="lg:w-1/2">
                            <Card className="card-elevated">
                                <CardHeader>
                                    <CardTitle>Students List</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {isLoading ? (
                                            <div className="text-center py-4">Loading...</div>
                                        ) : enrichedStudents.length === 0 ? (
                                            <div className="text-center py-12 text-muted-foreground">No students found</div>
                                        ) : (
                                            enrichedStudents.map((student) => (
                                                <motion.div
                                                    key={student.id}
                                                    whileHover={{ scale: 1.01 }}
                                                    className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedStudent?.id === student.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}
                                                    onClick={() => {
                                                        setSelectedStudent(student);
                                                        if (window.innerWidth < 1024) setShowDetailsPanel(true);
                                                    }}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 overflow-hidden shrink-0">
                                                            {student.profile_photo ? (
                                                                <img src={student.profile_photo} alt={getStudentName(student)} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <GraduationCap className="h-6 w-6 text-primary" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h3 className="font-medium">{getStudentName(student)}</h3>
                                                                {student.status === 'dropout_pending' && (
                                                                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50/50 text-[10px] font-bold py-0.5 px-2 rounded-full h-auto">
                                                                        Pending Dropout
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-muted-foreground">{getAdmissionNumber(student)}</p>
                                                        </div>
                                                        <Badge variant="secondary">{getClassName(student)}</Badge>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className={`lg:w-1/2 ${showDetailsPanel ? 'block' : 'hidden lg:block'}`}>
                            <Card className="card-elevated sticky top-6">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Student Details</CardTitle>
                                    <Button variant="ghost" size="sm" onClick={() => { setShowDetailsPanel(false); setSelectedStudent(null); }} className="lg:hidden">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {selectedStudent ? (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 overflow-hidden shrink-0">
                                                    {selectedStudent.profile_photo ? (
                                                        <img src={selectedStudent.profile_photo} alt={getStudentName(selectedStudent)} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <GraduationCap className="h-8 w-8 text-primary" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-semibold">{getStudentName(selectedStudent)}</h2>
                                                    <p className="text-muted-foreground">{getClassName(selectedStudent)}</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-4">
                                                <div className="flex justify-between"><span className="text-muted-foreground">Admission No</span><span className="font-medium">{getAdmissionNumber(selectedStudent)}</span></div>
                                                <div className="flex justify-between"><span className="text-muted-foreground">Father's Name</span><span className="font-medium">{getFatherName(selectedStudent)}</span></div>
                                                <div className="flex justify-between"><span className="text-muted-foreground">Father's Phone</span><span className="font-medium">{selectedStudent.father_phone || 'N/A'}</span></div>
                                                <div className="flex justify-between"><span className="text-muted-foreground">Mother's Phone</span><span className="font-medium">{selectedStudent.mother_phone || 'N/A'}</span></div>
                                                <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span className="font-medium truncate max-w-[150px]">{getAddress(selectedStudent)}</span></div>
                                                <div className="flex justify-between"><span className="text-muted-foreground">Joining Date</span><span className="font-medium">{selectedStudent.joining_date || '-'}</span></div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 pt-4">
                                                {selectedStudent.dropout_reason === 'DELETED_PENDING_PURGE' ? (
                                                    <div className="w-full space-y-4">
                                                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                                                            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm font-bold text-red-800">Pending Permanent Deletion</p>
                                                            </div>
                                                        </div>
                                                        <Button 
                                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                                                            onClick={() => handleRestoreStudent(selectedStudent)}
                                                            disabled={isSubmitting}
                                                        >
                                                            Restore Student Record
                                                        </Button>
                                                    </div>
                                                ) : selectedStudent.status === 'dropout_pending' ? (
                                                    <div className="w-full space-y-4">
                                                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                                                            <p className="text-sm font-bold text-amber-800">Dropout Requested</p>
                                                            <p className="text-xs text-amber-600 mt-1">{selectedStudent.dropout_reason}</p>
                                                        </div>
                                                        {isAdmin ? (
                                                            <div className="flex gap-2">
                                                                <Button 
                                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                                                                    onClick={() => handleApproveDropout(selectedStudent)}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    Approve
                                                                </Button>
                                                                <Button 
                                                                    variant="outline"
                                                                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold"
                                                                    onClick={() => handleRejectDropout(selectedStudent)}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    Reject
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <p className="text-center text-xs text-slate-400 italic">Waiting for Admin approval...</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex w-full gap-2">
                                                        <Button variant="outline" className="flex-1" onClick={() => openEditDialog(selectedStudent)} disabled={!isFeeAdmin}><Edit2 className="mr-2 h-4 w-4" />Edit</Button>
                                                        {selectedStudent.status !== 'dropout' && (
                                                            <Button variant="destructive" className="flex-1" onClick={() => handleMarkDropout(selectedStudent)} disabled={!isFeeAdmin}>Mark Dropout</Button>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                <Button
                                                    variant="outline"
                                                    className="w-full gap-2 border-slate-200 mt-2 hover:bg-slate-50 text-[#002147] font-bold"
                                                    onClick={() => setShowProfileDialog(true)}
                                                >
                                                    <User className="h-4 w-4" />
                                                    View Full Profile
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted" />
                                            <p>Select a student to view details</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </DashboardLayout>

            {/* Remove All Students Confirmation Dialog */}
            {showRemoveConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-red-100">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                                <AlertTriangle className="h-8 w-8 text-red-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800">Remove All Students?</h2>
                            <p className="text-slate-500 text-sm">
                                This will permanently delete{' '}
                                <span className="font-bold text-red-600">{enrichedStudents.length} student records</span>{' '}
                                from <span className="font-bold">{className === 'all' ? 'all classes' : className}</span>.
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
                                    onClick={handleRemoveClassStudents}
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

            {/* Full Student Profile Dialog */}
            <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl p-0">
                    {selectedStudent && (
                        <div className="flex flex-col">
                            {/* Header / Cover */}
                            <div className="h-32 bg-gradient-to-r from-[#002147] to-[#003366] w-full relative">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute right-4 top-4 text-white/70 hover:text-white hover:bg-white/10"
                                    onClick={() => setShowProfileDialog(false)}
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                            
                            {/* Profile Info */}
                            <div className="px-8 pb-8 -mt-12 relative">
                                <div className="flex flex-col sm:flex-row gap-6 items-end mb-8">
                                    <div className="h-32 w-32 rounded-3xl bg-white p-1.5 shadow-xl ring-1 ring-slate-100 flex items-center justify-center overflow-hidden">
                                        {selectedStudent.profile_photo ? (
                                            <img src={selectedStudent.profile_photo} alt={getStudentName(selectedStudent)} className="h-full w-full object-cover rounded-[1.25rem]" />
                                        ) : (
                                            <div className="h-full w-full bg-slate-50 flex items-center justify-center rounded-[1.25rem]">
                                                <User className="h-12 w-12 text-slate-200" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 pb-2">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-3xl font-black text-[#002147] tracking-tight">{getStudentName(selectedStudent)}</h2>
                                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50">Active</Badge>
                                        </div>
                                        <p className="text-slate-500 font-bold flex items-center gap-2 mt-1">
                                            <GraduationCap className="h-4 w-4" />
                                            Class {getClassName(selectedStudent)} • Roll {selectedStudent.roll_number || 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-8 md:grid-cols-2">
                                    {/* Personal & Academic */}
                                    <div className="space-y-6">
                                        <section>
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Academic Details</h3>
                                            <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                                <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-500">Admission No</span> <span className="text-sm font-black text-[#002147]">{getAdmissionNumber(selectedStudent)}</span></div>
                                                <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-500">Student Type</span> <Badge variant="outline" className="capitalize">{selectedStudent.student_type}</Badge></div>
                                                <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-500">Joining Date</span> <span className="text-sm font-bold">{formatDateSafe(selectedStudent.joining_date)}</span></div>
                                                <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-500">Gender</span> <span className="text-sm font-bold">{selectedStudent.gender || 'N/A'}</span></div>
                                            </div>
                                        </section>

                                        <section>
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Personal Details</h3>
                                            <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                                <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-500 flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> Date of Birth</span> <span className="text-sm font-bold">{formatDateSafe(selectedStudent.dob)}</span></div>
                                                <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-500 flex items-center gap-2"><div className="h-3.5 w-3.5 rounded-full border border-slate-400 flex items-center justify-center text-[8px] font-bold">A</div> Aadhaar No</span> <span className="text-sm font-bold">{selectedStudent.aadhaar || 'N/A'}</span></div>
                                                <div className="flex flex-col gap-1 mt-2">
                                                    <span className="text-sm font-bold text-slate-500 flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Home Address</span>
                                                    <span className="text-sm font-bold text-slate-700 bg-white p-2 rounded-lg border border-slate-100 mt-1">{getAddress(selectedStudent)}</span>
                                                </div>
                                            </div>
                                        </section>
                                    </div>

                                    {/* Parent & Contact */}
                                    <div className="space-y-6">
                                        <section>
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Parent Information</h3>
                                            <div className="space-y-5 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                                                        <User className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 leading-none mb-1">Father's Name</p>
                                                        <p className="text-sm font-bold text-[#002147]">{getFatherName(selectedStudent)}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center">
                                                        <User className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 leading-none mb-1">Mother's Name</p>
                                                        <p className="text-sm font-bold text-[#002147]">{selectedStudent.mother_name || 'N/A'}</p>
                                                    </div>
                                                </div>

                                                <div className="pt-2 space-y-3">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-slate-500 font-bold flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> Contact 1</span>
                                                        <span className="font-black text-[#002147]">{selectedStudent.father_phone || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-slate-500 font-bold flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> Contact 2</span>
                                                        <span className="font-black text-[#002147]">{selectedStudent.mother_phone || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-sm truncate">
                                                        <span className="text-slate-500 font-bold flex items-center gap-2 min-w-fit"><Mail className="h-3.5 w-3.5" /> Email ID</span>
                                                        <span className="font-bold text-[#002147] truncate ml-2">{selectedStudent.parent_email || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        <section>
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Fee Configuration</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                                    <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Transport</p>
                                                    <Badge variant={selectedStudent.has_transport ? 'default' : 'outline'} className="text-[10px]">
                                                        {selectedStudent.has_transport ? 'ACTIVE' : 'NONE'}
                                                    </Badge>
                                                </div>
                                                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                                    <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Books/Study</p>
                                                    <Badge variant={selectedStudent.has_books ? 'default' : 'outline'} className="text-[10px]">
                                                        {selectedStudent.has_books ? 'ACTIVE' : 'NONE'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-[2rem]">
                                <Button
                                    variant="outline"
                                    className="rounded-xl border-slate-300 gap-2"
                                    onClick={() => {
                                        setShowProfileDialog(false);
                                        fetchStudentHistory(selectedStudent.id as string);
                                        setShowHistoryDialog(true);
                                    }}
                                >
                                    <History className="h-4 w-4" /> History
                                </Button>
                                <Button 
                                    className="bg-[#002147] hover:bg-[#002147]/90 text-white rounded-xl px-8"
                                    onClick={() => {
                                        setShowProfileDialog(false);
                                        openEditDialog(selectedStudent);
                                    }}
                                >
                                    Edit Profile
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Student Action History Dialog */}
            <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                            <History className="h-6 w-6 text-[#002147]" />
                            Action History
                        </DialogTitle>
                        <DialogDescription>
                            Audit trail for {selectedStudent ? getStudentName(selectedStudent) : 'Student'}
                        </DialogDescription>
                    </DialogHeader>

                    {isHistoryLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#002147]"></div>
                            <p className="text-slate-500 text-sm mt-4">Streaming history...</p>
                        </div>
                    ) : studentHistory.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">
                            <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No recorded history for this student.</p>
                            <p className="text-xs">Only actions performed after the history system was installed are tracked.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 pt-4">
                            {studentHistory.map((log, index) => (
                                <div key={log.log_id} className="relative pl-8 pb-4">
                                    {index !== studentHistory.length - 1 && (
                                        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-100" />
                                    )}
                                    <div className={`absolute left-0 top-1.5 h-6 w-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center 
                                        ${log.action_type === 'ADD' ? 'bg-emerald-100 text-emerald-600' :
                                            log.action_type === 'EDIT' ? 'bg-amber-100 text-amber-600' :
                                                log.action_type === 'UPDATE' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                                    </div>
                                    <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <Badge variant="outline" className="mb-1 uppercase tracking-tighter text-[10px]">
                                                    {log.action_type}
                                                </Badge>
                                                <p className="text-xs text-slate-500">
                                                    {formatDateSafe(log.created_at, 'MMM dd, yyyy • hh:mm a')}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-[#002147] uppercase opacity-40">Performed By</p>
                                                <p className="text-xs font-bold text-slate-700">{log.performed_by_name}</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-600 italic">
                                            {log.action_type === 'ADD' && "Original record created."}
                                            {log.action_type === 'EDIT' && "Modified student information."}
                                            {log.action_type === 'UPDATE' && "Status or secondary info updated."}
                                            {log.action_type === 'DELETE' && "Record was removed."}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowHistoryDialog(false)} className="rounded-xl">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* OTP Dialog for Individual Student Deletion */}
            <Dialog open={showDeleteOtpDialog} onOpenChange={setShowDeleteOtpDialog}>
                <DialogContent className="max-w-xl rounded-3xl border-none shadow-2xl bg-white p-6">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-800">
                            Admin OTP Required
                        </DialogTitle>
                        <DialogDescription className="text-slate-600">
                            Please enter the 6-digit confirmation code sent to the administrator to authorize deletion of student {studentToDelete ? getStudentName(studentToDelete) : ''}.
                        </DialogDescription>
                    </DialogHeader>

                    {studentToDelete && (() => {
                        const t1 = Number(studentToDelete.term1_fee || 0);
                        const t2 = Number(studentToDelete.term2_fee || 0);
                        const t3 = Number(studentToDelete.term3_fee || 0);
                        const books = studentToDelete.has_books ? Number(studentToDelete.books_fee || 0) : 0;
                        const transport = studentToDelete.has_transport ? Number(studentToDelete.transport_fee || 0) : 0;
                        const oldDues = Number(studentToDelete.old_dues || 0);
                        const totalPending = t1 + t2 + t3 + books + transport + oldDues;

                        return (
                            <div className="my-4 bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-4 text-xs">
                                <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                                    <span className="font-extrabold uppercase tracking-wider text-[#002147]">Target Student Profile</span>
                                    <Badge className="bg-red-100 text-red-800 border-red-200 uppercase text-[9px] font-bold">WIPE TARGET</Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Full Name</span>
                                        <span className="font-black text-slate-700 text-sm">{getStudentName(studentToDelete)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Class / Admission No</span>
                                        <span className="font-bold text-slate-700">{studentToDelete.classes?.name || className || 'N/A'} • {studentToDelete.admission_number || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Roll Number</span>
                                        <span className="font-bold text-slate-700">{studentToDelete.roll_number || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Date of Birth</span>
                                        <span className="font-bold text-slate-700">{studentToDelete.dob || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Father's Info</span>
                                        <span className="font-bold text-slate-700">{studentToDelete.father_name || 'N/A'}</span>
                                        {studentToDelete.father_phone && <span className="block text-[10px] text-[#002147] font-bold">{studentToDelete.father_phone}</span>}
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Mother's Info</span>
                                        <span className="font-bold text-slate-700">{studentToDelete.mother_name || 'N/A'}</span>
                                        {studentToDelete.mother_phone && <span className="block text-[10px] text-[#002147] font-bold">{studentToDelete.mother_phone}</span>}
                                    </div>
                                </div>
                                {studentToDelete.address && (
                                    <div className="bg-white/80 p-2.5 rounded-xl border border-slate-100">
                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Residential Address</span>
                                        <span className="font-semibold text-slate-600 block leading-tight">{studentToDelete.address}</span>
                                    </div>
                                )}
                                <div className="bg-red-50/50 p-3 rounded-xl border border-red-100 flex justify-between items-center">
                                    <div>
                                        <span className="text-[10px] font-bold text-red-700 block uppercase">Outstanding Balance</span>
                                        <span className="text-[10px] text-slate-500 font-medium">T1+T2+T3 + Books + Transport + Dues</span>
                                    </div>
                                    <span className="text-sm font-black text-red-700">₹{totalPending.toLocaleString()}</span>
                                </div>
                            </div>
                        );
                    })()}

                    <div className="py-2 space-y-2">
                        <Input
                            type="text"
                            placeholder="Enter 6-digit OTP"
                            value={deleteOtp}
                            onChange={(e) => setDeleteOtp(e.target.value)}
                            className="text-center text-xl font-bold tracking-[0.2em] rounded-xl py-6"
                            maxLength={6}
                        />
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => { setShowDeleteOtpDialog(false); setDeleteOtp(''); setStudentToDelete(null); }} className="rounded-xl flex-1 py-6">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => studentToDelete && handleDeleteDropout(studentToDelete, deleteOtp)}
                            disabled={isDeletingDropout || deleteOtp.length !== 6}
                            className="bg-[#002147] hover:bg-[#003366] text-white rounded-xl flex-1 py-6 font-bold"
                        >
                            {isDeletingDropout ? 'Verifying & Deleting...' : 'Verify & Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* OTP Dialog for Class mass deletion */}
            <Dialog open={showRemoveClassOtpDialog} onOpenChange={setShowRemoveClassOtpDialog}>
                <DialogContent className="max-w-xl rounded-3xl border-none shadow-2xl bg-white p-6">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-800">
                            Admin OTP Required
                        </DialogTitle>
                        <DialogDescription className="text-slate-600">
                            Please enter the 6-digit confirmation code sent to the administrator to authorize mass removal of students in class {className === 'all' ? 'All Classes' : className}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="my-4 bg-red-50/50 rounded-2xl border border-red-100 p-4 space-y-3 text-xs">
                        <div className="border-b border-red-200 pb-2 flex justify-between items-center">
                            <span className="font-extrabold uppercase tracking-wider text-red-800">Wipe Operation Details</span>
                            <Badge className="bg-red-600 text-white border-red-700 uppercase text-[9px] font-bold">MASS REMOVAL</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <span className="text-[10px] font-bold text-red-400 block uppercase">Target Class</span>
                                <span className="font-black text-red-800 text-sm">{className === 'all' ? 'All Classes' : className}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-red-400 block uppercase">Total Students Affected</span>
                                <span className="font-black text-red-800 text-sm">{students.length} Students</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-red-500 font-semibold leading-relaxed mt-2">
                            ⚠️ WARNING: This operation will permanently remove all {students.length} students currently listed in this view. This action is highly destructive and requires dual authorization.
                        </p>
                    </div>

                    <div className="py-2 space-y-2">
                        <Input
                            type="text"
                            placeholder="Enter 6-digit OTP"
                            value={removeClassOtp}
                            onChange={(e) => setRemoveClassOtp(e.target.value)}
                            className="text-center text-xl font-bold tracking-[0.2em] rounded-xl py-6"
                            maxLength={6}
                        />
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => { setShowRemoveClassOtpDialog(false); setRemoveClassOtp(''); }} className="rounded-xl flex-1 py-6">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => handleRemoveClassStudents(removeClassOtp)}
                            disabled={isRemoving || removeClassOtp.length !== 6}
                            className="bg-[#002147] hover:bg-[#003366] text-white rounded-xl flex-1 py-6 font-bold"
                        >
                            {isRemoving ? 'Verifying & Removing...' : 'Verify & Remove All'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
