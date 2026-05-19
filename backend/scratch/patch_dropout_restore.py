import os

file_path = r"d:\school-fee-mangament system (3)\adarsh-oxford\frontend\src\pages\ClassStudents.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. Target for handleMarkDropout ───────────────────────────────────────────
target_dropout = """                const { error } = await supabase.from('students').update({
                    is_active: false,
                    status: 'dropout',
                    dropout_reason: reason,
                    dropout_date: new Date().toISOString()
                }).eq('id', student.id);
                if (error) throw error;
                toast({ title: 'Success', description: 'Student marked as dropout.' });"""

replacement_dropout = """                const resp = await apiFetch(`/api/students/dropout/${student.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.detail || 'Failed to mark student as dropout');
                toast({ title: 'Success', description: 'Student marked as dropout.' });"""

# ── 2. Target for handleRestoreStudent ────────────────────────────────────────
target_restore = """            const { error } = await supabase
                .from('students')
                .update({
                    is_active: true,
                    status: 'active',
                    dropout_reason: null,
                    dropout_date: null
                })
                .eq('id', student.id);

            if (error) throw error;
            toast({ title: 'Restored', description: `${getStudentName(student)} has been restored to active status.` });"""

replacement_restore = """            const resp = await apiFetch(`/api/students/restore/${student.id}`, {
                method: 'POST'
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Failed to restore student');
            toast({ title: 'Restored', description: `${getStudentName(student)} has been restored to active status.` });"""

# Try matching with CRLF and LF
changed = False

target_dropout_crlf = target_dropout.replace("\n", "\r\n")
target_dropout_lf = target_dropout.replace("\r\n", "\n")
replacement_dropout_crlf = replacement_dropout.replace("\n", "\r\n")

if target_dropout_crlf in content:
    content = content.replace(target_dropout_crlf, replacement_dropout_crlf)
    print("Mark-Dropout: Replaced CRLF version!")
    changed = True
elif target_dropout_lf in content:
    content = content.replace(target_dropout_lf, replacement_dropout)
    print("Mark-Dropout: Replaced LF version!")
    changed = True
else:
    print("Mark-Dropout: Target not found!")

target_restore_crlf = target_restore.replace("\n", "\r\n")
target_restore_lf = target_restore.replace("\r\n", "\n")
replacement_restore_crlf = replacement_restore.replace("\n", "\r\n")

if target_restore_crlf in content:
    content = content.replace(target_restore_crlf, replacement_restore_crlf)
    print("Restore-Student: Replaced CRLF version!")
    changed = True
elif target_restore_lf in content:
    content = content.replace(target_restore_lf, replacement_restore)
    print("Restore-Student: Replaced LF version!")
    changed = True
else:
    print("Restore-Student: Target not found!")

if changed:
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("ClassStudents.tsx updated successfully!")
else:
    print("No changes made.")
