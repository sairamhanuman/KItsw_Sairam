# Master Tables Implementation - Testing Guide

## Overview
This document describes the implementation of 7 master tables with full CRUD operations for the Engineering College Application.

## Implemented Tables

### 1. Branch Master Table
**Endpoint:** `/api/branches`

**Fields:**
- `branch_id` (Primary Key, Auto Increment)
- `branch_code` (VARCHAR(20), UNIQUE) - e.g., 'CSE', 'ECE', 'MECH'
- `branch_name` (VARCHAR(100)) - Full name of the branch
- `programme_id` (Foreign Key to programme_master)
- `description` (TEXT)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (Timestamps)

**Sample Data:**
- CSE - Computer Science and Engineering
- ECE - Electronics and Communication Engineering
- MECH - Mechanical Engineering
- CIVIL - Civil Engineering
- EEE - Electrical and Electronics Engineering

### 2. Batch Master Table
**Endpoint:** `/api/batches`

**Fields:**
- `batch_id` (Primary Key, Auto Increment)
- `batch_year` (INT, UNIQUE) - e.g., 2021, 2022
- `batch_name` (VARCHAR(50))
- `start_date` (DATE)
- `end_date` (DATE)
- `description` (TEXT)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (Timestamps)

**Sample Data:**
- Batch 2021 (2021-08-01 to 2025-05-31)
- Batch 2022 (2022-08-01 to 2026-05-31)
- Batch 2023 (2023-08-01 to 2027-05-31)
- Batch 2024 (2024-08-01 to 2028-05-31)

### 3. Semesters Master Table
**Endpoint:** `/api/semesters`

**Fields:**
- `semester_id` (Primary Key, Auto Increment)
- `semester_number` (INT, UNIQUE) - 1-8
- `semester_name` (VARCHAR(50))
- `description` (TEXT)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (Timestamps)

**Sample Data:**
- Semester I through Semester VIII

### 4. Regulation Master Table
**Endpoint:** `/api/regulations`

**Fields:**
- `regulation_id` (Primary Key, Auto Increment)
- `regulation_code` (VARCHAR(20), UNIQUE) - e.g., 'R20', 'R21'
- `regulation_name` (VARCHAR(100))
- `effective_from` (DATE)
- `effective_to` (DATE)
- `description` (TEXT)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (Timestamps)

**Sample Data:**
- R20 - Regulation 2020 (effective from 2020-08-01)
- R21 - Regulation 2021 (effective from 2021-08-01)
- R22 - Regulation 2022 (effective from 2022-08-01)
- R23 - Regulation 2023 (effective from 2023-08-01)

### 5. Section Master Table
**Endpoint:** `/api/sections`

**Fields:**
- `section_id` (Primary Key, Auto Increment)
- `section_code` (VARCHAR(20), UNIQUE) - e.g., 'A', 'B', 'C'
- `section_name` (VARCHAR(50))
- `capacity` (INT) - Default: 60
- `description` (TEXT)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (Timestamps)

**Sample Data:**
- Section A (capacity: 60)
- Section B (capacity: 60)
- Section C (capacity: 60)
- Section D (capacity: 60)

### 6. Exam Sessions Master Table
**Endpoint:** `/api/exam-sessions`

**Fields:**
- `exam_session_id` (Primary Key, Auto Increment)
- `session_code` (VARCHAR(20), UNIQUE) - e.g., 'MAY2024', 'NOV2024'
- `session_name` (VARCHAR(100))
- `exam_month` (VARCHAR(20))
- `exam_year` (INT)
- `start_date` (DATE)
- `end_date` (DATE)
- `description` (TEXT)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (Timestamps)

**Sample Data:**
- MAY2024 - May 2024 Examination (2024-05-01 to 2024-05-31)
- NOV2024 - November 2024 Examination (2024-11-01 to 2024-11-30)
- MAY2025 - May 2025 Examination (2025-05-01 to 2025-05-31)

### 7. Student Management Table
**Endpoint:** `/api/students`

**Fields:**
- `student_id` (Primary Key, Auto Increment)
- `roll_number` (VARCHAR(20), UNIQUE)
- `first_name` (VARCHAR(50))
- `last_name` (VARCHAR(50))
- `email` (VARCHAR(100), UNIQUE)
- `phone` (VARCHAR(15))
- `date_of_birth` (DATE)
- `admission_year` (INT)
- `programme_id` (Foreign Key to programme_master)
- `branch_id` (Foreign Key to branch_master)
- `batch_id` (Foreign Key to batch_master)
- `regulation_id` (Foreign Key to regulation_master)
- `section_id` (Foreign Key to section_master)
- `current_semester` (INT) - Default: 1
- `address` (TEXT)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (Timestamps)

**Sample Data:**
- 21CS001 - Rajesh Kumar (CSE, Batch 2021, R20, Section A, Semester 8)
- 21CS002 - Priya Sharma (CSE, Batch 2021, R20, Section A, Semester 8)
- 22CS001 - Amit Patel (CSE, Batch 2022, R21, Section A, Semester 6)
- 23CS001 - Sneha Reddy (CSE, Batch 2023, R22, Section B, Semester 4)
- 24CS001 - Karthik Rao (CSE, Batch 2024, R23, Section B, Semester 2)

