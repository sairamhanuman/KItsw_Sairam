# Migration Guide: Semester and Exam Session Fixes

## Overview
This migration adds support for the new `timings` field in the exam_session_master table and fixes field mapping issues in semester and exam session creation.

## Changes Summary

### 1. Database Schema Changes
- **exam_session_master table**: Added `timings` column (VARCHAR(50))
  - Stores time ranges in format: "HH:MM - HH:MM" (e.g., "09:30 - 12:30")

### 2. API Changes
- **routes/semesters.js**: Added debug logging for better error tracking
- **routes/exam-sessions.js**: 
  - Now accepts `start_time` and `end_time` parameters
  - Combines them into `timings` field for storage
  - Added debug logging

### 3. Frontend Changes
- **exam-sessions.html**:
  - Changed Session Name from text input to dropdown (FN/AN)
  - Added Timings field with two time inputs (start_time, end_time)
  - Updated field names to match API expectations

- **js/exam-sessions.js**:
  - Updated to send correct field names: `session_name`, `exam_date`, `session_type`
  - Added support for `start_time` and `end_time`
  - Updated table display to show timings

## Migration Steps

### For New Installations
No action required. The database will be initialized with the correct schema automatically.

### For Existing Installations

#### Step 1: Backup Your Database
```bash
# Create a backup of your database
mysqldump -u root -p engineering_college > backup_$(date +%Y%m%d).sql
```

#### Step 2: Run the Migration Script
```bash
# Make sure you have a .env file with database credentials
# Then run the migration script
node db/migrate_add_timings.js
```

The migration script will:
- Check if the `timings` column already exists
- Add the column if it doesn't exist
- Skip if already applied

#### Step 3: Restart Your Application
```bash
# Stop the current server (Ctrl+C)
# Start the server again
node server.js
# or
npm start
```

### Manual Migration (Alternative)
If you prefer to run the SQL manually:

```sql
-- Connect to your database
USE engineering_college;

-- Check if column exists
SHOW COLUMNS FROM exam_session_master LIKE 'timings';

-- Add timings column if it doesn't exist
ALTER TABLE exam_session_master 
ADD COLUMN timings VARCHAR(50) AFTER session_type;

-- Verify the change
DESCRIBE exam_session_master;
```

## Testing the Changes

### Automated Testing
Run the provided test script:
```bash
# Start the server first
node server.js

# In another terminal, run the tests
node test_fixes.js
```

### Manual Testing

#### Test 1: Create Semester with Roman Numerals
1. Navigate to the Semesters page
2. Select a Roman numeral (e.g., "I") from the Semester Name dropdown
3. Enter a semester number (e.g., 1)
4. Click "Add Semester"
5. ✅ Expected: Success message "Semester created successfully"

#### Test 2: Create Exam Session with Dropdown and Timings
1. Navigate to the Exam Sessions page
2. Select "FN" or "AN" from the Session Name dropdown
3. Select an exam date
4. Enter a session type (e.g., "MSE-1")
5. Optionally, enter start time (e.g., "09:30") and end time (e.g., "12:30")
6. Click "Add Exam Session"
7. ✅ Expected: Success message "Exam session created successfully"
8. ✅ Expected: New row appears in the table with timings displayed

#### Test 3: Edit Exam Session
1. Click "Edit" on an existing exam session
2. Verify all fields populate correctly including timings
3. Update any field
4. Click "Update Exam Session"
5. ✅ Expected: Success message and updated data in table

## Rollback Procedure

If you need to rollback the changes:

```sql
-- Remove the timings column
ALTER TABLE exam_session_master DROP COLUMN timings;

-- Restore from backup if needed
mysql -u root -p engineering_college < backup_YYYYMMDD.sql
```

Then revert the code changes:
```bash
git checkout main
```

## Troubleshooting

### Issue: "Column 'timings' doesn't exist"
**Solution**: Run the migration script or manually add the column using SQL.

### Issue: "Missing required fields: session_name, exam_date"
**Solution**: 
- Check browser console for the data being sent
- Verify field names in HTML match: `session_name`, `exam_date`, `session_type`
- Clear browser cache and reload the page

### Issue: Migration script fails with "Access denied"
**Solution**: 
- Check your .env file has correct database credentials
- Ensure the database user has ALTER TABLE privileges

### Issue: Form submits but no data appears
**Solution**:
- Check server logs for errors
- Verify database connection is working
- Check browser Network tab for API response

## Additional Notes

### Field Naming Convention
The fix standardizes field names to use snake_case (matching database columns):
- `session_name` (not sessionName)
- `exam_date` (not examDate)
- `session_type` (not sessionType)
- `start_time` and `end_time` (combined into `timings`)

### Timings Field Format
- Format: "HH:MM - HH:MM"
- Example: "09:30 - 12:30"
- Optional field (can be null)
- Displayed in table if provided

### Session Name Options
The dropdown now restricts session names to:
- **FN**: Forenoon
- **AN**: Afternoon

This ensures consistency across the system.

## Support

If you encounter any issues:
1. Check the server console logs for detailed error messages
2. Check the browser console for JavaScript errors
3. Verify your database schema matches the expected structure
4. Review the test_fixes.js output for specific failures

## Files Modified

1. `routes/semesters.js` - Added debug logging
2. `routes/exam-sessions.js` - Added timings support and logging
3. `db/init.js` - Updated schema with timings column
4. `exam-sessions.html` - Updated form structure
5. `js/exam-sessions.js` - Updated to send correct data format
6. `db/migrate_add_timings.js` - Migration script (new)
7. `test_fixes.js` - Test suite (new)
8. `MIGRATION_GUIDE.md` - This file (new)
