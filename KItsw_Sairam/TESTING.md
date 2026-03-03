# Testing and Verification Guide

This guide provides step-by-step instructions on how to check and verify that the Engineering College Application is working correctly.

## Table of Contents
1. [Quick Health Check](#quick-health-check)
2. [Backend Verification](#backend-verification)
3. [Frontend Verification](#frontend-verification)
4. [API Endpoint Testing](#api-endpoint-testing)
5. [Database Connection Testing](#database-connection-testing)
6. [UI/UX Verification](#uiux-verification)
7. [Troubleshooting](#troubleshooting)

---

## Quick Health Check

### 1. Check if Dependencies are Installed
```bash
npm list --depth=0
```

**Expected Output:** List of installed packages (express, mysql2, dotenv, cors, nodemon)

### 2. Start the Server
```bash
npm start
```

**Expected Output:**
```
Server is running on port 3000
Visit http://localhost:3000 to view the application
```

### 3. Quick Backend Test
Open a new terminal and run:
```bash
curl http://localhost:3000/api/health
```

**Expected Output:**
```json
{
  "status": "ok",
  "message": "Engineering College Application API is running",
  "timestamp": "2026-02-05T14:33:00.000Z"
}
```

✅ **If you see this output, your backend is working!**

---

## Backend Verification

### Test 1: Server Startup
```bash
npm start
```

**What to Check:**
- ✅ Server starts without errors
- ✅ Port 3000 is accessible (or your configured PORT)
- ✅ No error messages in console

**Possible Issues:**
- ❌ Port already in use: Change PORT in .env file
- ❌ Module not found: Run `npm install`

### Test 2: Health Endpoint
```bash
curl http://localhost:3000/api/health | jq
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Engineering College Application API is running",
  "timestamp": "2026-02-05T14:33:00.000Z"
}
```

### Test 3: Database Connection (Optional - requires MySQL)
```bash
curl http://localhost:3000/api/db-test | jq
```

**With Database Connected:**
```json
{
  "status": "success",
  "message": "Database connection successful",
  "result": 2
}
```

**Without Database (Expected):**
```json
{
  "status": "error",
  "message": "Database connection failed",
  "error": "connect ECONNREFUSED 127.0.0.1:3306"
}
```

Note: Database connection failure is normal if MySQL is not set up yet.

---

## Frontend Verification

### Test 1: Access the Homepage
1. Open your browser
2. Navigate to: `http://localhost:3000`

**What to Check:**
- ✅ Page loads without errors
- ✅ Header shows "ENGINEERING COLLEGE - Welcome"
- ✅ Sidebar navigation is visible
- ✅ Welcome message is displayed in content area

### Test 2: Backend Connection Status
Look at the top-right corner of the header.

**What to Check:**
- ✅ You should see "Backend Connected" with a green pulsing dot
- ❌ If you see "Backend Disconnected" with a red dot, the backend isn't running

**Fix:** Make sure the server is running with `npm start`

### Test 3: Navigation Menu
1. Click on "PRE-EXAMINATIONS"
2. Menu should expand showing Masters, Course Master, and Exam Setup

**What to Check:**
- ✅ Menu expands/collapses smoothly
- ✅ Arrow icon rotates when expanded
- ✅ Submenu items are visible

### Test 4: Submenu Navigation
1. Click on "Masters" under PRE-EXAMINATIONS
2. Submenu should expand showing 9 items

**What to Check:**
- ✅ Submenu expands smoothly
- ✅ All menu items are visible:
  - Programme
  - Branch
  - Batch
  - Semesters
  - Regulation
  - Section
  - Exam Sessions
  - Student Management
  - Staff Master

---

## API Endpoint Testing

### Using Command Line (curl)

#### Test All Main Endpoints
```bash
# Health check
curl http://localhost:3000/api/health | jq

# Programme endpoint
curl http://localhost:3000/api/programmes | jq

# Branch endpoint
curl http://localhost:3000/api/branches | jq

# Batch endpoint
curl http://localhost:3000/api/batches | jq

# Student endpoint
curl http://localhost:3000/api/students | jq

# Course endpoint
curl http://localhost:3000/api/courses | jq
```

**Expected Output for each:**
```json
{
  "message": "[Entity] list endpoint - To be implemented"
}
```

### Using Browser Developer Tools

1. Open browser to `http://localhost:3000`
2. Press F12 to open Developer Tools
3. Go to "Network" tab
4. Click on any menu item (e.g., "Programme")
5. Look for the API request in the Network tab

**What to Check:**
- ✅ Request to `/api/programmes` (or respective endpoint)
- ✅ Status: 200 OK
- ✅ Response shows JSON data

---

## Database Connection Testing

### Without Database (Normal State)
The application works without a database. API endpoints return placeholder messages.

**To Verify:**
```bash
curl http://localhost:3000/api/db-test
```

**Expected:** Error message (this is normal)

### With Database (Optional Setup)

#### 1. Install MySQL
Follow MySQL installation for your OS.

#### 2. Create Database
```sql
CREATE DATABASE engineering_college;
```

#### 3. Configure Environment
Edit `.env` file:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=engineering_college
DB_PORT=3306
```

#### 4. Restart Server
```bash
npm start
```

#### 5. Test Connection
```bash
curl http://localhost:3000/api/db-test | jq
```

**Expected:**
```json
{
  "status": "success",
  "message": "Database connection successful",
  "result": 2
}
```

---

## UI/UX Verification

### Test 1: Backend-Frontend Integration
1. Open browser to `http://localhost:3000`
2. Verify green "Backend Connected" indicator
3. Click "Masters" → "Programme"

**What to Check:**
- ✅ Loading spinner appears briefly
- ✅ Content area updates with "Programme Management"
- ✅ "Backend API Response" box is displayed
- ✅ Shows JSON response from `/api/programmes`
- ✅ Shows "Endpoint: /api/programmes" at bottom

### Test 2: All Menu Items Work
Click through each menu item and verify:

**Masters Section:**
- ✅ Programme - Shows API response
- ✅ Branch - Shows API response
- ✅ Batch - Shows API response
- ✅ Semesters - Shows API response
- ✅ Regulation - Shows API response
- ✅ Section - Shows API response
- ✅ Exam Sessions - Shows API response
- ✅ Student Management - Shows API response
- ✅ Staff Master - Shows API response

**Course Master Section:**
- ✅ Course Import/Entry Verification - Shows API response
- ✅ Course Mapping vs Faculty - Shows API response

**Exam Setup:**
- ✅ Exam Setup - Shows API response

### Test 3: Active State Highlighting
Click different menu items and verify:
- ✅ Clicked item has blue background
- ✅ Blue left border appears on active item
- ✅ Previous item loses active state

### Test 4: Responsive Design
1. Resize browser window to mobile size (< 768px)

**What to Check:**
- ✅ Sidebar becomes vertical at top
- ✅ Content area stacks below sidebar
- ✅ Navigation still works
- ✅ Text is readable

---

## Troubleshooting

### Issue: Server Won't Start

**Symptom:** Error when running `npm start`

**Solutions:**
1. Check if dependencies are installed:
   ```bash
   npm install
   ```

2. Check if port 3000 is already in use:
   ```bash
   # Linux/Mac
   lsof -i :3000
   
   # Windows
   netstat -ano | findstr :3000
   ```

3. Change port in `.env`:
   ```env
   PORT=3001
   ```

### Issue: Backend Disconnected

**Symptom:** Red "Backend Disconnected" indicator in UI

**Solutions:**
1. Verify server is running:
   ```bash
   curl http://localhost:3000/api/health
   ```

2. Check server console for errors

3. Restart the server:
   ```bash
   npm start
   ```

### Issue: API Returns 404

**Symptom:** API endpoint returns "API endpoint not found"

**Solutions:**
1. Check the endpoint URL is correct
2. Verify server is running
3. Check server.js has the endpoint defined

### Issue: Module Not Found

**Symptom:** `Error: Cannot find module 'express'`

**Solution:**
```bash
npm install
```

### Issue: Permission Denied

**Symptom:** `EACCES: permission denied`

**Solutions:**
1. Don't use sudo with npm
2. Check file permissions:
   ```bash
   ls -la
   ```

3. Fix npm permissions:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

### Issue: Database Connection Failed

**Symptom:** MySQL connection error in console

**This is Normal:** The application works without a database. Database errors are expected and handled gracefully.

**To Fix (Optional):**
1. Install and start MySQL
2. Create the database
3. Configure `.env` with correct credentials

---

## Automated Testing Script

Create a file `test-app.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Engineering College Application..."
echo ""

# Test 1: Check if server is running
echo "1️⃣ Testing backend health..."
HEALTH=$(curl -s http://localhost:3000/api/health)
if [[ $HEALTH == *"ok"* ]]; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend is not responding"
    exit 1
fi

# Test 2: Test API endpoints
echo ""
echo "2️⃣ Testing API endpoints..."
ENDPOINTS=("programmes" "branches" "batches" "students" "courses")

for endpoint in "${ENDPOINTS[@]}"; do
    RESPONSE=$(curl -s http://localhost:3000/api/$endpoint)
    if [[ $RESPONSE == *"message"* ]]; then
        echo "✅ /api/$endpoint is working"
    else
        echo "❌ /api/$endpoint failed"
    fi
done

# Test 3: Check frontend
echo ""
echo "3️⃣ Testing frontend..."
FRONTEND=$(curl -s http://localhost:3000)
if [[ $FRONTEND == *"ENGINEERING COLLEGE"* ]]; then
    echo "✅ Frontend is serving correctly"
else
    echo "❌ Frontend is not accessible"
fi

echo ""
echo "✨ All tests completed!"
```

**Run the test:**
```bash
chmod +x test-app.sh
./test-app.sh
```

---

## Summary Checklist

Use this checklist to verify your installation:

- [ ] Dependencies installed (`npm install`)
- [ ] Server starts without errors (`npm start`)
- [ ] Health endpoint returns OK (`curl http://localhost:3000/api/health`)
- [ ] Frontend loads in browser (`http://localhost:3000`)
- [ ] Backend connection indicator shows green
- [ ] Navigation menu expands/collapses
- [ ] Clicking menu items shows API responses
- [ ] All 12 menu items work correctly
- [ ] Active menu item highlighting works
- [ ] Responsive design works on mobile

---

## Next Steps

Once you've verified everything works:

1. **Start Development:** Begin implementing actual database schemas and business logic
2. **Add Features:** Implement CRUD operations for each module
3. **Deploy:** Use Railway or your preferred hosting platform
4. **Documentation:** Keep README and this guide updated

For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)
