// Student Routes - Comprehensive Implementation
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// Create a promise pool for database operations
let promisePool;

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all students with filters and statistics
router.get('/', async (req, res) => {
    try {
        const { 
            programme_id, 
            branch_id, 
            batch_id, 
            semester_id, 
            section_id, 
            student_status,
            search 
        } = req.query;
        
        let query = `
            SELECT s.*, 
                   p.programme_name, p.programme_code,
                   b.branch_name, b.branch_code,
                   bat.batch_name, 
                   sem.semester_name,
                   sec.section_name
            FROM student_master s
            LEFT JOIN programme_master p ON s.programme_id = p.programme_id AND p.is_active = 1
            LEFT JOIN branch_master b ON s.branch_id = b.branch_id AND b.is_active = 1
            LEFT JOIN batch_master bat ON s.batch_id = bat.batch_id AND bat.is_active = 1
            LEFT JOIN semester_master sem ON s.semester_id = sem.semester_id AND sem.is_active = 1
            LEFT JOIN section_master sec ON s.section_id = sec.section_id AND sec.is_active = 1
            WHERE s.is_active = 1
        `;
        
        const params = [];
        
        // Apply filters
        if (programme_id) {
            query += ' AND s.programme_id = ?';
            params.push(programme_id);
        }
        
        if (branch_id) {
            query += ' AND s.branch_id = ?';
            params.push(branch_id);
        }
        
        if (batch_id) {
            query += ' AND s.batch_id = ?';
            params.push(batch_id);
        }
        
        if (semester_id) {
            query += ' AND s.semester_id = ?';
            params.push(semester_id);
        }
        
        if (section_id) {
            query += ' AND s.section_id = ?';
            params.push(section_id);
        }
        
        if (student_status) {
            query += ' AND s.student_status = ?';
            params.push(student_status);
        }
        
        if (search) {
            query += ' AND (s.full_name LIKE ? OR s.admission_number LIKE ? OR s.roll_number LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        query += ' ORDER BY s.admission_number';
        
        const [students] = await promisePool.query(query, params);
        
        // Calculate statistics
        const statistics = {
            total: students.length,
            boys: students.filter(s => s.gender === 'Male').length,
            girls: students.filter(s => s.gender === 'Female').length,
            in_roll: students.filter(s => s.student_status === 'In Roll').length,
            detained: students.filter(s => s.student_status === 'Detained').length,
            left_out: students.filter(s => s.student_status === 'Left out').length
        };
        
        res.json({
            status: 'success',
            message: 'Students retrieved successfully',
            data: {
                students: students,
                statistics: statistics
            }
        });
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch students',
            error: error.message
        });
    }
});

