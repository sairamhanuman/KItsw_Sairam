// ========================================
// PROFESSIONAL STUDENT MANAGEMENT ROUTES
// routes/student-management-professional-routes.js
// ========================================

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

let promisePool;

function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// ========================================
// TAB 1: IMPORT INITIAL DATABASE
// ========================================

// Generate Excel Template for Initial Import
router.get('/import-initial/generate-template', async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id, regulation_id } = req.query;
        
        console.log('Generating initial import template:', { programme_id, batch_id, branch_id, regulation_id });
        
        // ========================================
        // 🚨 CRITICAL FIX: Get Actual Database Values
        // ========================================
        
        // Fetch metadata for template with actual database lookup
        let programmeName = 'B.Tech';
        let batchName = '2025-2026';
        let branchName = 'CSE';
        let regulationName = 'R18';
        
        if (programme_id) {
            const [programmes] = await promisePool.query(
                'SELECT programme_code, programme_name FROM programme_master WHERE programme_id = ?', [programme_id]
            );
            if (programmes.length > 0) {
                programmeName = programmes[0].programme_code || programmes[0].programme_name;
                console.log(`✅ Found Programme: ID ${programme_id} -> ${programmeName}`);
            } else {
                console.log(`⚠️ Programme ID ${programme_id} not found in database`);
            }
        }
        
        if (batch_id) {
            const [batches] = await promisePool.query(
                'SELECT batch_name FROM batch_master WHERE batch_id = ?', [batch_id]
            );
            if (batches.length > 0) {
                batchName = batches[0].batch_name;
                console.log(`✅ Found Batch: ID ${batch_id} -> ${batchName}`);
            } else {
                console.log(`⚠️ Batch ID ${batch_id} not found in database`);
            }
        }
        
        if (branch_id) {
            const [branches] = await promisePool.query(
                'SELECT branch_code, branch_name FROM branch_master WHERE branch_id = ?', [branch_id]
            );
            if (branches.length > 0) {
                branchName = branches[0].branch_code || branches[0].branch_name;
                console.log(`✅ Found Branch: ID ${branch_id} -> ${branchName}`);
            } else {
                console.log(`⚠️ Branch ID ${branch_id} not found in database`);
            }
        }
        
        if (regulation_id) {
            const [regulations] = await promisePool.query(
                'SELECT regulation_name FROM regulation_master WHERE regulation_id = ?', [regulation_id]
            );
            if (regulations.length > 0) {
                regulationName = regulations[0].regulation_name;
                console.log(`✅ Found Regulation: ID ${regulation_id} -> ${regulationName}`);
            } else {
                console.log(`⚠️ Regulation ID ${regulation_id} not found in database`);
            }
        }
        
        // ========================================
        // END DATABASE LOOKUP - Continue with Template Generation
        // ========================================
        
        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Student Data');
        
        // ========================================
        // 🚨 CRITICAL VALIDATION: Add Filter Context (Name-Based)
        // ========================================
        
        // Metadata section (rows 1-6) - INCLUDE FILTER NAMES FOR VALIDATION
        worksheet.getCell('A1').value = 'Batch:';
        worksheet.getCell('B1').value = batchName;
        worksheet.getCell('A2').value = 'Programme:';
        worksheet.getCell('B2').value = programmeName;
        worksheet.getCell('A3').value = 'Branch:';
        worksheet.getCell('B3').value = branchName;
        worksheet.getCell('A4').value = 'Regulation:';
        worksheet.getCell('B4').value = regulationName;
        worksheet.getCell('A5').value = 'Semester:';
        worksheet.getCell('B5').value = 'I (First Semester)';
        worksheet.getCell('A6').value = 'Generated:';
        worksheet.getCell('B6').value = new Date().toLocaleString();
        
        // Style metadata
        for (let i = 1; i <= 6; i++) {
            worksheet.getCell(`A${i}`).font = { bold: true };
            worksheet.getCell(`B${i}`).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE7E6E6' }
            };
        }
        
        // Row 7 is empty separator
        
        // Headers (row 7) - STARTING FROM COLUMN A (after metadata rows)
        worksheet.getCell('A7').value = 'Admission Number*';
        worksheet.getCell('B7').value = 'HT Number';
        worksheet.getCell('C7').value = 'Roll Number*';
        worksheet.getCell('D7').value = 'Full Name*';
        worksheet.getCell('E7').value = 'Date of Birth (YYYY-MM-DD)*';
        worksheet.getCell('F7').value = 'Gender (Male/Female/Other)*';
        worksheet.getCell('G7').value = 'Father Name*';
        worksheet.getCell('H7').value = 'Mother Name*';
        worksheet.getCell('I7').value = 'Aadhaar Number (12 digits)';
        worksheet.getCell('J7').value = 'Caste Category';
        worksheet.getCell('K7').value = 'Student Mobile';
        worksheet.getCell('L7').value = 'Parent Mobile*';
        worksheet.getCell('M7').value = 'Email';
        worksheet.getCell('N7').value = 'Section';
        
        // Style headers
        const headerRow = worksheet.getRow(7);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        
        // Set column widths
        worksheet.columns = [
            { width: 15 }, { width: 25 }, // A, B for metadata
            { width: 20 }, { width: 15 }, { width: 30 }, // C, D, E, F for data
            { width: 20 }, { width: 15 }, { width: 25 }, { width: 25 }, // G, H, I, J for data
            { width: 20 }, { width: 15 }, { width: 30 }, { width: 15 } // K, L, M, N for data
        ];
        
        // Add sample row (row 8) - STARTING FROM COLUMN A (after metadata rows)
        worksheet.getCell('A8').value = 'B25CSE001';           // A: Admission Number
        worksheet.getCell('B8').value = 'HT123456';            // B: HT Number
        worksheet.getCell('C8').value = 'B25AI001';             // C: Roll Number
        worksheet.getCell('D8').value = 'Sample Student Name';    // D: Full Name
        worksheet.getCell('E8').value = '2005-06-15';          // E: Date of Birth
        worksheet.getCell('F8').value = 'Male';                 // F: Gender
        worksheet.getCell('G8').value = 'Father Name';           // G: Father Name
        worksheet.getCell('H8').value = 'Mother Name';           // H: Mother Name
        worksheet.getCell('I8').value = '123456789012';        // I: Aadhaar Number
        worksheet.getCell('J8').value = 'OC';                   // J: Caste Category
        worksheet.getCell('K8').value = '9876543210';          // K: Student Mobile
        worksheet.getCell('L8').value = '9876543211';          // L: Parent Mobile
        worksheet.getCell('M8').value = 'student@example.com';   // M: Email
        worksheet.getCell('N8').value = 'A';                     // N: Section
        
        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Student_Initial_Import_${batchName}_${branchName}.xlsx"`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Error generating template:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate template',
            error: error.message
        });
    }
});

