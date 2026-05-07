# Adarsh Oxford School Management System

> Multi-portal school management application for **Adarsh Oxford** school.
> Separate builds for Admin, Staff, and Fee In-Charge portals — each deployed to its own subdomain.

---

## Project Structure

```
adarsh-oxford/
├── frontend/          ← React + Vite + TypeScript app (single codebase, 3 portal builds)
├── backend/           ← Python FastAPI REST API
├── supabase/          ← Supabase DB migrations
└── README.md          ← You are here
```

---

## Portals & Subdomains

| Portal | Subdomain | Build Command | Output Folder |
|---|---|---|---|
| Admin | `admin.yourdomain.com` | `npm run build:admin` | `dist-admin/` |
| Staff | `staff.yourdomain.com` | `npm run build:staff` | `dist-staff/` |
| Fee In-Charge | `fee.yourdomain.com` | `npm run build:fee` | `dist-fee/` |

> Replace `yourdomain.com` with your actual domain (e.g. `adarshoxford.in`)

---

## Pre-Deployment Setup

### 1. Update Environment Variables

Edit `frontend/.env`:

```env
# Change this from localhost to your deployed backend URL
VITE_API_BASE_URL="https://api.yourdomain.com"
```

### 2. Add Redirect URLs in Supabase

Go to: [Supabase Dashboard](https://supabase.com/dashboard) → Authentication → URL Configuration

Add all three portal URLs to **Redirect URLs**:
```
https://admin.yourdomain.com/**
https://staff.yourdomain.com/**
https://fee.yourdomain.com/**
```

Also set **Site URL** to your primary domain (admin portal):
```
https://admin.yourdomain.com
```

---

## Building for Production

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Build all three portals at once
npm run build:all

# Or build individually:
npm run build:admin    # → dist-admin/
npm run build:staff    # → dist-staff/
npm run build:fee      # → dist-fee/
```

Each `dist-*/` folder is a complete static site — upload it to your hosting provider.

---

## Running Locally (Development)

```bash
# Frontend dev server (all portals combined at localhost:8080)
cd frontend
npm run dev

# Backend API server
cd backend
pip install -r requirements.txt
python main.py
# Runs at http://localhost:8000
```

---

## Backend Deployment

The `backend/` folder is a **Python FastAPI** application.

### Required Environment Variables (backend/.env)

```env
VITE_SUPABASE_URL=https://dakdpmprzumtwyjshgap.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-service-role-key>
```

### Recommended Hosting: Render / Railway

**On Render:**
1. Create a new **Web Service**
2. Connect this repo, set root to `backend/`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Copy the Render URL (e.g. `https://adarsh-oxford-api.onrender.com`)
6. Set `VITE_API_BASE_URL` in `frontend/.env` to this URL

---

## Deploying Frontend Portals

### Option A: Netlify / Vercel (easiest)

For each portal:
1. Drag-and-drop the `dist-admin/`, `dist-staff/`, `dist-fee/` folder to Netlify
2. Set the custom domain for each (`admin.yourdomain.com` etc.)
3. Enable **SPA redirect**: for all 404s → redirect to `/index.html` with 200 status

> In Netlify: add a `_redirects` file inside each dist folder with: `/* /index.html 200`

### Option B: Shared cPanel Hosting

Upload each `dist-*/` to a subdomain folder:
```
public_html/
├── admin/    ← dist-admin contents
├── staff/    ← dist-staff contents
└── fee/      ← dist-fee contents
```

### Option C: VPS (Nginx)

```nginx
# /etc/nginx/sites-available/admin.yourdomain.com
server {
    listen 80;
    server_name admin.yourdomain.com;
    root /var/www/adarsh-oxford/admin;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;   # Required for React Router
    }
}
```

Repeat for `staff.yourdomain.com` and `fee.yourdomain.com`.

---

## After Deployment Checklist

- [ ] Backend deployed and accessible at `https://api.yourdomain.com`
- [ ] `VITE_API_BASE_URL` updated in `frontend/.env` to production API URL
- [ ] All three portals built with `npm run build:all`
- [ ] Each `dist-*/` uploaded to its subdomain
- [ ] Supabase redirect URLs configured for all three subdomains
- [ ] HTTPS enabled on all subdomains
- [ ] Test login on each portal with correct role credentials

---

## User Roles

| Role | Portal | Login URL |
|---|---|---|
| `admin` | Admin Portal | `https://admin.yourdomain.com/auth` |
| `staff` | Staff Portal | `https://staff.yourdomain.com/auth` |
| `feeInCharge` | Fee Portal | `https://fee.yourdomain.com/auth` |

Each portal only accepts logins from users with the matching role.
