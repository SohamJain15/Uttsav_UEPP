# UTTSAV UEPP

UTTSAV UEPP (Unified Event Permission Portal) is a multi-app system for event application intake, inter-department review, AI-assisted risk/compliance checks, and NOC issuance.

This repository contains:
- A split FastAPI backend (`User API` + `Department API`)
- A React User Portal (organizers)
- A React Department Portal (officials)
- Supabase integration (Auth, Postgres, Storage)
- AI modules (risk scoring, approval probability, route collision, RAG assistant)
- Department NOC + Final Combined NOC generation with QR-enabled verification links

---

## 0) Quick Start (15 Minutes)

1. Create `backend/.env` with Supabase + Google Maps + Ollama variables from section 7.
2. Create `user-portal/.env.local` and `department_portal/.env.local`.
3. Run Supabase SQL from section 5 (`tables` + `match_rules` function).
4. Start Ollama and pull models:
   - `ollama serve`
   - `ollama pull tinyllama`
   - `ollama pull nomic-embed-text`
5. Install dependencies:
   - `cd backend && python -m venv .venv && .venv\Scripts\Activate.ps1 && pip install -r requirements.txt`
   - `cd user-portal && npm install`
   - `cd department_portal && npm install`
6. Seed rulebook embeddings:
   - `cd backend && python seed_rules.py`
7. Start services (section 9) and open:
   - User portal: `http://127.0.0.1:5173`
   - Department portal: `http://127.0.0.1:5174`

---

## 1) Project Architecture

### Runtime services
- `backend/run_user_api.py` -> User API on `http://127.0.0.1:8000`
- `backend/run_dept_api.py` -> Department API on `http://127.0.0.1:8001`
- `user-portal` -> Organizer frontend on `http://127.0.0.1:5173`
- `department_portal` -> Department frontend on `http://127.0.0.1:5174`
- Supabase storage bucket -> `application_documents`
- Ollama (local) -> `http://localhost:11434` (for assistant embeddings/generation + risk recommendation text)

### Optional unified backend mode
- `backend/app/main.py` mounts auth + docs + user + dept routes in one FastAPI app.
- For local development, the split mode (`run_user_api.py` + `run_dept_api.py`) is the default and recommended workflow.

---

## 2) Key Workflows

### Organizer flow
1. Register/Login
2. Fill smart application form
3. Upload required documents
4. Track departmental status timeline
5. Respond to departmental queries
6. View/download department NOCs
7. Download/view final combined NOC (after all approvals)

### Department flow
1. Login with department username (`P-*`, `FB-*`, `T-*`, `M-*`, `A-*`)
2. Review assigned applications
3. Mark in-review / approve / reject / raise query
4. On approval -> department NOC generated
5. On all required approvals -> final NOC generated
6. On rejection -> flow is closed, remaining pending stages are rejected/cascaded as closed

### NOC principle
- Approval at one department does **not** mean final permit.
- Department approval -> department NOC.
- All required departments approved -> final combined NOC.

---

## 3) Repository Layout

```text
Uttsav_UEPP/
|- backend/
|  |- app/
|  |  |- api/
|  |  |  |- auth_routes.py
|  |  |  |- user_routes.py
|  |  |  |- dept_routes.py
|  |  |  |- document_routes.py
|  |  |- services/
|  |  |  |- risk_engine.py
|  |  |  |- approval_probability.py
|  |  |  |- collision_engine.py
|  |  |  |- rag_assistant.py
|  |  |- core/
|  |  |- models/
|  |- ai_intelligence/
|  |  |- models/risk_model/*.pkl
|  |  |- knowledge/rulebook_documents.json
|  |- seed_rules.py
|  |- run_user_api.py
|  |- run_dept_api.py
|
|- user-portal/
|  |- src/
|  |  |- pages/
|  |  |- services/
|  |  |- components/
|
|- department_portal/
|  |- src/
|  |  |- pages/
|  |  |- services/
|  |  |- components/
```

---

## 4) Prerequisites

- Python `3.11+`
- Node.js `18+` (LTS recommended)
- npm
- Supabase project
- Ollama installed locally
- Google Maps API key (Directions + Maps JS/Places as needed)

---

## 5) Supabase Setup (Required)

Create:
- Project
- Auth enabled (email/password)
- Storage bucket: `application_documents` (public or policy-enabled for your use case)

### 5.1 Recommended baseline tables

The backend has schema fallbacks, but this canonical schema is recommended for stability.

