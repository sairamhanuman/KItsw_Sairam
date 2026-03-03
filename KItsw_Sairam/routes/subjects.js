// Subject/Course Management Routes
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Constants for Excel structure
const CONTEXT_ROWS = 4;  // First 4 rows contain Programme, Branch, Semester, Regulation
const EMPTY_ROW = 1;     // Row 5 is empty separator
const HEADER_ROW = 1;    // Row 6 contains headers
const SUBJECT_DATA_START_ROW = CONTEXT_ROWS + EMPTY_ROW; // Row 6 (index 5) - start reading subject data from here

// Configure multer for Excel uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/excel/';
        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'subjects-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /xlsx|xls/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype || extname) {
            return cb(null, true);
        }
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'));
    }
});

// Create a promise pool for database operations
let promisePool;

// Database connection check middleware
function checkDbConnection(req, res, next) {
    if (!promisePool) {
        return res.status(500).json({
            success: false,
            message: 'Database connection not available'
        });
    }
    next();
}

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all subjects with filters
router.get('/', async (req, res) => {
    try {
        const { programme_id, branch_id, semester_id, regulation_id } = req.query;
        
        let query = `
            SELECT 
                s.*,
                p.programme_name,
                p.programme_code,
                b.branch_name,
                b.branch_code,
                sem.semester_name,
                r.regulation_name
            FROM subject_master s
            LEFT JOIN programme_master p ON s.programme_id = p.programme_id
            LEFT JOIN branch_master b ON s.branch_id = b.branch_id
            LEFT JOIN semester_master sem ON s.semester_id = sem.semester_id
            LEFT JOIN regulation_master r ON s.regulation_id = r.regulation_id
            WHERE s.is_active = 1
        `;
        
        const params = [];
        
        if (programme_id) {
            query += ' AND s.programme_id = ?';
            params.push(programme_id);
        }
        
        if (branch_id) {
            query += ' AND s.branch_id = ?';
            params.push(branch_id);
        }
        
        if (semester_id) {
            query += ' AND s.semester_id = ?';
            params.push(semester_id);
        }
        
        if (regulation_id) {
            query += ' AND s.regulation_id = ?';
            params.push(regulation_id);
        }
        
        query += ' ORDER BY s.subject_order, s.subject_name';
        
        const [rows] = await promisePool.query(query, params);
        
        res.json({
            status: 'success',
            message: 'Subjects retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch subjects',
            error: error.message
        });
    }
});



