module.exports = (promisePool) => {
    const express = require('express');
    const router = express.Router();

    // GET All Allotments
    router.get('/', async (req, res) => {
        try {
            const [rows] = await promisePool.query(`
            SELECT 
    a.allotment_id,

    a.programme_id,
    a.branch_id,
    a.semester_id,
    a.regulation_id,
    a.subject_id,
    a.batch_id,
    a.section_id,
    a.staff_id,

    s.syllabus_code,
    s.subject_name,
    b.batch_name,
    sec.section_name,
    CONCAT(br.branch_code, ' - ', st.employee_id, ' - ', st.full_name) AS faculty_name

FROM subject_faculty_allotment a
JOIN subject_master s ON a.subject_id = s.subject_id
JOIN batch_master b ON a.batch_id = b.batch_id
JOIN section_master sec ON a.section_id = sec.section_id
JOIN staff_master st ON a.staff_id = st.staff_id
JOIN branch_master br ON a.branch_id = br.branch_id

WHERE a.deleted_at IS NULL
ORDER BY a.allotment_id DESC
            `);

            res.json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // CREATE Allotment
    router.post('/', async (req, res) => {
        try {
            const {
                programme_id,
                branch_id,
                semester_id,
                regulation_id,
                subject_id,
                batch_id,
                section_id,
                staff_id
            } = req.body;

            await promisePool.query(`
                INSERT INTO subject_faculty_allotment
                (programme_id, branch_id, semester_id, regulation_id,
                 subject_id, batch_id, section_id, staff_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                programme_id, branch_id, semester_id, regulation_id,
                subject_id, batch_id, section_id, staff_id
            ]);

            res.json({ success: true, message: 'Allotment saved successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // UPDATE Allotment
router.put('/:id', async (req, res) => {
    try {
        const {
            programme_id,
            branch_id,
            semester_id,
            regulation_id,
            subject_id,
            batch_id,
            section_id,
            staff_id
        } = req.body;

        await promisePool.query(`
            UPDATE subject_faculty_allotment
            SET programme_id = ?,
                branch_id = ?,
                semester_id = ?,
                regulation_id = ?,
                subject_id = ?,
                batch_id = ?,
                section_id = ?,
                staff_id = ?
            WHERE allotment_id = ?
        `, [
            programme_id,
            branch_id,
            semester_id,
            regulation_id,
            subject_id,
            batch_id,
            section_id,
            staff_id,
            req.params.id
        ]);

        res.json({ success: true, message: 'Allotment updated successfully' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

    // DELETE
    router.delete('/:id', async (req, res) => {
        try {
            await promisePool.query(
                `UPDATE subject_faculty_allotment 
                 SET deleted_at = NOW() 
                 WHERE allotment_id = ?`,
                [req.params.id]
            );

            res.json({ success: true, message: 'Allotment deleted' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};