```sql
-- Optional extensions
create extension if not exists pgcrypto;
create extension if not exists vector;
-- Optional for advanced route prefiltering
-- create extension if not exists postgis;

create table if not exists users (
  id uuid primary key,
  email text unique not null,
  name text,
  phone text unique,
  role text not null default 'Organizer',
  prefix text unique,
  organization_type text,
  password text,
  password_hash text,
  is_active boolean default true,
  is_verified boolean default true,
  last_login timestamptz,
  created_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key,
  organizer_id uuid,
  name text not null,
  category text,
  expected_crowd integer default 0,
  start_time timestamptz,
  end_time timestamptz,
  raw_address text,
  city text,
  pincode text,
  latitude double precision,
  longitude double precision,
  is_moving_procession boolean default false,
  route_timeline jsonb,
  route_geometry text
);

create table if not exists applications (
  app_id text primary key,
  event_id uuid references events(id) on delete cascade,
  user_id uuid,
  status text default 'Pending',
  submitted_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists department_routings (
  id uuid primary key default gen_random_uuid(),
  app_id text references applications(app_id) on delete cascade,
  department text not null,
  status text default 'Pending',
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  app_id text references applications(app_id) on delete cascade,
  doc_type text default 'General',
  file_name text,
  storage_url text,
  uploaded_at timestamptz default now()
);

create table if not exists official_queries (
  id uuid primary key default gen_random_uuid(),
  routing_id uuid references department_routings(id) on delete cascade,
  official_id uuid,
  query_text text not null,
  organizer_response text,
  is_resolved boolean default false,
  created_at timestamptz default now()
);

create table if not exists ai_intelligence_logs (
  app_id text primary key references applications(app_id) on delete cascade,
  base_risk_score text,
  numerical_risk_score integer,
  capacity_utilization integer,
  exit_safety_rating text,
  shap_feature_importances jsonb,
  ollama_recommendation text
);

create table if not exists rules_knowledge_base (
  id bigserial primary key,
  rule_category text not null,
  content text not null,
  embedding vector(768)
);
```

### 5.2 `match_rules` RPC for RAG assistant

`rag_assistant.py` uses `db.rpc("match_rules", ...)`.

```sql
create or replace function match_rules(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  rule_category text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    r.id,
    r.rule_category,
    r.content,
    1 - (r.embedding <=> query_embedding) as similarity
  from rules_knowledge_base r
  where 1 - (r.embedding <=> query_embedding) > match_threshold
  order by r.embedding <=> query_embedding
  limit match_count;
$$;
```

### 5.3 Storage bucket

Create bucket:
- Name: `application_documents`
- Allow read for required clients/policies
- Allow write through backend service role operations

### 5.4 Department login bootstrap (required for department portal)

Department sign-in expects `users.prefix` + `users.role` records (for example `P-1001`, `FB-1001`).

```sql
insert into users (id, email, name, phone, role, prefix, password, is_active)
values
  (gen_random_uuid(), 'police.demo@uttsav.local', 'Police Demo Officer', '9000000001', 'Police', 'P-1001', 'Admin@123', true),
  (gen_random_uuid(), 'fire.demo@uttsav.local', 'Fire Demo Officer', '9000000002', 'Fire', 'FB-1001', 'Admin@123', true),
  (gen_random_uuid(), 'traffic.demo@uttsav.local', 'Traffic Demo Officer', '9000000003', 'Traffic', 'T-1001', 'Admin@123', true),
  (gen_random_uuid(), 'municipality.demo@uttsav.local', 'Municipality Demo Officer', '9000000004', 'Municipality', 'M-1001', 'Admin@123', true),
  (gen_random_uuid(), 'admin.demo@uttsav.local', 'Admin Demo', '9000000005', 'Admin', 'A-1001', 'Admin@123', true)
on conflict (prefix) do update
set email = excluded.email,
    name = excluded.name,
    role = excluded.role,
    phone = excluded.phone,
    password = excluded.password,
    is_active = excluded.is_active;
```

If your schema keeps only `password_hash`, use that column for the same values in dev mode.

---

## 6) Ollama Setup (Required for Full AI Features)

### 6.1 Install Ollama
- Install from official Ollama distribution for your OS.

### 6.2 Start Ollama
```bash
ollama serve
```

### 6.3 Pull models used by this repo
```bash
ollama pull tinyllama
ollama pull nomic-embed-text
```

### 6.4 Verify Ollama is reachable
```bash
curl http://localhost:11434/api/tags
```

Expected use in this project:
- `tinyllama` -> assistant answer generation + risk recommendation text
- `nomic-embed-text` -> rulebook embedding + query embedding