// POST create new subject
router.post('/', async (req, res) => {
    try {
        const {
            programme_id, branch_id, semester_id, regulation_id,
            subject_order, syllabus_code, ref_code, internal_exam_code,
            external_exam_code, subject_name, subject_type,
            internal_max_marks, external_max_marks, ta_max_marks,
            credits, is_elective, is_under_group, is_exempt_exam_fee,
            replacement_group_order, is_running_curriculum, is_locked
        } = req.body;
        
        // Validation
        if (!programme_id || !branch_id || !semester_id || !regulation_id || !syllabus_code || !subject_name) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: programme_id, branch_id, semester_id, regulation_id, syllabus_code, subject_name'
            });
        }
        
        // Check if syllabus code already exists for this combination
        const [existing] = await promisePool.query(
            `SELECT subject_id FROM subject_master 
             WHERE syllabus_code = ? AND programme_id = ? AND branch_id = ? 
             AND semester_id = ? AND regulation_id = ? AND is_active = 1`,
            [syllabus_code, programme_id, branch_id, semester_id, regulation_id]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'Subject with this syllabus code already exists for the selected filters'
            });
        }
        
        // Insert new subject
        const [result] = await promisePool.query(
            `INSERT INTO subject_master (
                programme_id, branch_id, semester_id, regulation_id,
                subject_order, syllabus_code, ref_code, internal_exam_code,
                external_exam_code, subject_name, subject_type,
                internal_max_marks, external_max_marks, ta_max_marks,
                credits, is_elective, is_under_group, is_exempt_exam_fee,
                replacement_group_order, is_running_curriculum, is_locked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                programme_id, branch_id, semester_id, regulation_id,
                subject_order || 1, syllabus_code, ref_code || null, 
                internal_exam_code || null, external_exam_code || null,
                subject_name, subject_type || 'Theory',
                internal_max_marks || 0, external_max_marks || 0, ta_max_marks || 0,
                credits || 0, is_elective || 0, is_under_group || 0, 
                is_exempt_exam_fee || 0, replacement_group_order || null,
                is_running_curriculum !== false ? 1 : 0, is_locked || 0
            ]
        );
        
        res.status(201).json({
            status: 'success',
            message: 'Subject created successfully',
            data: {
                subject_id: result.insertId
            }
        });
    } catch (error) {
        console.error('Error creating subject:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create subject',
            error: error.message
        });
    }
});

// PUT update subject
router.put('/:id', async (req, res) => {
    try {
        const {
            subject_order, syllabus_code, ref_code, internal_exam_code,
            external_exam_code, subject_name, subject_type,
            internal_max_marks, external_max_marks, ta_max_marks,
            credits, is_elective, is_under_group, is_exempt_exam_fee,
            replacement_group_order, is_running_curriculum, is_locked
        } = req.body;
        
        // Check if subject exists
        const [existing] = await promisePool.query(
            'SELECT subject_id, is_locked FROM subject_master WHERE subject_id = ?',
            [req.params.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Subject not found'
            });
        }
        
        // Check if subject is locked
        if (existing[0].is_locked && is_locked === undefined) {
            return res.status(403).json({
                status: 'error',
                message: 'Subject is locked and cannot be modified'
            });
        }
        
        // Update subject
        await promisePool.query(
            `UPDATE subject_master 
            SET subject_order = ?, syllabus_code = ?, ref_code = ?, 
                internal_exam_code = ?, external_exam_code = ?, 
                subject_name = ?, subject_type = ?,
                internal_max_marks = ?, external_max_marks = ?, ta_max_marks = ?,
                credits = ?, is_elective = ?, is_under_group = ?, 
                is_exempt_exam_fee = ?, replacement_group_order = ?,
                is_running_curriculum = ?, is_locked = ?
            WHERE subject_id = ?`,
            [
                subject_order, syllabus_code, ref_code,
                internal_exam_code, external_exam_code,
                subject_name, subject_type,
                internal_max_marks, external_max_marks, ta_max_marks,
                credits, is_elective, is_under_group,
                is_exempt_exam_fee, replacement_group_order,
                is_running_curriculum, is_locked,
                req.params.id
            ]
        );
        
        res.json({
            status: 'success',
            message: 'Subject updated successfully'
        });
    } catch (error) {
        console.error('Error updating subject:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update subject',
            error: error.message
        });
    }
});

// DELETE subject (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if subject exists and is active
        const [existing] = await promisePool.query(
            'SELECT * FROM subject_master WHERE subject_id = ? AND is_active = 1',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Subject not found or already deleted'
            });
        }
        
        // Check if subject is locked
        if (existing[0].is_locked) {
            return res.status(403).json({
                status: 'error',
                message: 'Subject is locked and cannot be deleted'
            });
        }
        
        // Soft delete
        await promisePool.query(
            'UPDATE subject_master SET is_active = 0, deleted_at = NOW() WHERE subject_id = ?',
            [id]
        );
        
        res.json({
            status: 'success',
            message: 'Subject deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting subject:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete subject',
            error: error.message
        });
    }
});

// POST Toggle lock status
router.post('/:id/toggle-lock', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [existing] = await promisePool.query(
            'SELECT is_locked FROM subject_master WHERE subject_id = ?',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Subject not found'
            });
        }
        
        const newLockStatus = existing[0].is_locked ? 0 : 1;
        
        await promisePool.query(
            'UPDATE subject_master SET is_locked = ? WHERE subject_id = ?',
            [newLockStatus, id]
        );
        
        res.json({
            status: 'success',
            message: `Subject ${newLockStatus ? 'locked' : 'unlocked'} successfully`,
            data: { is_locked: newLockStatus }
        });
    } catch (error) {
        console.error('Error toggling lock:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to toggle lock status',
            error: error.message
        });
    }
});

// POST Toggle running curriculum status
router.post('/:id/toggle-running', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [existing] = await promisePool.query(
            'SELECT is_running_curriculum FROM subject_master WHERE subject_id = ?',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Subject not found'
            });
        }
        
        const newStatus = existing[0].is_running_curriculum ? 0 : 1;
        
        await promisePool.query(
            'UPDATE subject_master SET is_running_curriculum = ? WHERE subject_id = ?',
            [newStatus, id]
        );
        
        res.json({
            status: 'success',
            message: `Running curriculum status ${newStatus ? 'enabled' : 'disabled'} successfully`,
            data: { is_running_curriculum: newStatus }
        });
    } catch (error) {
        console.error('Error toggling running curriculum:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to toggle running curriculum status',
            error: error.message
        });
    }
});

// GET Generate sample Excel template with context pre-filled
router.get('/sample-excel', async (req, res) => {
    try {
        console.log('=== GENERATE SAMPLE EXCEL WITH CONTEXT ===');
        
        const { programme_id, branch_id, semester_id, regulation_id } = req.query;
        
        console.log('Filter context:', { programme_id, branch_id, semester_id, regulation_id });
        
        // Fetch context data based on selected filters
        let context = {
            Programme: '',
            Branch: '',
            Semester: '',
            Regulation: ''
        };
        
        // Fetch programme code
        if (programme_id) {
            try {
                const [prog] = await promisePool.query(
                    'SELECT programme_code FROM programme_master WHERE programme_id = ?',
                    [programme_id]
                );
                if (prog.length > 0) {
                    context.Programme = prog[0].programme_code;
                }
            } catch (err) {
                console.log('Could not fetch programme:', err.message);
            }
        }
        
        // Fetch branch code
        if (branch_id) {
            try {
                const [branch] = await promisePool.query(
                    'SELECT branch_code FROM branch_master WHERE branch_id = ?',
                    [branch_id]
                );
                if (branch.length > 0) {
                    context.Branch = branch[0].branch_code;
                }
            } catch (err) {
                console.log('Could not fetch branch:', err.message);
            }
        }
        
        // Fetch semester name
        if (semester_id) {
            try {
                const [sem] = await promisePool.query(
                    'SELECT semester_name FROM semester_master WHERE semester_id = ?',
                    [semester_id]
                );
                if (sem.length > 0) {
                    context.Semester = sem[0].semester_name;
                }
            } catch (err) {
                console.log('Could not fetch semester:', err.message);
            }
        }
        
        // Fetch regulation name
        if (regulation_id) {
            try {
                const [reg] = await promisePool.query(
                    'SELECT regulation_name FROM regulation_master WHERE regulation_id = ?',
                    [regulation_id]
                );
                if (reg.length > 0) {
                    context.Regulation = reg[0].regulation_name;
                }
            } catch (err) {
                console.log('Could not fetch regulation:', err.message);
            }
        }
        
        console.log('Excel context:', context);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Subjects');
        
        // Add context metadata rows (first 4 rows)
        worksheet.addRow(['Programme', context.Programme]);
        worksheet.addRow(['Branch', context.Branch]);
        worksheet.addRow(['Semester', context.Semester]);
        worksheet.addRow(['Regulation', context.Regulation]);
        worksheet.addRow([]); // Empty separator row
        
        // Add column headers (row 6)
        worksheet.addRow([
            'subject_order', 'syllabus_code', 'ref_code', 'internal_exam_code',
            'external_exam_code', 'subject_name', 'subject_type', 'internal_max_marks',
            'external_max_marks', 'ta_max_marks', 'credits', 'is_elective',
            'is_under_group', 'is_exempt_exam_fee'
        ]);
        
        // Add sample subject data
        worksheet.addRow([
            1, 'U18MH101', 'EM-I', 'U18MH101', 'U18MH101',
            'ENGINEERING MATHEMATICS - I', 'Theory', 30, 60, 0, 4,
            'No', 'No', 'No'
        ]);
        worksheet.addRow([
            2, 'U18CS102', 'PPSC', 'U18CS102', 'U18CS102',
            'PROGRAMMING FOR PROBLEM SOLVING IN C', 'Theory', 30, 60, 0, 3,
            'No', 'No', 'No'
        ]);
        
        // Set column widths for readability
        worksheet.columns = [
            { width: 20 },  // subject_order/Programme
            { width: 15 },  // syllabus_code/value
            { width: 15 },  // ref_code
            { width: 18 },  // internal_exam_code
            { width: 18 },  // external_exam_code
            { width: 40 },  // subject_name
            { width: 12 },  // subject_type
            { width: 12 },  // internal_max_marks
            { width: 12 },  // external_max_marks
            { width: 10 },  // ta_max_marks
            { width: 10 },  // credits
            { width: 12 },  // is_elective
            { width: 12 },  // is_under_group
            { width: 12 }   // is_exempt_exam_fee
        ];
        
        // Style the context rows (1-4) with bold labels
        for (let i = 1; i <= 4; i++) {
            worksheet.getRow(i).getCell(1).font = { bold: true };
        }
        
        // Style the header row (6) 
        const headerRow = worksheet.getRow(6);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        
        // Sanitize filename components to prevent path traversal
        const sanitize = (str) => str.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `subjects_template_${sanitize(context.Programme)}_${sanitize(context.Branch)}_${sanitize(context.Semester)}.xlsx`;
        
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        await workbook.xlsx.write(res);
        res.end();
        
        console.log('✅ Sample Excel generated with context in first 4 rows');
        
    } catch (error) {
        console.error('=== SAMPLE EXCEL ERROR ===');
        console.error('Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// POST Import subjects from Excel with context
router.post('/import/excel', upload.single('file'), async (req, res) => {
    try {
        console.log('=== IMPORT SUBJECTS FROM EXCEL WITH CONTEXT ===');
        
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.worksheets[0];
        
        // Extract context from first 4 rows
        const context = {
            programme: worksheet.getRow(1).getCell(2).value || '',     // Row 1: Programme | BTECH
            branch: worksheet.getRow(2).getCell(2).value || '',        // Row 2: Branch    | CSE
            semester: worksheet.getRow(3).getCell(2).value || '',      // Row 3: Semester  | I
            regulation: worksheet.getRow(4).getCell(2).value || ''     // Row 4: Regulation| URR-22
        };
        
        console.log('Excel context:', context);
        
        // Validate context
        if (!context.programme || !context.branch || !context.semester || !context.regulation) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing context in Excel. First 4 rows must contain Programme, Branch, Semester, and Regulation.'
            });
        }
        
        // Convert codes to IDs
        const [programme] = await promisePool.query(
            'SELECT programme_id FROM programme_master WHERE programme_code = ?',
            [context.programme]
        );
        
        if (!programme.length) {
            return res.status(400).json({
                status: 'error',
                message: `Programme not found: ${context.programme}`
            });
        }
        
        const [branch] = await promisePool.query(
            'SELECT branch_id FROM branch_master WHERE branch_code = ?',
            [context.branch]
        );
        
        if (!branch.length) {
            return res.status(400).json({
                status: 'error',
                message: `Branch not found: ${context.branch}`
            });
        }
        
        const [semester] = await promisePool.query(
            'SELECT semester_id FROM semester_master WHERE semester_name = ?',
            [context.semester]
        );
        
        if (!semester.length) {
            return res.status(400).json({
                status: 'error',
                message: `Semester not found: ${context.semester}`
            });
        }
        
        const [regulation] = await promisePool.query(
            'SELECT regulation_id FROM regulation_master WHERE regulation_name = ?',
            [context.regulation]
        );
        
        if (!regulation.length) {
            return res.status(400).json({
                status: 'error',
                message: `Regulation not found: ${context.regulation}`
            });
        }
        
        const programme_id = programme[0].programme_id;
        const branch_id = branch[0].branch_id;
        const semester_id = semester[0].semester_id;
        const regulation_id = regulation[0].regulation_id;
        
        console.log('Resolved IDs:', { programme_id, branch_id, semester_id, regulation_id });
        
        // Read subject data starting from row 7 (after context, empty row, and header row)
        // Row 1-4: Context, Row 5: Empty, Row 6: Headers, Row 7+: Data
        const subjectData = [];
        
        // Get header row (row 6) to map column names
        const headerRow = worksheet.getRow(6);
        const headers = [];
        headerRow.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value;
        });
        
        // Read data rows starting from row 7
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 6) { // Skip context, empty, and header rows
                const rowData = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber];
                    if (header) {
                        rowData[header] = cell.value;
                    }
                });
                // Only add non-empty rows
                if (Object.keys(rowData).length > 0 && rowData.syllabus_code) {
                    subjectData.push(rowData);
                }
            }
        });
        
        console.log(`Found ${subjectData.length} subject rows to import`);
        
        let imported = 0;
        let skipped = 0;
        const errors = [];
        
        for (let i = 0; i < subjectData.length; i++) {
            const row = subjectData[i];
            const rowNum = i + 7;  // Actual row in Excel (6 header + data starts at 7)
            
            try {
                // Validate required fields
                if (!row.syllabus_code || !row.subject_name) {
                    errors.push(`Row ${rowNum}: Missing required fields (syllabus_code or subject_name)`);
                    skipped++;
                    continue;
                }
                
                const insertQuery = `
                    INSERT INTO subject_master (
                        programme_id, branch_id, semester_id, regulation_id,
                        subject_order, syllabus_code, ref_code,
                        internal_exam_code, external_exam_code, subject_name,
                        subject_type, internal_max_marks, external_max_marks, ta_max_marks,
                        credits, is_elective, is_under_group, is_exempt_exam_fee
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                await promisePool.query(insertQuery, [
                    programme_id,   // From context (top of Excel)
                    branch_id,      // From context (top of Excel)
                    semester_id,    // From context (top of Excel)
                    regulation_id,  // From context (top of Excel)
                    row.subject_order || (i + 1),
                    row.syllabus_code,
                    row.ref_code || null,
                    row.internal_exam_code || null,
                    row.external_exam_code || null,
                    row.subject_name,
                    row.subject_type || 'Theory',
                    row.internal_max_marks || 0,
                    row.external_max_marks || 0,
                    row.ta_max_marks || 0,
                    row.credits || 0,
                    row.is_elective === 'Yes' ? 1 : 0,
                    row.is_under_group === 'Yes' ? 1 : 0,
                    row.is_exempt_exam_fee === 'Yes' ? 1 : 0
                ]);
                
                imported++;
                
            } catch (error) {
                console.error(`Error importing row ${rowNum}:`, error.message);
                errors.push(`Row ${rowNum}: ${error.message}`);
                skipped++;
            }
        }
        
        console.log(`✅ Import complete: ${imported} imported, ${skipped} skipped`);
        
        // Clean up uploaded file
        try {
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
                console.log('✅ Temporary file cleaned up');
            }
        } catch (cleanupError) {
            console.error('Warning: Failed to clean up temporary file:', cleanupError.message);
        }
        
        res.json({
            status: 'success',
            message: `Successfully imported ${imported} subjects for ${context.programme} ${context.branch} ${context.semester} ${context.regulation}`,
            context: context,
            imported,
            skipped,
            total: subjectData.length,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('=== IMPORT EXCEL ERROR ===');
        console.error('Error:', error);
        
        // Clean up uploaded file on error
        try {
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
                console.log('✅ Temporary file cleaned up after error');
            }
        } catch (cleanupError) {
            console.error('Warning: Failed to clean up temporary file:', cleanupError.message);
        }
        
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// POST Import subjects from Excel
router.post('/import', async (req, res) => {
    try {
        const { subjects } = req.body;
        
        if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No subjects data provided'
            });
        }
        
        let imported = 0;
        let skipped = 0;
        const errors = [];
        
        for (const subject of subjects) {
            try {
                // Validate required fields
                if (!subject.programme_id || !subject.branch_id || !subject.semester_id || 
                    !subject.regulation_id || !subject.syllabus_code || !subject.subject_name) {
                    skipped++;
                    errors.push(`Row skipped: Missing required fields - ${subject.subject_name || 'Unknown'}`);
                    continue;
                }
                
                // Check if already exists
                const [existing] = await promisePool.query(
                    `SELECT subject_id FROM subject_master 
                     WHERE syllabus_code = ? AND programme_id = ? AND branch_id = ? 
                     AND semester_id = ? AND regulation_id = ? AND is_active = 1`,
                    [subject.syllabus_code, subject.programme_id, subject.branch_id, 
                     subject.semester_id, subject.regulation_id]
                );
                
                if (existing.length > 0) {
                    skipped++;
                    errors.push(`Row skipped: Subject ${subject.syllabus_code} already exists`);
                    continue;
                }
                
                // Insert subject
                await promisePool.query(
                    `INSERT INTO subject_master (
                        programme_id, branch_id, semester_id, regulation_id,
                        subject_order, syllabus_code, ref_code, internal_exam_code,
                        external_exam_code, subject_name, subject_type,
                        internal_max_marks, external_max_marks, ta_max_marks,
                        credits, is_elective, is_under_group, is_exempt_exam_fee,
                        replacement_group_order, is_running_curriculum, is_locked
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        subject.programme_id, subject.branch_id, subject.semester_id, subject.regulation_id,
                        subject.subject_order || 1, subject.syllabus_code, subject.ref_code || null,
                        subject.internal_exam_code || null, subject.external_exam_code || null,
                        subject.subject_name, subject.subject_type || 'Theory',
                        subject.internal_max_marks || 0, subject.external_max_marks || 0, subject.ta_max_marks || 0,
                        subject.credits || 0, subject.is_elective || 0, subject.is_under_group || 0,
                        subject.is_exempt_exam_fee || 0, subject.replacement_group_order || null,
                        subject.is_running_curriculum !== false ? 1 : 0, subject.is_locked || 0
                    ]
                );
                
                imported++;
            } catch (err) {
                skipped++;
                errors.push(`Error importing ${subject.syllabus_code || 'Unknown'}: ${err.message}`);
            }
        }
        
        res.json({
            status: 'success',
            message: `Import completed: ${imported} imported, ${skipped} skipped`,
            data: {
                imported,
                skipped,
                errors
            }
        });
    } catch (error) {
        console.error('Error importing subjects:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to import subjects',
            error: error.message
        });
    }
});

// GET Export subjects to Excel
router.get('/export/excel', async (req, res) => {
    try {
        const { programme_id, branch_id, semester_id, regulation_id } = req.query;
        
        let query = `
            SELECT 
                s.*,
                p.programme_name,
                p.programme_code,
                b.branch_name,
                b.branch_code,
                sem.semester_name,
                r.regulation_name
            FROM subject_master s
            LEFT JOIN programme_master p ON s.programme_id = p.programme_id
            LEFT JOIN branch_master b ON s.branch_id = b.branch_id
            LEFT JOIN semester_master sem ON s.semester_id = sem.semester_id
            LEFT JOIN regulation_master r ON s.regulation_id = r.regulation_id
            WHERE s.is_active = 1
        `;
        
        const params = [];
        
        if (programme_id) {
            query += ' AND s.programme_id = ?';
            params.push(programme_id);
        }
        
        if (branch_id) {
            query += ' AND s.branch_id = ?';
            params.push(branch_id);
        }
        
        if (semester_id) {
            query += ' AND s.semester_id = ?';
            params.push(semester_id);
        }
        
        if (regulation_id) {
            query += ' AND s.regulation_id = ?';
            params.push(regulation_id);
        }
        
        query += ' ORDER BY s.subject_order, s.subject_name';
        
        const [subjects] = await promisePool.query(query, params);
        
        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Subjects');
        
        // Define columns
        worksheet.columns = [
            { header: 'Subject Order', key: 'subject_order', width: 12 },
            { header: 'Syllabus Code', key: 'syllabus_code', width: 15 },
            { header: 'Ref Code', key: 'ref_code', width: 15 },
            { header: 'Internal Exam Code', key: 'internal_exam_code', width: 18 },
            { header: 'External Exam Code', key: 'external_exam_code', width: 18 },
            { header: 'Subject Name', key: 'subject_name', width: 40 },
            { header: 'Subject Type', key: 'subject_type', width: 12 },
            { header: 'Internal Max Marks', key: 'internal_max_marks', width: 18 },
            { header: 'External Max Marks', key: 'external_max_marks', width: 18 },
            { header: 'TA Max Marks', key: 'ta_max_marks', width: 15 },
            { header: 'Credits', key: 'credits', width: 10 },
            { header: 'Is Elective', key: 'is_elective', width: 12 },
            { header: 'Is Under Group', key: 'is_under_group', width: 15 },
            { header: 'Exempt Exam Fee', key: 'is_exempt_exam_fee', width: 15 },
            { header: 'Replacement Group', key: 'replacement_group_order', width: 18 },
            { header: 'Running Curriculum', key: 'is_running_curriculum', width: 18 },
            { header: 'Programme', key: 'programme_name', width: 20 },
            { header: 'Branch', key: 'branch_name', width: 30 },
            { header: 'Semester', key: 'semester_name', width: 15 },
            { header: 'Regulation', key: 'regulation_name', width: 15 }
        ];
        
        // Style header row
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        
        // Add rows
        subjects.forEach(subject => {
            worksheet.addRow({
                subject_order: subject.subject_order,
                syllabus_code: subject.syllabus_code,
                ref_code: subject.ref_code,
                internal_exam_code: subject.internal_exam_code,
                external_exam_code: subject.external_exam_code,
                subject_name: subject.subject_name,
                subject_type: subject.subject_type,
                internal_max_marks: subject.internal_max_marks,
                external_max_marks: subject.external_max_marks,
                ta_max_marks: subject.ta_max_marks,
                credits: subject.credits,
                is_elective: subject.is_elective ? 'Yes' : 'No',
                is_under_group: subject.is_under_group ? 'Yes' : 'No',
                is_exempt_exam_fee: subject.is_exempt_exam_fee ? 'Yes' : 'No',
                replacement_group_order: subject.replacement_group_order,
                is_running_curriculum: subject.is_running_curriculum ? 'Yes' : 'No',
                programme_name: subject.programme_name,
                branch_name: subject.branch_name,
                semester_name: subject.semester_name,
                regulation_name: subject.regulation_name
            });
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=subjects.xlsx');
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Error exporting subjects:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to export subjects',
            error: error.message
        });
    }
});

// GET single subject by ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT 
                s.*,
                p.programme_name,
                b.branch_name,
                sem.semester_name,
                r.regulation_name
            FROM subject_master s
            LEFT JOIN programme_master p ON s.programme_id = p.programme_id
            LEFT JOIN branch_master b ON s.branch_id = b.branch_id
            LEFT JOIN semester_master sem ON s.semester_id = sem.semester_id
            LEFT JOIN regulation_master r ON s.regulation_id = r.regulation_id
            WHERE s.subject_id = ?`,
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Subject not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Subject retrieved successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching subject:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch subject',
            error: error.message
        });
    }
});
// GET Generate sample Excel template
router.get('/export/sample', async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Subjects Sample');
        
        // Define columns
        worksheet.columns = [
            { header: 'Programme ID*', key: 'programme_id', width: 15 },
            { header: 'Branch ID*', key: 'branch_id', width: 12 },
            { header: 'Semester ID*', key: 'semester_id', width: 12 },
            { header: 'Regulation ID*', key: 'regulation_id', width: 15 },
            { header: 'Subject Order', key: 'subject_order', width: 15 },
            { header: 'Syllabus Code*', key: 'syllabus_code', width: 15 },
            { header: 'Ref Code', key: 'ref_code', width: 15 },
            { header: 'Internal Exam Code', key: 'internal_exam_code', width: 18 },
            { header: 'External Exam Code', key: 'external_exam_code', width: 18 },
            { header: 'Subject Name*', key: 'subject_name', width: 40 },
            { header: 'Subject Type', key: 'subject_type', width: 12 },
            { header: 'Internal Max Marks', key: 'internal_max_marks', width: 18 },
            { header: 'External Max Marks', key: 'external_max_marks', width: 18 },
            { header: 'TA Max Marks', key: 'ta_max_marks', width: 15 },
            { header: 'Credits', key: 'credits', width: 10 },
            { header: 'Is Elective (0/1)', key: 'is_elective', width: 15 },
            { header: 'Is Under Group (0/1)', key: 'is_under_group', width: 18 },
            { header: 'Exempt Exam Fee (0/1)', key: 'is_exempt_exam_fee', width: 20 },
            { header: 'Replacement Group', key: 'replacement_group_order', width: 18 }
        ];
        
        // Style header row
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        
        // Add sample rows
        worksheet.addRow({
            programme_id: 1,
            branch_id: 1,
            semester_id: 1,
            regulation_id: 1,
            subject_order: 1,
            syllabus_code: 'CS101',
            ref_code: 'REF001',
            internal_exam_code: 'INT001',
            external_exam_code: 'EXT001',
            subject_name: 'Introduction to Computer Science',
            subject_type: 'Theory',
            internal_max_marks: 40,
            external_max_marks: 60,
            ta_max_marks: 0,
            credits: 4.0,
            is_elective: 0,
            is_under_group: 0,
            is_exempt_exam_fee: 0,
            replacement_group_order: null
        });
        
        worksheet.addRow({
            programme_id: 1,
            branch_id: 1,
            semester_id: 1,
            regulation_id: 1,
            subject_order: 2,
            syllabus_code: 'CS102',
            ref_code: 'REF002',
            internal_exam_code: 'INT002',
            external_exam_code: 'EXT002',
            subject_name: 'Programming Lab',
            subject_type: 'Practical',
            internal_max_marks: 30,
            external_max_marks: 70,
            ta_max_marks: 0,
            credits: 2.0,
            is_elective: 0,
            is_under_group: 0,
            is_exempt_exam_fee: 0,
            replacement_group_order: null
        });
        
        // Add instruction sheet
        const instructionSheet = workbook.addWorksheet('Instructions');
        instructionSheet.getCell('A1').value = 'Subject Import Instructions';
        instructionSheet.getCell('A1').font = { bold: true, size: 16 };
        instructionSheet.getCell('A3').value = 'Required Fields (marked with *):';
        instructionSheet.getCell('A3').font = { bold: true };
        instructionSheet.getCell('A4').value = '- Programme ID, Branch ID, Semester ID, Regulation ID';
        instructionSheet.getCell('A5').value = '- Syllabus Code, Subject Name';
        instructionSheet.getCell('A7').value = 'Subject Type Options:';
        instructionSheet.getCell('A7').font = { bold: true };
        instructionSheet.getCell('A8').value = '- Theory, Practical, Drawing, Project, Others';
        instructionSheet.getCell('A10').value = 'Boolean Fields (use 0 or 1):';
        instructionSheet.getCell('A10').font = { bold: true };
        instructionSheet.getCell('A11').value = '- Is Elective, Is Under Group, Exempt Exam Fee';
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=subjects_sample.xlsx');
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Error generating sample:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate sample template',
            error: error.message
        });
    }
});

