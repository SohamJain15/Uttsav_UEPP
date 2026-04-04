# UTTSAV UEPP

Unified Event Permission Portal with a split FastAPI backend, User Portal, Department Portal, Supabase PostgreSQL, and Supabase Storage.

## Architecture
- `backend/run_user_api.py` -> User API on `http://localhost:8000`
- `backend/run_dept_api.py` -> Department API on `http://localhost:8001`
- `user-portal` -> User Frontend on `http://localhost:5173`
- `department_portal` -> Department Frontend on `http://localhost:5174`
- Supabase bucket: `application_documents`

## Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase project with the expected tables and `application_documents` storage bucket
- Google Maps JavaScript API key with Maps JavaScript API and Places API enabled

## Environment Setup
Create `backend/.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_or_backend_key
SUPABASE_ANON_KEY=your_supabase_anon_key_if_available
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Create `user-portal/.env`:
```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_BACKEND_ORIGIN=http://127.0.0.1:8000
```

Optional `department_portal/.env`:
```env
VITE_BACKEND_ORIGIN=http://127.0.0.1:8001
```

## Install Dependencies
Backend:
```bash
cd backend
python3 -m pip install -r requirements.txt
```

User Portal:
```bash
cd user-portal
npm install
```

Department Portal:
```bash
cd department_portal
npm install
```

## Run Live Servers
Terminal 1 - User API:
```bash
cd backend
python3 run_user_api.py
```

Terminal 2 - Department API:
```bash
cd backend
python3 run_dept_api.py
```

Terminal 3 - User Portal:
```bash
cd user-portal
npm run dev -- --host 0.0.0.0 --port 5173
```

Terminal 4 - Department Portal:
```bash
cd department_portal
npm run dev -- --host 0.0.0.0 --port 5174
```

## Feature Checklist
- User registration/login via Supabase Auth
- User profile fetch/update
- Event application submission
- AI risk calculation
- Approval probability estimation
- Route collision detection
- Department application review
- Department query raising
- Organizer query response
- Document upload to Supabase Storage
- NOC PDF generation and upload

## API Summary
User API:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/user/profile`
- `PUT /api/user/profile`
- `POST /api/user/submit-application`
- `GET /api/user/applications`
- `GET /api/user/applications/{app_id}`
- `GET /api/user/notifications`
- `POST /api/user/respond-query`
- `POST /api/user/risk/calculate`
- `GET /api/user/risk-score/{app_id}`
- `POST /api/user/route-collision/check`
- `GET /api/user/detect-collision?event_id=...`
- `POST /api/documents/upload`
- `GET /api/documents/{app_id}`

Department API:
- `POST /api/auth/login`
- `GET /api/user/profile`
- `GET /api/dept/applications`
- `GET /api/dept/applications/detail/{app_id}`
- `POST /api/dept/applications/{app_id}/mark-in-review`
- `POST /api/dept/applications/{app_id}/action`
- `POST /api/dept/raise-query`
- `GET /api/dept/queries`
- `POST /api/dept/applications/{app_id}/generate-noc`

## Validation
Backend tests:
```bash
cd backend
python3 -m pytest tests -q
```

Frontend production builds:
```bash
cd user-portal
npm run build

cd ../department_portal
npm run build
```

## Notes
- Keep `backend/.env` server-side only. Do not expose service-role keys in frontend env files.
- For browser-side Google Maps, only `VITE_GOOGLE_MAPS_API_KEY` is read by `user-portal/src/components/GoogleMapPicker.jsx`.
- After changing `.env` files, restart the affected dev servers so Vite/Python reloads the variables.