// GET /api/students/sample-excel - Generate sample Excel template (MUST BE BEFORE /:id ROUTE)
router.get('/sample-excel', async (req, res) => {
    try {
        console.log('=== GENERATE SAMPLE EXCEL TEMPLATE ===');
        
        // Get current filter values to populate header
        const { programme_id, branch_id, batch_id, semester_id, regulation_id } = req.query;
        
        let batchName = '2025-2026';
        let programmeName = 'B.Tech';
        let branchName = 'CSE';
        let semesterName = 'I';
        let regulationCode = '';
        
        // Fetch actual values if provided
        if (batch_id) {
            const [batches] = await promisePool.query(
                'SELECT batch_name FROM batch_master WHERE batch_id = ? AND is_active = 1',
                [batch_id]
            );
            if (batches.length > 0) batchName = batches[0].batch_name;
        }
        
        if (programme_id) {
            const [programmes] = await promisePool.query(
                'SELECT programme_code FROM programme_master WHERE programme_id = ? AND is_active = 1',
                [programme_id]
            );
            if (programmes.length > 0) programmeName = programmes[0].programme_code;
        }
        
        if (branch_id) {
            const [branches] = await promisePool.query(
                'SELECT branch_code FROM branch_master WHERE branch_id = ? AND is_active = 1',
                [branch_id]
            );
            if (branches.length > 0) branchName = branches[0].branch_code;
        }
        
        if (semester_id) {
            const [semesters] = await promisePool.query(
                'SELECT semester_name FROM semester_master WHERE semester_id = ? AND is_active = 1',
                [semester_id]
            );
            if (semesters.length > 0) semesterName = semesters[0].semester_name;
        }
        
        // Fetch regulation if provided
        if (regulation_id) {
            const [regulations] = await promisePool.query(
                'SELECT regulation_name FROM regulation_master WHERE regulation_id = ? AND is_active = 1',
                [regulation_id]
            );
            if (regulations.length > 0) regulationCode = regulations[0].regulation_name;
        }
        
        // Build CSV content
        let csv = '';
        
        // Metadata Section (Rows 1-5, Row 6 is empty)
        csv += `Batch,${batchName}\n`;
        csv += `Programme,${programmeName}\n`;
        csv += `Branch,${branchName}\n`;
        csv += `Semester,${semesterName}\n`;
        csv += `Regulation,${regulationCode}\n`;
        csv += '\n'; // Empty line (Row 6)
        
        // Column Headers (Row 7)
        const headers = [
            'Admission Number',
            'HT Number',
            'Roll Number',
            'Full Name',
            'Date of Birth (DD/MM/YYYY)',
            'Gender (Male/Female/Other)',
            'Father Name',
            'Mother Name',
            'Aadhaar Number',
            'Caste Category',
            'Student Mobile',
            'Parent Mobile',
            'Email',
            'Admission Date (DD/MM/YYYY)',
            'Completion Year',
            'Student Status (In Roll/Detained/Left out)',
            'Section',
            'Detainee (Yes/No)',
            'Lateral (Yes/No)',
            'Handicapped (Yes/No)',
            'Transitory (Yes/No)'
        ];
        csv += headers.join(',') + '\n';
        
        // Sample Data (Row 8)
        const sampleRow = [
            'B25AI001',
            'HT12345',
            '101',
            'SAIRAM',
            '15/01/2005',
            'Male',
            'HANUMAN',
            'SATHYA SAI',
            '123456789012',
            'OC',
            '9000000000',
            '9000000000',
            'sairam@example.com',
            '15/06/2025',
            '2029',
            'In Roll',
            'A',
            'No',
            'No',
            'No',
            'No'
        ];
        csv += sampleRow.map(val => `"${val}"`).join(',') + '\n';
        
        // Add one more sample row
        const sampleRow2 = [
            'B25AI002',
            'HT12346',
            '102',
            'KRISHNA',
            '20/02/2005',
            'Female',
            'RAMA',
            'SITA',
            '123456789013',
            'BC',
            '9000000001',
            '9000000001',
            'krishna@example.com',
            '15/06/2025',
            '2029',
            'In Roll',
            'A',
            'No',
            'Yes',
            'No',
            'No'
        ];
        csv += sampleRow2.map(val => `"${val}"`).join(',') + '\n';
        
        console.log('Sample Excel template generated successfully');
        
        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=student_import_template_${Date.now()}.csv`);
        res.send(csv);
        
    } catch (error) {
        console.error('=== SAMPLE EXCEL GENERATION ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate sample Excel template',
            error: error.message
        });
    }
});

// GET single student by ID
// GET /api/students/:id - Get single student details
router.get('/:id', async (req, res) => {
    try {
        console.log('=== GET STUDENT DETAILS ===');
        console.log('Student ID:', req.params.id);
        
        // Step 1: Get base student data without JOINs (safer)
        const studentQuery = `
            SELECT * 
            FROM student_master 
            WHERE student_id = ? AND is_active = 1
        `;
        
        const [students] = await promisePool.query(studentQuery, [req.params.id]);
        
        if (students.length === 0) {
            console.log('Student not found with ID:', req.params.id);
            return res.status(404).json({
                status: 'error',
                message: 'Student not found'
            });
        }
        
        const student = students[0];
        console.log('Student found:', student.admission_number);
        
        // Step 2: Fetch programme details (if exists)
        if (student.programme_id) {
            try {
                const [programme] = await promisePool.query(
                    'SELECT programme_code, programme_name FROM programme_master WHERE programme_id = ?',
                    [student.programme_id]
                );
                if (programme.length > 0) {
                    student.programme_name = programme[0].programme_name;
                    student.programme_code = programme[0].programme_code;
                }
            } catch (err) {
                console.log('Could not fetch programme:', err.message);
            }
        }
        
        // Step 3: Fetch branch details (if exists)
        if (student.branch_id) {
            try {
                const [branch] = await promisePool.query(
                    'SELECT branch_code, branch_name FROM branch_master WHERE branch_id = ?',
                    [student.branch_id]
                );
                if (branch.length > 0) {
                    student.branch_name = branch[0].branch_name;
                    student.branch_code = branch[0].branch_code;
                }
            } catch (err) {
                console.log('Could not fetch branch:', err.message);
            }
        }
        
        // Step 4: Fetch batch details (if exists)
        if (student.batch_id) {
            try {
                const [batch] = await promisePool.query(
                    'SELECT batch_name FROM batch_master WHERE batch_id = ?',
                    [student.batch_id]
                );
                if (batch.length > 0) {
                    student.batch_name = batch[0].batch_name;
                }
            } catch (err) {
                console.log('Could not fetch batch:', err.message);
            }
        }
        
        // Step 5: Fetch semester details (if exists)
        if (student.semester_id) {
            try {
                const [semester] = await promisePool.query(
                    'SELECT semester_name FROM semester_master WHERE semester_id = ?',
                    [student.semester_id]
                );
                if (semester.length > 0) {
                    student.semester_name = semester[0].semester_name;
                }
            } catch (err) {
                console.log('Could not fetch semester:', err.message);
            }
        }
        
        // Step 6: Fetch section details (if exists)
        if (student.section_id) {
            try {
                const [section] = await promisePool.query(
                    'SELECT section_name FROM section_master WHERE section_id = ?',
                    [student.section_id]
                );
                if (section.length > 0) {
                    student.section_name = section[0].section_name;
                }
            } catch (err) {
                console.log('Could not fetch section:', err.message);
            }
        }
        
        // Step 7: Fetch joining regulation (if exists)
        if (student.joining_regulation_id) {
            try {
                const [joiningReg] = await promisePool.query(
                    'SELECT regulation_name, regulation_year, description FROM regulation_master WHERE regulation_id = ? AND is_active = 1',
                    [student.joining_regulation_id]
                );
                if (joiningReg.length > 0) {
                    student.joining_regulation = joiningReg[0].regulation_name;  // ✅ Changed from regulation_code
                    student.joining_regulation_name = joiningReg[0].regulation_name;
                    student.joining_regulation_year = joiningReg[0].regulation_year;
                    console.log('Joining regulation:', student.joining_regulation);
                } else {
                    console.log('Joining regulation ID exists but not found in regulation_master');
                    student.joining_regulation = 'Not Set';
                    student.joining_regulation_name = '';
                }
            } catch (err) {
                console.log('Could not fetch joining regulation:', err.message);
                student.joining_regulation = 'Not Set';
                student.joining_regulation_name = '';
            }
        } else {
            student.joining_regulation = 'Not Set';
            student.joining_regulation_name = '';
        }
        
        // Step 8: Fetch current regulation (if exists)
        if (student.current_regulation_id) {
            try {
                const [currentReg] = await promisePool.query(
                    'SELECT regulation_name, regulation_year, description FROM regulation_master WHERE regulation_id = ? AND is_active = 1',
                    [student.current_regulation_id]
                );
                if (currentReg.length > 0) {
                    student.current_regulation = currentReg[0].regulation_name;  // ✅ Changed from regulation_code
                    student.current_regulation_name = currentReg[0].regulation_name;
                    student.current_regulation_year = currentReg[0].regulation_year;
                    console.log('Current regulation:', student.current_regulation);
                } else {
                    console.log('Current regulation ID exists but not found in regulation_master');
                    student.current_regulation = 'Not Set';
                    student.current_regulation_name = '';
                }
            } catch (err) {
                console.log('Could not fetch current regulation:', err.message);
                student.current_regulation = 'Not Set';
                student.current_regulation_name = '';
            }
        } else {
            student.current_regulation = 'Not Set';
            student.current_regulation_name = '';
        }
        
        console.log('Student details prepared successfully');
        
        // Return in expected format
        res.json({
            status: 'success',
            message: 'Student retrieved successfully',
            data: student
        });
        
    } catch (error) {
        console.error('=== GET STUDENT DETAILS ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('SQL:', error.sql);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch student details',
            error: error.message
        });
    }
});

// POST create new student
router.post('/', async (req, res) => {
    try {
        const { 
            admission_number,
            ht_number,
            roll_number,
            full_name,
            programme_id,
            branch_id,
            batch_id,
            semester_id,
            section_id,
            regulation_id,
            date_of_birth,
            gender,
            father_name,
            mother_name,
            aadhaar_number,
            caste_category,
            student_mobile,
            parent_mobile,
            email,
            admission_date,
            completion_year,
            date_of_leaving,
            discontinue_date,
            student_status,
            is_detainee,
            is_transitory,
            is_handicapped,
            is_lateral,
            join_curriculum,
            is_locked
        } = req.body;
        
        // Validation
        if (!admission_number || !full_name || !gender) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: admission_number, full_name, gender'
            });
        }
        
        if (!programme_id || !branch_id || !batch_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: programme_id, branch_id, batch_id'
            });
        }
        
        // Validate mobile numbers (10 digits)
        if (student_mobile && !/^\d{10}$/.test(student_mobile)) {
            return res.status(400).json({
                status: 'error',
                message: 'Student mobile must be 10 digits'
            });
        }
        
        if (parent_mobile && !/^\d{10}$/.test(parent_mobile)) {
            return res.status(400).json({
                status: 'error',
                message: 'Parent mobile must be 10 digits'
            });
        }
        
        // Validate Aadhaar (12 digits)
        if (aadhaar_number && !/^\d{12}$/.test(aadhaar_number)) {
            return res.status(400).json({
                status: 'error',
                message: 'Aadhaar number must be 12 digits'
            });
        }
        
        // Validate email format
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }
        
        // Check if admission number already exists
        const [existing] = await promisePool.query(
            'SELECT student_id FROM student_master WHERE admission_number = ?',
            [admission_number]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'Admission number already exists'
            });
        }
        
        // Insert new student
        const [result] = await promisePool.query(
            `INSERT INTO student_master 
            (admission_number, ht_number, roll_number, full_name, 
             programme_id, branch_id, batch_id, semester_id, section_id, regulation_id,
             date_of_birth, gender, father_name, mother_name, aadhaar_number, caste_category,
             student_mobile, parent_mobile, email, admission_date, completion_year,
             date_of_leaving, discontinue_date, student_status,
             is_detainee, is_transitory, is_handicapped, is_lateral, join_curriculum, is_locked) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                admission_number,
                ht_number || null,
                roll_number || null,
                full_name,
                programme_id,
                branch_id,
                batch_id,
                semester_id || null,
                section_id || null,
                regulation_id || null,
                date_of_birth || null,
                gender,
                father_name || null,
                mother_name || null,
                aadhaar_number || null,
                caste_category || null,
                student_mobile || null,
                parent_mobile || null,
                email || null,
                admission_date || null,
                completion_year || null,
                date_of_leaving || null,
                discontinue_date || null,
                student_status || 'In Roll',
                is_detainee || false,
                is_transitory || false,
                is_handicapped || false,
                is_lateral || false,
                join_curriculum || false,
                is_locked || false
            ]
        );
        
        res.status(201).json({
            status: 'success',
            message: 'Student created successfully',
            data: {
                student_id: result.insertId,
                admission_number,
                full_name
            }
        });
    } catch (error) {
        console.error('Error creating student:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create student',
            error: error.message
        });
    }
});

