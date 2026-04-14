const express = require('express');
const router = express.Router();
const { promisePool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const AdmZip = require('adm-zip');

// Configure multer for photo uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/staff');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, JPG, PNG) are allowed!'));
        }
    }
});


// ===== SPECIFIC GET ROUTES (must come before /:id) =====

router.get('/sample-excel', async (req, res) => {
    try {
        console.log('=== GENERATE SAMPLE EXCEL TEMPLATE ===');
        
        // Get current filter values to populate sample data
        const { department_id } = req.query;
        
        let departmentCode = 'CSE';
        
        // Fetch actual department code if provided
        if (department_id) {
            const [departments] = await promisePool.query(
                'SELECT branch_code FROM branch_master WHERE branch_id = ? AND is_active = 1',
                [department_id]
            );
            if (departments.length > 0) departmentCode = departments[0].branch_code;
        }
        
        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Staff Data');
        
        // Define columns
        worksheet.columns = [
            { header: 'employee_id', key: 'employee_id', width: 15 },
            { header: 'title_prefix', key: 'title_prefix', width: 12 },
            { header: 'full_name', key: 'full_name', width: 30 },
            { header: 'department_code', key: 'department_code', width: 18 },
            { header: 'designation', key: 'designation', width: 25 },
            { header: 'date_of_birth', key: 'date_of_birth', width: 15 },
            { header: 'gender', key: 'gender', width: 10 },
            { header: 'qualification', key: 'qualification', width: 15 },
            { header: 'years_of_experience', key: 'years_of_experience', width: 20 },
            { header: 'mobile_number', key: 'mobile_number', width: 15 },
            { header: 'email', key: 'email', width: 30 },
            { header: 'address', key: 'address', width: 35 },
            { header: 'emergency_contact', key: 'emergency_contact', width: 18 },
            { header: 'date_of_joining', key: 'date_of_joining', width: 15 },
            { header: 'bank_name', key: 'bank_name', width: 25 },
            { header: 'bank_branch', key: 'bank_branch', width: 25 },
            { header: 'ifsc_code', key: 'ifsc_code', width: 12 },
            { header: 'account_number', key: 'account_number', width: 20 },
            { header: 'pan_card', key: 'pan_card', width: 12 },
            { header: 'aadhaar_number', key: 'aadhaar_number', width: 15 },
            { header: 'uan_number', key: 'uan_number', width: 15 },
            { header: 'salary', key: 'salary', width: 12 },
            { header: 'employment_status', key: 'employment_status', width: 18 },
            { header: 'is_hod', key: 'is_hod', width: 8 },
            { header: 'is_class_coordinator', key: 'is_class_coordinator', width: 22 },
            { header: 'is_exam_invigilator', key: 'is_exam_invigilator', width: 20 }
        ];
        
        // Add sample data rows
        worksheet.addRow({
            employee_id: 'S1001',
            title_prefix: 'Dr',
            full_name: 'RAMESH KUMAR',
            department_code: departmentCode,
            designation: 'Professor',
            date_of_birth: '1980-05-15',
            gender: 'Male',
            qualification: 'Ph.D',
            years_of_experience: 15,
            mobile_number: '9876543210',
            email: 'ramesh.kumar@example.com',
            address: '123 Main Street, City',
            emergency_contact: '9876543211',
            date_of_joining: '2010-06-01',
            bank_name: 'State Bank of India',
            bank_branch: 'Main Branch',
            ifsc_code: 'SBIN0001234',
            account_number: '12345678901234',
            pan_card: 'ABCDE1234F',
            aadhaar_number: '123456789012',
            uan_number: 'UAN123456789',
            salary: 75000,
            employment_status: 'Active',
            is_hod: 1,
            is_class_coordinator: 0,
            is_exam_invigilator: 1
        });
        
        worksheet.addRow({
            employee_id: 'S1002',
            title_prefix: 'Mrs',
            full_name: 'LAKSHMI DEVI',
            department_code: departmentCode,
            designation: 'Assistant Professor',
            date_of_birth: '1985-08-20',
            gender: 'Female',
            qualification: 'M.Tech',
            years_of_experience: 8,
            mobile_number: '9876543220',
            email: 'lakshmi.devi@example.com',
            address: '456 Park Avenue, City',
            emergency_contact: '9876543221',
            date_of_joining: '2015-07-15',
            bank_name: 'HDFC Bank',
            bank_branch: 'City Branch',
            ifsc_code: 'HDFC0001234',
            account_number: '23456789012345',
            pan_card: 'FGHIJ5678K',
            aadhaar_number: '234567890123',
            uan_number: 'UAN234567890',
            salary: 55000,
            employment_status: 'Active',
            is_hod: 0,
            is_class_coordinator: 1,
            is_exam_invigilator: 0
        });
        
        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };
        
        console.log('Sample Excel template generated successfully');
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=staff_sample_${Date.now()}.xlsx`);
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
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

router.get('/export/excel', async (req, res) => {
    try {
        console.log('=== EXCEL EXPORT REQUEST ===');
        
        // Build query with filters
        const { department_id, designation, employment_status } = req.query;
        
        let query = `
            SELECT 
                s.employee_id,
                s.title_prefix,
                s.full_name,
                b.branch_code as department_code,
                b.branch_name as department_name,
                s.designation,
                s.date_of_birth,
                s.gender,
                s.qualification,
                s.years_of_experience,
                s.mobile_number,
                s.email,
                s.address,
                s.emergency_contact,
                s.date_of_joining,
                s.bank_name,
                s.bank_branch,
                s.ifsc_code,
                s.account_number,
                s.pan_card,
                s.aadhaar_number,
                s.uan_number,
                s.salary,
                s.employment_status,
                s.is_hod,
                s.is_class_coordinator,
                s.is_exam_invigilator
            FROM staff_master s
            LEFT JOIN branch_master b ON s.department_id = b.branch_id
            WHERE s.is_active = 1
        `;
        
        const params = [];
        
        // Apply filters
        if (department_id) {
            query += ' AND s.department_id = ?';
            params.push(department_id);
        }
        if (designation) {
            query += ' AND s.designation = ?';
            params.push(designation);
        }
        if (employment_status) {
            query += ' AND s.employment_status = ?';
            params.push(employment_status);
        }
        
        query += ' ORDER BY s.employee_id';
        
        console.log('Export query:', query);
        console.log('Export params:', params);
        
        const [staff] = await promisePool.query(query, params);
        
        console.log(`Found ${staff.length} staff members to export`);
        
        if (staff.length === 0) {
            return res.json({
                status: 'success',
                message: 'No staff found to export',
                data: []
            });
        }
        
        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Staff Data');
        
        // Define columns
        worksheet.columns = [
            { header: 'Employee ID', key: 'employee_id', width: 15 },
            { header: 'Title', key: 'title_prefix', width: 10 },
            { header: 'Full Name', key: 'full_name', width: 30 },
            { header: 'Department Code', key: 'department_code', width: 18 },
            { header: 'Department Name', key: 'department_name', width: 30 },
            { header: 'Designation', key: 'designation', width: 25 },
            { header: 'Date of Birth', key: 'date_of_birth', width: 15 },
            { header: 'Gender', key: 'gender', width: 10 },
            { header: 'Qualification', key: 'qualification', width: 15 },
            { header: 'Years of Experience', key: 'years_of_experience', width: 20 },
            { header: 'Mobile Number', key: 'mobile_number', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Address', key: 'address', width: 35 },
            { header: 'Emergency Contact', key: 'emergency_contact', width: 18 },
            { header: 'Date of Joining', key: 'date_of_joining', width: 15 },
            { header: 'Bank Name', key: 'bank_name', width: 25 },
            { header: 'Bank Branch', key: 'bank_branch', width: 25 },
            { header: 'IFSC Code', key: 'ifsc_code', width: 12 },
            { header: 'Account Number', key: 'account_number', width: 20 },
            { header: 'PAN Card', key: 'pan_card', width: 12 },
            { header: 'Aadhaar Number', key: 'aadhaar_number', width: 15 },
            { header: 'UAN Number', key: 'uan_number', width: 15 },
            { header: 'Salary', key: 'salary', width: 12 },
            { header: 'Employment Status', key: 'employment_status', width: 18 },
            { header: 'HOD', key: 'is_hod', width: 8 },
            { header: 'Class Coordinator', key: 'is_class_coordinator', width: 20 },
            { header: 'Exam Invigilator', key: 'is_exam_invigilator', width: 20 }
        ];
        
        // Add data
        staff.forEach(member => {
            worksheet.addRow({
                ...member,
                date_of_birth: member.date_of_birth ? new Date(member.date_of_birth).toISOString().split('T')[0] : '',
                date_of_joining: member.date_of_joining ? new Date(member.date_of_joining).toISOString().split('T')[0] : '',
                is_hod: member.is_hod ? 'Yes' : 'No',
                is_class_coordinator: member.is_class_coordinator ? 'Yes' : 'No',
                is_exam_invigilator: member.is_exam_invigilator ? 'Yes' : 'No'
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
        res.setHeader('Content-Disposition', `attachment; filename=staff_export_${Date.now()}.xlsx`);
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('=== EXCEL EXPORT ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to export to Excel',
            error: error.message
        });
    }
});

// ===== GENERAL GET ROUTES =====

router.get('/', async (req, res) => {
    try {
        console.log('=== GET STAFF REQUEST ===');
        console.log('Query params:', req.query);
        
        const { department_id, designation, employment_status } = req.query;
        
        // Build WHERE clause for filters
        let whereConditions = ['s.is_active = 1'];
        let queryParams = [];
        
        if (department_id) {
            whereConditions.push('s.department_id = ?');
            queryParams.push(department_id);
        }
        
        if (designation) {
            whereConditions.push('s.designation = ?');
            queryParams.push(designation);
        }
        
        if (employment_status) {
            whereConditions.push('s.employment_status = ?');
            queryParams.push(employment_status);
        }
        
        const whereClause = whereConditions.join(' AND ');
        
        // Fetch staff list
        const staffQuery = `
            SELECT 
                s.staff_id,
                s.employee_id,
                s.title_prefix,
                s.full_name,
                s.designation,
                s.employment_status,
                s.photo_url,
                 b.branch_code,
                b.branch_name as dept_name,
                b.branch_id as department_id
            FROM staff_master s
            LEFT JOIN branch_master b ON s.department_id = b.branch_id
            WHERE ${whereClause}
            ORDER BY s.employee_id
        `;
        
        console.log('Staff query:', staffQuery);
        console.log('Query params:', queryParams);
        
        const [staff] = await promisePool.query(staffQuery, queryParams);
        
        console.log(`Found ${staff.length} staff members`);
        
        // Calculate statistics
        const statsQuery = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN designation IN ('Principal', 'Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Lab Assistant') THEN 1 ELSE 0 END) as teaching,
                SUM(CASE WHEN designation IN ('Superintendent', 'Senior Assistant', 'Junior Assistant', 'Attender', 'Lab Technician', 'Librarian', 'Office Assistant') THEN 1 ELSE 0 END) as non_teaching,
                SUM(CASE WHEN employment_status = 'Active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN employment_status = 'On Leave' THEN 1 ELSE 0 END) as on_leave,
                SUM(CASE WHEN employment_status = 'Retired' THEN 1 ELSE 0 END) as retired,
                SUM(CASE WHEN employment_status = 'Resigned' THEN 1 ELSE 0 END) as resigned
            FROM staff_master s
            WHERE ${whereClause}
        `;
        
        const [stats] = await promisePool.query(statsQuery, queryParams);
        
        console.log('Statistics:', stats[0]);
        
        res.json({
            status: 'success',
            data: {
                staff: staff,
                statistics: stats[0]
            }
        });
        
    } catch (error) {
        console.error('=== GET STAFF ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch staff',
            error: error.message
        });
    }
});

