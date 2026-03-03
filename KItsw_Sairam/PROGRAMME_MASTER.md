# Programme Master Table - Setup Guide

This guide explains how to set up and use the Programme Master Table functionality.

## Overview

The Programme Master Table allows you to manage engineering programmes (B.Tech, M.Tech, Ph.D., etc.) with full CRUD (Create, Read, Update, Delete) operations.

## Files Created

1. **Database Schema**: `schema.sql`
   - Contains the database table structure
   - Includes sample data

2. **HTML Interface**: `programme.html`
   - User-friendly form for adding/editing programmes
   - Data table displaying all programmes
   - Full CRUD functionality interface

3. **Frontend JavaScript**: `js/programme.js`
   - Client-side logic for form handling
   - API communication
   - Dynamic UI updates

4. **Backend Routes**: `routes/programmes.js`
   - RESTful API endpoints
   - Database operations
   - Input validation

5. **Server Integration**: `server.js` (updated)
   - Routes integrated into main server
   - Database connection handling

## Database Setup

### Step 1: Create Database and Table

Run the following SQL commands:

```sql
-- Create database
CREATE DATABASE IF NOT EXISTS engineering_college;
USE engineering_college;

-- Run the schema.sql file
SOURCE schema.sql;
```

Or execute directly:

```bash
mysql -u root -p < schema.sql
```

### Step 2: Configure Environment Variables

Make sure your `.env` file has the correct database credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=engineering_college
DB_PORT=3306
```

## API Endpoints

All endpoints are prefixed with `/api/programmes`

### GET /api/programmes
Get all programmes

**Response:**
```json
{
  "status": "success",
  "message": "Programmes retrieved successfully",
  "data": [
    {
      "programme_id": 1,
      "programme_code": "BTECH",
      "programme_name": "Bachelor of Technology",
      "programme_type": "UG",
      "duration_years": 4.0,
      "description": "Four-year undergraduate engineering program",
      "is_active": true,
      "created_at": "2026-02-06T00:00:00.000Z",
      "updated_at": "2026-02-06T00:00:00.000Z"
    }
  ]
}
```

### GET /api/programmes/:id
Get a specific programme by ID

**Response:**
```json
{
  "status": "success",
  "message": "Programme retrieved successfully",
  "data": {
    "programme_id": 1,
    "programme_code": "BTECH",
    "programme_name": "Bachelor of Technology",
    "programme_type": "UG",
    "duration_years": 4.0,
    "description": "Four-year undergraduate engineering program",
    "is_active": true
  }
}
```

### POST /api/programmes
Create a new programme

**Request Body:**
```json
{
  "programme_code": "BTECH",
  "programme_name": "Bachelor of Technology",
  "programme_type": "UG",
  "duration_years": 4.0,
  "description": "Four-year undergraduate engineering program",
  "is_active": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Programme created successfully",
  "data": {
    "programme_id": 5,
    "programme_code": "BTECH",
    "programme_name": "Bachelor of Technology",
    "programme_type": "UG",
    "duration_years": 4.0,
    "description": "Four-year undergraduate engineering program",
    "is_active": true
  }
}
```

### PUT /api/programmes/:id
Update an existing programme

**Request Body:**
```json
{
  "programme_name": "Bachelor of Technology (Updated)",
  "programme_type": "UG",
  "duration_years": 4.0,
  "description": "Updated description",
  "is_active": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Programme updated successfully"
}
```

### DELETE /api/programmes/:id
Delete a programme

**Response:**
```json
{
  "status": "success",
  "message": "Programme BTECH deleted successfully"
}
```

## Usage

### Via Web Interface

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/programme.html
   ```

3. Use the form to:
   - Add new programmes
   - Edit existing programmes
   - Delete programmes
   - View all programmes in a table

### Via API (Programmatic)

#### Using cURL:

```bash
# Get all programmes
curl http://localhost:3000/api/programmes

# Get specific programme
curl http://localhost:3000/api/programmes/1

# Create new programme
curl -X POST http://localhost:3000/api/programmes \
  -H "Content-Type: application/json" \
  -d '{
    "programme_code": "MBA",
    "programme_name": "Master of Business Administration",
    "programme_type": "PG",
    "duration_years": 2.0,
    "description": "Management program",
    "is_active": true
  }'

# Update programme
curl -X PUT http://localhost:3000/api/programmes/1 \
  -H "Content-Type: application/json" \
  -d '{
    "programme_name": "Bachelor of Technology (Updated)",
    "programme_type": "UG",
    "duration_years": 4.0,
    "description": "Updated description",
    "is_active": true
  }'

# Delete programme
curl -X DELETE http://localhost:3000/api/programmes/1
```

#### Using JavaScript (fetch):

```javascript
// Get all programmes
const programmes = await fetch('/api/programmes').then(r => r.json());

// Create new programme
const newProgramme = await fetch('/api/programmes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    programme_code: 'MBA',
    programme_name: 'Master of Business Administration',
    programme_type: 'PG',
    duration_years: 2.0,
    description: 'Management program',
    is_active: true
  })
}).then(r => r.json());
```

## Features

- ✅ Full CRUD operations
- ✅ Input validation (client and server-side)
- ✅ Duplicate code prevention
- ✅ Active/Inactive status management
- ✅ Responsive design
- ✅ Error handling
- ✅ Success/Error notifications
- ✅ RESTful API design
- ✅ Modular code structure

## Database Schema

```sql
CREATE TABLE programme_master (
    programme_id INT AUTO_INCREMENT PRIMARY KEY,
    programme_code VARCHAR(20) NOT NULL UNIQUE,
    programme_name VARCHAR(100) NOT NULL,
    programme_type VARCHAR(50) NOT NULL,
    duration_years DECIMAL(3,1) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_programme_code (programme_code),
    INDEX idx_is_active (is_active)
);
```

## Sample Data

The schema includes sample data for:
- B.Tech (Bachelor of Technology)
- M.Tech (Master of Technology)
- Ph.D. (Doctor of Philosophy)
- MBA (Master of Business Administration)

## Troubleshooting

### Database Connection Issues

If you see "Failed to fetch programmes" error:

1. Verify MySQL is running:
   ```bash
   sudo service mysql status
   ```

2. Check database credentials in `.env` file

3. Verify database exists:
   ```bash
   mysql -u root -p -e "SHOW DATABASES;"
   ```

4. Import schema if table doesn't exist:
   ```bash
   mysql -u root -p engineering_college < schema.sql
   ```

### Port Already in Use

If port 3000 is already in use, change it in `.env`:
```env
PORT=3001
```

## Integration with Main Dashboard

The Programme menu item in the main dashboard (`index.html`) now links directly to the programme management page.

## Next Steps

Similar tables can be created for:
- Branch Master
- Batch Master
- Semester Configuration
- Regulation Management
- Section Management
- Exam Sessions
- Student Management
- Staff Master

Each would follow the same pattern:
1. SQL schema file
2. HTML interface
3. JavaScript frontend logic
4. Routes module
5. Server integration
