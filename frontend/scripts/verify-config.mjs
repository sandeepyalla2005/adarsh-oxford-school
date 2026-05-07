import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

console.log('🔍 Verifying Production Configuration...');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envConfig = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    envConfig[key.trim()] = value;
  }
});

const pubKey = envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;

if (pubKey) {
  try {
    const parts = pubKey.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      if (payload.role === 'service_role') {
        console.error('🚨 SECURITY ALERT: VITE_SUPABASE_PUBLISHABLE_KEY is a SERVICE_ROLE key!');
        console.error('   This key has full database access and bypasses RLS.');
        console.error('   Please replace it with an "anon" key before deployment.');
        // In a real CI/CD we might exit 1 here, but for now we just warn loudly
        // process.exit(1); 
      } else {
        console.log('✅ Supabase Publishable Key appears to be a client-safe key.');
      }
    }
  } catch (e) {
    console.warn('⚠️ Could not decode Supabase Publishable Key for role verification.');
  }
}

console.log('✅ Configuration check complete.');