// ===== DYNAMIC GET ROUTES (must come after specific routes) =====

router.get('/:id', async (req, res) => {
    try {
        const staffId = req.params.id;
        
        console.log('=== GET STAFF DETAILS ===');
        console.log('Staff ID:', staffId);
        
        const query = `
            SELECT 
                s.*,
                b.branch_name as dept_name
            FROM staff_master s
            LEFT JOIN branch_master b ON s.department_id = b.branch_id
            WHERE s.staff_id = ? AND s.is_active = 1
        `;
        
        const [staff] = await promisePool.query(query, [staffId]);
        
        if (staff.length === 0) {
            console.error('Staff not found:', staffId);
            return res.status(404).json({
                status: 'error',
                message: 'Staff not found'
            });
        }
        
        console.log('Staff details loaded:', staff[0].employee_id);
        
        res.json({
            status: 'success',
            data: staff[0]
        });
        
    } catch (error) {
        console.error('=== GET STAFF DETAILS ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch staff details',
            error: error.message
        });
    }
});

// ===== POST ROUTES =====

router.post('/', async (req, res) => {
    try {
        console.log('=== CREATE STAFF ===');
        console.log('Request body:', req.body);
        
        const {
            employee_id,
            title_prefix,
            full_name,
            department_id,
            designation,
            date_of_birth,
            gender,
            qualification,
            years_of_experience,
            mobile_number,
            email,
            address,
            emergency_contact,
            date_of_joining,
            bank_name,
            bank_branch,
            ifsc_code,
            account_number,
            pan_card,
            aadhaar_number,
            uan_number,
            salary,
            employment_status,
            is_hod,
            is_class_coordinator,
            is_exam_invigilator,
            is_locked
        } = req.body;
        
        // Validate required fields
        if (!employee_id || !full_name || !designation) {
            return res.status(400).json({
                status: 'error',
                message: 'Employee ID, Full Name, and Designation are required'
            });
        }
        
        // Check if employee_id already exists
        const [existing] = await promisePool.query(
            'SELECT employee_id FROM staff_master WHERE employee_id = ?',
            [employee_id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Employee ID already exists'
            });
        }
        
        const insertQuery = `
            INSERT INTO staff_master (
                employee_id, title_prefix, full_name, department_id, designation,
                date_of_birth, gender, qualification, years_of_experience,
                mobile_number, email, address, emergency_contact, date_of_joining,
                bank_name, bank_branch, ifsc_code, account_number,
                pan_card, aadhaar_number, uan_number, salary,
                employment_status, is_hod, is_class_coordinator,
                is_exam_invigilator, is_locked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            employee_id,
            title_prefix || null,
            full_name,
            department_id || null,
            designation,
            date_of_birth || null,
            gender || null,
            qualification || null,
            years_of_experience || null,
            mobile_number || null,
            email || null,
            address || null,
            emergency_contact || null,
            date_of_joining || null,
            bank_name || null,
            bank_branch || null,
            ifsc_code || null,
            account_number || null,
            pan_card || null,
            aadhaar_number || null,
            uan_number || null,
            salary || null,
            employment_status || 'Active',
            is_hod ? 1 : 0,
            is_class_coordinator ? 1 : 0,
            is_exam_invigilator ? 1 : 0,
            is_locked ? 1 : 0
        ];
        
        const [result] = await promisePool.query(insertQuery, values);
        
        console.log('Staff created successfully:', result.insertId);
        
        res.status(201).json({
            status: 'success',
            message: 'Staff created successfully',
            data: {
                staff_id: result.insertId,
                employee_id: employee_id
            }
        });
        
    } catch (error) {
        console.error('=== CREATE STAFF ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to create staff',
            error: error.message
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

router.post('/import/excel', uploadExcel.single('file'), async (req, res) => {
    try {
        console.log('=== EXCEL IMPORT REQUEST ===');
        
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }
        
        const filePath = req.file.path;
        
        // Read Excel file using ExcelJS
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const worksheet = workbook.worksheets[0];
        
        // Get all departments for mapping
        const [departments] = await promisePool.query(
            'SELECT branch_id, branch_code FROM branch_master WHERE is_active = 1'
        );
        
        const deptMap = {};
        departments.forEach(dept => {
            deptMap[dept.branch_code] = dept.branch_id;
        });
        
        const results = {
            total: 0,
            imported: 0,
            skipped: 0,
            errors: []
        };
        
        // Get headers from first row
        const headers = [];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value;
        });
        
        // Process data rows (skip header row)
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            
            // Skip empty rows
            if (row.values.filter(v => v).length === 0) continue;
            
            results.total++;
            
            try {
                // Create object from row
                const data = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber];
                    data[header] = cell.value;
                });
                
                // Validate required fields
                if (!data.employee_id || !data.full_name || !data.designation) {
                    results.skipped++;
                    results.errors.push({
                        row: rowNumber,
                        error: 'Missing required fields (employee_id, full_name, or designation)'
                    });
                    continue;
                }
                
                // Check if employee_id already exists
                const [existing] = await promisePool.query(
                    'SELECT employee_id FROM staff_master WHERE employee_id = ?',
                    [data.employee_id]
                );
                
                if (existing.length > 0) {
                    results.skipped++;
                    results.errors.push({
                        row: rowNumber,
                        error: `Employee ID ${data.employee_id} already exists`
                    });
                    continue;
                }
                
                // Map department_code to department_id
                let department_id = null;
                if (data.department_code) {
                    department_id = deptMap[data.department_code];
                    if (!department_id) {
                        results.skipped++;
                        results.errors.push({
                            row: rowNumber,
                            error: `Department code ${data.department_code} not found`
                        });
                        continue;
                    }
                }
                
                // Validate formats
                if (data.mobile_number && !/^\d{10}$/.test(String(data.mobile_number))) {
                    results.skipped++;
                    results.errors.push({
                        row: rowNumber,
                        error: 'Invalid mobile number format (must be 10 digits)'
                    });
                    continue;
                }
                
                if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                    results.skipped++;
                    results.errors.push({
                        row: rowNumber,
                        error: 'Invalid email format'
                    });
                    continue;
                }
                
                if (data.pan_card && !/^[A-Z]{5}\d{4}[A-Z]$/.test(data.pan_card)) {
                    results.skipped++;
                    results.errors.push({
                        row: rowNumber,
                        error: 'Invalid PAN card format (must be ABCDE1234F)'
                    });
                    continue;
                }
                
                if (data.aadhaar_number && !/^\d{12}$/.test(String(data.aadhaar_number))) {
                    results.skipped++;
                    results.errors.push({
                        row: rowNumber,
                        error: 'Invalid Aadhaar number format (must be 12 digits)'
                    });
                    continue;
                }
                
                if (data.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.ifsc_code)) {
                    results.skipped++;
                    results.errors.push({
                        row: rowNumber,
                        error: 'Invalid IFSC code format (must be 11 characters)'
                    });
                    continue;
                }
                
                // Insert staff record
                const insertQuery = `
                    INSERT INTO staff_master (
                        employee_id, title_prefix, full_name, department_id, designation,
                        date_of_birth, gender, qualification, years_of_experience,
                        mobile_number, email, address, emergency_contact, date_of_joining,
                        bank_name, bank_branch, ifsc_code, account_number,
                        pan_card, aadhaar_number, uan_number, salary,
                        employment_status, is_hod, is_class_coordinator, is_exam_invigilator
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                // Parse date values
                const parseDate = (val) => {
                    if (!val) return null;
                    if (val instanceof Date) return val.toISOString().split('T')[0];
                    return val;
                };
                
                await promisePool.query(insertQuery, [
                    data.employee_id,
                    data.title_prefix || 'Mr',
                    data.full_name,
                    department_id,
                    data.designation,
                    parseDate(data.date_of_birth),
                    data.gender || null,
                    data.qualification || null,
                    data.years_of_experience || 0,
                    data.mobile_number || null,
                    data.email || null,
                    data.address || null,
                    data.emergency_contact || null,
                    parseDate(data.date_of_joining),
                    data.bank_name || null,
                    data.bank_branch || null,
                    data.ifsc_code || null,
                    data.account_number || null,
                    data.pan_card || null,
                    data.aadhaar_number || null,
                    data.uan_number || null,
                    data.salary || null,
                    data.employment_status || 'Active',
                    data.is_hod ? 1 : 0,
                    data.is_class_coordinator ? 1 : 0,
                    data.is_exam_invigilator ? 1 : 0
                ]);
                
                results.imported++;
                console.log(`✅ Imported staff: ${data.employee_id} - ${data.full_name}`);
                
            } catch (error) {
                console.error(`Error importing row ${rowNumber}:`, error);
                results.skipped++;
                results.errors.push({
                    row: rowNumber,
                    error: error.message
                });
            }
        }
        
        // Clean up uploaded file
        try {
            fs.unlinkSync(filePath);
        } catch (cleanupError) {
            console.error('Failed to cleanup Excel file:', cleanupError);
        }
        
        console.log(`Import complete: ${results.imported}/${results.total} successful`);
        
        res.json({
            status: 'success',
            message: `Successfully imported ${results.imported} staff members`,
            data: results
        });
        
    } catch (error) {
        console.error('=== EXCEL IMPORT ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to import Excel',
            error: error.message
        });
    }
});

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
        const uploadsDir = path.join(__dirname, '../uploads/staff');
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
                // Extract filename without extension (should be employee_id)
                const basename = path.basename(filename, ext);
                
                // Try to find staff by employee_id
                const [staff] = await promisePool.query(
                    'SELECT staff_id, employee_id FROM staff_master WHERE employee_id = ? AND is_active = 1',
                    [basename]
                );
                
                if (staff.length === 0) {
                    results.failed++;
                    results.errors.push({
                        filename: filename,
                        error: 'Staff not found'
                    });
                    continue;
                }
                
                const staffMember = staff[0];
                
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
                const newFilename = `${staffMember.staff_id}_${Date.now()}${ext}`;
                const photoPath = path.join(uploadsDir, newFilename);
                
                fs.writeFileSync(photoPath, fileData);
                
                // Update photo_url in database
                const photoUrl = `/uploads/staff/${newFilename}`;
                await promisePool.query(
                    'UPDATE staff_master SET photo_url = ? WHERE staff_id = ?',
                    [photoUrl, staffMember.staff_id]
                );
                
                results.uploaded++;
                console.log(`✅ Uploaded photo for ${staffMember.employee_id}`);
                
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

