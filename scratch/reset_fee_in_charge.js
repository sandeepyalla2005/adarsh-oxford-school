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

async function resetPassword() {
    console.log('Resetting password for feeincharge@adarshoxford.com...');
    const userId = "8a274d46-94ef-4ae7-99a9-e5748fd26e52";
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            password: "AdminPassword123!"
        })
    });

    if (!res.ok) {
        console.error('❌ Failed to update password:', res.status, await res.text());
    } else {
        console.log('✅ Successfully reset password to AdminPassword123!');
    }
}

resetPassword();
