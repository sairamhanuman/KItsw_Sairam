# Student Management Module Documentation

## 🔒 Security Update (2026-02-06)

**CRITICAL**: Multer upgraded from 1.4.5-lts.2 to 2.0.2 to fix 4 DoS vulnerabilities.  
**Status**: ✅ All patched - 0 vulnerabilities

---

## Overview

The Student Management module is a comprehensive system for managing student records in an engineering college. It includes complete CRUD operations, advanced filtering, statistics, photo uploads, and Excel import/export functionality.

## Features

### 1. Complete Student Profile Management

#### Required Fields
- **Admission Number** (unique identifier)
- **Full Name**
- **Gender** (Male/Female/Other)
- **Programme** (e.g., B.Tech, M.Tech)
- **Branch** (e.g., CSE, ECE, Mechanical)
- **Batch** (enrollment year)

#### Optional Fields
- HT Number (Hall Ticket Number)
- Roll Number
- Semester
- Section
- Regulation
- Date of Birth
- Father's Name
- Mother's Name
- Aadhaar Number (12 digits)
- Caste Category
- Student Mobile (10 digits)
- Parent Mobile (10 digits)
- Email Address
- Admission Date
- Completion Year
- Date of Leaving
- Discontinue Date

#### Status and Flags
- **Student Status**: In Roll (default), Detained, Left out
- **Is Detainee**: Boolean flag
- **Is Transitory**: Boolean flag
- **Is Handicapped**: Boolean flag
- **Is Lateral**: Boolean flag for lateral entry students
- **Join Curriculum**: Boolean flag
- **Is Locked**: Boolean flag to prevent modifications

### 2. Photo Upload

- Maximum file size: 2MB
- Supported formats: JPEG, JPG, PNG
- Recommended dimensions: 260x200px
- Files stored in `/uploads/students/` directory
- Filename format: `student-{timestamp}.{ext}`
- Photo preview before upload
- Remove/replace photo functionality

### 3. Advanced Filtering

Filter students by:
- **Programme**: Filter by degree program
- **Branch**: Filter by department
- **Batch**: Filter by enrollment year
- **Semester**: Filter by current semester
- **Status**: In Roll, Detained, Left out
- **Gender**: Male, Female, Other
- **Search**: By name, admission number, or roll number

### 4. Real-time Statistics

Dashboard displays:
- **Total Students**: Overall count
- **Boys**: Count of male students
- **Girls**: Count of female students
- **In Roll**: Active students count
- **Detained**: Detained students count
- **Left Out**: Students who left count

Statistics update automatically based on current filters.

### 5. Excel Export/Import

#### Export Features
- Export all visible students (respects current filters)
- Professional Excel format with headers
- All fields included in export
- Column auto-sizing for readability
- Download as `.xlsx` file

#### Export Columns
1. Admission Number
2. HT Number
3. Roll Number
4. Full Name
5. Programme
6. Branch
7. Batch
8. Semester
9. Section
10. Regulation
11. Date of Birth
12. Gender
13. Father's Name
14. Mother's Name
15. Aadhaar Number
16. Caste Category
17. Student Mobile
18. Parent Mobile
19. Email
20. Admission Date
21. Completion Year
22. Student Status
23. Special Flags (Detainee, Lateral, etc.)

#### Import Features (Coming Soon)
- Bulk import from Excel file
- Data validation during import
- Error reporting for invalid rows
- Preview before final import

### 6. Soft Delete and Restore

- Students are soft-deleted (not permanently removed)
- Deleted students are hidden from normal views
- Can be restored if needed
- `deleted_at` timestamp tracks when deletion occurred
- Maintains data integrity and audit trail

### 7. Bulk Operations

- **Bulk Lock**: Lock all students in a specific batch
- Prevents accidental modifications
- Useful for graduating batches

## API Endpoints

### Student CRUD Operations

#### 1. List All Students with Filters
```
GET /api/students
```

**Query Parameters:**
- `programme_id`: Filter by programme
- `branch_id`: Filter by branch
- `batch_id`: Filter by batch
- `semester_id`: Filter by semester
- `section_id`: Filter by section
- `student_status`: Filter by status (In Roll, Detained, Left out)
- `gender`: Filter by gender (Male, Female, Other)
- `search`: Search by name, admission number, roll number

**Response:**
```json
{
  "status": "success",
  "data": {
    "students": [...],
    "statistics": {
      "total": 191,
      "boys": 98,
      "girls": 93,
      "in_roll": 180,
      "detained": 8,
      "left_out": 3
    }
  }
}
```

#### 2. Get Single Student
```
GET /api/students/:id
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "student_id": 1,
    "admission_number": "B21CS001",
    "full_name": "John Doe",
    ...
  }
}
```

#### 3. Create New Student
```
POST /api/students
```

**Request Body:**
```json
{
  "admission_number": "B21CS001",
  "full_name": "John Doe",
  "gender": "Male",
  "programme_id": 1,
  "branch_id": 2,
  "batch_id": 3,
  "student_status": "In Roll",
  ...
}
```

