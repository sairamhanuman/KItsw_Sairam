// ========================================
// ELECTIVE MAPPING ROUTES
// File: routes/elective-mapping.js
// ========================================

const express = require('express');
const router = express.Router();

let promisePool;


// ========================================
// GET GROUP-WISE ELECTIVE SUBJECTS
// ========================================
router.get('/group-wise-subjects', async (req, res) => {
    try {
        const { semester_id, programme_id, branch_id, regulation_id } = req.query;
        
        console.log('=== GET GROUP-WISE ELECTIVE SUBJECTS ===');
        console.log('Filters:', { semester_id, programme_id, branch_id, regulation_id });
        
        let query = `
            SELECT 
                subject_id,
                syllabus_code,
                subject_name,
                elective_name,
                semester_id,
                programme_id,
                branch_id,
                regulation_id,
                CASE 
                    WHEN elective_name = 'Open Elective' THEN 'Group 1'
                    WHEN elective_name = 'Open Elective-1' THEN 'Group 2'
                    WHEN elective_name = 'Open Elective-2' THEN 'Group 3'
                    WHEN elective_name = 'Open Elective-3' THEN 'Group 4'
                    WHEN elective_name = 'Open Elective-4' THEN 'Group 5'
                    WHEN elective_name = 'Professional Elective' THEN 'Group 6'
                    WHEN elective_name = 'Professional Elective-1' THEN 'Group 7'
                    WHEN elective_name = 'Professional Elective-2' THEN 'Group 8'
                    WHEN elective_name = 'Professional Elective-3' THEN 'Group 9'
                    WHEN elective_name = 'Professional Elective-4' THEN 'Group 10'
                    ELSE 'Other Groups'
                END as group_category,
                CASE 
                    WHEN elective_name = 'Open Elective' THEN 1
                    WHEN elective_name = 'Open Elective-1' THEN 2
                    WHEN elective_name = 'Open Elective-2' THEN 3
                    WHEN elective_name = 'Open Elective-3' THEN 4
                    WHEN elective_name = 'Open Elective-4' THEN 5
                    WHEN elective_name = 'Professional Elective' THEN 6
                    WHEN elective_name = 'Professional Elective-1' THEN 7
                    WHEN elective_name = 'Professional Elective-2' THEN 8
                    WHEN elective_name = 'Professional Elective-3' THEN 9
                    WHEN elective_name = 'Professional Elective-4' THEN 10
                    ELSE 11
                END as group_order
            FROM subject_master
            WHERE is_elective = 1 
            AND is_active = 1
        `;
        
        const params = [];
        
        // Dynamic filtering based on available parameters
        if (semester_id) {
            query += ` AND semester_id = ?`;
            params.push(semester_id);
        }
        
        if (programme_id) {
            query += ` AND programme_id = ?`;
            params.push(programme_id);
        }
        
        if (branch_id) {
            query += ` AND branch_id = ?`;
            params.push(branch_id);
        }
        
        if (regulation_id) {
            query += ` AND regulation_id = ?`;
            params.push(regulation_id);
        }
        
        query += ` ORDER BY group_order, elective_name`;
        
        console.log('Executing query:', query);
        console.log('With params:', params);
        
        const [subjects] = await promisePool.query(query, params);
        
        // Group by category
        const groups = {};
        subjects.forEach(subject => {
            const group = subject.group_category;
            if (!groups[group]) {
                groups[group] = {
                    name: group,
                    order: subject.group_order,
                    subjects: []
                };
            }
            groups[group].subjects.push(subject);
        });
        
        console.log(`Found ${Object.keys(groups).length} groups with ${subjects.length} subjects`);
        
        res.json({
            status: 'success',
            data: { groups },
            filters: { semester_id, programme_id, branch_id, regulation_id },
            total_subjects: subjects.length
        });
        
    } catch (error) {
        console.error('Error fetching group-wise elective subjects:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch group-wise elective subjects',
            error: error.message
        });
    }
});

