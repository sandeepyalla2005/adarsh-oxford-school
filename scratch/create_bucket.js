import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../frontend/.env');

if (!fs.existsSync(envPath)) {
    console.error('Frontend .env file not found at:', envPath);
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

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env');
    process.exit(1);
}

async function manageBucket() {
    console.log('Connecting to:', supabaseUrl);
    const bucketName = 'academic-calendars';

    // List existing buckets
    console.log('Checking existing buckets...');
    const listRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    if (!listRes.ok) {
        console.error('❌ Failed to list buckets:', listRes.status, await listRes.text());
        process.exit(1);
    }

    const buckets = await listRes.json();
    console.log('Existing buckets:', buckets.map(b => b.name));

    const exists = buckets.some(b => b.name === bucketName);

    if (exists) {
        console.log(`✅ Bucket "${bucketName}" already exists!`);
    } else {
        console.log(`Creating public bucket "${bucketName}"...`);
        const createRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: bucketName,
                name: bucketName,
                public: true,
                file_size_limit: 15728640, // 15MB
                allowed_mime_types: [
                    'image/png',
                    'image/jpeg',
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'
                ]
            })
        });

        if (!createRes.ok) {
            console.error('❌ Failed to create bucket:', createRes.status, await createRes.text());
        } else {
            console.log(`✅ Bucket "${bucketName}" created successfully!`, await createRes.json());
        }
    }
}

manageBucket();