// Import Initial Database from Excel
router.post('/import-initial/upload', upload.single('file'), async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id, regulation_id, section_id } = req.body;
        
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }
        
        console.log('Importing initial database:', {
            file: req.file.originalname,
            programme_id, batch_id, branch_id, regulation_id
        });
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.getWorksheet('Student Data');
        
        // ========================================
        // 🚨 VALIDATION: Check Excel Metadata vs Filters
        // ========================================
        
        // Read metadata from Excel (rows 1-6)
        const metadata = {
            programme_id: null,
            batch_id: null,
            branch_id: null,
            regulation_id: null,
            generated_date: null
        };
        
        // Extract metadata from Excel header
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber <= 6) { // Metadata rows (1-6)
                const values = row.values;
                console.log(`🔍 Row ${rowNumber} values:`, values);
                console.log(`🔍 Row ${rowNumber} cell A:`, row.getCell('A').value);
                console.log(`🔍 Row ${rowNumber} cell B:`, row.getCell('B').value);
                
                // Check for filter names using cell access instead of values array
                const cellA = row.getCell('A').value || '';
                const cellB = row.getCell('B').value || '';
                
                console.log(`🔍 Found metadata: ${cellA} = ${cellB}`);
                
                if (cellA && cellA.includes('Programme:')) {
                    metadata.programme_name = cellB;
                } else if (cellA && cellA.includes('Batch:')) {
                    metadata.batch_name = cellB;
                } else if (cellA && cellA.includes('Branch:')) {
                    metadata.branch_name = cellB;
                } else if (cellA && cellA.includes('Regulation:')) {
                    metadata.regulation_name = cellB;
                } else if (cellA && cellA.includes('Generated:')) {
                    metadata.generated_date = cellB;
                }
            }
        });
        
        console.log('🔍 Extracted metadata:', metadata);
        
        // ========================================
        // 🚨 CRITICAL VALIDATION: Name-Based Database Lookup
        // ========================================
        
        const validationErrors = [];
        
        // NAME-BASED VALIDATION: Check if Excel names match selected filters
        console.log('🔍 Starting validation...');
        console.log('🔍 Selected filters:', { programme_id, batch_id, branch_id, regulation_id });
        console.log('🔍 Excel metadata:', metadata);
        
        if (metadata.programme_name) {
            console.log(`🔍 Validating Programme: Excel="${metadata.programme_name}" vs Selected ID=${programme_id}`);
            const [programmes] = await promisePool.query(
                'SELECT programme_id, programme_code, programme_name FROM programme_master WHERE programme_code = ? OR programme_name = ?', 
                [metadata.programme_name, metadata.programme_name]
            );
            if (programmes.length === 0) {
                validationErrors.push(`CRITICAL: Excel Programme "${metadata.programme_name}" not found in database. Please regenerate template.`);
            } else {
                console.log(`🔍 Found Excel Programme: ID=${programmes[0].programme_id}, Name="${programmes[0].programme_code}"`);
                // CRITICAL: Check if Excel programme matches selected programme
                if (programmes[0].programme_id !== parseInt(programme_id)) {
                    const [selectedProgramme] = await promisePool.query(
                        'SELECT programme_code, programme_name FROM programme_master WHERE programme_id = ?', [programme_id]
                    );
                    validationErrors.push(`CRITICAL: Excel Programme "${metadata.programme_name}" does not match selected Programme "${selectedProgramme[0]?.programme_code || selectedProgramme[0]?.programme_name}". Please regenerate template with correct filters.`);
                    console.log(`❌ Programme mismatch: Excel ID=${programmes[0].programme_id} vs Selected ID=${programme_id}`);
                } else {
                    console.log(`✅ Programme matches: Excel ID=${programmes[0].programme_id} == Selected ID=${programme_id}`);
                }
            }
        }
        
        if (metadata.batch_name) {
            console.log(`🔍 Validating Batch: Excel="${metadata.batch_name}" vs Selected ID=${batch_id}`);
            const [batches] = await promisePool.query(
                'SELECT batch_id, batch_name FROM batch_master WHERE batch_name = ?', [metadata.batch_name]
            );
            if (batches.length === 0) {
                validationErrors.push(`CRITICAL: Excel Batch "${metadata.batch_name}" not found in database. Please regenerate template.`);
            } else {
                console.log(`🔍 Found Excel Batch: ID=${batches[0].batch_id}, Name="${batches[0].batch_name}"`);
                // CRITICAL: Check if Excel batch matches selected batch
                if (batches[0].batch_id !== parseInt(batch_id)) {
                    const [selectedBatch] = await promisePool.query(
                        'SELECT batch_name FROM batch_master WHERE batch_id = ?', [batch_id]
                    );
                    validationErrors.push(`CRITICAL: Excel Batch "${metadata.batch_name}" does not match selected Batch "${selectedBatch[0]?.batch_name}". Please regenerate template with correct filters.`);
                    console.log(`❌ Batch mismatch: Excel ID=${batches[0].batch_id} vs Selected ID=${batch_id}`);
                } else {
                    console.log(`✅ Batch matches: Excel ID=${batches[0].batch_id} == Selected ID=${batch_id}`);
                }
            }
        }
        
        if (metadata.branch_name) {
            console.log(`🔍 Validating Branch: Excel="${metadata.branch_name}" vs Selected ID=${branch_id}`);
            const [branches] = await promisePool.query(
                'SELECT branch_id, branch_code, branch_name FROM branch_master WHERE branch_code = ? OR branch_name = ?', 
                [metadata.branch_name, metadata.branch_name]
            );
            if (branches.length === 0) {
                validationErrors.push(`CRITICAL: Excel Branch "${metadata.branch_name}" not found in database. Please regenerate template.`);
            } else {
                console.log(`🔍 Found Excel Branch: ID=${branches[0].branch_id}, Name="${branches[0].branch_code}"`);
                // CRITICAL: Check if Excel branch matches selected branch
                if (branches[0].branch_id !== parseInt(branch_id)) {
                    const [selectedBranch] = await promisePool.query(
                        'SELECT branch_code, branch_name FROM branch_master WHERE branch_id = ?', [branch_id]
                    );
                    validationErrors.push(`CRITICAL: Excel Branch "${metadata.branch_name}" does not match selected Branch "${selectedBranch[0]?.branch_code || selectedBranch[0]?.branch_name}". Please regenerate template with correct filters.`);
                    console.log(`❌ Branch mismatch: Excel ID=${branches[0].branch_id} vs Selected ID=${branch_id}`);
                } else {
                    console.log(`✅ Branch matches: Excel ID=${branches[0].branch_id} == Selected ID=${branch_id}`);
                }
            }
        }
        
        if (metadata.regulation_name) {
            console.log(`🔍 Validating Regulation: Excel="${metadata.regulation_name}" vs Selected ID=${regulation_id}`);
            const [regulations] = await promisePool.query(
                'SELECT regulation_id, regulation_name FROM regulation_master WHERE regulation_name = ?', [metadata.regulation_name]
            );
            if (regulations.length === 0) {
                validationErrors.push(`CRITICAL: Excel Regulation "${metadata.regulation_name}" not found in database. Please regenerate template.`);
            } else {
                console.log(`🔍 Found Excel Regulation: ID=${regulations[0].regulation_id}, Name="${regulations[0].regulation_name}"`);
                // CRITICAL: Check if Excel regulation matches selected regulation
                if (regulations[0].regulation_id !== parseInt(regulation_id)) {
                    const [selectedRegulation] = await promisePool.query(
                        'SELECT regulation_name FROM regulation_master WHERE regulation_id = ?', [regulation_id]
                    );
                    validationErrors.push(`CRITICAL: Excel Regulation "${metadata.regulation_name}" does not match selected Regulation "${selectedRegulation[0]?.regulation_name}". Please regenerate template with correct filters.`);
                    console.log(`❌ Regulation mismatch: Excel ID=${regulations[0].regulation_id} vs Selected ID=${regulation_id}`);
                } else {
                    console.log(`✅ Regulation matches: Excel ID=${regulations[0].regulation_id} == Selected ID=${regulation_id}`);
                }
            }
        }
        
        console.log('🔍 Validation errors found:', validationErrors);
        
        // BLOCK IMPORT if validation errors exist
        if (validationErrors.length > 0) {
            console.log('❌ CRITICAL VALIDATION FAILED:', validationErrors);
            return res.status(400).json({
                status: 'error',
                message: 'Excel template context mismatch',
                validation_errors: validationErrors
            });
        }
        
        console.log('✅ CRITICAL VALIDATION PASSED: Excel metadata matches selected filters');
        
        // ========================================
        // END CRITICAL VALIDATION - Continue with existing logic
        // ========================================
        
        // Validate metadata matches current filters (non-blocking validation)
        const validationWarnings = [];
        
        if (metadata.programme_id && metadata.programme_id !== parseInt(programme_id)) {
            validationWarnings.push(`Excel Programme ID (${metadata.programme_id}) differs from selected (${programme_id})`);
        }
        
        if (metadata.batch_id && metadata.batch_id !== parseInt(batch_id)) {
            validationWarnings.push(`Excel Batch ID (${metadata.batch_id}) differs from selected (${batch_id})`);
        }
        
        if (metadata.branch_id && metadata.branch_id !== parseInt(branch_id)) {
            validationWarnings.push(`Excel Branch ID (${metadata.branch_id}) differs from selected (${branch_id})`);
        }
        
        if (metadata.regulation_id && metadata.regulation_id !== parseInt(regulation_id)) {
            validationWarnings.push(`Excel Regulation ID (${metadata.regulation_id}) differs from selected (${regulation_id})`);
        }
        
        // Log validation warnings but don't block import
        if (validationWarnings.length > 0) {
            console.log('⚠️ Excel Metadata Validation Warnings:', validationWarnings);
            // Continue with import - non-blocking validation
        }
        
        // ========================================
        // END VALIDATION - Continue with existing logic
        // ========================================
        
        const students = [];
        const errors = [];
        
        // Read data starting from row 8 (after metadata and headers)
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber < 8) return; // Skip metadata and headers
            
            const values = row.values;
            if (!values[1]) return; // Skip empty rows (column A is Admission Number)
            
            try {
                const student = {
                    admission_number: values[1],  // Column A
                    ht_number: values[2] || null,  // Column B
                    roll_number: values[3],  // Column C
                    full_name: values[4],  // Column D
                    date_of_birth: values[5],  // Column E
                    gender: values[6],  // Column F
                    father_name: values[7],  // Column G
                    mother_name: values[8],  // Column H
                    aadhaar_number: values[9] || null,  // Column I
                    caste_category: values[10] || null,  // Column J
                    student_mobile: values[11] || null,  // Column K
                    parent_mobile: values[12],  // Column L
                    email: values[13] || null,  // Column M
                    section: values[14] || 'A'  // Column N
                };
                
                // Validation
                if (!student.admission_number || !student.roll_number || !student.full_name) {
                    throw new Error('Missing required fields');
                }
                
                // ========================================
                // 🚨 VALIDATION: Content Context Check (Non-Blocking)
                // ========================================
                
                // Add context validation warnings (non-blocking)
                const contentWarnings = [];
                
                // Note: Excel data doesn't contain programme/branch/batch info directly
                // This validation would be relevant if Excel had those columns
                // For now, we log the validation for future enhancement
                
                if (contentWarnings.length > 0) {
                    console.log(`⚠️ Row ${rowNumber} Content Validation Warnings:`, contentWarnings);
                    // Continue with import - non-blocking validation
                }
                
                // ========================================
                // END VALIDATION - Continue with existing logic
                // ========================================
                
                students.push(student);
            } catch (error) {
                errors.push({
                    row: rowNumber,
                    error: error.message
                });
            }
        });
        
        // Start transaction
        const connection = await promisePool.getConnection();
        await connection.beginTransaction();
        
        try {
            let imported = 0;
            let skipped = 0;
            
            // Get section_id if section name provided
            let actualSectionId = section_id;
            if (!actualSectionId && students.length > 0) {
                const [sections] = await connection.query(
                    'SELECT section_id FROM section_master WHERE section_name = ? AND is_active = 1 LIMIT 1',
                    [students[0].section]
                );
                if (sections.length > 0) {
                    actualSectionId = sections[0].section_id;
                }
            }
            
            // Get academic year from batch
            const [batches] = await connection.query(
                'SELECT batch_name FROM batch_master WHERE batch_id = ?',
                [batch_id]
            );
            const academicYear = batches.length > 0 ? batches[0].batch_name : new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);
            
            for (const student of students) {
                // Check if student already exists
                const [existing] = await connection.query(
                    'SELECT student_id FROM student_master WHERE admission_number = ?',
                    [student.admission_number]
                );
                
                if (existing.length > 0) {
                    skipped++;
                    errors.push({
                        admission_number: student.admission_number,
                        error: 'Student already exists'
                    });
                    continue;
                }
                
                // Insert into student_master
                const [result] = await connection.query(
                    `INSERT INTO student_master (
                        admission_number, ht_number, roll_number, full_name,
                        date_of_birth, gender, father_name, mother_name,
                        aadhaar_number, caste_category, student_mobile, parent_mobile, email,
                        programme_id, branch_id, batch_id, section_id,
                        joining_regulation_id, current_regulation_id,
                        admission_date, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 1)`,
                    [
                        student.admission_number, student.ht_number, student.roll_number, student.full_name,
                        student.date_of_birth, student.gender, student.father_name, student.mother_name,
                        student.aadhaar_number, student.caste_category, student.student_mobile, 
                        student.parent_mobile, student.email,
                        programme_id, branch_id, batch_id, actualSectionId,
                        regulation_id, regulation_id
                    ]
                );
                
                const studentId = result.insertId;
                
                // Insert into student_semester_history (Semester I)
                await connection.query(
                    `INSERT INTO student_semester_history (
                        student_id, academic_year, semester_id,
                        programme_id, branch_id, batch_id, regulation_id, section_id,
                        roll_number, student_status, status_date,
                        is_promoted, created_by
                    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 'In Roll', CURDATE(), 0, 'system')`,
                    [
                        studentId, academicYear,
                        programme_id, branch_id, batch_id, regulation_id, actualSectionId,
                        student.roll_number
                    ]
                );
                
                imported++;
            }
            
            await connection.commit();
            
            // Delete uploaded file
            fs.unlinkSync(req.file.path);
            
            // ========================================
            // 🚨 VALIDATION: Include Validation Summary
            // ========================================
            
            const response = {
                status: 'success',
                message: 'Import completed successfully',
                data: {
                    imported,
                    skipped,
                    total: students.length,
                    errors: errors
                }
            };
            
            // Add validation warnings to response if any (non-blocking)
            if (validationWarnings.length > 0) {
                response.data.validation_warnings = validationWarnings;
                console.log('📋 Validation Summary:', validationWarnings);
            }
            
            // ========================================
            // END VALIDATION - Send Response
            // ========================================
            
            res.json(response);
            
            connection.release();
        } catch (error) {
            await connection.rollback();
            connection.release();
            
            console.error('Error importing initial database:', error);
            
            // Clean up file
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            res.status(500).json({
                status: 'error',
                message: 'Failed to import database',
                error: error.message
            });
        }
    } catch (error) {
        console.error('Error importing initial database:', error);
        
        // Clean up file
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to import database',
            error: error.message
        });
    }
});

