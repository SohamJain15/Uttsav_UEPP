# Pre-Test Checklist ✅

Before running tests, verify ALL of these are complete:

## ✅ Database Setup
- [ ] DATABASE_MIGRATIONS.sql executed successfully on Supabase
- [ ] No errors during execution
- [ ] RLS policies created (verify in Supabase: SQL Editor → SELECT COUNT(*) FROM pg_policies WHERE schemaname='public';)
- [ ] Expected result: Should show policies for users, events, applications, documents, etc.

## ✅ Backend Configuration
- [ ] `backend/.env` file created with:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - SUPABASE_ANON_KEY (optional but recommended)
  
- [ ] `backend/requirements.txt` dependencies installed:
  ```bash
  cd backend
  pip install -r requirements.txt
  ```

## ✅ Code Updates
- [ ] Code fixes applied to:
  - app/core/database.py ✓
  - app/core/auth.py ✓
  - app/api/user_routes.py ✓
  - app/services/collision_engine.py ✓

## ✅ AI Models & Files
- [ ] Verify model files exist:
  ```bash
  ls backend/ai_intelligence/models/risk_model/
  # Should show: uttsav_preprocessor.pkl, uttsav_rf_model.pkl, etc.
  ```
- [ ] Verify rulebook exists:
  ```bash
  cat backend/ai_intelligence/knowledge/rulebook_documents.json | head -10
  # Should show JSON with metadata
  ```

## ✅ Frontend Configuration (Optional for now)
- [ ] `user-portal/.env.local` with VITE_BACKEND_ORIGIN
- [ ] `department-portal/.env.local` with VITE_BACKEND_ORIGIN

---

## Quick Verification Commands

```bash
# Check database migrations applied
# (Run in Supabase SQL Editor)
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
# Expected: Should return a number > 0

# Check if applications table has user_id column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'applications' AND column_name = 'user_id';
# Expected: Should return "user_id"
```

---

## Ready to Test? Start with Step 1 below ⬇️
