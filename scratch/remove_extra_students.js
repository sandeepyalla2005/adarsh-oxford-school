import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../frontend/.env');

if (!fs.existsSync(envPath)) {
    console.error('Frontend .env file not found');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
        }
        env[match[1]] = val;
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const gteTime = '2026-05-19T10:38:10Z';
const lteTime = '2026-05-19T10:38:13Z';

const childTables = [
    'student_accessory_payments',
    'course_payments',
    'student_history_logs',
    'student_accessory_fees',
    'transport_payments',
    'books_payments',
    'attendance_records',
    'accessory_sales'
];

async function removeExtraStudents() {
    console.log(`Querying students created between ${gteTime} and ${lteTime}...`);
    
    const studentsRes = await fetch(`${supabaseUrl}/rest/v1/students?select=id,admission_number,full_name&created_at=gte.${gteTime}&created_at=lte.${lteTime}`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    if (!studentsRes.ok) {
        console.error('❌ Failed to fetch students:', studentsRes.status, studentsRes.statusText);
        const errText = await studentsRes.text();
        console.error(errText);
        process.exit(1);
    }

    const students = await studentsRes.json();
    console.log(`Found ${students.length} students to remove.`);

    if (students.length === 0) {
        console.log('No students match the criteria. Nothing to delete.');
        return;
    }

    const studentIds = students.map(s => s.id);
    const idListString = `(${studentIds.map(id => `"${id}"`).join(',')})`;

    console.log('\nChecking and cleaning child table references...');
    for (const table of childTables) {
        const res = await fetch(`${supabaseUrl}/rest/v1/${table}?student_id=in.${idListString}&select=id`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (res.ok) {
            const records = await res.json();
            if (records.length > 0) {
                console.log(`Found ${records.length} records in table '${table}'. Deleting...`);
                const delRes = await fetch(`${supabaseUrl}/rest/v1/${table}?student_id=in.${idListString}`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    }
                });
                if (!delRes.ok) {
                    console.error(`❌ Failed to delete from '${table}':`, delRes.status, delRes.statusText);
                } else {
                    console.log(`✅ Deleted records from '${table}' successfully.`);
                }
            } else {
                console.log(`No records found in table '${table}'.`);
            }
        } else {
            console.log(`Could not check table '${table}'.`);
        }
    }

    console.log('\nDeleting student records...');
    const delStudentsRes = await fetch(`${supabaseUrl}/rest/v1/students?id=in.${idListString}`, {
        method: 'DELETE',
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    });

    if (!delStudentsRes.ok) {
        console.error('❌ Failed to delete students:', delStudentsRes.status, delStudentsRes.statusText);
        const text = await delStudentsRes.text();
        console.error(text);
    } else {
        const text = await delStudentsRes.text();
        console.log(`✅ Successfully deleted student records from the database.`);
    }
}

removeExtraStudents();
