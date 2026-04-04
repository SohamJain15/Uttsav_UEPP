# Frontend Integration Testing Guide

## ✅ Fixes Applied

1. **User Portal** - Fixed auth endpoints: `/api/auth/*` → `/api/user/*` ✅
2. **Department Portal** - Fixed auth endpoint: `/api/auth/login` → `/api/user/login` ✅

---

## Pre-Testing Checklist

Before starting tests, ensure:

- [ ] Backend server running: `uvicorn app.main:main --reload` [Port 8000]
- [ ] Database migrations executed successfully
- [ ] Both portals have `.env.local` configured with `VITE_BACKEND_ORIGIN=http://127.0.0.1:8000`
- [ ] Both portals can access backend (test: http://localhost:8000/ in browser)
- [ ] Browser DevTools Network tab open to monitor API calls

---

## STEP 1: Start User Portal

### Terminal Command:
```bash
cd user-portal
npm run dev
```

### Expected Output:
```
  ➜  Local:   http://localhost:5173/
```

---

## STEP 2: User Registration Test

### Actions:
1. Navigate to `http://localhost:5173/`
2. Click **"Register here"** link
3. Fill in registration form:
   - **Full Name:** John Smith
   - **Organization:** Tech Corp
   - **Email:** john@example.com
   - **Phone:** 9876543210
4. Click **Register** button

### Expected Result:
```
✅ Success message displayed
✅ Redirected to Login page
✅ In Network tab: POST /api/user/signup → 200 OK
```

### If Error:
```
❌ 404 Not Found → Check if endpoint fixed
❌ 400 Bad Request → Check required fields
❌ Connection refused → Backend not running
```

**Network Debug:**
```
Request URL: http://127.0.0.1:8000/api/user/signup
Request Body: {"email": "john@example.com", "password": "..."}
Response Status: 200
```

---

## STEP 3: User Login Test

### Actions:
1. On Login page, enter credentials:
   - **Email:** john@example.com
   - **Password:** (same as registration)
2. Click **Sign In** button

### Expected Result:
```
✅ Login successful
✅ Redirected to Dashboard
✅ Token stored in localStorage
✅ In Network tab: POST /api/user/login → 200 OK
```

### Verify Token Storage:
```
Browser DevTools → Application → LocalStorage → uttsav_auth
Should contain: {access_token: "eyJ...", user: {id, email}, ...}
```

### If Error:
```
❌ 404 Not Found → Check if endpoint fixed to /api/user/login
❌ 401 Unauthorized → Check email/password correct
❌ Connection refused → Backend not running
```

---

## STEP 4: User Dashboard Test

### Expected Page Elements:
- ✅ "My Applications" section (empty initially)
- ✅ Create Application button
- ✅ User profile info in header

### Test API Call:
```
Network tab should show: GET /api/user/applications → 200 OK
Response: {"status": "success", "data": []}
```

---

## STEP 5: Create Application Test

### Actions:
1. Click **"Create Application"** or **"New Application"** button
2. Fill Multi-Step Form:

**Step 1 - Event Details:**
- Event Name: Tech Conference 2026
- Event Type: Conference
- Crowd Size: 500
- Start Date: 2026-05-15
- End Date: 2026-05-16
- Start Time: 09:00
- End Time: 18:00

**Step 2 - Venue Details:**
- Venue Name: Delhi Convention Center
- Venue Type: Auditorium
- Address: Pragati Maidan, Delhi
- City: Delhi
- Pincode: 110001

**Step 3 - Infrastructure:**
- (Check relevant boxes or leave as default)

**Step 4 - Safety:**
- (Fill as needed)

**Step 5 - Traffic:**
- (Fill as needed)

**Step 6 - Waste:**
- (Fill as needed)

**Step 7 - Documents:**
- (Upload or skip)

**Step 8 - Review & Submit:**
- Click **Submit Application**

### Expected Result:
```
✅ Success message: "Application submitted successfully!"
✅ Application ID displayed (e.g., UEPP-ABC12345)
✅ Redirected to dashboard
✅ In Network tab: POST /api/user/submit-application → 200 OK
```

### Network Debug:
```
Request URL: http://127.0.0.1:8000/api/user/submit-application
Request Headers: Authorization: Bearer eyJ...
Request Body: {eventName, eventType, crowdSize, ...}
Response: {status: "success", application_id: "UEPP-...", routed_to: [...]}
```

---

## STEP 6: View Applications Test

### Actions:
1. Go back to Dashboard (if not already there)
2. Should see submitted application in list

### Expected Result:
```
✅ Application appears in "My Applications"
✅ Shows: Event Name, Type, Crowd Size, Status (Pending), Department Routing
✅ In Network tab: GET /api/user/applications → 200 OK
```

### Response Check:
```json
{
  "status": "success",
  "data": [
    {
      "id": "UEPP-ABC12345",
      "eventName": "Tech Conference 2026",
      "eventType": "Conference",
      "crowdSize": 500,
      "status": "Pending",
      "departments": [
        {
          "name": "Municipality",
          "status": "Pending"
        }
      ]
    }
  ]
}
```

---

## STEP 7: Risk Analysis Test

### If form has risk button:
1. Look for **"Calculate Risk"** or **"Analyze Risk"** button
2. Click it

### Expected Result:
```
✅ Risk score displayed (e.g., 0.65)
✅ Risk level shown (Low/Medium/High)
✅ Recommendations displayed
✅ In Network tab: POST /api/user/risk/calculate → 200 OK
```

### Network Debug:
```
Request URL: http://127.0.0.1:8000/api/user/risk/calculate
Response: {
  "status": "success",
  "risk_score": 0.65,
  "risk_level": "Medium",
  "recommendations": [...]
}
```

---

## STEP 8: Assistant Query Test

### If form has chat/assistant:
1. Look for **"Ask Questions"** or chat icon
2. Ask: "What permits do I need?"

### Expected Result:
```
✅ Response appears
✅ Relevant rules shown
✅ In Network tab: POST /api/user/assistant/query → 200 OK
```

---

## STEP 9: Start Department Portal

### Terminal Command (new terminal):
```bash
cd department_portal
npm run dev
```

### Expected Output:
```
  ➜  Local:   http://localhost:5174/
```

---

## STEP 10: Department Login Test

### Actions:
1. Navigate to `http://localhost:5174/`
2. Enter department credentials:
   - **Username:** P-001 (Police) or other valid prefix
   - **Password:** (department password)

### Expected Result:
```
✅ Login successful
✅ Redirected to Department Dashboard
✅ Token stored in localStorage
✅ In Network tab: POST /api/user/login → 200 OK
```

### Valid Username Prefixes:
```
P-xxx    → Police
FB-xxx   → Fire Brigade
T-xxx    → Traffic
M-xxx    → Municipality
A-xxx    → Admin
```

### If Error:
```
❌ 404 Not Found → Check if endpoint fixed to /api/user/login
❌ 401 Unauthorized → Check credentials
❌ "Invalid department role" → User doesn't have department metadata
```

---

## STEP 11: Department Dashboard Test

### Expected Elements:
- ✅ Applications list for this department
- ✅ Application statistics
- ✅ Status filters (Pending, In Review, etc.)

### Network Check:
```
GET /api/dept/applications → 200 OK
Response should include routed applications
```

---

## STEP 12: View Application as Department

### Actions:
1. Click on application from STEP 5
2. View application details

### Expected Result:
```
✅ Application details displayed
✅ Event info visible
✅ Department routing visible
✅ Can see status and actions
✅ In Network tab: GET /api/dept/applications/detail/{appId} → 200 OK
```

---

## STEP 13: Department Action Test

### Actions:
1. Click **"Approve"**, **"Reject"**, or **"Mark as In Review"**
2. If rejecting, add reason
3. Submit

### Expected Result:
```
✅ Status updated
✅ Success message displayed
✅ In Network tab: POST /api/dept/applications/{appId}/action → 200 OK
```

---

## Complete Test Checklist ✅

### User Portal
- [ ] Register new organizer account
- [ ] Login successfully
- [ ] View dashboard
- [ ] Create new application
- [ ] Application appears in list
- [ ] Submit form with all details
- [ ] Calculate risk score
- [ ] Ask assistant questions
- [ ] Approve notifications

### Department Portal
- [ ] Login as department officer
- [ ] View dashboard with applications
- [ ] See routed applications
- [ ] View application details
- [ ] Change application status
- [ ] Mark as In Review
- [ ] Approve/Reject application

---

## Browser DevTools Monitoring

### Network Tab Checks:

**Successful Signup:**
```
POST /api/user/signup → 200
Response: {status: "success", user: {...}}
```

**Successful Login:**
```
POST /api/user/login → 200
Response: {status: "success", access_token: "...", user: {...}}
```

**Create Application:**
```
POST /api/user/submit-application → 200
Response: {status: "success", application_id: "UEPP-...", routed_to: [...]}
```

**Fetch Applications:**
```
GET /api/user/applications → 200
Response: {status: "success", data: [...]}
```

**Department View:**
```
GET /api/dept/applications → 200
Response: {status: "success", applications: [...]}
```

---

## Troubleshooting

### "Cannot find backend" error
- Check backend is running on 8000
- Check VITE_BACKEND_ORIGIN in .env.local
- Clear browser cache

### 404 errors after login
- Verify auth endpoint fixes were applied
- Check file was saved: `grep "/api/user/login" user-portal/src/services/authService.js`

### Token not persisting
- Check localStorage in DevTools
- Verify Bearer token added in Network requests
- Clear localStorage and try again

### Application not appearing  
- Check backend returned application_id
- Check RLS policy on applications table
- Verify user_id matches in database

---

## All Tests Passed? ✅

If all tests passed:

1. ✅ Full backend integration verified
2. ✅ Authentication working
3. ✅ CRUD operations working
4. ✅ Multi-portal architecture working
5. ✅ Ready for production deployment

---

## Next Steps

1. Create department test accounts with proper roles
2. Test with multiple applications
3. Test department routing logic
4. Test AI features (risk, assistant)
5. Load test with realistic data volumes
6. Set up CI/CD pipeline
7. Deploy to staging environment

