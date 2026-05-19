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

async function listTables() {
    try {
        console.log('Fetching OpenAPI schema from PostgREST...');
        const res = await fetch(`${supabaseUrl}/rest/v1/`, {
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

        const schema = await res.json();
        const definitions = schema.definitions || {};
        console.log('Tables exposed by PostgREST:');
        Object.keys(definitions).forEach(table => {
            console.log(`- ${table}`);
        });
    } catch (e) {
        console.error('Unhandled error:', e);
    }
}

listTables();
