import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envContent = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');

const getEnvVar = (name) => {
    const match = envContent.match(new RegExp(`${name}\\s*=\\s*["']?([^"'\r\n]+)["']?`));
    return match ? match[1] : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const serviceKey = getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY'); // Note: previously found this holds the service role key

console.log('Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, serviceKey);

async function checkTable() {
    console.log('Selecting from academic_calendars...');
    const { data, error } = await supabase.from('academic_calendars').select('*');
    if (error) {
        console.error('Error selecting:', error);
    } else {
        console.log('Selected data:', data);
    }

    console.log('Testing a dry run insert with service role key...');
    const testRow = {
        class_name: 'Test Class',
        file_name: 'test.pdf',
        file_url: 'https://example.com/test.pdf',
        file_size: '100 KB',
        file_type: 'application/pdf',
        academic_year: '2026-27'
    };

    const { data: insertData, error: insertError } = await supabase
        .from('academic_calendars')
        .insert(testRow)
        .select();

    if (insertError) {
        console.error('Insert error:', insertError);
    } else {
        console.log('Successfully inserted test row:', insertData);

        // Clean up
        const { error: deleteError } = await supabase
            .from('academic_calendars')
            .delete()
            .eq('class_name', 'Test Class');
        if (deleteError) {
            console.error('Delete cleanup error:', deleteError);
        } else {
            console.log('Successfully cleaned up test row!');
        }
    }
}

checkTable();
