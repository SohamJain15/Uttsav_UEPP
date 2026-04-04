# UTTSAV UEPP - Backend Implementation & Fix Guide

## Overview
This document provides comprehensive instructions to make the backend fully functional with proper database schema, RLS policies, and AI integrations.

---

## PART 1: DATABASE SETUP

### Step 1: Run Database Migrations

Execute the SQL queries in the `DATABASE_MIGRATIONS.sql` file on your Supabase database:

1. **Open Supabase Dashboard**
   - Go to: https://app.supabase.com
   - Select your project
   - Navigate to SQL Editor

2. **Run the migration file:**
   - Copy the entire content of `DATABASE_MIGRATIONS.sql`
   - Paste into SQL Editor
   - Click "Run" to execute all migrations

### Step 2: Verify Database Changes

After running migrations, verify the following:

```sql
-- Check that applications table has user_id column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'applications' AND column_name = 'user_id';

-- Check RLS is enabled
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

### Step 3: Create Missing Tables (if needed)

If any tables are missing, create them:

```sql
-- Master departments table for routing
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  description text,
  contact_email character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);

-- Sample departments
INSERT INTO public.departments (name, contact_email, is_active) VALUES
  ('Police', 'police@uttsav.org', true),
  ('Fire', 'fire@uttsav.org', true),
  ('Traffic', 'traffic@uttsav.org', true),
  ('Municipality', 'municipal@uttsav.org', true),
  ('Health', 'health@uttsav.org', true),
  ('Environment', 'environment@uttsav.org', true)
ON CONFLICT (name) DO NOTHING;
```

---

## PART 2: BACKEND ENVIRONMENT SETUP

### Step 1: Update .env file

Create or update `backend/.env` with:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# AI Models Path (optional, uses default if not set)
UTTSAV_RISK_MODEL_DIR=backend/ai_intelligence/models/risk_model
UTTSAV_RULEBOOK_PATH=backend/ai_intelligence/knowledge/rulebook_documents.json

# Google Maps API (optional, collision detection will use fallback if missing)
GOOGLE_MAPS_API_KEY=your-google-maps-key
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key

# Frontend URLs (for CORS)
FRONTEND_USER_PORTAL_URL=http://localhost:5173
FRONTEND_DEPARTMENT_PORTAL_URL=http://localhost:5174
```

### Step 2: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Note:** The `requirements.txt` already includes:
- fastapi, uvicorn
- supabase
- pydantic, python-dotenv, python-multipart
- numpy, pandas, joblib, scikit-learn, shap
- (Models need no additional packages)

---

## PART 3: BACKEND CODE FIXES (Already Applied)

The following fixes have been implemented:

### ✅ 1. Database Connection Module (`app/core/database.py`)
- Added support for anon client with RLS
- Added `get_db_with_token()` for authenticated queries
- Proper error handling for missing credentials

### ✅ 2. Authentication Module (`app/core/auth.py`)
- Enhanced user serialization with proper UUID handling
- Added `ensure_user_profile_exists()` to create user records
- Improved error messages with context

### ✅ 3. User Routes (`app/api/user_routes.py`)
- Fixed `user_id` column handling in applications table
- Improved event fetching with fallback queries
- Enhanced `_application_with_event()` to fetch documents and AI logs
- Fixed signup to create user profiles automatically
- Fixed application detail endpoint to include all required data

### ✅ 4. AI Services
- **Risk Engine:** Handles gracefully when model files missing
- **Collision Engine:** Returns fallback routes if Google Maps key missing
- **RAG Assistant:** Already configured with rulebook file

---

## PART 4: TESTING BACKEND ENDPOINTS

### Start Backend Server

```bash
cd backend
uvicorn app.main:main --host 0.0.0.0 --port 8000 --reload
```

### Test Endpoints

#### 1. Health Check
```bash
curl http://localhost:8000/
# Response: {"message": "Uttsav Backend is actively running in modular mode."}
```

#### 2. Signup
```bash
curl -X POST http://localhost:8000/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer@example.com",
    "password": "SecurePassword123"
  }'
```

#### 3. Login
```bash
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer@example.com",
    "password": "SecurePassword123"
  }'
# Save the access_token from response
```

#### 4. Submit Application
```bash
curl -X POST http://localhost:8000/api/user/submit-application \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "event_name": "Tech Conference 2026",
    "event_type": "Conference",
    "crowd_size": 500,
    "start_date": "2026-05-15",
    "end_date": "2026-05-16",
    "start_time": "09:00",
    "end_time": "18:00",
    "venue_name": "Delhi Convention Center",
    "venue_type": "Auditorium",
    "address": "Pragati Maidan, Delhi",
    "city": "Delhi",
    "pincode": "110001",
    "map_latitude": 28.6192,
    "map_longitude": 77.2307,
    "is_moving_procession": false,
    "has_fireworks": false,
    "has_loudspeakers": false,
    "food_stalls": true
  }'
```

#### 5. Fetch Applications
```bash
curl http://localhost:8000/api/user/applications \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 6. Get Application Details
```bash
curl http://localhost:8000/api/user/applications/UEPP-ABC12345 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 7. Calculate Risk
```bash
curl -X POST http://localhost:8000/api/user/risk/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "Concert",
    "crowd_size": 2000,
    "venue_type": "Open Ground",
    "start_time": "18:00",
    "has_fireworks": true,
    "max_venue_capacity": 2500,
    "venue_area_sq_meters": 5000,
    "number_of_fire_exits": 4
  }'
```

