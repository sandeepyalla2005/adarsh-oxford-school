import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEPLOY_DIR = path.resolve(ROOT, '..', 'deploy');

console.log('🚀 Starting Deployment Preparation...');

// 1. Clean up old deploy content
console.log('🧹 Cleaning up old deployment files...');
const dirs = ['admin', 'staff', 'fee', 'backend'];
dirs.forEach(dir => {
    const dirPath = path.join(DEPLOY_DIR, dir);
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
    fs.mkdirSync(dirPath, { recursive: true });
});

// 2. Build Frontend Portals
const portals = [
    { name: 'admin', script: 'npm run build:admin' },
    { name: 'staff', script: 'npm run build:staff' },
    { name: 'fee', script: 'npm run build:fee' }
];

portals.forEach(portal => {
    console.log(`\n📦 Building ${portal.name.toUpperCase()} Portal...`);
    try {
        execSync(portal.script, { stdio: 'inherit', cwd: ROOT });
        
        // Copy built files to deploy dir
        const distPath = path.join(ROOT, `dist-${portal.name}`);
        const targetPath = path.join(DEPLOY_DIR, portal.name);
        
        console.log(`🚚 Copying ${portal.name} assets to ${targetPath}...`);
        fs.cpSync(distPath, targetPath, { recursive: true });
        
        // Add a simple Dockerfile for the frontend
        fs.writeFileSync(path.join(targetPath, 'Dockerfile'), `
FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY ../nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`.trim());
    } catch (error) {
        console.error(`❌ Failed to build ${portal.name}:`, error.message);
    }
});

// 3. Prepare Backend
console.log('\n🐍 Preparing Backend Deployment...');
const backendSrc = path.resolve(ROOT, '..', 'backend');
const backendTarget = path.join(DEPLOY_DIR, 'backend');

const backendFilesToCopy = [
    'main.py',
    'requirements.txt',
    'Dockerfile',
    '.env'
];

backendFilesToCopy.forEach(file => {
    const src = path.join(backendSrc, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backendTarget, file));
    }
});

console.log('\n✅ Deployment preparation complete!');
console.log(`📍 All production-ready bundles are available in: ${DEPLOY_DIR}`);
console.log('\nRestructured into 4 deployment units:');
console.log('1. /deploy/backend      -> Deploy to Backend Server');
console.log('2. /deploy/admin        -> Deploy to Admin Frontend Server');
console.log('3. /deploy/staff        -> Deploy to Staff Frontend Server');
console.log('4. /deploy/fee          -> Deploy to Fee In-Charge Frontend Server');
