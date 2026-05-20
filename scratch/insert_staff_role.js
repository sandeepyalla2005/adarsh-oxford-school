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

const userId = '01971307-062f-43c1-a79c-8c8769a76cc9'; // kushal@gmail.com

async function insertRole() {
    console.log(`Checking if role exists for user ${userId}...`);
    
    // Check if role already exists
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${userId}&role=eq.staff`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    
    if (checkRes.ok) {
        const roles = await checkRes.json();
        if (roles.length > 0) {
            console.log('Role already exists in database.');
            return;
        }
    }
    
    console.log('Role not found. Inserting staff role...');
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
        method: 'POST',
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            user_id: userId,
            role: 'staff'
        })
    });
    
    if (!insertRes.ok) {
        console.error('❌ Failed to insert role:', insertRes.status, insertRes.statusText);
        const text = await insertRes.text();
        console.error(text);
    } else {
        console.log('✅ Staff role inserted successfully for kushal@gmail.com!');
    }
}

insertRole();