// ========================================
// GET ELECTIVE SUBJECTS (Original - Keep for compatibility)
// ========================================
// Get all elective subjects for a semester
router.get('/elective-subjects', async (req, res) => {
    try {
        const { semester_id } = req.query;
        
        console.log('=== GET ELECTIVE SUBJECTS ===');
        console.log('Semester:', semester_id);
        
        let query = `
            SELECT 
                subject_id,
                syllabus_code,
                subject_name,
                subject_type,
                credits,
                semester_id
            FROM subject_master
            WHERE  is_elective = 1
            AND is_active = 1
        `;
        
        const params = [];
        
        if (semester_id) {
            query += ` AND semester_id = ?`;
            params.push(semester_id);
        }
        
        query += ` ORDER BY  syllabus_code`;
        
        const [subjects] = await promisePool.query(query, params);
        
        console.log(`Found ${subjects.length} elective subjects`);
        
        res.json({
            status: 'success',
            data: { subjects }
        });
        
    } catch (error) {
        console.error('Error fetching elective subjects:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch elective subjects',
            error: error.message
        });
    }
});

// ========================================
// GET AVAILABLE STUDENTS (Left Box)
// ========================================
// Students who are NOT yet mapped to the selected elective
router.get('/available-students', async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id, semester_id, subject_id } = req.query;
        
        console.log('=== GET AVAILABLE STUDENTS ===');
        console.log('Filters:', { programme_id, batch_id, branch_id, semester_id, subject_id });
        
    if (!programme_id || !batch_id || !branch_id || !semester_id || !subject_id) {
    return res.status(400).json({
        status: 'error',
        message: 'Programme, Batch, Branch, Semester and Subject are required'
    });
}
        // Get students who are NOT already mapped to this elective
        const query = `
            SELECT DISTINCT
                sm.student_id,
                sm.admission_number,
                sm.roll_number,
                sm.full_name,
                sm.gender,
                ssh.student_status,
                ssh.semester_id
            FROM student_master sm
            INNER JOIN student_semester_history ssh 
                ON sm.student_id = ssh.student_id
            WHERE ssh.programme_id = ?
            AND ssh.batch_id = ?
            AND ssh.branch_id = ?
            AND ssh.semester_id = ?
            AND ssh.student_status IN ('In Roll', 'Detained', 'Left', 'Completed', 'Dropout')
        AND sm.student_id NOT IN (
    SELECT sem.student_id 
    FROM student_elective_mapping sem
    INNER JOIN subject_master subm ON sem.subject_id = subm.subject_id
    WHERE sem.programme_id = ?
    AND sem.batch_id = ?
    AND sem.branch_id = ?
    AND sem.semester_id = ?
    AND sem.is_active = 1
    AND subm.elective_name = (
        SELECT elective_name 
        FROM subject_master 
        WHERE subject_id = ?
    )
)
            ORDER BY sm.roll_number
        `;
        
        const [students] = await promisePool.query(query, [
    programme_id,
    batch_id,
    branch_id,
    semester_id,
    programme_id,
    batch_id,
    branch_id,
    semester_id,
    subject_id      // ← NEW: to match elective_name of selected subject
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
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch available students',
            error: error.message
        });
    }
});

// ========================================
// GET MAPPED STUDENTS (Right Box)
// ========================================
// Students already mapped to the selected elective
router.get('/mapped-students', async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id, semester_id, subject_id } = req.query;
        
        console.log('=== GET MAPPED STUDENTS ===');
        
        if (!subject_id) {
            return res.json({
                status: 'success',
                data: { students: [], total: 0 }
            });
        }
        
        const query = `
            SELECT 
                sem.mapping_id,
                sem.student_id,
                sm.admission_number,
                sm.roll_number,
                sm.full_name,
                sm.gender,
                sem.elective_name,
                sem.mapped_date
            FROM student_elective_mapping sem
            INNER JOIN student_master sm ON sem.student_id = sm.student_id
            WHERE sem.subject_id = ?
            AND sem.programme_id = ?
            AND sem.batch_id = ?
            AND sem.branch_id = ?
            AND sem.semester_id = ?
            AND sem.is_active = 1
            ORDER BY sm.roll_number
        `;
        
        const [students] = await promisePool.query(query, [
            subject_id,
            programme_id,
            batch_id,
            branch_id,
            semester_id
        ]);
        
        console.log(`Found ${students.length} mapped students`);
        
        res.json({
            status: 'success',
            data: {
                students,
                total: students.length
            }
        });
        
    } catch (error) {
        console.error('Error fetching mapped students:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch mapped students',
            error: error.message
        });
    }
});

