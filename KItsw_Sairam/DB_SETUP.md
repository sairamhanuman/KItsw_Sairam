# Database Setup Documentation

## Overview

The application uses MySQL database with automatic table creation on startup. The database initialization module (`db/init.js`) ensures all necessary tables exist before the application starts serving requests.

## Database Schema

### Tables Created Automatically

The following tables are created automatically when the application starts:

#### 1. programme_master
Stores academic programme information (BTECH, MTECH, etc.)

| Column | Type | Description |
|--------|------|-------------|
| programme_id | INT (PK) | Auto-increment primary key |
| programme_code | VARCHAR(20) | Unique programme code (e.g., 'BTECH') |
| programme_name | VARCHAR(200) | Full programme name |
| programme_type | ENUM | Type: 'UG', 'PG', 'Diploma', 'Certificate' |
| duration_years | DECIMAL(3,1) | Programme duration in years |
| description | TEXT | Programme description |
| is_active | BOOLEAN | Active status (default: TRUE) |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### 2. branch_master
Stores branch/department information

| Column | Type | Description |
|--------|------|-------------|
| branch_id | INT (PK) | Auto-increment primary key |
| branch_code | VARCHAR(20) | Unique branch code (e.g., 'CSE') |
| branch_name | VARCHAR(200) | Full branch name |
| programme_id | INT (FK) | References programme_master |
| description | TEXT | Branch description |
| is_active | BOOLEAN | Active status (default: TRUE) |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### 3. batch_master
Stores academic batch information

| Column | Type | Description |
|--------|------|-------------|
| batch_id | INT (PK) | Auto-increment primary key |
| batch_name | VARCHAR(100) | Batch name/identifier |
| start_year | INT | Batch start year |
| end_year | INT | Batch end year |
| is_active | BOOLEAN | Active status (default: TRUE) |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### 4. semester_master
Stores semester configuration

| Column | Type | Description |
|--------|------|-------------|
| semester_id | INT (PK) | Auto-increment primary key |
| semester_name | VARCHAR(50) | Semester name |
| semester_number | INT | Semester number |
| is_active | BOOLEAN | Active status (default: TRUE) |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### 5. regulation_master
Stores academic regulation information

| Column | Type | Description |
|--------|------|-------------|
| regulation_id | INT (PK) | Auto-increment primary key |
| regulation_name | VARCHAR(100) | Regulation name |
| regulation_year | INT | Regulation year |
| description | TEXT | Regulation description |
| is_active | BOOLEAN | Active status (default: TRUE) |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### 6. section_master
Stores section/division information

| Column | Type | Description |
|--------|------|-------------|
| section_id | INT (PK) | Auto-increment primary key |
| section_name | VARCHAR(50) | Section name (e.g., 'A', 'B') |
| capacity | INT | Maximum student capacity |
| is_active | BOOLEAN | Active status (default: TRUE) |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### 7. exam_session_master
Stores examination session details

| Column | Type | Description |
|--------|------|-------------|
| session_id | INT (PK) | Auto-increment primary key |
| session_name | VARCHAR(100) | Session name |
| exam_date | DATE | Examination date |
| session_type | VARCHAR(50) | Type of exam session |
| is_active | BOOLEAN | Active status (default: TRUE) |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### 8. student_master
Stores student information

| Column | Type | Description |
|--------|------|-------------|
| student_id | INT (PK) | Auto-increment primary key |
| student_name | VARCHAR(200) | Student full name |
| email | VARCHAR(200) | Student email (unique) |
| phone | VARCHAR(20) | Contact phone number |
| batch_id | INT (FK) | References batch_master |
| branch_id | INT (FK) | References branch_master |
| section_id | INT (FK) | References section_master |
| is_active | BOOLEAN | Active status (default: TRUE) |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

## Foreign Key Relationships

```
programme_master (1) ----< (N) branch_master
batch_master (1) ----< (N) student_master
branch_master (1) ----< (N) student_master
section_master (1) ----< (N) student_master
```

## Automatic Initialization

### How It Works