router.post('/:id/upload-photo', upload.single('photo'), async (req, res) => {
    try {
        const staffId = req.params.id;
        
        console.log('=== UPLOAD STAFF PHOTO ===');
        console.log('Staff ID:', staffId);
        console.log('File:', req.file);
        
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }
        
        const photoUrl = `/uploads/staff/${req.file.filename}`;
        
        // Update photo_url in database
        const [result] = await promisePool.query(
            'UPDATE staff_master SET photo_url = ? WHERE staff_id = ?',
            [photoUrl, staffId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Staff not found'
            });
        }
        
        console.log('Photo uploaded successfully:', photoUrl);
        
        res.json({
            status: 'success',
            message: 'Photo uploaded successfully',
            data: {
                photo_url: photoUrl
            }
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

// ===== PUT ROUTES =====

router.put('/:id', async (req, res) => {
    try {
        const staffId = req.params.id;
        
        console.log('=== UPDATE STAFF ===');
        console.log('Staff ID:', staffId);
        console.log('Request body:', req.body);
        
        // Check if staff exists
        const [existing] = await promisePool.query(
            'SELECT staff_id FROM staff_master WHERE staff_id = ? AND is_active = 1',
            [staffId]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Staff not found'
            });
        }
        
        const {
            title_prefix,
            full_name,
            department_id,
            designation,
            date_of_birth,
            gender,
            qualification,
            years_of_experience,
            mobile_number,
            email,
            address,
            emergency_contact,
            date_of_joining,
            bank_name,
            bank_branch,
            ifsc_code,
            account_number,
            pan_card,
            aadhaar_number,
            uan_number,
            salary,
            employment_status,
            is_hod,
            is_class_coordinator,
            is_exam_invigilator,
            is_locked
        } = req.body;
        
        const updateQuery = `
            UPDATE staff_master SET
                title_prefix = ?,
                full_name = ?,
                department_id = ?,
                designation = ?,
                date_of_birth = ?,
                gender = ?,
                qualification = ?,
                years_of_experience = ?,
                mobile_number = ?,
                email = ?,
                address = ?,
                emergency_contact = ?,
                date_of_joining = ?,
                bank_name = ?,
                bank_branch = ?,
                ifsc_code = ?,
                account_number = ?,
                pan_card = ?,
                aadhaar_number = ?,
                uan_number = ?,
                salary = ?,
                employment_status = ?,
                is_hod = ?,
                is_class_coordinator = ?,
                is_exam_invigilator = ?,
                is_locked = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE staff_id = ?
        `;
        
        const values = [
            title_prefix || null,
            full_name,
            department_id || null,
            designation,
            date_of_birth || null,
            gender || null,
            qualification || null,
            years_of_experience || null,
            mobile_number || null,
            email || null,
            address || null,
            emergency_contact || null,
            date_of_joining || null,
            bank_name || null,
            bank_branch || null,
            ifsc_code || null,
            account_number || null,
            pan_card || null,
            aadhaar_number || null,
            uan_number || null,
            salary || null,
            employment_status || 'Active',
            is_hod ? 1 : 0,
            is_class_coordinator ? 1 : 0,
            is_exam_invigilator ? 1 : 0,
            is_locked ? 1 : 0,
            staffId
        ];
        
        const [result] = await promisePool.query(updateQuery, values);
        
        console.log('Staff updated successfully, affected rows:', result.affectedRows);
        
        res.json({
            status: 'success',
            message: 'Staff updated successfully',
            data: {
                staff_id: staffId,
                affected_rows: result.affectedRows
            }
        });
        
    } catch (error) {
        console.error('=== UPDATE STAFF ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to update staff',
            error: error.message
        });
    }
});