**Validation Rules:**
- `admission_number`: Required, unique
- `full_name`: Required
- `gender`: Required (Male/Female/Other)
- `programme_id`, `branch_id`, `batch_id`: Required
- `student_mobile`: 10 digits (optional)
- `parent_mobile`: 10 digits (optional)
- `aadhaar_number`: 12 digits (optional)
- `email`: Valid email format (optional)

#### 4. Update Student
```
PUT /api/students/:id
```

**Request Body:** Same as create, all fields optional except required ones

#### 5. Delete Student (Soft Delete)
```
DELETE /api/students/:id
```

Sets `is_active = false` and `deleted_at = NOW()`

#### 6. Restore Deleted Student
```
POST /api/students/:id/restore
```

Sets `is_active = true` and `deleted_at = NULL`

### Photo Upload

#### 7. Upload Student Photo
```
POST /api/students/:id/upload-photo
```

**Content-Type:** `multipart/form-data`

**Form Field:** `photo`

**Validation:**
- Max file size: 2MB
- Allowed types: JPEG, JPG, PNG
- Automatic thumbnail generation (future enhancement)

**Response:**
```json
{
  "status": "success",
  "message": "Photo uploaded successfully",
  "data": {
    "photo_url": "/uploads/students/student-1234567890.jpg"
  }
}
```

### Bulk Operations

#### 8. Bulk Lock Students by Batch
```
POST /api/students/bulk-lock
```

**Request Body:**
```json
{
  "batch_id": 5
}
```

Locks all students in the specified batch.

### Excel Operations

#### 9. Export Students to Excel
```
GET /api/students/export/excel
```

Downloads an Excel file with all active students (respects current filters).

#### 10. Import Students from Excel
```
POST /api/students/import/excel
```

**Content-Type:** `multipart/form-data`

**Form Field:** `file`

(To be implemented)

## Database Schema

### student_master Table

```sql
CREATE TABLE IF NOT EXISTS student_master (
    student_id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Basic Information
    admission_number VARCHAR(50) UNIQUE NOT NULL,
    ht_number VARCHAR(50),
    roll_number VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    
    -- Academic Information
    programme_id INT,
    branch_id INT,
    batch_id INT,
    semester_id INT,
    section_id INT,
    regulation_id INT,
    
    -- Personal Information
    date_of_birth DATE,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    father_name VARCHAR(255),
    mother_name VARCHAR(255),
    aadhaar_number VARCHAR(12),
    caste_category VARCHAR(50),
    
    -- Contact Information
    student_mobile VARCHAR(15),
    parent_mobile VARCHAR(15),
    email VARCHAR(255),
    
    -- Dates
    admission_date DATE,
    completion_year VARCHAR(10),
    date_of_leaving DATE NULL,
    discontinue_date DATE NULL,
    
    -- Status and Flags
    student_status ENUM('In Roll', 'Detained', 'Left out') DEFAULT 'In Roll',
    is_detainee BOOLEAN DEFAULT FALSE,
    is_transitory BOOLEAN DEFAULT FALSE,
    is_handicapped BOOLEAN DEFAULT FALSE,
    is_lateral BOOLEAN DEFAULT FALSE,
    join_curriculum BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    
    -- Photo
    photo_url VARCHAR(500),
    
    -- Soft Delete
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (programme_id) REFERENCES programme_master(programme_id),
    FOREIGN KEY (branch_id) REFERENCES branch_master(branch_id),
    FOREIGN KEY (batch_id) REFERENCES batch_master(batch_id),
    FOREIGN KEY (semester_id) REFERENCES semester_master(semester_id),
    FOREIGN KEY (section_id) REFERENCES section_master(section_id),
    FOREIGN KEY (regulation_id) REFERENCES regulation_master(regulation_id),
    
    -- Indexes
    INDEX idx_admission_number (admission_number),
    INDEX idx_roll_number (roll_number),
    INDEX idx_student_status (student_status),
    INDEX idx_is_active (is_active),
    INDEX idx_programme_branch (programme_id, branch_id),
    INDEX idx_batch_semester (batch_id, semester_id)
);
```

## User Interface

### Main Page Layout

```
+------------------------------------------------------------------+
|  Student Management Header                                        |
+------------------------------------------------------------------+
|  Statistics:                                                      |
|  [👥 Total: 191] [👨‍🎓 Boys: 98] [👩‍🎓 Girls: 93]                |
|  [✅ In Roll: 180] [⚠️ Detained: 8] [❌ Left Out: 3]             |
+------------------------------------------------------------------+
|  🔍 Filter Students                                              |
|  Programme: [▼] Branch: [▼] Batch: [▼] Semester: [▼]           |
|  Status: [▼] Gender: [▼] Search: [____________]                  |
|  [🔍 Apply Filters] [🔄 Clear Filters]                           |
+------------------------------------------------------------------+
|  Student List                                                     |
|  [➕ Add New Student] [📊 Export to Excel] [📥 Import]          |
|                                                                   |
|  SNO | 📷 | Admn No | Name | Gender | Branch | Batch | Actions   |
|  1   | 🖼️ | B21CS001| ...  | Male   | CSE    | 2021  | [✏️][🗑️] |
+------------------------------------------------------------------+
```

