// ========================================
// ELECTIVE TEMPLATE DOWNLOAD + UPLOAD ROUTES
// File: routes/elective-template.js
// Dependencies: npm install exceljs multer
// ========================================

const express  = require('express');
const router   = express.Router();
const ExcelJS  = require('exceljs');
const multer   = require('multer');
const path     = require('path');

let promisePool;

// Multer — store upload in memory (no disk file needed)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.xlsx') return cb(new Error('Only .xlsx files are accepted'));
        cb(null, true);
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// HELPER: build the styled workbook
// ─────────────────────────────────────────────────────────────────────────────
function buildWorkbook({ programme_name, batch_name, branch_name, semester_name,
                         regulation_name, syllabus_code, subject_name,
                         programme_id, batch_id, branch_id,
                         semester_id, subject_id, regulation_id }) {

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Elective Mapping System';
    wb.created = new Date();

    const ws = wb.addWorksheet('Elective Mapping', {
        pageSetup: { orientation: 'portrait', fitToPage: true }
    });

    ws.columns = [
        { key: 'sl',   width: 8  },
        { key: 'htno', width: 30 }
    ];

    // Styles
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
    const filterFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    const lockedFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    const inputFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    const accentFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
    const thinBorder = { style: 'thin', color: { argb: 'FFBFBFBF' } };
    const border     = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

    // Row 1: Title
    ws.mergeCells('A1:B1');
    const title      = ws.getCell('A1');
    title.value      = 'ELECTIVE SUBJECT MAPPING TEMPLATE';
    title.font       = { name: 'Arial', bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    title.fill       = headerFill;
    title.alignment  = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    // Rows 2–7: Filter labels + locked values
    const filterRows = [
        ['Programme',     programme_name  || ''],
        ['Batch',         batch_name      || ''],
        ['Branch',        branch_name     || ''],
        ['Semester',      semester_name   || ''],
        ['Regulation',    regulation_name || ''],
        ['Syllabus Code', syllabus_code   || ''],
        ['Subject Name',  subject_name    || ''],
    ];

    filterRows.forEach(([label, value], idx) => {
        const row = idx + 2;
        const lc  = ws.getCell(`A${row}`);
        const vc  = ws.getCell(`B${row}`);

        lc.value      = label;
        lc.font       = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1F3864' } };
        lc.fill       = filterFill;
        lc.alignment  = { horizontal: 'left', vertical: 'middle' };
        lc.border     = border;
        lc.protection = { locked: true };

        vc.value      = value;
        vc.font       = { name: 'Arial', size: 10, color: { argb: 'FF404040' } };
        vc.fill       = lockedFill;
        vc.alignment  = { horizontal: 'left', vertical: 'middle' };
        vc.border     = border;
        vc.protection = { locked: true };

        ws.getRow(row).height = 18;
    });

    // Row 8: Hidden meta row — IDs for server-side validation on upload
    const metaCell   = ws.getCell('A8');
    metaCell.value   = 'META:' + programme_id + '|' + batch_id + '|' + branch_id + '|' + semester_id + '|' + subject_id + '|' + (regulation_id || '');
    metaCell.font    = { color: { argb: 'FFFFFFFF' }, size: 1 };
    ws.getRow(8).height = 4;
    ws.getRow(8).hidden = true;

    // Row 9: Column headers
    ['Sl.No', 'Hall Ticket No (Htno)'].forEach((h, i) => {
        const c      = ws.getCell(9, i + 1);
        c.value      = h;
        c.font       = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        c.fill       = accentFill;
        c.alignment  = { horizontal: 'center', vertical: 'middle' };
        c.border     = border;
        c.protection = { locked: true };
    });
    ws.getRow(9).height = 22;

    // Rows 10–209: Data entry (200 rows)
    for (let r = 10; r <= 209; r++) {
        const sl       = ws.getCell(r, 1);
        sl.value       = r - 9;
        sl.font        = { name: 'Arial', size: 10, color: { argb: 'FF808080' } };
        sl.fill        = lockedFill;
        sl.alignment   = { horizontal: 'center', vertical: 'middle' };
        sl.border      = border;
        sl.protection  = { locked: true };

        const htno     = ws.getCell(r, 2);
        htno.value     = '';
        htno.font      = { name: 'Arial', size: 10 };
        htno.fill      = inputFill;
        htno.alignment = { horizontal: 'left', vertical: 'middle' };
        htno.border    = border;
        htno.protection = { locked: false };

        ws.getRow(r).height = 16;
    }

    // Protect sheet — only green (unlocked) cells are editable
    ws.protect('elective123', {
        selectLockedCells:   true,
        selectUnlockedCells: true,
        formatCells:  false,
        formatColumns: false,
        formatRows:   false,
        insertRows:   false,
        deleteRows:   false,
    });

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 9 }];

    // Instructions sheet
    const ins = wb.addWorksheet('Instructions');
    ins.getColumn(1).width = 70;
    const steps = [
        { text: 'INSTRUCTIONS',                                                                              bold: true,  fg: 'FFFFFFFF', bg: 'FF1F3864' },
        { text: '',                                                                                           bold: false, fg: 'FF000000', bg: 'FFFFFFFF' },
        { text: '1.  Filter details (Programme, Branch, Semester, etc.) are PRE-FILLED and LOCKED.',         bold: false, fg: 'FF1F3864', bg: 'FFFFFFFF' },
        { text: '2.  Enter student Hall Ticket Numbers (Htno) in the GREEN cells — Column B.',               bold: false, fg: 'FF1F3864', bg: 'FFFFFFFF' },
        { text: '3.  Do NOT modify Column A (Sl.No) — auto-numbered.',                                      bold: false, fg: 'FF1F3864', bg: 'FFFFFFFF' },
        { text: '4.  Do NOT add extra columns or rename the "Elective Mapping" sheet.',                     bold: false, fg: 'FF1F3864', bg: 'FFFFFFFF' },
        { text: '5.  Save the file as .xlsx before uploading.',                                              bold: false, fg: 'FF1F3864', bg: 'FFFFFFFF' },
        { text: '6.  Invalid or duplicate Htnos will be shown in the upload response.',                     bold: false, fg: 'FF1F3864', bg: 'FFFFFFFF' },
    ];
    steps.forEach((s, i) => {
        const c     = ins.getCell(i + 1, 1);
        c.value     = s.text;
        c.font      = { name: 'Arial', bold: s.bold, size: 11, color: { argb: s.fg } };
        c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } };
        c.alignment = { horizontal: s.bold ? 'center' : 'left', vertical: 'middle', wrapText: true };
        ins.getRow(i + 1).height = 22;
    });

    return wb;
}