// ========================================
// ADD STUDENTS TO ELECTIVE (Left → Right)
// ========================================
router.post('/add-students', async (req, res) => {
    try {
        const {
            student_ids,
            programme_id,
            batch_id,
            branch_id,
            semester_id,
            subject_id,
            academic_year
        } = req.body;
        
        console.log('=== ADD STUDENTS TO ELECTIVE ===');
        console.log('Adding', student_ids.length, 'students to subject', subject_id);
        
        if (!student_ids || student_ids.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No students selected'
            });
        }
        
        if (!subject_id || !programme_id || !batch_id || !branch_id || !semester_id) {
            return res.status(400).json({
                status: 'error',
                message: 'All fields are required'
            });
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
                        `SELECT mapping_id FROM student_elective_mapping 
                         WHERE student_id = ? AND subject_id = ? AND semester_id = ? AND is_active = 1`,
                        [student_id, subject_id, semester_id]
                    );
                    
                    if (existing.length > 0) {
                        skipped++;
                        continue;
                    }
                    
                    // Insert mapping
               await connection.query(
    `INSERT INTO student_elective_mapping 
    (student_id, programme_id, batch_id, branch_id, semester_id, subject_id, elective_name, academic_year, is_active)
    SELECT ?, ?, ?, ?, ?, ?, elective_name, ?, 1
    FROM subject_master 
    WHERE subject_id = ?`,
    [student_id, programme_id, batch_id, branch_id, semester_id, subject_id, academic_year || null, subject_id]
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
                message: `Successfully added ${added} student(s) to elective`,
                data: {
                    added,
                    skipped,
                    errors
                }
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Error adding students to elective:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to add students to elective',
            error: error.message
        });
    }
});

// ========================================
// REMOVE STUDENTS FROM ELECTIVE (Right → Left)
// ========================================
router.post('/remove-students', async (req, res) => {
    try {
        const { student_ids, subject_id, semester_id } = req.body;
        
        console.log('=== REMOVE STUDENTS FROM ELECTIVE ===');
      
        if (!student_ids || student_ids.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No students selected'
            });
        }
          console.log('Removing', student_ids.length, 'students from subject', subject_id);
        
        const placeholders = student_ids.map(() => '?').join(',');
        
        const [result] = await promisePool.query(
            `UPDATE student_elective_mapping 
             SET is_active = 0 
             WHERE student_id IN (${placeholders})
             AND subject_id = ?
             AND semester_id = ?
             AND is_active = 1`,
            [...student_ids, subject_id, semester_id]
        );
        
        console.log(`✅ Removed ${result.affectedRows} students`);
        
        res.json({
            status: 'success',
            message: `Successfully removed ${result.affectedRows} student(s) from elective`,
            data: {
                removed: result.affectedRows
            }
        });
        
    } catch (error) {
        console.error('Error removing students from elective:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to remove students from elective',
            error: error.message
        });
    }
});

// ========================================
// GET ELECTIVE MAPPING REPORT
// ========================================
router.get('/report', async (req, res) => {
    try {
        const { programme_id, batch_id, branch_id, semester_id } = req.query;
        
        const query = `
            SELECT 
                subm.syllabus_code,
                subm.subject_name,
                COUNT(sem.student_id) as student_count,
                GROUP_CONCAT(sm.roll_number ORDER BY sm.roll_number SEPARATOR ', ') as students
            FROM subject_master subm
            LEFT JOIN student_elective_mapping sem 
                ON subm.subject_id = sem.subject_id
                AND sem.is_active = 1
                AND sem.programme_id = ?
                AND sem.batch_id = ?
                AND sem.branch_id = ?
                AND sem.semester_id = ?
            LEFT JOIN student_master sm ON sem.student_id = sm.student_id
            WHERE subm.is_elective = 1
            AND subm.is_active = 1
            GROUP BY subm.subject_id, subm.syllabus_code, subm.subject_name
            ORDER BY subm.syllabus_code
        `;
        
        const [report] = await promisePool.query(query, [
            programme_id,
            batch_id,
            branch_id,
            semester_id
        ]);
        
        res.json({
            status: 'success',
            data: { report }
        });
        
    } catch (error) {
        console.error('Error generating elective mapping report:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate report',
            error: error.message
        });
    }
});

// Initialize router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

module.exports = { router, initializeRouter };