// GET student status from student_semester_history
router.get('/:id/semester-status', async (req, res) => {
    try {
        const studentId = req.params.id;
        const { semester_id } = req.query;
        
        let query = `
            SELECT ssh.student_status, ssh.semester_id, 
                   s.semester_name, ssh.academic_year
            FROM student_semester_history ssh
            LEFT JOIN semester_master s ON ssh.semester_id = s.semester_id
            WHERE ssh.student_id = ?
        `;
        let params = [studentId];
        
        if (semester_id) {
            query += ' AND ssh.semester_id = ?';
            params.push(semester_id);
        }
        
        query += ' ORDER BY ssh.semester_id DESC';
        
        const [statusHistory] = await promisePool.query(query, params);
        
        res.json({
            status: 'success',
            message: 'Student status history retrieved successfully',
            data: statusHistory
        });
    } catch (error) {
        console.error('Error fetching student status history:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch student status history',
            error: error.message
        });
    }
});

// PUT update student
// PUT /api/students/:id - Update student (COMPLETE WORKING VERSION)
router.put('/:id', async (req, res) => {
    let connection;
    
    try {
        connection = await promisePool.getConnection();
        const studentId = req.params.id;
        
        console.log('='.repeat(80));
        console.log('=== UPDATE STUDENT REQUEST ===');
        console.log('='.repeat(80));
        console.log('Student ID:', studentId);
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
        
        // Validate student exists
        const [existing] = await connection.query(
            'SELECT student_id, admission_number FROM student_master WHERE student_id = ? AND is_active = 1',
            [studentId]
        );
        
        if (existing.length === 0) {
            console.error('❌ Student not found:', studentId);
            connection.release();
            return res.status(404).json({
                status: 'error',
                message: 'Student not found',
                error: `No active student with ID ${studentId}`
            });
        }
        
        console.log('✅ Student exists:', existing[0].admission_number);
        
        // Extract all fields
        const {
            admission_number,
            ht_number,
            roll_number,
            full_name,
            date_of_birth,
            gender,
            caste_category,
            father_name,
            mother_name,
            aadhaar_number,
            student_mobile,
            parent_mobile,
            email,
            programme_id,
            branch_id,
            batch_id,
            semester_id,
            joining_regulation_id,
            current_regulation_id,
            section_id,
            admission_date,
            completion_year,
            date_of_leaving,
            discontinue_date,
            student_status,
            is_detainee,
            is_transitory,
            is_handicapped,
            is_lateral,
            join_curriculum,
            is_locked
        } = req.body;
        
        // Validate required fields
        if (!admission_number || admission_number.trim() === '') {
            console.error('❌ Validation: admission_number required');
            connection.release();
            return res.status(400).json({
                status: 'error',
                message: 'Admission Number is required',
                error: 'admission_number cannot be empty'
            });
        }
        
        if (!full_name || full_name.trim() === '') {
            console.error('❌ Validation: full_name required');
            connection.release();
            return res.status(400).json({
                status: 'error',
                message: 'Full Name is required',
                error: 'full_name cannot be empty'
            });
        }
        
        // Helper to convert empty strings and undefined to null
        const toNull = (value) => {
            if (value === undefined || value === null || value === '') {
                return null;
            }
            if (typeof value === 'string') {
                return value.trim();
            }
            return value;
        };
        
        // Helper to convert to boolean 0/1
        const toBool = (value) => {
            if (value === true || value === 1 || value === '1' || value === 'true') {
                return 1;
            }
            return 0;
        };
        
        // Prepare update values
        const updateValues = [
            admission_number.trim(),
            toNull(ht_number),
            toNull(roll_number),
            full_name.trim(),
            toNull(date_of_birth),
            toNull(gender),
            toNull(caste_category),
            toNull(father_name),
            toNull(mother_name),
            toNull(aadhaar_number),
            toNull(student_mobile),
            toNull(parent_mobile),
            toNull(email),
            toNull(programme_id),
            toNull(branch_id),
            toNull(batch_id),
            toNull(semester_id),
            toNull(joining_regulation_id),
            toNull(current_regulation_id),
            toNull(section_id),
            toNull(admission_date),
            toNull(completion_year),
            toNull(date_of_leaving),
            toNull(discontinue_date),
            student_status || 'In Roll',
            toBool(is_detainee),
            toBool(is_transitory),
            toBool(is_handicapped),
            toBool(is_lateral),
            toBool(join_curriculum),
            toBool(is_locked),
            studentId
        ];
        
        console.log('Update values:', updateValues);
        
        // Execute UPDATE query
        const updateSQL = `
            UPDATE student_master 
            SET 
                admission_number = ?,
                ht_number = ?,
                roll_number = ?,
                full_name = ?,
                date_of_birth = ?,
                gender = ?,
                caste_category = ?,
                father_name = ?,
                mother_name = ?,
                aadhaar_number = ?,
                student_mobile = ?,
                parent_mobile = ?,
                email = ?,
                programme_id = ?,
                branch_id = ?,
                batch_id = ?,
                semester_id = ?,
                joining_regulation_id = ?,
                current_regulation_id = ?,
                section_id = ?,
                admission_date = ?,
                completion_year = ?,
                date_of_leaving = ?,
                discontinue_date = ?,
                student_status = ?,
                is_detainee = ?,
                is_transitory = ?,
                is_handicapped = ?,
                is_lateral = ?,
                join_curriculum = ?,
                is_locked = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ? AND is_active = 1
        `;
        
        console.log('Executing UPDATE query...');
        
        const [result] = await connection.query(updateSQL, updateValues);
        
        console.log('Update result:', {
            affectedRows: result.affectedRows,
            changedRows: result.changedRows,
            warningCount: result.warningCount
        });
        
        // Also update student_semester_history if status changed
        if (student_status) {
            const currentSemesterId = req.body.semester_id || 1; // Default to semester 1 if not provided
            const academicYear = new Date().getFullYear();
            
            // First check if semester history record exists
            const [existingRecord] = await connection.query(
                'SELECT semester_history_id FROM student_semester_history WHERE student_id = ? AND semester_id = ?',
                [studentId, currentSemesterId]
            );
            
            if (existingRecord.length > 0) {
                // Update existing record
                const updateSemesterSQL = `
                    UPDATE student_semester_history 
                    SET student_status = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE student_id = ? AND semester_id = ?
                `;
                
                const [semesterResult] = await connection.query(updateSemesterSQL, [
                    student_status,
                    studentId,
                    currentSemesterId
                ]);
                
                console.log('Semester history update result:', {
                    affectedRows: semesterResult.affectedRows,
                    changedRows: semesterResult.changedRows
                });
            } else {
                // Insert new record if it doesn't exist
                const insertSemesterSQL = `
                    INSERT INTO student_semester_history 
                    (student_id, academic_year, semester_id, programme_id, branch_id, batch_id, regulation_id, section_id, student_status, status_date, created_at, updated_at)
                    SELECT ?, ?, ?, programme_id, branch_id, batch_id, regulation_id, ?, ?, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    FROM student_master WHERE student_id = ?
                `;
                
                const [insertResult] = await connection.query(insertSemesterSQL, [
                    studentId,
                    academicYear,
                    currentSemesterId,
                    req.body.section_id || null,
                    student_status,
                    studentId
                ]);
                
                console.log('Semester history insert result:', {
                    insertId: insertResult.insertId,
                    affectedRows: insertResult.affectedRows
                });
            }
        }
        
        connection.release();
        
        if (result.affectedRows === 0) {
            console.warn('⚠️ No rows affected - student may not exist or no changes');
            return res.status(404).json({
                status: 'error',
                message: 'Student not found or no changes made',
                error: 'No rows were affected by the update'
            });
        }
        
        console.log('✅ Student updated successfully');
        console.log('='.repeat(80));
        
        res.json({
            status: 'success',
            message: 'Student updated successfully',
            data: {
                student_id: studentId,
                affected_rows: result.affectedRows,
                changed_rows: result.changedRows
            }
        });
        
    } catch (error) {
        if (connection) {
            connection.release();
        }
        
        console.error('='.repeat(80));
        console.error('=== UPDATE STUDENT ERROR ===');
        console.error('='.repeat(80));
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error errno:', error.errno);
        console.error('Error sqlState:', error.sqlState);
        console.error('Error sqlMessage:', error.sqlMessage);
        console.error('Error sql:', error.sql);
        console.error('Stack trace:', error.stack);
        console.error('='.repeat(80));
        
        // Return detailed error to frontend
        res.status(500).json({
            status: 'error',
            message: 'Failed to update student',
            error: error.sqlMessage || error.message || 'Unknown database error',
            errorCode: error.code,
            errorErrno: error.errno,
            errorSqlState: error.sqlState
        });
    }
});

