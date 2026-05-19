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
const serviceKey = getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');

console.log('Supabase URL:', supabaseUrl);

async function checkTable() {
    try {
        console.log('Selecting from academic_calendars via REST API...');
        const selectRes = await fetch(`${supabaseUrl}/rest/v1/academic_calendars?select=*`, {
            headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!selectRes.ok) {
            const errText = await selectRes.text();
            console.error(`Select failed with status ${selectRes.status}:`, errText);
            return;
        }

        const selectData = await selectRes.json();
        console.log('Selected data:', selectData);

        console.log('Testing insert via REST API...');
        const testRow = {
            class_name: 'Test Class',
            file_name: 'test.pdf',
            file_url: 'https://example.com/test.pdf',
            file_size: '100 KB',
            file_type: 'application/pdf',
            academic_year: '2026-27'
        };

        const insertRes = await fetch(`${supabaseUrl}/rest/v1/academic_calendars`, {
            method: 'POST',
            headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(testRow)
        });

        if (!insertRes.ok) {
            const errText = await insertRes.text();
            console.error(`Insert failed with status ${insertRes.status}:`, errText);
        } else {
            const insertData = await insertRes.json();
            console.log('Successfully inserted test row:', insertData);

            console.log('Cleaning up test row...');
            const deleteRes = await fetch(`${supabaseUrl}/rest/v1/academic_calendars?class_name=eq.Test%20Class`, {
                method: 'DELETE',
                headers: {
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`
                }
            });

            if (!deleteRes.ok) {
                const errText = await deleteRes.text();
                console.error(`Delete failed with status ${deleteRes.status}:`, errText);
            } else {
                console.log('Successfully cleaned up test row!');
            }
        }
    } catch (e) {
        console.error('Unhandled error:', e);
    }
}

checkTable();