### 6.5 Rulebook seeding (important)

After Ollama + DB are ready, seed rules:

```bash
cd backend
python seed_rules.py
```

This reads:
- `backend/ai_intelligence/knowledge/rulebook_documents.json`

And populates:
- `rules_knowledge_base`

---

## 7) Environment Variables

### 7.1 `backend/.env`

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_ANON_KEY=<anon_key>

GOOGLE_MAPS_API_KEY=<google_maps_key>
GOOGLE_DIRECTIONS_API_KEY=<optional_override_key>

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_URL=http://localhost:11434/api/embeddings
OLLAMA_EMBED_MODEL=nomic-embed-text

# Optional: override risk model asset directory
UTTSAV_RISK_MODEL_DIR=

# Optional: if you are serving API behind a public host/gateway
BACKEND_PUBLIC_BASE_URL=
```

Notes:
- For split local mode (`8000` + `8001`), you can leave `BACKEND_PUBLIC_BASE_URL` unset.
- Service role key must stay server-side only.

### 7.2 `user-portal/.env.local`

```env
VITE_BACKEND_ORIGIN=http://127.0.0.1:8000
VITE_GOOGLE_MAPS_API_KEY=<google_maps_key>
# Optional assistant timeout in milliseconds (default 45000)
VITE_ASSISTANT_TIMEOUT_MS=45000
```

### 7.3 `department_portal/.env.local`

```env
VITE_BACKEND_ORIGIN=http://127.0.0.1:8001
VITE_GOOGLE_MAPS_API_KEY=<google_maps_key>
```

---

## 8) Installation

## 8.1 Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# Linux/macOS
# source .venv/bin/activate

python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 8.2 User Portal

```bash
cd user-portal
npm install
```

## 8.3 Department Portal

```bash
cd department_portal
npm install
```

---

## 9) Run the Full System (4 terminals + Ollama)

### Terminal A - Ollama
```bash
ollama serve
```

### Terminal B - User API
```bash
cd backend
# activate venv if not already active
python run_user_api.py
```

### Terminal C - Department API
```bash
cd backend
# activate venv if not already active
python run_dept_api.py
```

### Terminal D - User Portal
```bash
cd user-portal
npm run dev -- --host 0.0.0.0 --port 5173
```

### Terminal E - Department Portal
```bash
cd department_portal
npm run dev -- --host 0.0.0.0 --port 5174
```

Open:
- Organizer UI: `http://127.0.0.1:5173`
- Department UI: `http://127.0.0.1:5174`
- User API docs: `http://127.0.0.1:8000/docs`
- Department API docs: `http://127.0.0.1:8001/docs`

---

## 10) Authentication Context

### Organizer login
- Login with email + password.
- API path used by frontend:
  - Primary: `/api/auth/login`
  - Fallback: `/api/user/login`

### Department login
- Use department username prefixes:
  - Police: `P-...`
  - Fire: `F-...` or `FB-...`
  - Traffic: `T-...`
  - Municipality: `M-...`
  - Admin: `A-...`
- These map to `users.prefix` + `users.role`.

### Department password behavior (current implementation)
- If `users.password` / `users.password_hash` exists, exact string match is used.
- If absent for seeded rows, fallback demo password is `Admin@123`.
- For production, replace this with proper password hashing or centralized auth mapping.

---

## 11) Major Features by Module

### Backend
- Auth + profile sync with Supabase
- Application submission + department routing
- Risk analysis (`risk_engine.py`)
- Approval probability forecast (`approval_probability.py`)
- 4D route collision analysis (`collision_engine.py`)
- RAG compliance assistant with pgvector + Ollama (`rag_assistant.py`)
- Document upload/list
- Department actions (approve/reject/query)
- Department NOC generation
- Final NOC generation with combined conditions
- NOC PDF fetch endpoints (including department-specific query)

### User Portal
- Registration/login
- Smart multi-step application form
- AI risk + approval preview
- Route collision checks for moving processions
- Application tracking timeline
- Query response submission
- Department/final NOC display + download + QR render

### Department Portal
- Scoped queue and filters
- In-review workflow
- SLA display (dynamic countdown)
- Decision action panel
- Query raise
- Department clearance view
- Final permit view + QR

---

## 12) API Surface (Current)

