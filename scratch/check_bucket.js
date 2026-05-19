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

async function checkBucket() {
    try {
        console.log('Fetching storage buckets...');
        const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
            headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`
            }
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error(`Failed with status ${res.status}:`, errText);
            return;
        }

        const buckets = await res.json();
        console.log('Storage Buckets:');
        buckets.forEach(b => {
            console.log(`- ID: ${b.id}, Public: ${b.public}`);
        });

        const hasCalendarBucket = buckets.some(b => b.id === 'academic-calendars');
        if (!hasCalendarBucket) {
            console.log('academic-calendars bucket is missing! Attempting to create it...');
            const createRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
                method: 'POST',
                headers: {
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: 'academic-calendars',
                    name: 'academic-calendars',
                    public: true,
                    file_size_limit: 15728640,
                    allowed_mime_types: ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'image/png', 'image/jpeg']
                })
            });

            if (!createRes.ok) {
                const errText = await createRes.text();
                console.error(`Failed to create bucket with status ${createRes.status}:`, errText);
            } else {
                console.log('Successfully created academic-calendars bucket!');
            }
        } else {
            console.log('academic-calendars bucket already exists!');
        }
    } catch (e) {
        console.error('Unhandled error:', e);
    }
}

checkBucket();