## CRUD Operations

All endpoints support the following operations:

### GET All Records
```bash
GET /api/{endpoint}
```
**Response:**
```json
{
  "status": "success",
  "message": "{Resource} retrieved successfully",
  "data": [...]
}
```

### GET Single Record
```bash
GET /api/{endpoint}/{id}
```
**Response:**
```json
{
  "status": "success",
  "message": "{Resource} retrieved successfully",
  "data": {...}
}
```

### POST Create New Record
```bash
POST /api/{endpoint}
Content-Type: application/json

{
  // Required fields for the specific endpoint
}
```
**Response:**
```json
{
  "status": "success",
  "message": "{Resource} created successfully",
  "data": {...}
}
```

### PUT Update Record
```bash
PUT /api/{endpoint}/{id}
Content-Type: application/json

{
  // Fields to update
}
```
**Response:**
```json
{
  "status": "success",
  "message": "{Resource} updated successfully"
}
```

### DELETE Record
```bash
DELETE /api/{endpoint}/{id}
```
**Response:**
```json
{
  "status": "success",
  "message": "{Resource} deleted successfully"
}
```

## Testing Examples

### 1. Test Branches API

#### Get all branches:
```bash
curl http://localhost:3000/api/branches
```

#### Get single branch:
```bash
curl http://localhost:3000/api/branches/1
```

#### Create new branch:
```bash
curl -X POST http://localhost:3000/api/branches \
  -H "Content-Type: application/json" \
  -d '{
    "branch_code": "IT",
    "branch_name": "Information Technology",
    "programme_id": 1,
    "description": "Information Technology branch"
  }'
```

#### Update branch:
```bash
curl -X PUT http://localhost:3000/api/branches/1 \
  -H "Content-Type: application/json" \
  -d '{
    "branch_name": "Computer Science & Engineering",
    "programme_id": 1,
    "description": "Updated description",
    "is_active": true
  }'
```

#### Delete branch:
```bash
curl -X DELETE http://localhost:3000/api/branches/1
```

### 2. Test Students API

#### Get all students:
```bash
curl http://localhost:3000/api/students
```

#### Create new student:
```bash
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "roll_number": "24CS050",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "9876543215",
    "date_of_birth": "2006-05-15",
    "admission_year": 2024,
    "programme_id": 1,
    "branch_id": 1,
    "batch_id": 4,
    "regulation_id": 4,
    "section_id": 1,
    "current_semester": 1,
    "address": "123 Main St, City"
  }'
```

## Database Setup

To set up the database with all tables and sample data:

```bash
mysql -u root -p < schema.sql
```

Or manually:

```sql
-- Create database
CREATE DATABASE IF NOT EXISTS engineering_college;
USE engineering_college;

-- Run the schema.sql file which includes:
-- 1. Programme Master Table (already existed)
-- 2. Branch Master Table
-- 3. Batch Master Table
-- 4. Semesters Master Table
-- 5. Regulation Master Table
-- 6. Section Master Table
-- 7. Exam Sessions Master Table
-- 8. Student Management Table
-- Plus all sample data
```

## Error Handling

All endpoints include comprehensive error handling:

- **400 Bad Request**: Missing required fields or invalid data
- **404 Not Found**: Record not found
- **409 Conflict**: Duplicate unique field (e.g., code already exists)
- **500 Internal Server Error**: Database or server errors

### Foreign Key Constraint Errors

When trying to delete a record that is referenced by other records:

```json
{
  "status": "error",
  "message": "Cannot delete {resource} as it is referenced by other records"
}
```

## Features Implemented

✅ **Full CRUD Operations**
- Create (POST)
- Read (GET single and list)
- Update (PUT)
- Delete (DELETE)

✅ **Data Validation**
- Required field validation
- Unique field validation
- Foreign key validation

✅ **Error Handling**
- Comprehensive error messages
- Proper HTTP status codes
- Foreign key constraint handling

✅ **Database Relationships**
- Foreign keys properly defined
- ON DELETE RESTRICT to prevent data loss
- Proper indexing for performance

✅ **Sample Data**
- All tables include sample data
- Realistic test data for development

## Integration with Frontend

The API endpoints are ready to be integrated with the frontend. The existing navigation menu in `index.html` already has links to all these features:

- Branch
- Batch
- Semesters
- Regulation
- Section
- Exam Sessions
- Student Management

You can update the JavaScript code to make API calls to these endpoints and display the data.

## Notes

- All tables use InnoDB engine for transaction support
- All tables use utf8mb4 character set for international character support
- Timestamps (created_at, updated_at) are automatically managed
- All tables have proper indexing for query performance
- Foreign key relationships ensure data integrity

## Known Limitations

1. **Update Endpoints**: The PUT endpoints currently update all fields. If a required field is not provided in the request body, it may be set to null/undefined. In a production environment, you should either:
   - Validate that all required fields are provided in UPDATE requests
   - Implement PATCH endpoints that only update provided fields
   - Fetch existing values and merge with provided values before updating

2. **Sample Data Dates**: Some sample data may reference past dates. Update the schema.sql with current academic year data as needed.

These limitations are acceptable for this initial implementation and can be addressed in future iterations.