#### 8. Assistant Query
```bash
curl -X POST http://localhost:8000/api/user/assistant/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What permits do I need for a concert with loudspeakers?",
    "current_step": 2
  }'
```

---

## PART 5: RLS POLICY VERIFICATION

### Verify RLS Policies are Enabled

```sql
-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- View all policies
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Test RLS with Service Role (Should see all)
```sql
-- Using service_role key (in backend)
SELECT COUNT(*) FROM public.applications;  -- Should return all records
```

### Test RLS with Anon Client (Should be restricted)
```sql
-- Using anon_key (after setting auth token)
SELECT COUNT(*) FROM public.applications;  -- Should only return user's records
```

---

## PART 6: COMMON DATA DICTIONARY

### Application Status Values
- `Draft` - Not yet submitted
- `Submitted` / `Pending` - Awaiting initial review
- `In Review` - Under review by one or more departments
- `Query Raised` - Departments raised questions
- `Approved` - All departments approved
- `Rejected` - One or more departments rejected

### Department Names
- `Police`
- `Fire`
- `Traffic`
- `Municipality`
- `Health`
- `Environment`

### Required Departments (Auto-Routing)

```
if crowd_size > 200 or is_moving_procession or has_loudspeaker:
  add Police
if has_fireworks:
  add Fire
if is_moving_procession or crowd_size > 1000:
  add Traffic
if food_stalls or venue_type == "Public Ground":
  add Municipality
if not any departments:
  add Municipality (default)
```

---

## PART 7: TROUBLESHOOTING

### Issue: "User not found" on /applications endpoint

**Solution:** Ensure user record exists in users table:
```sql
INSERT INTO public.users (id, email, name, phone, role, is_active)
VALUES (
  'user-uuid-here',
  'user@example.com',
  'User Name',
  '9876543210',
  'Organizer',
  true
);
```

### Issue: Event details not showing in applications

**Solution:** Check that event_id is properly set:
```sql
SELECT app_id, event_id FROM public.applications LIMIT 5;
SELECT id FROM public.events LIMIT 5;
```

### Issue: Risk calculation returns "Unknown" or error

**Solution:** Check model files exist:
```bash
ls -la backend/ai_intelligence/models/risk_model/
# Should show:
# - uttsav_preprocessor.pkl
# - uttsav_rf_model.pkl
# - uttsav_shap_explainer.pkl
# - uttsav_feature_names.pkl
```

### Issue: Assistant query returns error

**Solution:** Verify rulebook file:
```bash
cat backend/ai_intelligence/knowledge/rulebook_documents.json | head -20
# Should show valid JSON with metadata and documents array
```

### Issue: CORS errors from frontend

**Solution:** Update CORS origins in `backend/app/main.py`:
```python
allow_origins=[
    "http://localhost:5173",  # User portal
    "http://localhost:5174",  # Department portal
    "https://yourdomain.com",  # Production URL
]
```

---

## PART 8: FRONTEND ENVIRONMENT SETUP

### User Portal (.env.local)

```env
VITE_BACKEND_ORIGIN=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=your-key
```

### Department Portal (.env.local)

```env
VITE_BACKEND_ORIGIN=http://localhost:8000
```

---

## PART 9: PRODUCTION DEPLOYMENT CHECKLIST

- [ ] All DATABASE_MIGRATIONS.sql queries executed
- [ ] .env file configured with production Supabase credentials
- [ ] Google Maps API key configured (or collision engine fallback accepted)
- [ ] AI model files present in `ai_intelligence/models/risk_model/`
- [ ] Rulebook JSON file exists at `ai_intelligence/knowledge/`
- [ ] RLS policies verified with `pg_policies` query
- [ ] CORS origins updated for production URLs
- [ ] Backend health check working (`GET /`)
- [ ] Authentication flow tested (signup → login → fetch)
- [ ] Application submission tested end-to-end
- [ ] Risk engine tested and returning valid scores
- [ ] Assistant tested with sample questions
- [ ] All error responses return proper HTTP codes

---

## SUMMARY OF FIXES

| Issue | Fix | Status |
|-------|-----|--------|
| Missing user_id in applications | Added column and FK | ✅ |
| Event fetching failures | Multiple fallback queries | ✅ |
| AI models not loading | Graceful fallback responses | ✅ |
| Missing RLS policies | Created type... 

 policies for all tables | ✅ |
| Missing user profiles | Auto-create on signup | ✅ |
| Google Maps key missing | Fallback single route | ✅ |
| Collision engine not working | Optional API key handling | ✅ |
| Auth token not validated | Enhanced token validation | ✅ |

---

## NEXT STEPS

1. Execute DATABASE_MIGRATIONS.sql on your Supabase instance
2. Update backend .env with your credentials
3. Restart backend server
4. Run the endpoint tests above
5. Verify all responses are working
6. Check RLS policies are restricting data properly
7. Start frontend servers for end-to-end testing
8. Monitor logs for any remaining errors

---

## Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **Supabase RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security
- **PostGIS Docs:** https://postgis.net/documentation/