1. **Connection Check**: When the server starts, it first tests the database connection
2. **Table Creation**: The initialization module checks if each table exists
3. **Schema Application**: Uses `CREATE TABLE IF NOT EXISTS` to safely create missing tables
4. **Sample Data**: If tables are newly created and empty, sample data is inserted
5. **Logging**: Each step is logged to the console for debugging

### Initialization Process

The initialization happens automatically in this order:

1. `programme_master` (no dependencies)
2. `branch_master` (depends on programme_master)
3. `batch_master` (no dependencies)
4. `semester_master` (no dependencies)
5. `regulation_master` (no dependencies)
6. `section_master` (no dependencies)
7. `exam_session_master` (no dependencies)
8. `student_master` (depends on batch, branch, and section)

### Sample Data Inserted

If the database is empty, the following sample data is automatically inserted:

**Programmes:**
- BTECH - Bachelor of Technology (UG, 4 years)
- MTECH - Master of Technology (PG, 2 years)
- DIPLOMA - Diploma in Engineering (Diploma, 3 years)

**Branches (for BTECH):**
- CSE - Computer Science and Engineering
- ECE - Electronics and Communication Engineering
- MECH - Mechanical Engineering

## Manual Database Setup (Optional)

If you need to manually create the database or tables:

### Create Database

```sql
CREATE DATABASE IF NOT EXISTS engineering_college;
USE engineering_college;
```

### Run Initialization

The application will automatically create all tables on startup. No manual SQL execution is required.

### Manual Table Creation

If automatic initialization fails, you can manually run the SQL from `db/init.js` or use the existing `schema.sql` file:

```bash
mysql -u your_user -p your_database < schema.sql
```

## Environment Variables

Required database configuration in `.env`:

```env
DB_HOST=localhost          # Database host
DB_USER=root              # Database user
DB_PASSWORD=your_password # Database password
DB_NAME=engineering_college # Database name
DB_PORT=3306              # Database port (default: 3306)
```

## Troubleshooting

### Tables Not Created

**Symptom**: API returns "Table doesn't exist" error

**Solution**:
1. Check server logs for initialization errors
2. Verify database connection credentials
3. Ensure database user has CREATE TABLE permissions
4. Check for any foreign key constraint errors

### Sample Data Not Inserted

**Symptom**: Tables exist but are empty

**Solution**:
- Sample data is only inserted if tables are newly created
- Manually insert data using API endpoints or SQL
- Check server logs for insertion errors

### Foreign Key Errors

**Symptom**: "Cannot add foreign key constraint" error

**Solution**:
1. Ensure parent tables (programme_master, batch_master, etc.) exist first
2. Check that referenced IDs exist before inserting child records
3. Verify table creation order in initialization

## Testing Database Setup

### 1. Test Database Connection

```bash
curl http://localhost:3000/api/db-test
```

Expected response:
```json
{
  "status": "success",
  "message": "Database connection successful",
  "result": 2
}
```

### 2. Test Table Creation

```bash
curl http://localhost:3000/api/programmes
```

Expected response (with sample data):
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
      ...
    }
  ]
}
```

## Deployment Notes

### Railway Deployment

The automatic initialization is especially useful for Railway deployment:

1. **No Manual SQL Required**: Tables are created automatically on first deployment
2. **Idempotent**: Safe to redeploy without data loss (uses IF NOT EXISTS)
3. **Persistent Data**: Existing data is never dropped or modified
4. **Zero Downtime**: Database setup happens during startup

### Database Permissions

Ensure your database user has the following permissions:
- CREATE TABLE
- SELECT
- INSERT
- UPDATE
- DELETE
- REFERENCES (for foreign keys)

### Production Considerations

1. **Backup**: Always backup your database before deploying
2. **Migrations**: For schema changes, consider using a migration tool
3. **Monitoring**: Check server logs during deployment
4. **Testing**: Test on a staging database first

## API Endpoints

Once tables are initialized, the following endpoints are available:

- `GET /api/programmes` - List all programmes
- `POST /api/programmes` - Create a new programme
- `GET /api/programmes/:id` - Get programme by ID
- `PUT /api/programmes/:id` - Update programme
- `DELETE /api/programmes/:id` - Delete programme

More endpoints will be added for other master tables in future updates.

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure database is accessible from the application
4. Review this documentation for common issues