// ========================================
// TAB 2: IMPORT PHOTOS
// ========================================

router.post('/import-photos/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }
        
        console.log('Importing photos from ZIP:', req.file.originalname);
        
        // Extract ZIP
        const zip = new AdmZip(req.file.path);
        const zipEntries = zip.getEntries();
        
        let uploaded = 0;
        let failed = 0;
        const uploadErrors = [];
        
        // Create photos directory
        const photosDir = path.join(__dirname, '../public/uploads/photos');
        if (!fs.existsSync(photosDir)) {
            fs.mkdirSync(photosDir, { recursive: true });
        }
        
        for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            
            const filename = path.basename(entry.entryName);
            const ext = path.extname(filename).toLowerCase();
            
            // Only process image files
            if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
                continue;
            }
            
            try {
                // Extract roll number from filename (e.g., B25AI001.jpg -> B25AI001)
                const rollNumber = path.parse(filename).name;
                
                // Find student by roll number
                const [students] = await promisePool.query(
                    'SELECT student_id FROM student_master WHERE roll_number = ? AND is_active = 1',
                    [rollNumber]
                );
                
                if (students.length === 0) {
                    uploadErrors.push({
                        filename,
                        error: 'Student not found with roll number: ' + rollNumber
                    });
                    failed++;
                    continue;
                }
                
                // Save photo
                const photoPath = path.join(photosDir, filename);
                fs.writeFileSync(photoPath, entry.getData());
                
                // Update student_master with photo URL
                await promisePool.query(
                    'UPDATE student_master SET photo_url = ? WHERE student_id = ?',
                    [`/uploads/photos/${filename}`, students[0].student_id]
                );
                
                uploaded++;
                
            } catch (error) {
                console.error('Error processing photo:', filename, error);
                uploadErrors.push({
                    filename,
                    error: error.message
                });
                failed++;
            }
        }
        
        // Clean up ZIP file
        fs.unlinkSync(req.file.path);
        
        res.json({
            status: 'success',
            message: `Photo import completed: ${uploaded} photos uploaded, ${failed} failed`,
            data: {
                uploaded,
                failed,
                total: zipEntries.filter(e => !e.isDirectory).length,
                errors: uploadErrors
            }
        });
        
    } catch (error) {
        console.error('Error importing photos:', error);
        
        // Clean up file
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to import photos',
            error: error.message
        });
    }
});
// TAB 3: STUDENT MANAGEMENT (VIEW)
// ========================================

