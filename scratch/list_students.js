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

async function listStudentsCreatedToday() {
    console.log('Fetching students created today...');
    
    // Query for students created on or after 2026-05-19T00:00:00Z
    const todayStr = '2026-05-19T00:00:00Z';
    const url = `${supabaseUrl}/rest/v1/students?select=id,admission_number,full_name,class_id,created_at,classes(name)&created_at=gte.${todayStr}&order=created_at.desc`;
    
    const studentsRes = await fetch(url, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    if (!studentsRes.ok) {
        console.error('❌ Failed to fetch students:', studentsRes.status, studentsRes.statusText);
        process.exit(1);
    }

    const students = await studentsRes.json();

    console.log(`\n--- Found ${students.length} Students Created Today (May 19, 2026) ---`);
    students.forEach((student, index) => {
        const className = student.classes ? student.classes.name : 'Unknown';
        console.log(`${index + 1}. ID: ${student.id} | Adm: ${student.admission_number} | Name: ${student.full_name} | Class: ${className} | Created: ${student.created_at}`);
    });
}

listStudentsCreatedToday();