### Add/Edit Student Modal

The modal is organized into collapsible sections:

1. **📋 Basic Information**
   - Admission Number, HT Number, Roll Number, Full Name

2. **🎓 Academic Information**
   - Programme, Branch, Batch, Semester, Section, Regulation

3. **👤 Personal Information**
   - DOB, Gender, Father's Name, Mother's Name, Aadhaar, Caste Category

4. **📞 Contact Information**
   - Student Mobile, Parent Mobile, Email

5. **📅 Enrollment Information**
   - Admission Date, Completion Year, Date of Leaving, Discontinue Date, Student Status

6. **⚙️ Additional Attributes**
   - Checkboxes for all special flags

7. **📷 Student Photo**
   - Photo upload with preview

### Form Actions
- **💾 Save Student**: Create or update
- **🔄 Reset**: Clear all fields
- **❌ Cancel**: Close modal

## Security Features

### Input Validation
- Server-side validation for all fields
- XSS prevention with HTML escaping
- SQL injection prevention with parameterized queries
- File type validation for uploads
- File size limits enforced

### Data Protection
- Soft delete preserves audit trail
- Timestamps track all changes
- Foreign key constraints maintain referential integrity
- Unique constraints prevent duplicates

## Error Handling

### Validation Errors
- Clear error messages for each field
- Highlights invalid fields in red
- Prevents form submission until corrected

### API Errors
- Graceful error handling
- User-friendly error messages
- Automatic retry for network failures
- Loading states during operations

## Future Enhancements

1. **Excel Import**: Complete implementation with validation
2. **Bulk Edit**: Edit multiple students at once
3. **Photo Thumbnails**: Automatic thumbnail generation
4. **Advanced Search**: Full-text search across all fields
5. **Export Templates**: Customizable export columns
6. **Attendance Integration**: Link with attendance module
7. **Grade Management**: Link with grades module
8. **Reports**: Various analytical reports
9. **Audit Logs**: Track all changes to student records
10. **Email Notifications**: Automatic emails for status changes

## Dependencies

### Backend
- `express`: Web framework (5.2.1)
- `mysql2`: Database driver (3.16.3)
- `multer`: File upload handling (**2.0.2** - patched for DoS vulnerabilities)
- `exceljs`: Excel file generation (4.4.0)
- `dotenv`: Environment configuration (17.2.3)
- `cors`: Cross-origin resource sharing (2.8.6)

### Frontend
- Native JavaScript (ES6+)
- CSS3 with Flexbox/Grid
- No external frameworks (lightweight)

## File Structure

```
/home/runner/work/Kitsw_Sairam/Kitsw_Sairam/
├── server.js                          # Main server file with multer config
├── db/
│   └── init.js                        # Database initialization
├── routes/
│   └── students.js                    # Student API routes
├── uploads/
│   └── students/                      # Student photos
├── student-management.html            # Main UI
└── js/
    └── student-management.js          # Frontend logic
```

## Testing Checklist

- [ ] Create new student with all fields
- [ ] Create new student with only required fields
- [ ] Upload student photo
- [ ] Edit student details
- [ ] Delete student (soft delete)
- [ ] Restore deleted student
- [ ] Filter students by programme
- [ ] Filter students by branch
- [ ] Filter students by batch
- [ ] Filter students by semester
- [ ] Filter students by status
- [ ] Filter students by gender
- [ ] Search students by name
- [ ] Search students by admission number
- [ ] View statistics (Boys/Girls/Total)
- [ ] Export students to Excel
- [ ] Import students from Excel
- [ ] Lock individual student
- [ ] Bulk lock students by batch
- [ ] Verify default status = 'In Roll'
- [ ] Test mobile number validation (10 digits)
- [ ] Test Aadhaar validation (12 digits)
- [ ] Test email validation
- [ ] Test photo upload size limit (2MB)
- [ ] Test photo upload file type (JPEG/PNG only)
- [ ] Test unique admission number constraint
- [ ] Test responsive design on mobile

## Maintenance

### Regular Tasks
- Monitor photo storage space
- Archive old student records
- Backup database regularly
- Review and update validation rules
- Check for orphaned photos
- Optimize database queries

### Performance Tips
- Use indexes for frequently queried fields
- Implement pagination for large datasets
- Cache statistics for better performance
- Compress uploaded photos
- Use CDN for photo delivery

## Support

For issues or questions:
1. Check this documentation first
2. Review the code comments
3. Check the console for error messages
4. Contact the development team

## License

Proprietary - Engineering College Management System