router.get('/students', async (req, res) => {
    try {
        const { 
            programme_id, 
            batch_id, 
            branch_id, 
            semester_id, 
            section_id,
            student_status,
            search 
        } = req.query;
        
        let query = `
            SELECT 
                sm.student_id,
                sm.admission_number,
                sm.roll_number,
                sm.full_name,
                sm.date_of_birth,
                sm.gender,
                sm.father_name,
                sm.mother_name,
                sm.student_mobile,
                sm.parent_mobile,
                sm.email,
                sm.photo_url,
                ssh.semester_id,
                ssh.student_status,
                ssh.academic_year,
                ssh.semester_history_id,
                p.programme_name,
                p.programme_code,
                br.branch_name,
                br.branch_code,
                b.batch_name,
                r.regulation_name,
                sec.section_name
            FROM student_master sm
            INNER JOIN student_semester_history ssh ON sm.student_id = ssh.student_id
            LEFT JOIN programme_master p ON ssh.programme_id = p.programme_id
            LEFT JOIN branch_master br ON ssh.branch_id = br.branch_id
            LEFT JOIN batch_master b ON ssh.batch_id = b.batch_id
            LEFT JOIN regulation_master r ON ssh.regulation_id = r.regulation_id
            LEFT JOIN section_master sec ON ssh.section_id = sec.section_id
            WHERE sm.is_active = 1
        `;
        
        const params = [];
        
        // Filters on semester_history
        if (programme_id) {
            query += ' AND ssh.programme_id = ?';
            params.push(programme_id);
        }
        
        if (batch_id) {
            query += ' AND ssh.batch_id = ?';
            params.push(batch_id);
        }
        
        if (branch_id) {
            query += ' AND ssh.branch_id = ?';
            params.push(branch_id);
        }
        
        if (semester_id) {
            query += ' AND ssh.semester_id = ?';
            params.push(semester_id);
        }
        
        if (section_id) {
            query += ' AND ssh.section_id = ?';
            params.push(section_id);
        }
        
        if (student_status) {
            query += ' AND ssh.student_status = ?';
            params.push(student_status);
        }
        
        if (search) {
            query += ' AND (sm.full_name LIKE ? OR sm.admission_number LIKE ? OR sm.roll_number LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        query += ' ORDER BY sm.admission_number';
        
        const [students] = await promisePool.query(query, params);
        
        // Calculate statistics
        const statistics = {
            total: students.length,
            boys: students.filter(s => s.gender === 'Male').length,
            girls: students.filter(s => s.gender === 'Female').length,
            on_roll: students.filter(s => s.student_status === 'In Roll').length,
            detained: students.filter(s => s.student_status === 'Detained').length,
            left: students.filter(s => s.student_status === 'Left').length
        };
        
        res.json({
            status: 'success',
            message: 'Students retrieved successfully',
            data: {
                students,
                statistics
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

// ========================================
// TAB 4: REGULATION/BATCH MAPPING
// ========================================

// Get students for mapping
router.get('/mapping/students', async (req, res) => {
    try {
        const { programme_id, branch_id, batch_id, semester_id, student_status } = req.query;
        
        let query = `
            SELECT 
                sm.student_id,
                sm.roll_number,
                sm.full_name,
                ssh.semester_history_id,
                ssh.batch_id,
                ssh.regulation_id,
                b.batch_name,
                r.regulation_name
            FROM student_master sm
            INNER JOIN student_semester_history ssh ON sm.student_id = ssh.student_id
            LEFT JOIN batch_master b ON ssh.batch_id = b.batch_id
            LEFT JOIN regulation_master r ON ssh.regulation_id = r.regulation_id
            WHERE sm.is_active = 1
        `;
        
        const params = [];
        
        if (programme_id) {
            query += ' AND ssh.programme_id = ?';
            params.push(programme_id);
        }
        
        if (branch_id) {
            query += ' AND ssh.branch_id = ?';
            params.push(branch_id);
        }
        
        if (batch_id) {
            query += ' AND ssh.batch_id = ?';
            params.push(batch_id);
        }
        
        if (semester_id) {
            query += ' AND ssh.semester_id = ?';
            params.push(semester_id);
        }
        
        if (student_status) {
            query += ' AND ssh.student_status = ?';
            params.push(student_status);
        }
        
        query += ' ORDER BY sm.roll_number';
        
        const [students] = await promisePool.query(query, params);
        
        res.json({
            status: 'success',
            data: { students }
        });
        
    } catch (error) {
        console.error('Error fetching students for mapping:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch students',
            error: error.message
        });
    }
});

// Get semester-wise mapping view
router.get('/mapping/semester-view', async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id } = req.query;
        
        let query = `
            SELECT 
                sm.roll_number,
                ssh.semester_id,
                b.batch_name,
                r.regulation_name,
                CONCAT(b.batch_name, '-', r.regulation_name) as mapping
            FROM student_master sm
            INNER JOIN student_semester_history ssh ON sm.student_id = ssh.student_id
            LEFT JOIN batch_master b ON ssh.batch_id = b.batch_id
            LEFT JOIN regulation_master r ON ssh.regulation_id = r.regulation_id
            WHERE sm.is_active = 1
        `;
        
        const params = [];
        
        if (programme_id) {
            query += ' AND ssh.programme_id = ?';
            params.push(programme_id);
        }
        
        if (batch_id) {
            query += ' AND ssh.batch_id = ?';
            params.push(batch_id);
        }
        
        if (branch_id) {
            query += ' AND ssh.branch_id = ?';
            params.push(branch_id);
        }
        
        query += ' ORDER BY sm.roll_number, ssh.semester_id';
        
        const [mappings] = await promisePool.query(query, params);
        
        // Transform into pivot table structure
        const pivotData = {};
        
        mappings.forEach(row => {
            if (!pivotData[row.roll_number]) {
                pivotData[row.roll_number] = {};
            }
            pivotData[row.roll_number][`sem_${row.semester_id}`] = row.mapping;
        });
        
        res.json({
            status: 'success',
            data: { mappings: pivotData }
        });
        
    } catch (error) {
        console.error('Error fetching semester view:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch semester view',
            error: error.message
        });
    }
});

// Update batch/regulation for selected students
router.post('/mapping/update', async (req, res) => {
    try {
        const { student_ids, batch_id, regulation_id, semester_id } = req.body;
        
        if (!student_ids || student_ids.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No students selected'
            });
        }
        
        const connection = await promisePool.getConnection();
        await connection.beginTransaction();
        
        try {
            let updates = [];
            
            if (batch_id) {
                updates.push('batch_id = ?');
            }
            if (regulation_id) {
                updates.push('regulation_id = ?');
            }
            
            if (updates.length === 0) {
                throw new Error('No updates specified');
            }
            
            const params = [];
            if (batch_id) params.push(batch_id);
            if (regulation_id) params.push(regulation_id);
            
            // Add WHERE conditions
            params.push(...student_ids);
            params.push(semester_id);
            
            const query = `
                UPDATE student_semester_history 
                SET ${updates.join(', ')}, updated_by = 'system', updated_at = NOW()
                WHERE student_id IN (${student_ids.map(() => '?').join(',')})
                    AND semester_id = ?
            `;
            
            await connection.query(query, params);
            await connection.commit();
            
            res.json({
                status: 'success',
                message: `Updated ${student_ids.length} students successfully`
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Error updating mapping:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update mapping',
            error: error.message
        });
    }
});

// ========================================
// TAB 5: PROMOTIONS
// ========================================
// ========================================
// TAB 5: PROMOTIONS
router.get('/promotions/stats', async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id, semester_number } = req.query;

        if (!programme_id || !batch_id || !branch_id || !semester_number) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required parameters'
            });
        }

        const query = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN student_status = 'In Roll' THEN 1 ELSE 0 END) as on_roll,
                SUM(CASE WHEN student_status = 'Detained' THEN 1 ELSE 0 END) as detained,
                SUM(CASE WHEN student_status = 'Left' THEN 1 ELSE 0 END) as left_out
            FROM student_semester_history
            WHERE programme_id = ?
            AND batch_id = ?
            AND branch_id = ?
            AND semester_id = ?
            AND student_status IN ('In Roll', 'Detained', 'Left', 'Completed', 'Dropout')
        `;

        const params = [programme_id, batch_id, branch_id, semester_number];

        const [stats] = await promisePool.query(query, params);

        res.json({
            status: 'success',
            data: {
                total: stats[0]?.total || 0,
                on_roll: stats[0]?.on_roll || 0,
                detained: stats[0]?.detained || 0,
                left: stats[0]?.left_out || 0
            }
        });

    } catch (error) {
        console.error('Error fetching promotion statistics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
});


// ========================================
// PROMOTION SUMMARY (NEW!)
// ========================================
router.post('/promotions/summary', async (req, res) => {
    try {
        console.log('=== PROMOTION SUMMARY REQUEST ===');
        console.log('Body:', req.body);
        
        const { programme_id, batch_id, branch_id, semester_id } = req.body;

        if (!programme_id || !batch_id || !branch_id || !semester_id) {
            console.log('Missing required fields');
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields'
            });
        }

        console.log('Querying with params:', [programme_id, batch_id, branch_id, semester_id]);

     
        // Get students summary for promotion
        const [students] = await promisePool.query(
            `SELECT 
                COUNT(*) as total_students,
                SUM(CASE WHEN student_status = 'In Roll' THEN 1 ELSE 0 END) as in_roll,
                SUM(CASE WHEN student_status = 'Detained' THEN 1 ELSE 0 END) as detained,
                SUM(CASE WHEN student_status = 'Left' THEN 1 ELSE 0 END) as students_left,
                SUM(CASE WHEN student_status = 'Completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN student_status = 'Dropout' THEN 1 ELSE 0 END) as dropout
            FROM student_semester_history
            WHERE programme_id = ?
            AND batch_id = ?
            AND branch_id = ?
            AND semester_id = ?
            AND student_status IN ('In Roll', 'Detained', 'Left', 'Completed', 'Dropout')
            `,
            [programme_id, batch_id, branch_id, semester_id]
        );

        console.log('Query result:', students);

        const summary = students[0];

        res.json({
            status: 'success',
            data: {
                total_students: summary.total_students || 0,
                in_roll: summary.in_roll || 0,
                detained: summary.detained || 0,
                left: summary.students_left || 0,
                completed: summary.completed || 0,
                dropout: summary.dropout || 0,
                eligible_for_promotion: summary.in_roll || 0 // Only "In Roll" students can be promoted
            }
        });

    } catch (error) {
        console.error('Error getting promotion summary:', error);
        console.error('Error details:', error.stack);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get promotion summary',
            error: error.message
        });
    }
});

// ========================================
// PERFORM PROMOTION
// ========================================
router.post('/promotions/promote', async (req, res) => {

    try {
        console.log('=== PROMOTION EXECUTION REQUEST ===');
        console.log('Body:', req.body);

        const {
            from_programme_id,
            from_batch_id,
            from_branch_id,
            from_semester_id,
            to_programme_id,
            to_batch_id,
            to_branch_id,
            to_semester_id,
            to_regulation_id,
            to_section_id,
            academic_year
        } = req.body;

        // Validate required fields
        if (!from_programme_id || !from_batch_id || !from_branch_id || !from_semester_id || !to_semester_id || !academic_year) {
            console.log('Missing required fields');
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields for promotion'
            });
        }

        const connection = await promisePool.getConnection();
        await connection.beginTransaction();

        try {

           // ✅ FIXED - get students from student_semester_history (where data actually exists)
const [students] = await connection.query(
    `SELECT 
        sm.student_id,
        sm.admission_number,
        sm.roll_number,
        sm.full_name,
        ssh.programme_id,
        ssh.batch_id,
        ssh.branch_id,
        ssh.semester_id,
        ssh.regulation_id,
        ssh.section_id
     FROM student_master sm
     INNER JOIN student_semester_history ssh ON sm.student_id = ssh.student_id
     WHERE ssh.programme_id = ?
       AND ssh.batch_id = ?
       AND ssh.branch_id = ?
       AND ssh.semester_id = ?
       AND ssh.student_status = 'In Roll'
       AND sm.is_active = 1`,
    [from_programme_id, from_batch_id, from_branch_id, from_semester_id]
);

            if (students.length === 0) {
                throw new Error('No students found to promote');
            }

            let promotedCount = 0;

            // 2️⃣ Loop students
           for (const student of students) {
    // All students from student_master are "In Roll" by default
    // ✅ Update student_master to new semester
// ✅ FIXED - use actual column names from your schema
await connection.query(
    `UPDATE student_master 
     SET semester_id = ?,
         current_regulation_id = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE student_id = ?`,
    [to_semester_id, to_regulation_id || student.regulation_id, student.student_id]
);

           // STEP 1: Mark existing sem 1 record as 'Promoted'
        await connection.query(
            `UPDATE student_semester_history
             SET student_status = 'Promoted',
                 is_promoted = 1,
                 promotion_date = CURRENT_DATE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE student_id = ?
               AND semester_id = ?
               AND student_status = 'In Roll'`,
            [student.student_id, from_semester_id]
        );

        // STEP 2: Insert NEW record for next semester (sem 2)
        await connection.query(
            `INSERT INTO student_semester_history 
             (student_id, academic_year, semester_id, programme_id, branch_id, batch_id, 
              regulation_id, section_id, roll_number, student_status, status_date, 
              is_promoted, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'In Roll', CURRENT_DATE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                student.student_id,
                academic_year,
                to_semester_id,          // ✅ NEW semester (2), not old (1)
                student.programme_id,
                student.branch_id,
                student.batch_id,
                to_regulation_id || student.regulation_id,
                to_section_id || student.section_id,
                student.roll_number
            ]
        );

        promotedCount++;
    }
            // 3️⃣ Log the promotion
            await connection.query(
                `INSERT INTO promotion_batch_log 
                 (promotion_name,
                  from_programme_id,
                  from_batch_id,
                  from_branch_id,
                  from_semester,
                  to_programme_id,
                  to_batch_id,
                  to_branch_id,
                  to_semester,
                  to_academic_year,
                  to_regulation_id,
                  total_students,
                  promoted_count,
                  skipped_count,
                  executed_by,
                  remarks)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    `Sem-${from_semester_id} to Sem-${to_semester_id}`,
                    from_programme_id,
                    from_batch_id,
                    from_branch_id,
                    from_semester_id,
                    to_programme_id,
                    to_batch_id,
                    to_branch_id,
                    to_semester_id,
                    academic_year,
                    to_regulation_id,
                    students.length,
                    promotedCount,
                    students.length - promotedCount,
                    'system',
                    'Promotion executed successfully'
                ]
            );

            await connection.commit();

            res.json({
                status: 'success',
                message: `Successfully promoted ${promotedCount} students to Semester ${to_semester_id}`,
                data: {
                    total_students: students.length,
                    promoted: promotedCount,
                    skipped: students.length - promotedCount
                }
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error promoting students:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to promote students',
            error: error.message
        });
    }
});


module.exports = { initializeRouter };

// ========================================
// ELECTIVE GROUP ALLOTMENT ROUTES
// ========================================

// Get available students for elective group
router.get('/elective-group/available-students', async (req, res) => {
    try {
        const { 
            programme_id, 
            branch_id, 
            batch_id, 
            semester_id, 
            regulation_id,
            academic_year,
            group_category,
            elective_subject_id 
        } = req.query;
        
        console.log('=== GET AVAILABLE STUDENTS FOR ELECTIVE GROUP ===');
        console.log('Filters:', { 
            programme_id, branch_id, batch_id, semester_id, 
            regulation_id, academic_year, group_category, elective_subject_id 
        });
        
        const connection = await promisePool.getConnection();
        
        try {
            // Get students who are NOT yet allotted to this group
            const [availableStudents] = await connection.query(`
                SELECT 
                    sm.student_id,
                    sm.admission_number,
                    sm.roll_number,
                    sm.full_name,
                    ssh.programme_id,
                    ssh.branch_id,
                    ssh.batch_id,
                    ssh.semester_id,
                    ssh.regulation_id,
                    b.batch_name,
                    br.branch_name,
                    r.regulation_name
                FROM student_master sm
                INNER JOIN student_semester_history ssh ON sm.student_id = ssh.student_id
                LEFT JOIN batch_master b ON ssh.batch_id = b.batch_id
                LEFT JOIN branch_master br ON ssh.branch_id = br.branch_id
                LEFT JOIN regulation_master r ON ssh.regulation_id = r.regulation_id
                LEFT JOIN student_elective_mapping sem ON sm.student_id = sem.student_id 
                    AND sem.programme_id = ssh.programme_id
                    AND sem.branch_id = ssh.branch_id
                    AND sem.batch_id = ssh.batch_id
                    AND sem.semester_id = ssh.semester_id
                    AND sem.subject_id = ?
                    AND sem.is_active = 1
                WHERE sm.is_active = 1
                AND ssh.student_status = 'In Roll'
                AND ssh.programme_id = ?
                AND ssh.branch_id = ?
                AND ssh.batch_id = ?
                AND ssh.semester_id = ?
                AND ssh.regulation_id = ?
                AND sem.mapping_id IS NULL
                ORDER BY sm.roll_number
            `, [
                elective_subject_id,
                programme_id,
                branch_id,
                batch_id,
                semester_id,
                regulation_id
            ]);
            
            console.log(`Found ${availableStudents.length} available students for group ${group_category}`);
            
            res.json({
                status: 'success',
                data: availableStudents,
                filters: { 
                    programme_id, branch_id, batch_id, semester_id, 
                    regulation_id, academic_year, group_category 
                },
                total_students: availableStudents.length
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Error getting available students for elective group:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get available students',
            error: error.message
        });
    }
});

// Get allotted students for elective group
router.get('/elective-group/allotted-students', async (req, res) => {
    try {
        const { 
            programme_id, 
            branch_id, 
            batch_id, 
            semester_id, 
            regulation_id,
            academic_year,
            group_category,
            elective_subject_id 
        } = req.query;
        
        console.log('=== GET ALLOTTED STUDENTS FOR ELECTIVE GROUP ===');
        console.log('Filters:', { 
            programme_id, branch_id, batch_id, semester_id, 
            regulation_id, academic_year, group_category, elective_subject_id 
        });
        
        const connection = await promisePool.getConnection();
        
        try {
            // Get students who are allotted to this group
            const [allottedStudents] = await connection.query(`
                SELECT 
                    sem.mapping_id,
                    sem.student_id,
                    sem.subject_id as elective_subject_id,
                    sem.elective_name,
                    sem.mapped_date as allotted_date,
                    sm.admission_number,
                    sm.roll_number,
                    sm.full_name,
                    sub.syllabus_code,
                    sub.subject_name
                FROM student_elective_mapping sem
                INNER JOIN student_master sm ON sem.student_id = sm.student_id
                LEFT JOIN subject_master sub ON sem.subject_id = sub.subject_id
                WHERE sem.programme_id = ?
                AND sem.branch_id = ?
                AND sem.batch_id = ?
                AND sem.semester_id = ?
                AND sem.subject_id = ?
                AND sem.is_active = 1
                ORDER BY sm.roll_number
            `, [
                programme_id,
                branch_id,
                batch_id,
                semester_id,
                elective_subject_id
            ]);
            
            console.log(`Found ${allottedStudents.length} allotted students for group ${group_category}`);
            
            res.json({
                status: 'success',
                data: allottedStudents,
                filters: { 
                    programme_id, branch_id, batch_id, semester_id, 
                    regulation_id, academic_year, group_category 
                },
                total_students: allottedStudents.length
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Error getting allotted students for elective group:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get allotted students',
            error: error.message
        });
    }
});

// Save elective group allotment
router.post('/elective-group/save-allotment', async (req, res) => {
    try {
        const { 
            programme_id, 
            branch_id, 
            batch_id, 
            semester_id, 
            regulation_id,
            academic_year,
            elective_subject_id,
            elective_name,
            student_ids 
        } = req.body;
        
        console.log('=== SAVE ELECTIVE GROUP ALLOTMENT ===');
        console.log('Data:', { 
            programme_id, branch_id, batch_id, semester_id, 
            regulation_id, academic_year, elective_subject_id, elective_name, 
            student_count: student_ids?.length 
        });
        
        if (!student_ids || student_ids.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No students selected for allotment'
            });
        }
        
        const connection = await promisePool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Insert allotment records for each student
            const allotmentPromises = student_ids.map(student_id => 
                connection.query(`
                    INSERT INTO student_elective_mapping 
                    (student_id, programme_id, batch_id, branch_id, semester_id, 
                     subject_id, elective_name, academic_year, mapped_date, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 1)
                    ON DUPLICATE KEY UPDATE
                    subject_id = VALUES(subject_id),
                    elective_name = VALUES(elective_name),
                    academic_year = VALUES(academic_year),
                    mapped_date = CURDATE(),
                    is_active = 1,
                    updated_at = CURRENT_TIMESTAMP
                `, [
                    student_id, programme_id, batch_id, branch_id, semester_id,
                    elective_subject_id, elective_name, academic_year
                ])
            );
            
            await Promise.all(allotmentPromises);
            
            await connection.commit();
            
            res.json({
                status: 'success',
                message: `Successfully allotted ${student_ids.length} students to ${elective_name}`,
                data: {
                    allotted_count: student_ids.length,
                    elective_subject_id,
                    elective_name
                }
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Error saving elective group allotment:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to save elective group allotment',
            error: error.message
        });
    }
});
