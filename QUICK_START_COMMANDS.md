# 🚀 Quick Start Commands

## Prerequisites Checklist
```bash
# 1. Ensure you're in the correct directory
cd e:\Uttsav_UEPP

# 2. Verify Node.js installed
node --version    # Should show v16+
npm --version     # Should show v8+

# 3. Verify Python installed
python --version  # Should show v3.9+
```

---

## Backend Startup

### Terminal 1: Backend Server
```bash
cd backend

# Install dependencies (first time only)
pip install -r requirements.txt

# Start server
uvicorn app.main:main --reload

# Expected output:
# INFO:     Uvicorn running on http://127.0.0.1:8000
# INFO:     Application startup complete
```

**Verify backend running:**
```bash
# In another terminal
curl http://127.0.0.1:8000/
# Should return: {"status": "ok", ...}
```

---

## Frontend Startup

### Terminal 2: User Portal
```bash
cd user-portal

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev

# Expected output:
# ➜  Local:   http://localhost:5173/
```

### Terminal 3: Department Portal (optional, separate test)
```bash
cd department_portal

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev

# Expected output:
# ➜  Local:   http://localhost:5174/
```

---

## Browser URLs

| Portal | URL | Purpose |
|--------|-----|---------|
| **User Portal** | http://localhost:5173 | Organizer/Applicant |
| **Department Portal** | http://localhost:5174 | Department Official |
| **Backend API** | http://127.0.0.1:8000 | API endpoints |

---

## Environment Configuration (if not already done)

### User Portal (.env.local)
```
VITE_BACKEND_ORIGIN=http://127.0.0.1:8000
```

### Department Portal (.env.local)
```
VITE_BACKEND_ORIGIN=http://127.0.0.1:8000
```

### Backend (.env)
```
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
```

---

## Database Setup (CRITICAL - Must Do Once)

### In Supabase SQL Editor:
1. Go to Supabase Dashboard → Your Project → SQL Editor
2. Create new query
3. Copy contents of `DATABASE_MIGRATIONS.sql`
4. Run all statements
5. Verify with: `SELECT COUNT(*) FROM pg_policies;` (should be > 20)

**Or from terminal:**
```bash
# Export connection string from Supabase
export PGPASSWORD="your-password"

psql -h your-host.supabase.co -U postgres -d postgres -f DATABASE_MIGRATIONS.sql

# Verify
psql -h your-host.supabase.co -U postgres -d postgres -c "SELECT COUNT(*) FROM pg_policies;"
```

---

## Testing from Browser

### Step 1: User Portal Registration
```
1. Open http://localhost:5173
2. Click "Register here"
3. Fill form:
   - Full Name: John Smith
   - Organization: Tech Corp
   - Email: john@example.com
   - Phone: 9876543210
4. Click Register
5. Verify: Success message + redirected to login
```

### Step 2: User Portal Login
```
1. Enter same email and password
2. Click Sign In
3. Verify: Redirected to dashboard
4. Check: Token in localStorage (DevTools → Application)
```

### Step 3: Create Application
```
1. Click "Create Application"
2. Fill all form steps
3. Click Submit
4. Verify: Gets application ID + appears in list
```

### Step 4: Department Portal Login
```
1. Open http://localhost:5174
2. Enter department credentials (P-001, etc.)
3. Click Login
4. Verify: Dashboard shows applications
```

### Step 5: View Application as Department
```
1. Click on application from Step 3
2. Verify: All details display
3. Click approve/reject
4. Verify: Status updates
```

---

## Troubleshooting Quick Fixes

### Problem: "Cannot GET /" on backend
```bash
# Solution: Start backend with full path
cd e:\Uttsav_UEPP\backend
uvicorn app.main:main --reload
```

### Problem: 404 on login
```bash
# Solution: Check endpoint was fixed
grep "/api/user/login" user-portal/src/services/authService.js
# Should show: post("/api/user/login"

# If not showing, re-read FRONTEND_TESTING_GUIDE.md
```

### Problem: "Cannot find module" in frontend
```bash
# Solution: Install dependencies
cd user-portal  # or department_portal
npm install
npm run dev
```

### Problem: "Port 8000 already in use"
```bash
# Solution: Kill existing process
# On Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# On Mac/Linux:
lsof -i :8000
kill -9 <PID>
```

### Problem: Token not persisting
```javascript
// Check in browser console:
localStorage.getItem('uttsav_auth')
// Should show: {access_token: "eyJ...", ...}

// Clear and retry:
localStorage.clear()
// Then login again
```

### Problem: No applications appearing
```bash
# Check database migrations ran:
# In Supabase SQL Editor run:
SELECT COUNT(*) FROM applications;
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'applications';

# Both should return > 0
```

---

## API Endpoints Verification