// DELETE student (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if student exists and is active
        const [existing] = await promisePool.query(
            'SELECT * FROM student_master WHERE student_id = ? AND is_active = 1',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Student not found or already deleted'
            });
        }
        
        // Soft delete: Set is_active = 0 and deleted_at = NOW()
        await promisePool.query(
            'UPDATE student_master SET is_active = 0, deleted_at = NOW() WHERE student_id = ?',
            [id]
        );
        
        res.json({
            status: 'success',
            message: 'Student deleted successfully (can be restored)'
        });
    } catch (error) {
        console.error('Error soft deleting student:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete student',
            error: error.message
        });
    }
});

// POST restore deleted student
router.post('/:id/restore', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if student exists and is deleted
        const [existing] = await promisePool.query(
            'SELECT * FROM student_master WHERE student_id = ? AND is_active = 0',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Student not found or not deleted'
            });
        }
        
        // Restore: Set is_active = 1 and deleted_at = NULL
        await promisePool.query(
            'UPDATE student_master SET is_active = 1, deleted_at = NULL WHERE student_id = ?',
            [id]
        );
        
        res.json({
            status: 'success',
            message: 'Student restored successfully'
        });
    } catch (error) {
        console.error('Error restoring student:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to restore student',
            error: error.message
        });
    }
});

