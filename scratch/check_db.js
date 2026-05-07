
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../adarsh-oxford/frontend/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
    'students',
    'classes',
    'attendance_records',
    'homework',
    'staff_schedule',
    'notices',
    'student_accessory_payments',
    'accessory_sales'
];

async function checkTables() {
    console.log('Checking tables...');
    for (const table of tables) {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true }).limit(1);
        if (error) {
            console.log(`❌ ${table}: ${error.message} (${error.code})`);
        } else {
            console.log(`✅ ${table}: Exists`);
        }
    }
}

checkTables();
