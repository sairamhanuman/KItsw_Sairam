// Subject/Course Management Routes - Complete Version with elective_name support
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for Excel uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/excel/';
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

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all subjects with filters
router.get('/subjects', async (req, res) => {
    try {
        const { programme_id, branch_id, semester_id, regulation_id, is_elective, search, page = 1, limit = 50 } = req.query;
        
        let query = `
            SELECT 
                s.*,
                p.programme_name,
                p.programme_code,
                b.branch_name,
                b.branch_code,
                sem.semester_name,
                sem.semester_number,
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
        
        if (is_elective !== undefined) {
            query += ' AND s.is_elective = ?';
            params.push(is_elective);
        }
        
        if (search) {
            query += ' AND (s.subject_name LIKE ? OR s.syllabus_code LIKE ? OR s.ref_code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        query += ' ORDER BY s.subject_order, s.subject_name';
        
        // Add pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        const [rows] = await promisePool.query(query, params);
        
        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) as total
            FROM subject_master s
            WHERE s.is_active = 1
        `;
        
        const countParams = [];
        
        if (programme_id) {
            countQuery += ' AND s.programme_id = ?';
            countParams.push(programme_id);
        }
        
        if (branch_id) {
            countQuery += ' AND s.branch_id = ?';
            countParams.push(branch_id);
        }
        
        if (semester_id) {
            countQuery += ' AND s.semester_id = ?';
            countParams.push(semester_id);
        }
        
        if (regulation_id) {
            countQuery += ' AND s.regulation_id = ?';
            countParams.push(regulation_id);
        }
        
        if (is_elective !== undefined) {
            countQuery += ' AND s.is_elective = ?';
            countParams.push(is_elective);
        }
        
        if (search) {
            countQuery += ' AND (s.subject_name LIKE ? OR s.syllabus_code LIKE ? OR s.ref_code LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        const [countResult] = await promisePool.query(countQuery, countParams);
        const total = countResult[0].total;
        
        res.json({
            status: 'success',
            message: 'Subjects retrieved successfully',
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit)
            }
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
router.post('/subjects', async (req, res) => {
    try {
        const {
            programme_id, branch_id, semester_id, regulation_id,
            subject_order, syllabus_code, ref_code, internal_exam_code,
            external_exam_code, subject_name, subject_type,
            internal_max_marks, external_max_marks, ta_max_marks,
            credits, is_elective, is_under_group, elective_name,
            is_exempt_exam_fee, is_replacement, replacement_group_order, is_running_curriculum, is_locked
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
        
        // Insert new subject with elective_name
        const [result] = await promisePool.query(
            `INSERT INTO subject_master (
    programme_id, branch_id, semester_id, regulation_id,
    subject_order, syllabus_code, ref_code, internal_exam_code,
    external_exam_code, subject_name, subject_type,
    internal_max_marks, external_max_marks, ta_max_marks,
    credits, is_elective, is_under_group, elective_name,
        is_exempt_exam_fee, is_replacement, replacement_group_order, is_running_curriculum, is_locked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                programme_id, branch_id, semester_id, regulation_id,
                subject_order || 1, syllabus_code, ref_code || null, 
                internal_exam_code || null, external_exam_code || null,
                subject_name, subject_type || 'Theory',
                internal_max_marks || 0, external_max_marks || 0, ta_max_marks || 0,
                credits || 0, is_elective || 0, is_under_group || 0, elective_name || null,
                                is_exempt_exam_fee || 0, is_replacement || 0, replacement_group_order || null,
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
router.put('/subjects/:id', async (req, res) => {
    try {
        const {
            subject_order, syllabus_code, ref_code, internal_exam_code,
            external_exam_code, subject_name, subject_type,
            internal_max_marks, external_max_marks, ta_max_marks,
            credits, is_elective, is_under_group, elective_name,
            is_exempt_exam_fee,is_replacement, replacement_group_order, is_running_curriculum, is_locked
        } = req.body;
        // Add after line 258
console.log('Request body:', req.body);
console.log('is_replacement value:', req.body.is_replacement);
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
        
        // Update subject with elective_name
        await promisePool.query(
            `UPDATE subject_master 
            SET subject_order = ?, syllabus_code = ?, ref_code = ?, 
                internal_exam_code = ?, external_exam_code = ?, 
                subject_name = ?, subject_type = ?,
                internal_max_marks = ?, external_max_marks = ?, ta_max_marks = ?,
                credits = ?, is_elective = ?, is_under_group = ?, elective_name = ?,
                is_exempt_exam_fee = ?, is_replacement = ?, replacement_group_order = ?,
                is_running_curriculum = ?, is_locked = ?
            WHERE subject_id = ?`,
            [
                subject_order, syllabus_code, ref_code,
                internal_exam_code, external_exam_code,
                subject_name, subject_type,
                internal_max_marks, external_max_marks, ta_max_marks,
                credits, is_elective, is_under_group, elective_name,
                is_exempt_exam_fee, is_replacement,replacement_group_order,
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
router.delete('/subjects/:id', async (req, res) => {
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

// GET distinct subject_group_codes for dropdown
router.get('/subjects/group-codes', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT DISTINCT subject_group_code
             FROM subject_master
             WHERE subject_group_code IS NOT NULL
               AND subject_group_code != ''
               AND is_active = 1
             ORDER BY subject_group_code`
        );
        const codes = rows.map(r => r.subject_group_code);
        res.json({ status: 'success', data: codes });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// GET Generate sample Excel template with context pre-filled
router.get('/subjects/sample-excel', async (req, res) => {
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
            'is_under_group', 'elective_name', 'is_exempt_exam_fee'
        ]);
        
        // Add sample subject data
        worksheet.addRow([
            1, 'U18MH101', 'EM-I', 'U18MH101', 'U18MH101',
            'ENGINEERING MATHEMATICS - I', 'Theory', 30, 60, 0, 4,
            'No', 'No', '', 'No'
        ]);
        worksheet.addRow([
            2, 'U18CS102', 'PPSC', 'U18CS102', 'U18CS102',
            'PROGRAMMING FOR PROBLEM SOLVING IN C', 'Theory', 30, 60, 0, 3,
            'No', 'No', '', 'No'
        ]);
        worksheet.addRow([
            3, 'U18OE602A', 'DM', 'U18OE602A', 'U18OE602A',
            'DISASTER MANAGEMENT', 'Theory', 30, 60, 0, 3,
            'Yes', 'Yes', 'Open Elective', 'No'
        ]);
        worksheet.addRow([
            4, 'U18CS603A', 'DAA', 'U18CS603A', 'U18CS603A',
            'DESIGN AND ANALYSIS OF ALGORITHMS', 'Theory', 30, 60, 0, 3,
            'Yes', 'Yes', 'Professional Elective', 'No'
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
            { width: 20 },  // elective_name
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
router.post('/subjects/import/excel', upload.single('file'), async (req, res) => {
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
                        credits, is_elective, is_under_group, elective_name, is_exempt_exam_fee
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    row.elective_name || null,
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

// GET master data for dropdowns
router.get('/programmes', async (req, res) => {
    try {
        const [programmes] = await promisePool.query(`
            SELECT programme_id, programme_name 
            FROM programme_master 
            WHERE is_active = 1 
            ORDER BY programme_name
        `);

        res.json({
            status: 'success',
            data: programmes
        });

    } catch (error) {
        console.error('❌ Error fetching programmes:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch programmes',
            error: error.message
        });
    }
});

router.get('/branches', async (req, res) => {
    try {
        const [branches] = await promisePool.query(`
            SELECT branch_id, branch_name 
            FROM branch_master 
            WHERE is_active = 1 
            ORDER BY branch_name
        `);

        res.json({
            status: 'success',
            data: branches
        });

    } catch (error) {
        console.error('❌ Error fetching branches:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch branches',
            error: error.message
        });
    }
});

router.get('/semesters', async (req, res) => {
    try {
        const [semesters] = await promisePool.query(`
            SELECT semester_id, semester_name, semester_number 
            FROM semester_master 
            WHERE is_active = 1 
            ORDER BY semester_number
        `);

        res.json({
            status: 'success',
            data: semesters
        });

    } catch (error) {
        console.error('❌ Error fetching semesters:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch semesters',
            error: error.message
        });
    }
});

router.get('/regulations', async (req, res) => {
    try {
        const [regulations] = await promisePool.query(`
            SELECT regulation_id, regulation_name 
            FROM regulation_master 
            WHERE is_active = 1 
            ORDER BY regulation_name DESC
        `);

        res.json({
            status: 'success',
            data: regulations
        });

    } catch (error) {
        console.error('❌ Error fetching regulations:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch regulations',
            error: error.message
        });
    }
});

module.exports = { initializeRouter };
