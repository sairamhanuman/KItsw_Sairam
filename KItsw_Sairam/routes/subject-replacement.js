// ========================================
// SUBJECT REPLACEMENT ROUTES
// File: routes/subject-replacement.js
// ========================================

const express = require('express');
const router = express.Router();

let promisePool;

// ========================================
// GET ALL SUBJECTS FOR SEMESTER
// Returns originals and replacements separately
// ========================================
router.get('/subjects', async (req, res) => {
    try {
        const { programme_id, branch_id, semester_id, regulation_id } = req.query;

        console.log('=== GET REPLACEMENT SUBJECTS ===');
        console.log('Filters:', { programme_id, branch_id, semester_id, regulation_id });

        let query = `
            SELECT 
                subject_id,
                syllabus_code,
                subject_name,
                subject_type,
                is_elective,
                is_replacement,
                replaces_subject_id,
                replacement_group_order
            FROM subject_master
            WHERE is_active = 1
        `;
        const params = [];

        if (programme_id)  { query += ` AND programme_id = ?`;   params.push(programme_id); }
        if (branch_id)     { query += ` AND branch_id = ?`;      params.push(branch_id); }
        if (semester_id)   { query += ` AND semester_id = ?`;    params.push(semester_id); }
        if (regulation_id) { query += ` AND regulation_id = ?`;  params.push(regulation_id); }

        query += ` ORDER BY is_replacement ASC, replacement_group_order ASC, syllabus_code ASC`;

        const [subjects] = await promisePool.query(query, params);

        // Separate originals and replacements
        const originals    = subjects.filter(s => !s.is_replacement || s.is_replacement === 0);
        const replacements = subjects.filter(s => s.is_replacement === 1);

        // Group replacements by replacement_group_order
        const groups = {};
        replacements.forEach(s => {
            const grp = s.replacement_group_order || 0;
            if (!groups[grp]) groups[grp] = [];
            groups[grp].push(s);
        });

        console.log(`Found ${originals.length} originals, ${replacements.length} replacements`);

        res.json({
            status: 'success',
            data: {
                subjects,
                originals,
                replacements,
                groups
            }
        });

    } catch (error) {
        console.error('Error fetching replacement subjects:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ========================================
// GET AVAILABLE STUDENTS (Left Box)
// Students NOT yet mapped for this original subject
// ========================================
router.get('/available-students', async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id, semester_id, original_subject_id } = req.query;

        console.log('=== GET AVAILABLE STUDENTS (Replacement) ===');
        console.log('Filters:', { programme_id, batch_id, branch_id, semester_id, original_subject_id });

        if (!programme_id || !batch_id || !branch_id || !semester_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Programme, Batch, Branch, and Semester are required'
            });
        }

        if (!original_subject_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Original subject is required'
            });
        }

        const query = `
            SELECT DISTINCT
                sm.student_id,
                sm.admission_number,
                sm.roll_number,
                sm.full_name,
                sm.gender,
                ssh.student_status
            FROM student_master sm
            INNER JOIN student_semester_history ssh
                ON sm.student_id = ssh.student_id
            WHERE ssh.programme_id = ?
            AND ssh.batch_id = ?
            AND ssh.branch_id = ?
            AND ssh.semester_id = ?
            AND ssh.student_status IN ('In Roll', 'Detained', 'Left', 'Completed', 'Dropout')
            AND sm.student_id NOT IN (
                SELECT student_id
                FROM student_subject_replacement
                WHERE original_subject_id = ?
                AND programme_id = ?
                AND batch_id = ?
                AND branch_id = ?
                AND semester_id = ?
                AND is_active = 1
            )
            ORDER BY sm.roll_number
        `;

        const [students] = await promisePool.query(query, [
            programme_id, batch_id, branch_id, semester_id,
            original_subject_id,
            programme_id, batch_id, branch_id, semester_id
        ]);

        console.log(`Found ${students.length} available students`);

        res.json({
            status: 'success',
            data: {
                students,
                total: students.length
            }
        });

    } catch (error) {
        console.error('Error fetching available students:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ========================================
// GET REPLACED STUDENTS (Right Box)
// Students already given a replacement subject
// ========================================
router.get('/replaced-students', async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id, semester_id, original_subject_id, replacement_subject_id } = req.query;

        console.log('=== GET REPLACED STUDENTS ===');

        if (!original_subject_id) {
            return res.json({
                status: 'success',
                data: { students: [], total: 0 }
            });
        }

        let query = `
            SELECT
                ssr.replacement_id,
                ssr.student_id,
                sm.roll_number,
                sm.full_name,
                sm.admission_number,
                sm.gender,
                sub_orig.syllabus_code  AS original_code,
                sub_orig.subject_name   AS original_subject_name,
                sub_repl.syllabus_code  AS replacement_code,
                sub_repl.subject_name   AS replacement_subject_name
            FROM student_subject_replacement ssr
            INNER JOIN student_master sm
                ON ssr.student_id = sm.student_id
            INNER JOIN subject_master sub_orig
                ON ssr.original_subject_id = sub_orig.subject_id
            INNER JOIN subject_master sub_repl
                ON ssr.replacement_subject_id = sub_repl.subject_id
            WHERE ssr.original_subject_id = ?
            AND ssr.programme_id = ?
            AND ssr.batch_id = ?
            AND ssr.branch_id = ?
            AND ssr.semester_id = ?
            AND ssr.is_active = 1
        `;
        const params = [
            original_subject_id,
            programme_id, batch_id, branch_id, semester_id
        ];

        if (replacement_subject_id) {
            query += ` AND ssr.replacement_subject_id = ?`;
            params.push(replacement_subject_id);
        }

        query += ` ORDER BY sm.roll_number`;

        const [students] = await promisePool.query(query, params);

        console.log(`Found ${students.length} replaced students`);

        res.json({
            status: 'success',
            data: {
                students,
                total: students.length
            }
        });

    } catch (error) {
        console.error('Error fetching replaced students:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ========================================
// ADD STUDENTS TO REPLACEMENT (Left → Right)
// ========================================
router.post('/add-students', async (req, res) => {
    try {
        const {
            student_ids,
            programme_id,
            batch_id,
            branch_id,
            semester_id,
            original_subject_id,
            replacement_subject_id,
            academic_year
        } = req.body;

        console.log('=== ADD STUDENTS TO REPLACEMENT ===');
        console.log('Adding', student_ids?.length, 'students');

        if (!student_ids || student_ids.length === 0) {
            return res.status(400).json({ status: 'error', message: 'No students selected' });
        }

        if (!original_subject_id || !replacement_subject_id) {
            return res.status(400).json({ status: 'error', message: 'Both original and replacement subjects are required' });
        }

        if (!programme_id || !batch_id || !branch_id || !semester_id) {
            return res.status(400).json({ status: 'error', message: 'All filter fields are required' });
        }

        const connection = await promisePool.getConnection();

        try {
            await connection.beginTransaction();

            let added = 0;
            let skipped = 0;
            const errors = [];

            for (const student_id of student_ids) {
                try {
                    // Check if already mapped
                    const [existing] = await connection.query(
                        `SELECT replacement_id FROM student_subject_replacement
                         WHERE student_id = ?
                         AND original_subject_id = ?
                         AND semester_id = ?
                         AND is_active = 1`,
                        [student_id, original_subject_id, semester_id]
                    );

                    if (existing.length > 0) {
                        skipped++;
                        continue;
                    }

                    await connection.query(
                        `INSERT INTO student_subject_replacement
                        (student_id, programme_id, batch_id, branch_id, semester_id,
                         original_subject_id, replacement_subject_id, academic_year, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                        [
                            student_id, programme_id, batch_id, branch_id, semester_id,
                            original_subject_id, replacement_subject_id, academic_year || null
                        ]
                    );
                    added++;

                } catch (err) {
                    console.error(`Error adding student ${student_id}:`, err);
                    errors.push({ student_id, error: err.message });
                    skipped++;
                }
            }

            await connection.commit();

            console.log(`✅ Added ${added} students, skipped ${skipped}`);

            res.json({
                status: 'success',
                message: `Successfully added ${added} student(s) to replacement`,
                data: { added, skipped, errors }
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error adding students to replacement:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ========================================
// REMOVE STUDENTS FROM REPLACEMENT (Right → Left)
// ========================================
router.post('/remove-students', async (req, res) => {
    try {
        const { student_ids, original_subject_id, semester_id } = req.body;

        console.log('=== REMOVE STUDENTS FROM REPLACEMENT ===');

        if (!student_ids || student_ids.length === 0) {
            return res.status(400).json({ status: 'error', message: 'No students selected' });
        }

        console.log('Removing', student_ids.length, 'students from replacement of subject', original_subject_id);

        const placeholders = student_ids.map(() => '?').join(',');

        const [result] = await promisePool.query(
            `UPDATE student_subject_replacement
             SET is_active = 0
             WHERE student_id IN (${placeholders})
             AND original_subject_id = ?
             AND semester_id = ?
             AND is_active = 1`,
            [...student_ids, original_subject_id, semester_id]
        );

        console.log(`✅ Removed ${result.affectedRows} students`);

        res.json({
            status: 'success',
            message: `Successfully removed ${result.affectedRows} student(s) from replacement`,
            data: { removed: result.affectedRows }
        });

    } catch (error) {
        console.error('Error removing students from replacement:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ========================================
// GET REPLACEMENT REPORT
// ========================================
router.get('/report', async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id, semester_id } = req.query;

        const query = `
            SELECT
                sub_orig.syllabus_code  AS original_code,
                sub_orig.subject_name   AS original_subject,
                sub_repl.syllabus_code  AS replacement_code,
                sub_repl.subject_name   AS replacement_subject,
                COUNT(ssr.student_id)   AS student_count,
                GROUP_CONCAT(sm.roll_number ORDER BY sm.roll_number SEPARATOR ', ') AS students
            FROM student_subject_replacement ssr
            INNER JOIN subject_master sub_orig ON ssr.original_subject_id = sub_orig.subject_id
            INNER JOIN subject_master sub_repl ON ssr.replacement_subject_id = sub_repl.subject_id
            INNER JOIN student_master sm ON ssr.student_id = sm.student_id
            WHERE ssr.programme_id = ?
            AND ssr.batch_id = ?
            AND ssr.branch_id = ?
            AND ssr.semester_id = ?
            AND ssr.is_active = 1
            GROUP BY ssr.original_subject_id, ssr.replacement_subject_id,
                     sub_orig.syllabus_code, sub_orig.subject_name,
                     sub_repl.syllabus_code, sub_repl.subject_name
            ORDER BY sub_orig.syllabus_code, sub_repl.syllabus_code
        `;

        const [report] = await promisePool.query(query, [
            programme_id, batch_id, branch_id, semester_id
        ]);

        res.json({ status: 'success', data: { report } });

    } catch (error) {
        console.error('Error generating replacement report:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ========================================
// INITIALIZE ROUTER
// ========================================
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

module.exports = { router, initializeRouter };
