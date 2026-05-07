import { supabase } from "@/integrations/supabase/client";

export type ActionType = 'ADD' | 'EDIT' | 'UPDATE' | 'DELETE';
export type ModuleName = 'Student Info' | 'Course' | 'Books' | 'Transport' | 'Accessories';

interface LogActionParams {
    studentId?: string;
    studentName: string;
    actionType: ActionType;
    moduleName: ModuleName;
    oldValues?: any;
    newValues?: any;
    performedBy: string;
    performedByName: string;
    role: string;
}

// Human-readable field labels for audit display
const FIELD_LABELS: Record<string, string> = {
    full_name:       'Full Name',
    admission_number:'Admission Number',
    class_id:        'Class',
    roll_number:     'Roll Number',
    gender:          'Gender',
    father_name:     'Father Name',
    father_phone:    'Father Phone',
    mother_name:     'Mother Name',
    mother_phone:    'Mother Phone',
    dob:             'Date of Birth',
    aadhaar:         'Aadhaar Number',
    address:         'Address',
    term1_fee:       'Term 1 Fee',
    term2_fee:       'Term 2 Fee',
    term3_fee:       'Term 3 Fee',
    has_books:       'Has Books',
    books_fee:       'Books Fee',
    has_transport:   'Has Transport',
    transport_fee:   'Transport Fee',
    old_dues:        'Old Dues',
    parent_email:    'Parent Email',
    student_type:    'Student Type',
    joining_date:    'Joining Date',
    status:          'Status',
    is_active:       'Active Status',
    dropout_reason:  'Dropout Reason',
    dropout_date:    'Dropout Date',
};

// Ignored fields (system/internal that we don't need to show in diff)
const IGNORED_FIELDS = new Set([
    'id', 'created_at', 'updated_at', 'profile_photo', 'classes',
    'term1Paid', 'term2Paid', 'term3Paid', 'totalFee', 'pendingFee',
]);

export interface FieldChange {
    field: string;
    label: string;
    oldValue: string;
    newValue: string;
}

/**
 * Compares two student objects and returns only the changed fields.
 */
export function diffStudentObjects(oldObj: any, newObj: any): FieldChange[] {
    if (!oldObj || !newObj) return [];
    const changes: FieldChange[] = [];

    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of allKeys) {
        if (IGNORED_FIELDS.has(key)) continue;
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        // Stringify both to compare safely (handles numbers vs strings)
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
            changes.push({
                field: key,
                label: FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                oldValue: String(oldVal ?? '—'),
                newValue: String(newVal ?? '—'),
            });
        }
    }
    return changes;
}

/**
 * Logs a student action to the student_history_logs table.
 * Automatically diffs old vs new if action is EDIT and both provided.
 */
export async function logStudentAction({
    studentId,
    studentName,
    actionType,
    moduleName,
    oldValues,
    newValues,
    performedBy,
    performedByName,
    role
}: LogActionParams) {
    try {
        // For EDIT actions, compute a clean diff and store it
        let storedOld = oldValues;
        let storedNew = newValues;

        if (actionType === 'EDIT' && oldValues && newValues) {
            const changes = diffStudentObjects(oldValues, newValues);
            if (changes.length === 0) {
                // Nothing actually changed — skip logging
                return;
            }
            // Store structured diff instead of raw objects
            storedOld = Object.fromEntries(changes.map(c => [c.field, c.oldValue]));
            storedNew = Object.fromEntries(changes.map(c => [c.field, c.newValue]));
        }

        const { error } = await supabase
            .from('student_history_logs' as any)
            .insert({
                student_id: studentId,
                student_name: studentName,
                action_type: actionType,
                module_name: moduleName,
                old_values: storedOld ?? null,
                new_values: storedNew ?? null,
                performed_by: performedBy,
                performed_by_name: performedByName,
                role: role,
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error logging student action:', error);
        }
    } catch (err) {
        console.error('Failed to log action:', err);
    }
}

/**
 * Convenience: fetch history for a specific student (used in student detail panel)
 */
export async function fetchStudentHistory(studentId: string, limit = 20) {
    const { data, error } = await supabase
        .from('student_history_logs' as any)
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching student history:', error);
        return [];
    }
    return data || [];
}
