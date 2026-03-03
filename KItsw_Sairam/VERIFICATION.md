# Quick Verification Reference Card

## 🚀 How to Check If Everything Works

### Option 1: Ultra-Quick Check (30 seconds)
```bash
npm install          # Install dependencies
npm start           # Start server
```
Then open browser to: `http://localhost:3000`

✅ **Look for:** Green "Backend Connected" indicator in top-right corner

---

### Option 2: Command-Line Check (1 minute)
```bash
# Start server (Terminal 1)
npm start

# Test backend (Terminal 2)
curl http://localhost:3000/api/health

# Expected output:
# {"status":"ok","message":"Engineering College Application API is running",...}
```

---

### Option 3: Complete Verification (5 minutes)

#### 1. Backend Health
```bash
curl http://localhost:3000/api/health
```
✅ Should return: `"status":"ok"`

#### 2. Test API Endpoints
```bash
curl http://localhost:3000/api/programmes
curl http://localhost:3000/api/students
curl http://localhost:3000/api/courses
```
✅ Each should return: `{"message":"...endpoint - To be implemented"}`

#### 3. Frontend Check
- Open: `http://localhost:3000`
- ✅ Header shows: "ENGINEERING COLLEGE - Welcome"
- ✅ Top-right shows: "Backend Connected" (green dot)
- ✅ Sidebar navigation is visible

#### 4. Test Navigation
1. Click "PRE-EXAMINATIONS" → should expand
2. Click "Masters" → should show 9 menu items
3. Click "Programme" → should show content with API response

---

## 🔥 One-Line Automated Test

Copy this entire script and run it:

```bash
cat << 'EOF' > /tmp/test.sh
#!/bin/bash
echo "Testing..."
curl -s http://localhost:3000/api/health | grep -q "ok" && echo "✅ Backend OK" || echo "❌ Backend Failed"
curl -s http://localhost:3000/api/programmes | grep -q "message" && echo "✅ API OK" || echo "❌ API Failed"  
curl -s http://localhost:3000 | grep -q "ENGINEERING COLLEGE" && echo "✅ Frontend OK" || echo "❌ Frontend Failed"
echo "Done!"
EOF
chmod +x /tmp/test.sh && /tmp/test.sh
```

---

## 📋 Visual Checklist

When you open `http://localhost:3000`, you should see:

- [ ] Page loads without errors
- [ ] Header with "ENGINEERING COLLEGE - Welcome"
- [ ] Green "Backend Connected" badge (top-right)
- [ ] Left sidebar with PRE-EXAMINATIONS and POST-EXAMINATIONS
- [ ] Welcome message in center content area
- [ ] "Available Modules" info box

Click "PRE-EXAMINATIONS" → "Masters" → "Programme":

- [ ] Content updates to "Programme Management"
- [ ] Shows "Backend API Response" box
- [ ] Displays JSON: `{"message": "Programme list endpoint..."}`
- [ ] Shows "Endpoint: /api/programmes"

---

## ⚠️ Common Issues

| Issue | Quick Fix |
|-------|-----------|
| Port 3000 in use | Change PORT in .env to 3001 |
| Module not found | Run `npm install` |
| Backend Disconnected (red) | Check if `npm start` is running |
| Can't connect | Make sure you're using `localhost:3000` |

---

## 📚 Full Documentation

For detailed testing procedures, see:
- **[TESTING.md](TESTING.md)** - Complete testing guide
- **[README.md](README.md)** - Installation & setup
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment instructions

---

## 💡 Expected Behavior

### ✅ Normal (Working)
- Backend shows "ok" status
- APIs return "To be implemented" messages
- Frontend displays with green connection indicator
- Database errors are OK (not required for basic functionality)

### ❌ Problem (Needs Fixing)
- Server won't start
- APIs return 404
- Frontend shows "Backend Disconnected" (red)
- Blank page in browser

---

## 🎯 Success Criteria

You'll know everything works when:

1. ✅ Server starts with: `Server is running on port 3000`
2. ✅ Health check returns: `"status":"ok"`
3. ✅ Browser shows green "Backend Connected"
4. ✅ Clicking menu items shows API responses

**All 4 = Everything Connected! 🎉**
