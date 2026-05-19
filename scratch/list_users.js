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

async function listUsers() {
    console.log('Fetching users and profiles...');
    
    // Fetch profiles
    const profilesRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=*`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    // Fetch user_roles
    const rolesRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?select=*`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    if (!profilesRes.ok || !rolesRes.ok) {
        console.error('❌ Failed to fetch database data');
        process.exit(1);
    }

    const profiles = await profilesRes.json();
    const roles = await rolesRes.json();

    console.log('\n--- Profiles ---');
    console.log(JSON.stringify(profiles, null, 2));

    console.log('\n--- User Roles ---');
    console.log(JSON.stringify(roles, null, 2));
}

listUsers();