// POST bulk lock students by batch
router.post('/bulk-lock', async (req, res) => {
    try {
        const { batch_id } = req.body;
        
        if (!batch_id) {
            return res.status(400).json({
                status: 'error',
                message: 'batch_id is required'
            });
        }
        
        // Lock all students in the batch
        const [result] = await promisePool.query(
            'UPDATE student_master SET is_locked = 1 WHERE batch_id = ? AND is_active = 1',
            [batch_id]
        );
        
        res.json({
            status: 'success',
            message: `Locked ${result.affectedRows} students in the batch`
        });
    } catch (error) {
        console.error('Error bulk locking students:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to bulk lock students',
            error: error.message
        });
    }
});

// Configure multer for single photo upload
const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/students');
        // Use mkdirSync with recursive option which is safe for concurrent calls
        // The recursive option ensures directory creation is idempotent
        try {
            fs.mkdirSync(uploadDir, { recursive: true });
        } catch (err) {
            // Ignore EEXIST errors as directory already exists
            if (err.code !== 'EEXIST') {
                return cb(err);
            }
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const studentId = req.params.id;
        const ext = path.extname(file.originalname);
        const filename = `${studentId}_${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const uploadPhoto = multer({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, JPEG, and PNG files are allowed'));
        }
    }
});

// POST /api/students/:id/upload-photo - Upload single photo
router.post('/:id/upload-photo', uploadPhoto.single('photo'), async (req, res) => {
    try {
        const studentId = req.params.id;
        
        console.log('=== UPLOAD PHOTO ===');
        console.log('Student ID:', studentId);
        console.log('File:', req.file);
        
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No photo file uploaded'
            });
        }
        
        // Get old photo URL to delete old file
        const [student] = await promisePool.query(
            'SELECT photo_url FROM student_master WHERE student_id = ?',
            [studentId]
        );
        
        if (student.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Student not found'
            });
        }
        
        const oldPhotoUrl = student[0]?.photo_url;
        
        // Update photo_url in database
        const photoUrl = `/uploads/students/${req.file.filename}`;
        await promisePool.query(
            'UPDATE student_master SET photo_url = ? WHERE student_id = ?',
            [photoUrl, studentId]
        );
        
        // Delete old photo file if exists
        // Fire-and-forget cleanup: New photo is already uploaded and DB updated
        // Old photo deletion is best-effort cleanup, doesn't block response
        // Note: Consider implementing periodic cleanup job for orphaned files
        if (oldPhotoUrl) {
            const oldPhotoPath = path.join(__dirname, '..', oldPhotoUrl);
            fs.promises.unlink(oldPhotoPath)
                .then(() => console.log('Deleted old photo:', oldPhotoPath))
                .catch(err => {
                    // Only log error if it's not "file not found"
                    if (err.code !== 'ENOENT') {
                        console.error('Error deleting old photo:', err);
                        // TODO: Log to monitoring system for cleanup tracking
                    }
                });
        }
        
        console.log('Photo uploaded successfully:', photoUrl);
        
        res.json({
            status: 'success',
            message: 'Photo uploaded successfully',
            data: { photo_url: photoUrl }
        });
        
    } catch (error) {
        console.error('=== UPLOAD PHOTO ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to upload photo',
            error: error.message
        });
    }
});

// DELETE /api/students/:id/remove-photo - Remove student photo
router.delete('/:id/remove-photo', async (req, res) => {
    try {
        const studentId = req.params.id;
        
        console.log('=== REMOVE PHOTO ===');
        console.log('Student ID:', studentId);
        
        // Get current photo URL
        const [student] = await promisePool.query(
            'SELECT photo_url FROM student_master WHERE student_id = ? AND is_active = 1',
            [studentId]
        );
        
        if (student.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Student not found'
            });
        }
        
        const photoUrl = student[0].photo_url;
        
        // Clear photo_url in database
        await promisePool.query(
            'UPDATE student_master SET photo_url = NULL WHERE student_id = ?',
            [studentId]
        );
        
        // Delete physical file if exists
        // Await deletion for remove operation as it's the primary action
        if (photoUrl) {
            const photoPath = path.join(__dirname, '..', photoUrl);
            try {
                await fs.promises.unlink(photoPath);
                console.log('Deleted photo file:', photoPath);
            } catch (err) {
                // Only log error if it's not "file not found"
                if (err.code !== 'ENOENT') {
                    console.error('Error deleting photo file:', err);
                    // Don't fail the request if file deletion fails
                    // Database is already updated
                }
            }
        }
        
        console.log('Photo removed successfully');
        
        res.json({
            status: 'success',
            message: 'Photo removed successfully'
        });
        
    } catch (error) {
        console.error('=== REMOVE PHOTO ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to remove photo',
            error: error.message
        });
    }
});

// GET export students to Excel
router.get('/export/excel', async (req, res) => {
    try {
        console.log('=== EXCEL EXPORT REQUEST ===');
        
        // Build query with filters
        const { programme_id, branch_id, batch_id, semester_id, student_status, search } = req.query;
        
        let query = `
            SELECT 
                s.student_id,
                s.admission_number,
                s.ht_number,
                s.roll_number,
                s.full_name,
                s.date_of_birth,
                s.gender,
                s.father_name,
                s.mother_name,
                s.student_mobile,
                s.parent_mobile,
                s.email,
                s.aadhaar_number,
                s.caste_category,
                s.admission_date,
                s.completion_year,
                s.student_status,
                COALESCE(p.programme_code, '-') as programme_name,  -- Using code, aliased as name for backward compatibility
                COALESCE(b.branch_code, '-') as branch_name,        -- Using code, aliased as name for backward compatibility
                COALESCE(bat.batch_name, '-') as batch_name,
                COALESCE(sem.semester_name, '-') as semester_name,
                COALESCE(sec.section_name, '-') as section_name,
                COALESCE(jr.regulation_name, '-') as joining_regulation,  -- ✅ Use regulation_name
                COALESCE(cr.regulation_name, '-') as current_regulation,  -- ✅ Use regulation_name
                s.is_detainee,
                s.is_lateral,
                s.is_handicapped,
                s.is_transitory
            FROM student_master s
            LEFT JOIN programme_master p ON s.programme_id = p.programme_id AND p.is_active = 1
            LEFT JOIN branch_master b ON s.branch_id = b.branch_id AND b.is_active = 1
            LEFT JOIN batch_master bat ON s.batch_id = bat.batch_id AND bat.is_active = 1
            LEFT JOIN semester_master sem ON s.semester_id = sem.semester_id AND sem.is_active = 1
            LEFT JOIN section_master sec ON s.section_id = sec.section_id AND sec.is_active = 1
            LEFT JOIN regulation_master jr ON s.joining_regulation_id = jr.regulation_id AND jr.is_active = 1  -- ✅ Correct JOIN
            LEFT JOIN regulation_master cr ON s.current_regulation_id = cr.regulation_id AND cr.is_active = 1  -- ✅ Correct JOIN
            WHERE s.is_active = 1
        `;
        
        const params = [];
        
        // Apply filters
        if (programme_id) {
            query += ' AND s.programme_id = ?';
            params.push(programme_id);
        }
        if (branch_id) {
            query += ' AND s.branch_id = ?';
            params.push(branch_id);
        }
        if (batch_id) {
            query += ' AND s.batch_id = ?';
            params.push(batch_id);
        }
        if (semester_id) {
            query += ' AND s.semester_id = ?';
            params.push(semester_id);
        }
        if (student_status) {
            query += ' AND s.student_status = ?';
            params.push(student_status);
        }
        if (search) {
            query += ' AND (s.full_name LIKE ? OR s.admission_number LIKE ? OR s.roll_number LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        query += ' ORDER BY s.admission_number';
        
        console.log('Export query:', query);
        console.log('Export params:', params);
        
        const [students] = await promisePool.query(query, params);
        
        console.log(`Found ${students.length} students to export`);
        
        if (students.length === 0) {
            return res.json({
                status: 'success',
                message: 'No students found to export',
                data: []
            });
        }
        
        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Students');
        
        // Define columns
        worksheet.columns = [
            { header: 'Admission Number', key: 'admission_number', width: 15 },
            { header: 'HT Number', key: 'ht_number', width: 15 },
            { header: 'Roll Number', key: 'roll_number', width: 15 },
            { header: 'Full Name', key: 'full_name', width: 30 },
            { header: 'Date of Birth', key: 'date_of_birth', width: 12 },
            { header: 'Gender', key: 'gender', width: 10 },
            { header: 'Father Name', key: 'father_name', width: 25 },
            { header: 'Mother Name', key: 'mother_name', width: 25 },
            { header: 'Programme', key: 'programme_name', width: 20 },
            { header: 'Branch', key: 'branch_name', width: 30 },
            { header: 'Batch', key: 'batch_name', width: 15 },
            { header: 'Semester', key: 'semester_name', width: 15 },
            { header: 'Section', key: 'section_name', width: 10 },
            { header: 'Joining Regulation', key: 'joining_regulation', width: 18 },
            { header: 'Current Regulation', key: 'current_regulation', width: 18 },
            { header: 'Student Mobile', key: 'student_mobile', width: 15 },
            { header: 'Parent Mobile', key: 'parent_mobile', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Aadhaar Number', key: 'aadhaar_number', width: 15 },
            { header: 'Caste Category', key: 'caste_category', width: 15 },
            { header: 'Admission Date', key: 'admission_date', width: 15 },
            { header: 'Completion Year', key: 'completion_year', width: 15 },
            { header: 'Student Status', key: 'student_status', width: 15 },
            { header: 'Detainee', key: 'is_detainee', width: 10 },
            { header: 'Lateral', key: 'is_lateral', width: 10 },
            { header: 'Handicapped', key: 'is_handicapped', width: 12 },
            { header: 'Transitory', key: 'is_transitory', width: 10 }
        ];
        
        // Add data
        students.forEach(student => {
            worksheet.addRow({
                ...student,
                date_of_birth: student.date_of_birth ? new Date(student.date_of_birth).toISOString().split('T')[0] : '',
                admission_date: student.admission_date ? new Date(student.admission_date).toISOString().split('T')[0] : '',
                is_detainee: student.is_detainee ? 'Yes' : 'No',
                is_lateral: student.is_lateral ? 'Yes' : 'No',
                is_handicapped: student.is_handicapped ? 'Yes' : 'No',
                is_transitory: student.is_transitory ? 'Yes' : 'No'
            });
        });
        
        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=students_${Date.now()}.xlsx`);
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('=== EXCEL EXPORT ERROR ===');
        console.error('Error:', error);
        console.error('Error code:', error.code);
        console.error('SQL Message:', error.sqlMessage);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to export to Excel',
            error: error.message,
            sqlMessage: error.sqlMessage
        });
    }
});

