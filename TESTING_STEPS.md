# Testing Guide - Step by Step ✅

## STEP 1: Start Backend Server

```bash
cd backend
uvicorn app.main:main --host 0.0.0.0 --port 8000 --reload
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

---

## STEP 2: Health Check (Verify Backend Running)

```bash
curl http://localhost:8000/
```

**Expected Response:**
```json
{
  "message": "Uttsav Backend is actively running in modular mode."
}
```

**If this fails:**
- Check if backend is running on port 8000
- Check firewall settings
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env

---

## STEP 3: Test Signup (Create User Account)

```bash
curl -X POST http://localhost:8000/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123!"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "User created successfully",
  "user": {
    "id": "user-uuid-here",
    "email": "testuser@example.com"
  }
}
```

**If this fails:**
- Check auth0 configuration in Supabase
- Verify SUPABASE_SERVICE_ROLE_KEY has admin permissions
- Check email is unique (not already registered)

---

## STEP 4: Test Login (Get Access Token)

```bash
curl -X POST http://localhost:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123!"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Login successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid-here",
    "email": "testuser@example.com"
  }
}
```

**SAVE THIS TOKEN** for next tests:
```bash
export TOKEN="your_access_token_here"
```

**If this fails:**
- Verify email/password are correct
- Check if user was created in Step 3
- Check Supabase auth settings

---

## STEP 5: Fetch Applications (Empty List Expected)

```bash
curl http://localhost:8000/api/user/applications \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "status": "success",
  "data": []
}
```

**If this fails:**
- Check token is valid (copy from Step 4)
- Verify user_id column exists: Query Supabase
  ```sql
  SELECT app_id, user_id FROM applications LIMIT 1;
  ```
- Check RLS policies are correct

---

## STEP 6: Submit Application

```bash
curl -X POST http://localhost:8000/api/user/submit-application \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
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
    "venue_ownership": "Government",
    "address": "Pragati Maidan, Delhi",
    "city": "Delhi",
    "pincode": "110001",
    "map_latitude": 28.6192,
    "map_longitude": 77.2307,
    "is_moving_procession": false,
    "has_fireworks": false,
    "has_loudspeakers": false,
    "food_stalls": false
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Application stored and routed successfully!",
  "application_id": "UEPP-ABC12345",
  "routed_to": ["Municipality"]
}
```

**If this fails:**
- Check all required fields are present
- Verify events table has proper structure
- Check applications table has user_id, event_id
- Verify department_routings table exists

---

## STEP 7: Fetch Applications Again (Should Have 1)

```bash
curl http://localhost:8000/api/user/applications \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "UEPP-ABC12345",
      "eventName": "Tech Conference 2026",
      "eventType": "Conference",
      "crowdSize": 500,
      "venueType": "Auditorium",
      "status": "Pending",
      "submittedAt": "2026-04-04T10:30:00",
      "address": "Pragati Maidan, Delhi",
      "departments": [
        {
          "name": "Municipality",
          "status": "Pending",
          "reason": null,
          "updatedAt": "2026-04-04T10:30:00"
        }
      ]
    }
  ]
}
```

**If empty array:**
- Check RLS policy for applications_select_own
- Verify user_id matches in applications table
- Run: `SELECT * FROM applications WHERE user_id = 'your-user-id';`

---

## STEP 8: Get Application Details

```bash
curl http://localhost:8000/api/user/applications/UEPP-ABC12345 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "application": {
      "app_id": "UEPP-ABC12345",
      "user_id": "user-uuid",
      "event_id": "event-uuid",
      "status": "Pending",
      "submitted_at": "2026-04-04T10:30:00"
    },
    "event": {
      "id": "event-uuid",
      "name": "Tech Conference 2026",
      "category": "Conference",
      "expected_crowd": 500,
      "start_time": "2026-05-15T09:00:00",
      "end_time": "2026-05-16T18:00:00",
      "raw_address": "Pragati Maidan, Delhi"
    },
    "department_routings": [
      {
        "id": "routing-uuid",
        "app_id": "UEPP-ABC12345",
        "department": "Municipality",
        "status": "Pending"
      }
    ],
    "departments": [...]
  }
}
```

**If event is null:**
- Check events table was populated
- Verify event_id in applications table
- Database query: `SELECT * FROM events LIMIT 1;`

---

## STEP 9: Test Risk Calculation

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

**Expected Response (With Models):**
```json
{
  "status": "success",
  "risk_score": 0.65,
  "risk_level": "Medium",
  "capacity_utilization": 80.0,
  "shap_feature_importances": [...],
  "recommendations": [...]
}
```

**Expected Response (Without Models):**
```json
{
  "status": "warning",
  "message": "Risk models not available...",
  "risk_score": null,
  "risk_level": "Unknown",
  "recommendations": ["Models not initialized..."]
}
```

**If error:**
- Check model files exist in `backend/ai_intelligence/models/risk_model/`
- Check for Python import errors in backend logs

---

## STEP 10: Test Assistant Query

```bash
curl -X POST http://localhost:8000/api/user/assistant/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What permits do I need for a concert with loudspeakers?",
    "current_step": 2
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "step": 2,
  "answer": "For a concert with loudspeaker systems...",
  "relevant_documents": [...]
}
```

**If error:**
- Check rulebook file exists
- Verify JSON is valid: `cat backend/ai_intelligence/knowledge/rulebook_documents.json`

---

## Summary ✅

| Test | Status | Action if Failed |
|------|--------|------------------|
| 1. Backend Health | ✓ | Restart backend |
| 2. Signup | ✓ | Check auth setup |
| 3. Login | ✓ | Verify credentials |
| 4. Fetch Apps (Empty) | ✓ | Check RLS policy |
| 5. Submit Application | ✓ | Verify database columns |
| 6. Fetch Apps (With Data) | ✓ | Debug RLS/user_id |
| 7. Get Details | ✓ | Check event_id relation |
| 8. Risk Calculation | ✓ | Check model files |
| 9. Assistant Query | ✓ | Check rulebook file |

---

## All Tests Passed? ✅

Then you're ready for:
1. Frontend testing with portals
2. Department portal integration
3. Production deployment