### Check endpoints exist:
```bash
# Terminal
cd backend
grep -r "@router.post" app/api/user_routes.py

# Should show:
# @router.post("/signup")
# @router.post("/login")
# @router.post("/submit-application")
# @router.post("/applications/{id}")
# etc.
```

---

## File Verification Checklist

```bash
# ✅ Backend fixes applied
grep "get_db_with_token" backend/app/core/database.py     # Should exist
grep "ensure_user_profile_exists" backend/app/core/auth.py  # Should exist

# ✅ Frontend fixes applied
grep "/api/user/login" user-portal/src/services/authService.js        # Should exist
grep "/api/user/signup" user-portal/src/services/authService.js       # Should exist
grep "/api/user/login" department_portal/src/services/authService.js  # Should exist

# ✅ Configs correct
cat user-portal/.env.local                    # Should have VITE_BACKEND_ORIGIN
cat department_portal/.env.local              # Should have VITE_BACKEND_ORIGIN
cat backend/.env                              # Should have SUPABASE_* keys
```

---

## One-Time Setup Script

### Copy & Run (Windows):
```batch
@echo off
echo Starting UTTSAV Integration Testing...

echo.
echo [Step 1] Installing backend dependencies...
cd backend
pip install -r requirements.txt
cd ..

echo.
echo [Step 2] Installing user portal dependencies...
cd user-portal
npm install
cd ..

echo.
echo [Step 3] Installing department portal dependencies...
cd department_portal
npm install
cd ..

echo.
echo [Step 4] Configuration Check...
echo Checking environment files...
if not exist backend\.env echo ⚠️ backend\.env missing - create it with SUPABASE keys
if not exist user-portal\.env.local echo ✓ user-portal\.env.local exists
if not exist department_portal\.env.local echo ✓ department_portal\.env.local exists

echo.
echo Setup complete! Now run in separate terminals:
echo Terminal 1: cd backend ^& uvicorn app.main:main --reload
echo Terminal 2: cd user-portal ^& npm run dev
echo Terminal 3: cd department_portal ^& npm run dev
echo.
pause
```

### Copy & Run (Mac/Linux):
```bash
#!/bin/bash
echo "Starting UTTSAV Integration Testing..."

echo ""
echo "[Step 1] Installing backend dependencies..."
cd backend
pip install -r requirements.txt
cd ..

echo ""
echo "[Step 2] Installing user portal dependencies..."
cd user-portal
npm install
cd ..

echo ""
echo "[Step 3] Installing department portal dependencies..."
cd department_portal
npm install
cd ..

echo ""
echo "[Step 4] Configuration Check..."
if [ ! -f backend/.env ]; then echo "⚠️ backend/.env missing"; fi
if [ -f user-portal/.env.local ]; then echo "✓ user-portal/.env.local exists"; fi
if [ -f department_portal/.env.local ]; then echo "✓ department_portal/.env.local exists"; fi

echo ""
echo "Setup complete! Now run in separate terminals:"
echo "Terminal 1: cd backend && uvicorn app.main:main --reload"
echo "Terminal 2: cd user-portal && npm run dev"
echo "Terminal 3: cd department_portal && npm run dev"
```

---

## Expected Results

### Backend Starting Successfully:
```
INFO:     Will watch for changes in these directories: ['/app']
INFO:     Uvicorn running on http://127.0.0.1:8000 [Press ENTER to quit]
```

### User Portal Starting Successfully:
```
➜  Local:   http://localhost:5173/
➜  press h to show help
```

### Department Portal Starting Successfully:
```
➜  Local:   http://localhost:5174/
➜  press h to show help
```

### Successful Registration (DevTools → Network):
```
POST /api/user/signup
Status: 200
Response: {"status": "success", "user": {...}}
```

### Successful Login (DevTools → Network):
```
POST /api/user/login
Status: 200
Response: {"access_token": "eyJ...", "user": {...}}
```

---

## Verification Commands

```bash
# All services running?
ps aux | grep -E "(uvicorn|node)"

# All ports listening?
# Windows:
netstat -ano | findstr ":8000\|:5173\|:5174"

# Mac/Linux:
lsof -i :8000,5173,5174

# Database connected?
# Run in backend:
python -c "from app.core.database import db; print('✓ DB Connected')"

# All endpoints exist?
curl http://127.0.0.1:8000/api/user/login
# Status: 405 Method Not Allowed (means endpoint exists, just needs POST)
```

---

## Next Steps

1. ✅ Execute all startup commands above
2. ✅ Open browser to both portals
3. ✅ Follow FRONTEND_TESTING_GUIDE.md for step-by-step tests
4. ✅ Check COMPLETE_INTEGRATION_STATUS.md for status
5. ✅ Use this file for quick reference during testing

**Total Setup Time:** 10 minutes  
**Total Testing Time:** 30-45 minutes  
**Total Test Scenarios:** 13 (see FRONTEND_TESTING_GUIDE.md)