// POST /api/subjects/filter - Filter subjects based on criteria
router.post('/filter', checkDbConnection, async (req, res) => {
    try {
        const { programme_id, semester_ids, regulation_ids } = req.body;
        
        if (!programme_id || !semester_ids || !regulation_ids) {
            return res.status(400).json({
                success: false,
                message: 'Programme ID, Semester IDs, and Regulation IDs are required'
            });
        }
        
        // Build WHERE clause
        const conditions = ['s.is_active = 1'];
        const params = [];
        
        if (programme_id) {
            conditions.push('s.programme_id = ?');
            params.push(programme_id);
        }
        
        if (semester_ids && semester_ids.length > 0) {
            const semesterPlaceholders = semester_ids.map(() => '?').join(',');
            conditions.push(`s.semester_id IN (${semesterPlaceholders})`);
            params.push(...semester_ids);
        }
        
        if (regulation_ids && regulation_ids.length > 0) {
            const regulationPlaceholders = regulation_ids.map(() => '?').join(',');
            conditions.push(`s.regulation_id IN (${regulationPlaceholders})`);
            params.push(...regulation_ids);
        }
        
        const query = `
            SELECT 
                s.*,
                p.programme_name,
                p.programme_code,
                b.branch_name,
                b.branch_code,
                sem.semester_name,
                r.regulation_name
            FROM subject_master s
            LEFT JOIN programme_master p ON s.programme_id = p.programme_id
            LEFT JOIN branch_master b ON s.branch_id = b.branch_id
            LEFT JOIN semester_master sem ON s.semester_id = sem.semester_id
            LEFT JOIN regulation_master r ON s.regulation_id = r.regulation_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY s.branch_id, s.subject_order ASC, s.subject_name ASC
        `;
        
        const [subjects] = await promisePool.query(query, params);
        
        res.json({
            success: true,
            message: 'Subjects filtered successfully',
            data: subjects
        });
        
    } catch (error) {
        console.error('Error filtering subjects:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to filter subjects',
            error: error.message
        });
    }
});

module.exports = initializeRouter;