// ===== DELETE ROUTES =====

router.delete('/:id', async (req, res) => {
    try {
        const staffId = req.params.id;
        
        console.log('=== DELETE STAFF ===');
        console.log('Staff ID:', staffId);
        
        const [result] = await promisePool.query(
            'UPDATE staff_master SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE staff_id = ?',
            [staffId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Staff not found'
            });
        }
        
        console.log('Staff deleted successfully');
        
        res.json({
            status: 'success',
            message: 'Staff deleted successfully'
        });
        
    } catch (error) {
        console.error('=== DELETE STAFF ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete staff',
            error: error.message
        });
    }
});

router.delete('/:id/remove-photo', async (req, res) => {
    try {
        const staffId = req.params.id;
        
        console.log('=== REMOVE STAFF PHOTO ===');
        console.log('Staff ID:', staffId);
        
        // Get current photo URL
        const [staff] = await promisePool.query(
            'SELECT photo_url FROM staff_master WHERE staff_id = ?',
            [staffId]
        );
        
        if (staff.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Staff not found'
            });
        }
        
        // Delete photo file if exists
        if (staff[0].photo_url) {
            const photoPath = path.join(__dirname, '..', staff[0].photo_url);
            try {
                await fs.promises.unlink(photoPath);
                console.log('Photo file deleted:', photoPath);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.error('Error deleting photo file:', err);
                }
            }
        }
        
        // Update database
        await promisePool.query(
            'UPDATE staff_master SET photo_url = NULL WHERE staff_id = ?',
            [staffId]
        );
        
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

module.exports = router;