// ─────────────────────────────────────────────────────────────────────────────
// GET /elective-mapping/download-template
// Query: programme_id, batch_id, branch_id, semester_id, subject_id, regulation_id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/download-template', async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id, semester_id, subject_id, regulation_id } = req.query;

        if (!programme_id || !batch_id || !branch_id || !semester_id || !subject_id) {
            return res.status(400).json({
                status: 'error',
                message: 'programme_id, batch_id, branch_id, semester_id and subject_id are required'
            });
        }

        // Safe helper — returns first row or empty object, never crashes on empty result
        const fetchOne = async (sql, params) => {
            const [rows] = await promisePool.query(sql, params);
            return rows[0] || {};
        };

        const prog   = await fetchOne('SELECT programme_name FROM programme_master WHERE programme_id = ?', [programme_id]);
        const batch  = await fetchOne('SELECT batch_name FROM batch_master WHERE batch_id = ?', [batch_id]);
        const branch = await fetchOne('SELECT branch_name FROM branch_master WHERE branch_id = ?', [branch_id]);
        const sem    = await fetchOne('SELECT semester_name FROM semester_master WHERE semester_id = ?', [semester_id]);
        const reg    = regulation_id
            ? await fetchOne('SELECT regulation_name FROM regulation_master WHERE regulation_id = ?', [regulation_id])
            : {};
        const subj   = await fetchOne('SELECT syllabus_code, subject_name FROM subject_master WHERE subject_id = ?', [subject_id]);

        const meta = {
            programme_id, batch_id, branch_id, semester_id, subject_id,
            regulation_id:   regulation_id || '',
            programme_name:  prog.programme_name   || ('Prog-' + programme_id),
            batch_name:      batch.batch_name      || ('Batch-' + batch_id),
            branch_name:     branch.branch_name    || ('Branch-' + branch_id),
            semester_name:   sem.semester_name     || ('Sem-' + semester_id),
            regulation_name: reg.regulation_name   || '',
            syllabus_code:   subj.syllabus_code    || '',
            subject_name:    subj.subject_name     || ('Subject-' + subject_id),
        };

        const wb = buildWorkbook(meta);

        // Filename based on selection: BranchName_SemesterName_SyllabusCode.xlsx
        const clean = str => String(str).replace(/[\/\?%*:|"<>]/g, '-').trim();
        const filename = clean(meta.branch_name) + '_' + clean(meta.semester_name) + '_' + clean(meta.syllabus_code || meta.subject_name) + '.xlsx';

        // Write to buffer first — more reliable than streaming directly to res
        const buffer = await wb.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-Length', buffer.length);
        res.end(buffer);

    } catch (error) {
        console.error('Template generation error:', error);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Failed to generate template: ' + error.message });
        }
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /elective-mapping/upload-mapping
// Body: multipart/form-data  field: "file"  (.xlsx)
// Also: programme_id, batch_id, branch_id, semester_id, subject_id, academic_year
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload-mapping', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        }

        const { programme_id, batch_id, branch_id, semester_id, subject_id, academic_year } = req.body;

        if (!programme_id || !batch_id || !branch_id || !semester_id || !subject_id) {
            return res.status(400).json({
                status: 'error',
                message: 'programme_id, batch_id, branch_id, semester_id and subject_id are required'
            });
        }

        // Parse Excel
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(req.file.buffer);

        const ws = wb.getWorksheet('Elective Mapping');
        if (!ws) {
            return res.status(400).json({
                status: 'error',
                message: 'Sheet "Elective Mapping" not found. Please use the downloaded template.'
            });
        }

        // ── VALIDATION: Check META row (row 8) matches current filter selection ──
        // META format: "META:programme_id|batch_id|branch_id|semester_id|subject_id|regulation_id"
        const metaCell = ws.getRow(8).getCell(1).value || '';
        if (metaCell && String(metaCell).startsWith('META:')) {
            const parts = String(metaCell).replace('META:', '').split('|');
            const [fileProg, fileBatch, fileBranch, fileSem, fileSubj, fileReg] = parts;

            const mismatch =
                String(fileProg).trim()   !== String(programme_id).trim()  ||
                String(fileBatch).trim()  !== String(batch_id).trim()       ||
                String(fileBranch).trim() !== String(branch_id).trim()      ||
                String(fileSem).trim()    !== String(semester_id).trim()    ||
                String(fileSubj).trim()   !== String(subject_id).trim();

            if (mismatch) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Template mismatch! This Excel file was generated for different filters.',
                    filter_mismatch: true,
                    file_filters:    `Prog:${fileProg} | Batch:${fileBatch} | Branch:${fileBranch} | Sem:${fileSem} | Subject:${fileSubj}`,
                    current_filters: `Prog:${programme_id} | Batch:${batch_id} | Branch:${branch_id} | Sem:${semester_id} | Subject:${subject_id}`
                });
            }
        }

        // Collect Htnos from column B, row 10 onwards
        const htnos = [];
        ws.eachRow((row, rowNum) => {
            if (rowNum < 10) return;
            const val = row.getCell(2).value;
            if (val && String(val).trim() !== '') {
                htnos.push(String(val).trim().toUpperCase());
            }
        });

        if (htnos.length === 0) {
            return res.status(400).json({ status: 'error', message: 'No Hall Ticket Numbers found in the file.' });
        }

        const uniqueHtnos       = [...new Set(htnos)];
        const duplicatesInFile  = htnos.length - uniqueHtnos.length;

        // Validate against DB — must belong to correct programme/batch/branch/semester
        const ph = uniqueHtnos.map(() => '?').join(',');
        const [validStudents] = await promisePool.query(
            `SELECT sm.student_id, sm.roll_number, sm.full_name
             FROM student_master sm
             INNER JOIN student_semester_history ssh ON sm.student_id = ssh.student_id
             WHERE sm.roll_number IN (${ph})
               AND ssh.programme_id    = ?
               AND ssh.batch_id        = ?
               AND ssh.branch_id       = ?
               AND ssh.semester_id     = ?
               AND ssh.student_status IN ('In Roll','Detained')`,
            [...uniqueHtnos, programme_id, batch_id, branch_id, semester_id]
        );

        const validRollSet  = new Set(validStudents.map(s => s.roll_number.toUpperCase()));
        const invalidHtnos  = uniqueHtnos.filter(h => !validRollSet.has(h));

        if (validStudents.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No valid students found. Check the Htnos or filter selection.',
                invalid_htnos: invalidHtnos
            });
        }

        // Insert mappings
        const connection = await promisePool.getConnection();
        try {
            await connection.beginTransaction();

            let added   = 0;
            let skipped = 0;
            const errors = [];

            for (const student of validStudents) {
                try {
                    // Check if already mapped to this elective group
                    const [existing] = await connection.query(
                        `SELECT mapping_id
                         FROM student_elective_mapping sem
                         INNER JOIN subject_master subm ON sem.subject_id = subm.subject_id
                         WHERE sem.student_id  = ?
                           AND sem.semester_id = ?
                           AND sem.is_active   = 1
                           AND subm.elective_name = (
                               SELECT elective_name FROM subject_master WHERE subject_id = ?
                           )`,
                        [student.student_id, semester_id, subject_id]
                    );

                    if (existing.length > 0) { skipped++; continue; }

                    await connection.query(
                        `INSERT INTO student_elective_mapping
                            (student_id, programme_id, batch_id, branch_id, semester_id,
                             subject_id, elective_name, academic_year, is_active)
                         SELECT ?, ?, ?, ?, ?, ?, elective_name, ?, 1
                         FROM subject_master WHERE subject_id = ?`,
                        [student.student_id, programme_id, batch_id, branch_id,
                         semester_id, subject_id, academic_year || null, subject_id]
                    );
                    added++;

                } catch (err) {
                    console.error(`Error mapping ${student.roll_number}:`, err);
                    errors.push({ htno: student.roll_number, error: err.message });
                }
            }

            await connection.commit();

            return res.json({
                status: 'success',
                message: `Successfully mapped ${added} student(s).`,
                data: {
                    total_in_file:      htnos.length,
                    unique_in_file:     uniqueHtnos.length,
                    duplicates_in_file: duplicatesInFile,
                    valid:              validStudents.length,
                    added,
                    skipped,
                    invalid_htnos:      invalidHtnos,
                    errors
                }
            });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Upload processing error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to process upload', error: error.message });
    }
});


function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

module.exports = { router, initializeRouter };