## 12.1 Auth/Profile
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/user/profile`
- `PUT /api/user/profile`

## 12.2 User API (`/api/user/...`)
- `POST /api/user/submit-application`
- `GET /api/user/applications`
- `GET /api/user/applications/{app_id}`
- `GET /api/user/noc/{app_id}/pdf`
- `GET /api/user/notifications`
- `POST /api/user/respond-query`
- `POST /api/user/risk/calculate`
- `POST /api/user/applications/analyze-risk`
- `POST /api/user/approval/probability`
- `POST /api/user/applications/predict-approval`
- `POST /api/user/route-collision/check`
- `POST /api/user/applications/check-route-collision`
- `GET /api/user/risk-score/{app_id}`
- `GET /api/user/detect-collision?event_id=...`
- `POST /api/user/assistant/query`

Legacy aliases (still present):
- `POST /signup`
- `POST /login`

## 12.3 Department API
- `GET /api/dept/applications`
- `GET /api/dept/dashboard-stats`
- `GET /api/dept/applications/detail/{app_id}`
- `POST /api/dept/applications/{app_id}/mark-in-review`
- `POST /api/dept/applications/{app_id}/action`
- `POST /api/dept/raise-query`
- `GET /api/dept/queries`
- `POST /api/dept/applications/{app_id}/generate-noc`
- `GET /api/dept/noc/{app_id}/pdf`
- `POST /generate-noc/{app_id}` (alias)

## 12.4 Documents
- `POST /api/documents/upload`
- `GET /api/documents/{app_id}`

---

## 13) NOC Workflow Details

### Department approval transition
1. Department action -> status set to Approved
2. Department NOC PDF generated/uploaded
3. Department NOC document stored (`doc_type = NOC_<Department>`)
4. UI updates with issued timestamp, conditions, remarks, view/download link

### Final permit transition
1. Check all required departments Approved
2. Merge department conditions
3. Generate Final Combined NOC PDF
4. Store as `doc_type = NOC_FINAL`
5. Expose final permit + QR link to `/api/.../noc/{app_id}/pdf`

### Rejection behavior
- Rejection reason is mandatory.
- Rejection closes the flow; pending downstream department stages are cascaded/closed.

---

## 14) Validation / QA Commands

### Backend tests
```bash
cd backend
$env:PYTHONPATH='.'; pytest -q
```

Linux/macOS:
```bash
cd backend
PYTHONPATH=. pytest -q
```

### Frontend builds
```bash
cd user-portal
npm run build

cd ../department_portal
npm run build
```

### Quick health checks
```bash
curl http://127.0.0.1:8000/
curl http://127.0.0.1:8001/
curl http://127.0.0.1:11434/api/tags
```

---

## 15) Troubleshooting

### `Invalid login credentials` on user portal
- Verify account exists in Supabase Auth.
- Verify password is correct in Supabase Auth.
- Confirm `SUPABASE_ANON_KEY` is correct.
- Confirm `VITE_BACKEND_ORIGIN` in `user-portal/.env.local` points to `http://127.0.0.1:8000`.
- Restart backend + Vite after env changes.

### Department portal login fails (`Invalid credentials`)
- Ensure the `users` table has matching `prefix` + `role` rows (see section 5.4).
- If `users.password`/`users.password_hash` is empty, use fallback password `Admin@123`.
- Confirm `VITE_BACKEND_ORIGIN` in `department_portal/.env.local` points to `http://127.0.0.1:8001`.
- Confirm department API is running on `8001`.

### Registration fails with duplicate phone constraint
- `users.phone` is typically unique in many setups.
- Use a unique phone number while registering or relax the DB unique constraint if intended.

### Google route/collision returns fallback or unknown
- Check `GOOGLE_MAPS_API_KEY` / Directions API enablement.
- If unavailable, system falls back to simulated route output and marks status provisional.

### Assistant returns low-context responses
- Ensure `rules_knowledge_base` is seeded.
- Ensure `match_rules` RPC exists.
- Ensure Ollama is running with both required models.

### Risk engine load error
- Verify `.pkl` assets exist in:
  - `backend/ai_intelligence/models/risk_model/`
- Or set `UTTSAV_RISK_MODEL_DIR` explicitly.

### NOC not generated
- Final NOC only generates when all required departments are approved.
- Check `department_routings` statuses for the app.
- Check `documents` table for `NOC_FINAL` and `NOC_<Department>`.

---

## 16) Security & Deployment Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend.
- Keep `backend/.env` out of client bundles and source control.
- Replace demo department password fallback behavior in production.
- Restrict CORS origins for deployed hostnames.
- Add strict storage policies and signed URLs if needed.

---

## 17) License / Ownership

This repository is licensed under the MIT License.

See [LICENSE](LICENSE) for the full text.