// Configure multer for Excel upload
const uploadExcel = multer({
    dest: 'uploads/temp/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and Excel files are allowed'));
        }
    }
});

// Helper function to parse DD/MM/YYYY to YYYY-MM-DD
function parseDateDDMMYYYY(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Helper function to parse Yes/No to boolean
function parseYesNo(value) {
    if (!value) return false;
    return value.trim().toLowerCase() === 'yes' ? true : false;
}

// POST import students from Excel
router.post('/import/excel', uploadExcel.single('file'), async (req, res) => {
    try {
        console.log('=== EXCEL IMPORT REQUEST ===');
        
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }
        
        // Get regulation_id from request body
        const regulation_id = req.body.regulation_id;
        
        if (!regulation_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Regulation must be selected for import'
            });
        }
        
        console.log('Importing with regulation_id:', regulation_id);
        
        const filePath = req.file.path;
        const students = [];
        const errors = [];
        let lineNumber = 0;
        let isHeaderFound = false;
        
        // Read file and manually parse to skip first 6 rows
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        
        let headers = [];
        
        for (let i = 0; i < lines.length; i++) {
            lineNumber = i + 1;
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) continue;
            
            // Find the header row (row 6) - it starts with "Admission Number"
            if (line.startsWith('Admission Number') || line.startsWith('"Admission Number"')) {
                headers = line.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                isHeaderFound = true;
                continue;
            }
            
            // Skip rows before header
            if (!isHeaderFound) {
                continue;
            }
            
            // Parse data rows
            try {
                // Simple CSV parsing - handle quoted values
                const values = [];
                let current = '';
                let inQuotes = false;
                
                for (let char of line) {
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());
                
                // Create row object
                const row = {};
                headers.forEach((header, idx) => {
                    row[header] = values[idx] || '';
                });
                
                // Validate and parse row
                const student = {
                    admission_number: row['Admission Number']?.trim(),
                    ht_number: row['HT Number']?.trim() || null,
                    roll_number: row['Roll Number']?.trim() || null,
                    full_name: row['Full Name']?.trim(),
                    date_of_birth: parseDateDDMMYYYY(row['Date of Birth (DD/MM/YYYY)']),
                    gender: row['Gender (Male/Female/Other)']?.trim(),
                    father_name: row['Father Name']?.trim() || null,
                    mother_name: row['Mother Name']?.trim() || null,
                    aadhaar_number: row['Aadhaar Number']?.trim() || null,
                    caste_category: row['Caste Category']?.trim() || null,
                    student_mobile: row['Student Mobile']?.trim() || null,
                    parent_mobile: row['Parent Mobile']?.trim() || null,
                    email: row['Email']?.trim() || null,
                    admission_date: parseDateDDMMYYYY(row['Admission Date (DD/MM/YYYY)']),
                    completion_year: row['Completion Year']?.trim() || null,
                    student_status: row['Student Status (In Roll/Detained/Left out)']?.trim() || 'In Roll',
                    section: row['Section']?.trim() || null,
                    is_detainee: parseYesNo(row['Detainee (Yes/No)']),
                    is_lateral: parseYesNo(row['Lateral (Yes/No)']),
                    is_handicapped: parseYesNo(row['Handicapped (Yes/No)']),
                    is_transitory: parseYesNo(row['Transitory (Yes/No)']),
                    programme_id: req.body.programme_id || null,
                    branch_id: req.body.branch_id || null,
                    batch_id: req.body.batch_id || null,
                    semester_id: req.body.semester_id || null,
                    section_id: null
                };
                
                // Validate required fields
                if (!student.admission_number) {
                    errors.push({
                        row: lineNumber,
                        error: 'Admission Number is required'
                    });
                    continue;
                }
                
                if (!student.full_name) {
                    errors.push({
                        row: lineNumber,
                        admission_number: student.admission_number,
                        error: 'Full Name is required'
                    });
                    continue;
                }
                
                // Validate gender
                if (student.gender && !['Male', 'Female', 'Other'].includes(student.gender)) {
                    errors.push({
                        row: lineNumber,
                        admission_number: student.admission_number,
                        error: 'Gender must be Male, Female, or Other'
                    });
                    continue;
                }
                
                // Validate mobile numbers
                if (student.student_mobile && !/^\d{10}$/.test(student.student_mobile)) {
                    errors.push({
                        row: lineNumber,
                        admission_number: student.admission_number,
                        error: 'Student Mobile must be 10 digits'
                    });
                    continue;
                }
                
                if (student.parent_mobile && !/^\d{10}$/.test(student.parent_mobile)) {
                    errors.push({
                        row: lineNumber,
                        admission_number: student.admission_number,
                        error: 'Parent Mobile must be 10 digits'
                    });
                    continue;
                }
                
                // Validate aadhaar
                if (student.aadhaar_number && !/^\d{12}$/.test(student.aadhaar_number)) {
                    errors.push({
                        row: lineNumber,
                        admission_number: student.admission_number,
                        error: 'Aadhaar Number must be 12 digits'
                    });
                    continue;
                }
                
                // Validate email
                if (student.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) {
                    errors.push({
                        row: lineNumber,
                        admission_number: student.admission_number,
                        error: 'Invalid email format'
                    });
                    continue;
                }
                
                // Validate student status
                if (student.student_status && !['In Roll', 'Detained', 'Left out'].includes(student.student_status)) {
                    errors.push({
                        row: lineNumber,
                        admission_number: student.admission_number,
                        error: 'Student Status must be In Roll, Detained, or Left out'
                    });
                    continue;
                }
                
                students.push({ ...student, lineNumber });
                
            } catch (error) {
                errors.push({
                    row: lineNumber,
                    error: error.message
                });
            }
        }
        
        console.log(`Parsed ${students.length} valid students, ${errors.length} errors`);
        
        // Bulk insert students
        let importedCount = 0;
        
        for (const student of students) {
            try {
                // Check if admission number already exists
                const [existing] = await promisePool.query(
                    'SELECT student_id FROM student_master WHERE admission_number = ?',
                    [student.admission_number]
                );
                
                if (existing.length > 0) {
                    errors.push({
                        row: student.lineNumber,
                        admission_number: student.admission_number,
                        error: 'Duplicate admission number'
                    });
                    continue;
                }
                
                // Insert student
                await promisePool.query(
                    `INSERT INTO student_master 
                    (admission_number, ht_number, roll_number, full_name, date_of_birth, gender,
                     father_name, mother_name, aadhaar_number, caste_category,
                     student_mobile, parent_mobile, email, admission_date, completion_year,
                     student_status, programme_id, branch_id, batch_id, semester_id,
                     joining_regulation_id, current_regulation_id,
                     is_detainee, is_lateral, is_handicapped, is_transitory, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    [
                        student.admission_number, student.ht_number, student.roll_number,
                        student.full_name, student.date_of_birth, student.gender,
                        student.father_name, student.mother_name, student.aadhaar_number,
                        student.caste_category, student.student_mobile, student.parent_mobile,
                        student.email, student.admission_date, student.completion_year,
                        student.student_status, student.programme_id, student.branch_id,
                        student.batch_id, student.semester_id,
                        regulation_id, regulation_id,  // Both joining and current set to selected regulation
                        student.is_detainee,
                        student.is_lateral, student.is_handicapped, student.is_transitory
                    ]
                );
                
                importedCount++;
                
            } catch (error) {
                errors.push({
                    row: student.lineNumber,
                    admission_number: student.admission_number,
                    error: error.message
                });
            }
        }
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        
        res.json({
            status: 'success',
            message: 'Import completed',
            data: {
                total: students.length,
                imported: importedCount,
                failed: errors.length,
                errors: errors
            }
        });
        
    } catch (error) {
        console.error('=== EXCEL IMPORT ERROR ===');
        console.error('Error:', error);
        
        // Clean up file if it exists
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Failed to cleanup temp file:', cleanupError);
            }
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to import Excel file',
            error: error.message
        });
    }
});

// Configure multer for ZIP upload
const uploadZip = multer({
    dest: 'uploads/temp/',
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.zip') {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are allowed'));
        }
    }
});

// POST bulk import photos from ZIP
router.post('/import-photos', uploadZip.single('file'), async (req, res) => {
    try {
        console.log('=== PHOTO IMPORT REQUEST ===');
        
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }
        
        const zipPath = req.file.path;
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        
        const results = {
            total: 0,
            uploaded: 0,
            failed: 0,
            errors: []
        };
        
        // Ensure uploads directory exists
        const uploadsDir = path.join(__dirname, '../uploads/students');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            
            const filename = entry.entryName;
            const ext = path.extname(filename).toLowerCase();
            
            // Check if valid image
            if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
                continue;
            }
            
            results.total++;
            
            try {
                // Extract filename without extension
                const basename = path.basename(filename, ext);
                
                // Try to find student by admission number or roll number
                const [students] = await promisePool.query(
                    'SELECT student_id, admission_number FROM student_master WHERE (admission_number = ? OR roll_number = ?) AND is_active = 1',
                    [basename, basename]
                );
                
                if (students.length === 0) {
                    results.failed++;
                    results.errors.push({
                        filename: filename,
                        error: 'Student not found'
                    });
                    continue;
                }
                
                const student = students[0];
                
                // Check file size (max 5MB)
                const fileData = entry.getData();
                if (fileData.length > 5 * 1024 * 1024) {
                    results.failed++;
                    results.errors.push({
                        filename: filename,
                        error: 'File size exceeds 5MB limit'
                    });
                    continue;
                }
                
                // Extract and save photo
                const newFilename = `${student.student_id}_${Date.now()}${ext}`;
                const photoPath = path.join(uploadsDir, newFilename);
                
                fs.writeFileSync(photoPath, fileData);
                
                // Update photo_url in database
                const photoUrl = `/uploads/students/${newFilename}`;
                await promisePool.query(
                    'UPDATE student_master SET photo_url = ? WHERE student_id = ?',
                    [photoUrl, student.student_id]
                );
                
                results.uploaded++;
                console.log(`✅ Uploaded photo for ${student.admission_number}`);
                
            } catch (error) {
                results.failed++;
                results.errors.push({
                    filename: filename,
                    error: error.message
                });
            }
        }
        
        // Clean up ZIP file
        try {
            fs.unlinkSync(zipPath);
        } catch (cleanupError) {
            console.error('Failed to cleanup ZIP file:', cleanupError);
        }
        
        console.log(`Photo import completed: ${results.uploaded}/${results.total} successful`);
        
        res.json({
            status: 'success',
            message: 'Photo import completed',
            data: results
        });
        
    } catch (error) {
        console.error('=== PHOTO IMPORT ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to import photos',
            error: error.message
        });
    }
});

module.exports = initializeRouter;
